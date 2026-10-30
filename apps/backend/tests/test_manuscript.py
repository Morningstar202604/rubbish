"""在线阅读 Markdown 稿件：转换服务 + /catalog/{id}/manuscript 端点。"""

from __future__ import annotations

import io
import zipfile

import pymupdf
import pytest
from httpx import AsyncClient

from app.modules.submission.manuscript import convert_to_markdown, markdown_storage_key
from tests.test_catalog import _SAMPLE


def _make_pdf(text: str = "奶蛙叙事的演化路径考察") -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 100), text, fontname="china-s")
    data = doc.tobytes()
    doc.close()
    return data


def _make_pdf_with_image(text: str = "含图论文") -> bytes:
    """含位图的 PDF：pymupdf4llm 会抽取图片并在 Markdown 里留文件引用。"""
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 100), text, fontname="china-s")
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 120, 80), False)
    pix.clear_with(200)
    page.insert_image(pymupdf.Rect(72, 140, 300, 260), pixmap=pix)
    data = doc.tobytes()
    doc.close()
    return data


def _make_docx(text: str = "排队论建模的实证研究") -> bytes:
    """最小可解析 docx（mammoth 只需 document.xml 的段落文本）。"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>",
        )
        zf.writestr(
            "word/document.xml",
            '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            f"<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>",
        )
    return buf.getvalue()


# ---------------------------------------------------------------------------
# 转换服务
# ---------------------------------------------------------------------------


def test_convert_pdf_extracts_text() -> None:
    md = convert_to_markdown(_make_pdf(), "thesis.pdf")
    assert md is not None
    assert "奶蛙叙事" in md


def test_convert_pdf_images_are_inlined_as_data_uri() -> None:
    """回归：Windows 下 pymupdf4llm 产出 `![](C:/.../rubbish-md-xxx/-0001-00.png)`
    绝对路径，旧实现按相对文件名匹配，图片全部落空（data URI 0 个、阅读器空图）。
    1.6.0 起默认输出 JPEG，故只断言 data URI 而非具体格式。"""
    md = convert_to_markdown(_make_pdf_with_image(), "with-image.pdf")
    assert md is not None
    assert "data:image/" in md
    assert ";base64," in md
    assert "rubbish-md-" not in md
    assert "C:/" not in md


def test_convert_docx_extracts_text() -> None:
    md = convert_to_markdown(_make_docx(), "thesis.docx")
    assert md is not None
    assert "排队论建模" in md


def test_convert_unsupported_returns_none() -> None:
    assert convert_to_markdown(b"PK\x03\x04 zip bytes", "attachment.zip") is None
    assert convert_to_markdown(b"\xd0\xcf\x11\xe0 legacy doc", "legacy.doc") is None


def test_convert_corrupt_pdf_fails_closed() -> None:
    assert convert_to_markdown(b"%PDF-1.4 not really a pdf", "broken.pdf") is None


def test_markdown_storage_key_pairs_with_file() -> None:
    assert markdown_storage_key("tenant/3/abc.pdf") == "tenant/3/abc.md"
    assert markdown_storage_key("tenant/3/abc") == "tenant/3/abc.md"


# ---------------------------------------------------------------------------
# 端点：上传 → 转换 → 录用刊出 → 匿名可读
# ---------------------------------------------------------------------------


async def _author_submit_with_docx(client: AsyncClient, test_user: dict) -> int:
    r = await client.post(
        "/api/submissions",
        json={
            "title": "Markdown 稿件流程验证",
            "type": "paper",
            "authors": ["流程作者"],
            "year": 2026,
            "discipline": "计算机科学",
            "abstract": "用于验证 markdown 转换链路。",
        },
        headers={"Authorization": f"Bearer {test_user['token']}"},
    )
    assert r.status_code == 201
    sid = r.json()["id"]
    up = await client.post(
        f"/api/submissions/{sid}/files",
        files={
            "file": (
                "thesis.docx",
                _make_docx(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        headers={"Authorization": f"Bearer {test_user['token']}"},
    )
    assert up.status_code == 200, up.text[:200]
    return sid


async def test_upload_converts_docx_to_markdown(client: AsyncClient, test_user: dict) -> None:
    sid = await _author_submit_with_docx(client, test_user)
    mine = await client.get(
        "/api/submissions/me", headers={"Authorization": f"Bearer {test_user['token']}"}
    )
    entry = next(s for s in mine.json()["data"] if s["id"] == sid)
    assert entry["markdown_path"]


async def test_manuscript_public_after_publish(
    client: AsyncClient, test_user: dict, admin_user: dict
) -> None:
    sid = await _author_submit_with_docx(client, test_user)
    d = await client.patch(
        f"/api/submissions/{sid}/decision",
        json={"decision": "accept"},
        headers={"Authorization": f"Bearer {admin_user['token']}"},
    )
    assert d.status_code == 200
    rid = d.json().get("resource_id")
    assert rid

    anon = await client.get(f"/api/catalog/{rid}/manuscript")
    assert anon.status_code == 200
    assert anon.headers["content-type"].startswith("text/markdown")
    assert "排队论建模" in anon.text

    detail = (await client.get(f"/api/catalog/{rid}")).json()
    assert detail["has_markdown"] is True
    assert detail["has_file"] is True


@pytest.mark.parametrize("status_value", ["draft", "in_review"])
async def test_manuscript_hidden_for_unpublished(
    client: AsyncClient, admin_user: dict, status_value: str
) -> None:
    """未刊稿的 md 与 PDF 同边界：对无权限者 404。"""
    r = await client.post(
        "/api/catalog",
        json={
            **_SAMPLE,
            "title": f"Manuscript Hidden {status_value}",
            "publication_status": status_value,
        },
        headers={"Authorization": f"Bearer {admin_user['token']}"},
    )
    rid = r.json()["id"]
    anon = await client.get(f"/api/catalog/{rid}/manuscript")
    assert anon.status_code == 404


async def test_manuscript_404_when_no_submission_file(
    client: AsyncClient, admin_user: dict
) -> None:
    r = await client.post(
        "/api/catalog",
        json={**_SAMPLE, "title": "No Manuscript Here"},
        headers={"Authorization": f"Bearer {admin_user['token']}"},
    )
    rid = r.json()["id"]
    assert (await client.get(f"/api/catalog/{rid}/manuscript")).status_code == 404


async def test_list_has_markdown_flag(
    client: AsyncClient, test_user: dict, admin_user: dict
) -> None:
    sid = await _author_submit_with_docx(client, test_user)
    d = await client.patch(
        f"/api/submissions/{sid}/decision",
        json={"decision": "accept"},
        headers={"Authorization": f"Bearer {admin_user['token']}"},
    )
    rid = d.json()["resource_id"]
    listing = (await client.get("/api/catalog?page_size=50")).json()
    flags = {item["id"]: item["has_markdown"] for item in listing["data"]}
    assert flags[rid] is True
