"""Submission API routes — 文件上传与下载（作者/编辑/审稿人）。

从 routes.py（52KB 单文件）拆出。router 来自 routes.py，本模块在其上
追加端点；注册顺序见 routes.py 文件末尾的底部 import。
"""

from __future__ import annotations

import mimetypes
import os
from uuid import uuid4

from fastapi import Depends, File, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ROLE_EDITOR, get_current_user, user_has_role
from app.core.db import get_db
from app.core.storage import get_storage
from app.models import User
from app.modules.review.models import ReviewAssignment
from app.modules.submission._helpers import (
    _get_or_404,
    _to_response,
    _try_delete_storage,
)
from app.modules.submission.routes import router
from app.modules.submission.schemas import SubmissionResponse

_ALLOWED_UPLOAD_MIMES = frozenset(
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/postscript",
        "text/plain",
        "application/zip",
    }
)
_MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post(
    "/{submission_id}/files",
    response_model=SubmissionResponse,
)
async def upload_submission_file(
    submission_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    """作者上传稿件 PDF（替换式：重复上传会覆盖 file_path）。

    限制：
    - 仅作者本人
    - submission 必须处于 pending / under_review / major_revision / minor_revision
      （under_review 允许是为了让编辑要求作者替换稿件时仍能上传）
    - accepted / rejected 终态下不可上传
    - MIME 必须在白名单内
    - 大小 ≤ 50 MB
    - 文件名经过 path 安全检查（防 ../ 穿越）
    """
    entry = await _get_or_404(db, submission_id)
    if entry.submitted_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the submitter can upload files",
        )
    if entry.status not in (
        "pending",
        "under_review",
        "major_revision",
        "minor_revision",
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot upload files in status '{entry.status}'",
        )
    if file.content_type not in _ALLOWED_UPLOAD_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}",
        )

    # 流式读 + 大小校验，避免一次性 OOM
    contents = b""
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        contents += chunk
        if len(contents) > _MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds {_MAX_UPLOAD_BYTES} bytes",
            )

    # 存储 key：{tenant_id}/{submission_id}/{uuid}{ext}
    # 用 uuid 防文件名碰撞 + 路径穿越；本地/S3 后端共用同一 key 形状，
    # 切换后端无需迁移数据库。
    original_filename = file.filename or "upload"
    ext = os.path.splitext(original_filename)[1]
    if ext and len(ext) > 20:
        ext = ext[:20]
    safe_name = f"{uuid4().hex}{ext}"
    rel_path = f"{entry.tenant_id}/{entry.id}/{safe_name}"
    old_path = entry.file_path  # 可能为 None（首次上传）
    if old_path == rel_path:  # uuid 碰撞极不可能，但保险起见跳过自删
        old_path = None
    await get_storage().save(rel_path, contents, content_type=file.content_type)
    entry.file_path = rel_path
    await db.commit()
    await db.refresh(entry)
    # 替换式上传会覆盖 file_path，被替换的旧文件若不清会被丢成孤儿对象。
    await _try_delete_storage(old_path)
    return _to_response(entry)


