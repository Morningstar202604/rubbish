"""Email delivery layer.

Design goals (0.8.0):

- **Fill-in-the-code ready**: with SMTP credentials present in the env, mail
  works with no code change; without them, everything degrades silently to
  the console sender so registration/login flows never break.
- **Non-blocking**: ``smtplib`` is synchronous, so every send is offloaded to
  a worker thread (``asyncio.to_thread``). A slow relay can never stall the
  request that triggered it.
- **Retry with backoff**: transient network errors are retried
  ``email_smtp_retries`` times (default 2) with exponential backoff.
- **HTML + text**: every message carries both parts; the HTML shell is the
  same editorial card used on the site (no external assets, inline CSS).
- **Testable**: ``EmailSender`` is a Protocol; tests swap in a fake via
  ``app.core.email._sender`` or ``reset_email_sender()``.

Providers: Mailgun / SendGrid / SES / Postmark / QQ 邮箱 / 163 / 腾讯企业邮 all
speak SMTP, so one backend covers them. Ports: 465 = implicit TLS
(``email_smtp_use_tls=true``), 587 = STARTTLS (``use_tls=false`` +
``starttls=true``), 25 = plain (not recommended).
"""

from __future__ import annotations

import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from typing import Protocol, runtime_checkable

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("rubbish.email")


@runtime_checkable
class EmailSender(Protocol):
    """Send a transactional email to one recipient."""

    async def send(
        self,
        *,
        to: str,
        subject: str,
        body: str,
        html: str | None = None,
    ) -> None: ...


class ConsoleEmailSender:
    """Dev / test sender — writes the message to the log stream."""

    async def send(
        self,
        *,
        to: str,
        subject: str,
        body: str,
        html: str | None = None,
    ) -> None:
        logger.info(
            "email_sent_console",
            to=to,
            subject=subject,
            body_preview=body[:200],
        )


class SMTPEmailSender:
    """SMTP relay sender with timeout, retry and thread offloading."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        from_addr: str,
        from_name: str = "Rubbish",
        use_tls: bool = True,
        starttls: bool = False,
        timeout: int = 15,
        retries: int = 2,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._from_addr = from_addr
        self._from_name = from_name
        self._use_tls = use_tls
        self._starttls = starttls
        self._timeout = timeout
        self._retries = retries

    def _build_message(self, to: str, subject: str, body: str, html: str | None) -> EmailMessage:
        msg = EmailMessage()
        msg["From"] = (
            f"{self._from_name} <{self._from_addr}>" if self._from_name else self._from_addr
        )
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        if html is not None:
            msg.add_alternative(html, subtype="html")
        return msg

    def _send_sync(self, msg: EmailMessage) -> None:
        """Blocking SMTP round-trip (runs inside a worker thread)."""
        if self._use_tls:
            client: smtplib.SMTP = smtplib.SMTP_SSL(
                self._host,
                self._port,
                timeout=self._timeout,
                context=ssl.create_default_context(),
            )
        else:
            client = smtplib.SMTP(self._host, self._port, timeout=self._timeout)
        with client:
            if not self._use_tls and self._starttls:
                client.starttls(context=ssl.create_default_context())
            if self._username and self._password:
                client.login(self._username, self._password)
            client.send_message(msg)

    async def send(
        self,
        *,
        to: str,
        subject: str,
        body: str,
        html: str | None = None,
    ) -> None:
        msg = self._build_message(to, subject, body, html)
        last_error: Exception | None = None
        for attempt in range(self._retries + 1):
            try:
                await asyncio.to_thread(self._send_sync, msg)
                logger.info("email_sent_smtp", to=to, subject=subject, attempt=attempt + 1)
                return
            except (OSError, smtplib.SMTPException) as exc:
                last_error = exc
                logger.warning(
                    "email_smtp_attempt_failed",
                    to=to,
                    attempt=attempt + 1,
                    retries=self._retries,
                    error=str(exc)[:200],
                )
                if attempt < self._retries:
                    await asyncio.sleep(2**attempt)
        logger.error("email_smtp_gave_up", to=to, subject=subject, error=str(last_error)[:200])
        raise last_error if last_error else RuntimeError("smtp send failed")


_sender: EmailSender | None = None


def smtp_configured() -> bool:
    """True when the operator has supplied enough env for real delivery."""
    return bool(
        settings.email_backend == "smtp"
        and settings.email_smtp_host
        and settings.email_from_address
    )


def get_email_sender() -> EmailSender:
    """Return the configured sender (lazily constructed, test-swappable)."""
    global _sender
    if _sender is not None:
        return _sender

    if settings.email_backend == "console" or settings.environment == "test":
        _sender = ConsoleEmailSender()
        return _sender

    if settings.email_backend == "smtp":
        if not settings.email_smtp_host or not settings.email_from_address:
            logger.warning(
                "email_smtp_misconfigured_fallback_to_console",
                reason="missing host or from_address",
            )
            _sender = ConsoleEmailSender()
            return _sender

        _sender = SMTPEmailSender(
            host=settings.email_smtp_host,
            port=settings.email_smtp_port,
            username=settings.email_smtp_username,
            password=settings.email_smtp_password,
            from_addr=settings.email_from_address,
            from_name=settings.email_from_name,
            use_tls=settings.email_smtp_use_tls,
            starttls=settings.email_smtp_starttls,
            timeout=settings.email_smtp_timeout,
            retries=settings.email_smtp_retries,
        )
        return _sender

    logger.warning("email_unknown_backend_fallback_to_console", backend=settings.email_backend)
    _sender = ConsoleEmailSender()
    return _sender


def reset_email_sender() -> None:
    """Test helper: clear the cached sender so the next call re-reads settings."""
    global _sender
    _sender = None


async def verify_smtp_connection() -> tuple[bool, str]:
    """Startup/ops self-check: open a connection and (if creds exist) log in.

    Returns ``(ok, detail)``. Never raises — callers log the result.
    With the console backend this returns ``(False, "console backend")``.
    """
    if not smtp_configured():
        return False, "SMTP 未配置（email_backend=console 或缺少 host/from）"
    try:
        await asyncio.to_thread(_probe_smtp)
        return True, f"{settings.email_smtp_host}:{settings.email_smtp_port} 连接成功"
    except Exception as exc:
        return False, f"连接失败：{str(exc)[:160]}"


def _probe_smtp() -> None:
    if settings.email_smtp_use_tls:
        client: smtplib.SMTP = smtplib.SMTP_SSL(
            settings.email_smtp_host,
            settings.email_smtp_port,
            timeout=settings.email_smtp_timeout,
            context=ssl.create_default_context(),
        )
    else:
        client = smtplib.SMTP(
            settings.email_smtp_host, settings.email_smtp_port, timeout=settings.email_smtp_timeout
        )
    with client:
        if not settings.email_smtp_use_tls and settings.email_smtp_starttls:
            client.starttls(context=ssl.create_default_context())
        if settings.email_smtp_username and settings.email_smtp_password:
            client.login(settings.email_smtp_username, settings.email_smtp_password)
        client.noop()
