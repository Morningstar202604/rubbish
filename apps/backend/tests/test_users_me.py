"""User self-management endpoints: GET/PATCH /users/me, password change."""

from __future__ import annotations

import pytest
from conftest import FakeEmailSender, auth_headers
from httpx import AsyncClient


@pytest.fixture(autouse=True)
def _clear_outbox(fake_email_sender: FakeEmailSender) -> None:
    """Registration itself may queue mail; start each test with an empty outbox."""
    fake_email_sender.reset()


@pytest.mark.asyncio
async def test_get_me_returns_current_profile(client: AsyncClient, test_user: dict) -> None:
    r = await client.get("/api/users/me", headers=auth_headers(test_user))
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "testuser"
    assert body["email"] == "user@example.com"


@pytest.mark.asyncio
async def test_get_me_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/users/me")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_update_username(client: AsyncClient, test_user: dict) -> None:
    r = await client.patch(
        "/api/users/me", json={"username": "renamed-user"}, headers=auth_headers(test_user)
    )
    assert r.status_code == 200
    assert r.json()["username"] == "renamed-user"

    login = await client.post(
        "/api/auth/login", json={"username": "renamed-user", "password": "password123"}
    )
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_update_email_resets_verification_and_sends_email(
    client: AsyncClient,
    test_user: dict,
    fake_email_sender: FakeEmailSender,
) -> None:
    r = await client.patch(
        "/api/users/me",
        json={"email": "new-address@example.com"},
        headers=auth_headers(test_user),
    )
    assert r.status_code == 200
    assert r.json()["email"] == "new-address@example.com"
    assert fake_email_sender.outbox, "email change should trigger a verification email"


@pytest.mark.asyncio
async def test_update_email_send_failure_is_swallowed(
    client: AsyncClient,
    test_user: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api import auth as auth_module

    async def boom(user: object) -> None:
        raise RuntimeError("smtp down")

    monkeypatch.setattr(auth_module, "_send_verification_email", boom)
    r = await client.patch(
        "/api/users/me",
        json={"email": "quiet-change@example.com"},
        headers=auth_headers(test_user),
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_update_same_email_skips_verification_send(
    client: AsyncClient,
    test_user: dict,
    fake_email_sender: FakeEmailSender,
) -> None:
    fake_email_sender.reset()
    r = await client.patch(
        "/api/users/me", json={"email": "user@example.com"}, headers=auth_headers(test_user)
    )
    assert r.status_code == 200
    assert fake_email_sender.outbox == []


@pytest.mark.asyncio
async def test_update_duplicate_email_conflicts(client: AsyncClient, test_user: dict) -> None:
    register = await client.post(
        "/api/auth/register",
        json={
            "email": "occupied@example.com",
            "username": "occupied",
            "password": "password123",
        },
    )
    assert register.status_code in (200, 201)

    r = await client.patch(
        "/api/users/me", json={"email": "occupied@example.com"}, headers=auth_headers(test_user)
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_disable_own_account_blocks_token(client: AsyncClient, test_user: dict) -> None:
    r = await client.patch(
        "/api/users/me", json={"is_active": False}, headers=auth_headers(test_user)
    )
    assert r.status_code == 200
    assert r.json()["is_active"] is False

    after = await client.get("/api/users/me", headers=auth_headers(test_user))
    assert after.status_code in (401, 403)


@pytest.mark.asyncio
async def test_change_password_wrong_old_password(client: AsyncClient, test_user: dict) -> None:
    r = await client.post(
        "/api/users/me/password",
        json={"old_password": "totally-wrong", "new_password": "NewPass12345"},
        headers=auth_headers(test_user),
    )
    assert r.status_code == 401
    assert "incorrect" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_change_password_success_invalidates_tokens(
    client: AsyncClient, test_user: dict
) -> None:
    r = await client.post(
        "/api/users/me/password",
        json={"old_password": "password123", "new_password": "NewPass12345"},
        headers=auth_headers(test_user),
    )
    assert r.status_code == 204

    # token_version bump: outstanding access token no longer authenticates.
    me = await client.get("/api/users/me", headers=auth_headers(test_user))
    assert me.status_code == 401

    relogin = await client.post(
        "/api/auth/login", json={"username": "testuser", "password": "NewPass12345"}
    )
    assert relogin.status_code == 200