@router.get("/{submission_id}/files")
async def download_submission_file(
    submission_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """下载稿件文件。

    这里补上了此前缺失的链路终点：稿件此前只能上传、无法取回，
    编辑与被指派的审稿人拿不到作者的 PDF，评审无从谈起。

    可访问方：
    - 作者本人
    - admin / editor
    - 该稿件的被指派审稿人（assignment 处于 pending/accepted/completed）

    S3 后端会尽量返回 302 预签名直链（省一次服务端带宽）；本地后端
    与预签名失败时改为服务端流式返回，权限校验始终发生在这里。
    """
    entry = await _get_or_404(db, submission_id)
    if not entry.file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This submission has no uploaded file",
        )

    allowed = entry.submitted_by == current_user.id or await user_has_role(
        db, current_user, ROLE_EDITOR
    )
    if not allowed:
        assignment = (
            (
                await db.execute(
                    select(ReviewAssignment).where(
                        ReviewAssignment.submission_id == entry.id,
                        ReviewAssignment.reviewer_id == current_user.id,
                        ReviewAssignment.status.in_(("pending", "accepted", "completed")),
                    )
                )
            )
            .scalars()
            .first()
        )
        allowed = assignment is not None
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this submission file",
        )

    # 双盲评审：原始上传文件不能交给审稿人。
    #
    # 修复前，双盲只在 JSON 字段上做抹除（authors/邮箱/submitted_by/venue/doi），
    # 文件下载端点却把**原始 PDF** 直接返回给被指派的审稿人——标题页和 PDF
    # 元数据里就是作者姓名与单位，双盲在核心流程上等于不存在。
    #
    # 第二层修复（双盲绕过 v2）：重定向目标曾用 ``download_url``，但该字段
    # **作者可控**（创建端点与作者编辑端点均可写）——作者填一条带身份的
    # URL 即可直穿双盲（重定向目标对审稿人可见，页面内容更可直接暴露身份）。
    # 现在只放行编辑端点写入的 ``anonymized_file_url``；没有匿名稿则明确报错，
    # 由编辑补上传。服务端不具备剥离 PDF 元数据的能力，不假装能做到。
    is_privileged = entry.submitted_by == current_user.id or await user_has_role(
        db, current_user, ROLE_EDITOR
    )
    if not is_privileged:
        # 函数级导入：blinding 模块读取设置，保持与原实现一致的加载时机，
        # 规避潜在的模块环。
        from app.modules.review.blinding import get_review_mode

        mode = await get_review_mode(db, entry.tenant_id)
        if mode == "double_blind":
            anon_url = (entry.anonymized_file_url or "").strip()
            if anon_url.lower().startswith(("http://", "https://")):
                return RedirectResponse(anon_url, status_code=status.HTTP_302_FOUND)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Double-blind review is enabled: the original manuscript may reveal "
                    "author identity. Ask the editor to provide an anonymized version "
                    "(editor: PUT /api/submissions/{id}/anonymized-file) before reviewing."
                ),
            )

    storage = get_storage()
    url = storage.presigned_url(entry.file_path)
    if url:
        # S3 预签名 URL 直接重定向到对象存储；对象存储自身会依据客户端的
        # Range 头返回 206，无需在此追加（追加未签名的 range 参数会让
        # SigV4 签名失效，导致 SignatureDoesNotMatch → 403）。
        return RedirectResponse(url, status_code=status.HTTP_302_FOUND)

    try:
        data = await storage.load(entry.file_path)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored file is missing",
        ) from exc

    filename = entry.file_path.rsplit("/", 1)[-1]
    media_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    # F9: HTTP Range 支持（本地后端）。解析 Range: bytes=start-end，
    # 返回 206 Partial Content + Content-Range 头。若 Range 非法或缺失，
    # 退回 200 全量流式。
    range_header = request.headers.get("Range")
    if range_header and range_header.startswith("bytes="):
        spec = range_header[len("bytes=") :]
        try:
            if "-" in spec:
                start_s, end_s = spec.split("-", 1)
                start = int(start_s) if start_s else 0
                end = int(end_s) if end_s else len(data) - 1
            else:
                start = int(spec)
                end = len(data) - 1
            start = max(start, 0)
            end = min(end, len(data) - 1)
            if start > end or start >= len(data):
                raise ValueError("invalid range")
            chunk = data[start : end + 1]
            return Response(
                content=chunk,
                status_code=status.HTTP_206_PARTIAL_CONTENT,
                media_type=media_type,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{len(data)}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(len(chunk)),
                    "Content-Disposition": f'attachment; filename="{filename}"',
                },
            )
        except (ValueError, IndexError):
            # 非法 Range → 退回全量 200（不报错）
            pass

    return StreamingResponse(
        iter((data,)),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Accept-Ranges": "bytes",
        },
    )
