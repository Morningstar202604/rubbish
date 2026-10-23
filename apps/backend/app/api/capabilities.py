"""Public capability probe.

The SPA needs to know which operator-level integrations are actually
live before it writes copy that promises them. The canonical example is
transactional email: with the console backend a verification or reset
mail is only written to the server log, so the UI must not tell the user
to check their inbox. Everything returned here is non-sensitive.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.core.email import ConsoleEmailSender, get_email_sender

router = APIRouter(prefix="/capabilities", tags=["public"])


class CapabilitiesResponse(BaseModel):
    email_backend: str
    email_delivery: bool
    email_verification_required: bool
    oidc_enabled: bool
    registration_open: bool


@router.get("", response_model=CapabilitiesResponse)
async def get_capabilities() -> CapabilitiesResponse:
    """Return feature availability the frontend may safely advertise.

    Delivery is judged by the *actual* sender in use, not by the settings
    string: the E2E harness swaps in an in-memory sender while leaving
    ``email_backend=console`` untouched, and production falls back to
    console when SMTP is half-configured. Either way the console sender
    means "nothing leaves this process".
    """
    sender = get_email_sender()
    delivers = not isinstance(sender, ConsoleEmailSender)
    return CapabilitiesResponse(
        email_backend=settings.email_backend,
        email_delivery=delivers,
        # Registration currently issues tokens immediately; verification is
        # recorded but never gates access, so the UI must not block on it.
        email_verification_required=False,
        oidc_enabled=settings.oidc_enabled,
        registration_open=True,
    )


__all__ = ["CapabilitiesResponse", "router"]
