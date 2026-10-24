"""SQLAlchemy models for the comments module.

``comments`` — reader comments on published resources. Tenant-scoped
with RLS (migration 007). The user FK points at the core ``users``
table; the resource FK at the catalog ``resources`` table — both
inherit from the shared core ``Base`` so cross-module FKs resolve
without metadata gymnastics.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.time import utcnow
from app.models import Base, TenantScopedMixin


class Comment(Base, TenantScopedMixin):
    """A reader comment on a published resource.

    Deletion policy: hard delete (owner or admin), never edited —
    the timeline stays honest; audit log keeps the moderation trail.
    """

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resource_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    __table_args__ = (
        Index("ix_comments_tenant_resource_created", "tenant_id", "resource_id", created_at.desc()),
    )
