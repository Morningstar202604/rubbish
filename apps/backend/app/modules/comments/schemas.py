"""Pydantic schemas for the comments module."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.core.schemas import PaginationMeta


class CommentCreate(BaseModel):
    """Body for POST /comments."""

    resource_id: int = Field(ge=1)
    body: str = Field(min_length=1, max_length=1000)


class CommentResponse(BaseModel):
    """One comment row as shown in the public thread."""

    id: int
    resource_id: int
    user_id: int
    author_name: str
    body: str
    created_at: datetime


class CommentListResponse(BaseModel):
    data: list[CommentResponse]
    meta: PaginationMeta
