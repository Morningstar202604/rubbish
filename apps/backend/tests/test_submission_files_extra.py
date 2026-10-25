"""Edge paths of the submission file endpoints: size limit, Range, redirects."""

from __future__ import annotations

import pytest
from conftest import auth_headers
from httpx import AsyncClient

_PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"


async def _create_submission(client: AsyncClient, token: str) -> int:
    r = await client.post(
        "/api/submissions",
        json={
            "title": "Files Edge Cases",
            "type": "paper",
            "authors": ["边界作者"],
            "year": 2026,
            "discipline": "计算机科学",
            "abstract": "用于验证文件端点边界行为。",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    return r.json()["id"]


async def _upload(
    client: AsyncClient,
    token: str,
    sid: int,
    content: bytes = _PDF,
    name: str = "paper.pdf",
    mime: str = "application/pdf",
):
    return await client.post(
        f"/api/submissions/{sid}/files",
        files={"file": (name, content, mime)},
        headers={"Authorization": f"Bearer {token}"},
    )


@pytest.mark.asyncio
async def test_upload_rejects_oversize_file(
    client: AsyncClient, test_user: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.modules.submission import routes_files

    monkeypatch.setattr(routes_files, "_MAX_UPLOAD_BYTES", 256)
    sid = await _create_submission(client, test_user["token"])
    r = await _upload(client, test_user["token"], sid, content=b"x" * 1024)
    assert r.status_code == 413


@pytest.mark.asyncio
async def test_upload_truncates_overlong_extension(client: AsyncClient, test_user: dict) -> None:
    sid = await _create_submission(client, test_user["token"])
    r = await _upload(
        client,
        test_user["token"],
        sid,
        name=f"paper.{'a' * 30}",
        mime="text/plain",
        content=b"plain text body",
    )
    assert r.status_code == 200
    file_path = r.json().get("file_path") or ""
    suffix = file_path.rsplit(".", 1)[1]
    # ext is truncated to 20 chars including the leading dot.
    assert len(suffix) == 19 and set(suffix) == {"a"}


@pytest.mark.asyncio
async def test_download_returns_206_for_valid_range(client: AsyncClient, test_user: dict) -> None:
    sid = await _create_submission(client, test_user["token"])
    up = await _upload(client, test_user["token"], sid)
    assert up.status_code == 200

    r = await client.get(
        f"/api/submissions/{sid}/files",
        headers={**auth_headers(test_user), "Range": "bytes=0-3"},
    )
    assert r.status_code == 206
    assert r.headers["Content-Range"].startswith("bytes 0-3/")
    assert r.headers["Accept-Ranges"] == "bytes"
    assert len(r.content) == 4


@pytest.mark.asyncio
async def test_download_open_ended_range(client: AsyncClient, test_user: dict) -> None:
    sid = await _create_submission(client, test_user["token"])
    await _upload(client, test_user["token"], sid)

    r = await client.get(
        f"/api/submissions/{sid}/files",
        headers={**auth_headers(test_user), "Range": "bytes=2-"},
    )
    assert r.status_code == 206
    assert r.headers["Content-Range"].startswith("bytes 2-")


@pytest.mark.asyncio
async def test_download_invalid_range_falls_back_to_200(
    client: AsyncClient, test_user: dict
) -> None:
    sid = await _create_submission(client, test_user["token"])
    await _upload(client, test_user["token"], sid)

    r = await client.get(
        f"/api/submissions/{sid}/files",
        headers={**auth_headers(test_user), "Range": "bytes=99999-"},
    )
    assert r.status_code == 200
    assert len(r.content) == len(_PDF)


@pytest.mark.asyncio
async def test_download_presigned_redirect(
    client: AsyncClient, test_user: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.storage import get_storage

    sid = await _create_submission(client, test_user["token"])
    await _upload(client, test_user["token"], sid)

    monkeypatch.setattr(
        get_storage(), "presigned_url", lambda path: f"https://s3.example.com/{path}"
    )
    r = await client.get(f"/api/submissions/{sid}/files", headers=auth_headers(test_user))
    assert r.status_code == 302
    assert r.headers["location"].startswith("https://s3.example.com/")


@pytest.mark.asyncio
async def test_download_missing_storage_file_404(
    client: AsyncClient, test_user: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.storage import get_storage

    sid = await _create_submission(client, test_user["token"])
    await _upload(client, test_user["token"], sid)

    async def missing(path: str) -> bytes:
        raise FileNotFoundError(path)

    monkeypatch.setattr(get_storage(), "load", missing)
    r = await client.get(f"/api/submissions/{sid}/files", headers=auth_headers(test_user))
    assert r.status_code == 404
