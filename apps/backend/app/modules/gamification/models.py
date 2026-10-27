"""Gamification models — XP ledger + unlocked achievements.

Design notes
------------
- ``user_xp_events`` is an append-only ledger. The users table carries the
  running total (``users.xp``) so level lookups never aggregate the ledger
  on the hot path; the ledger exists for auditability and for the
  "where did these points come from" panel in the profile page.
- One event per (tenant, user, action, ref_type, ref_id) — the unique
  constraint makes awarding idempotent, so a retried request can never
  double-credit the same action.
- ``user_achievements`` stores only unlocked badges. Badge definitions live
  in code (``badges.py``) and are frozen; unlocking is evaluated lazily on
  profile reads and writes a row the first time the criterion holds.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.time import utcnow
from app.models import Base, TenantScopedMixin


class UserXpEvent(Base, TenantScopedMixin):
    """Append-only XP ledger row."""

    __tablename__ = "user_xp_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    ref_type: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    ref_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # __table_args__ 必须放在 created_at 声明之后（类体自上而下求值）。
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "user_id",
            "action",
            "ref_type",
            "ref_id",
            name="uq_user_xp_event_identity",
        ),
        Index("ix_user_xp_events_tenant_user_created", "tenant_id", "user_id", created_at.desc()),
    )


class UserAchievement(Base, TenantScopedMixin):
    """A badge a user has unlocked. Appearance order follows ``unlocked_at``."""

    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", "badge_key", name="uq_user_achievement_identity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    badge_key: Mapped[str] = mapped_column(String(64), nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )


__all__ = ["UserAchievement", "UserXpEvent"]
