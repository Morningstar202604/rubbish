"""Gamification API — level ladder, onboarding, profile, badge wall, admin grants."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin, require_tenant_id
from app.api.levels import CURRENT_RULES_VERSION
from app.core.db import get_db
from app.core.time import utcnow
from app.models import AuditLog, User
from app.modules.gamification import service
from app.modules.gamification.ladder import ladder_payload, level_payload

router = APIRouter(prefix="/gamification", tags=["gamification"])


class LevelGrantRequest(BaseModel):
    points: int = Field(ge=1, le=10000)
    note: str = Field(min_length=1, max_length=200)


class AuthorOnboardingRequest(BaseModel):
    accept_rules: bool = Field(description="必须为 true：表示已读完并接受投稿规范")


class PublicUserLevel(BaseModel):
    user_id: int
    username: str
    level: dict[str, object]


@router.get("/ladder")
async def get_ladder() -> dict[str, object]:
    """The frozen 9-tier ladder. Public: readers should know what exists."""
    return {"version": "1.0", "levels": ladder_payload()}


@router.get("/me")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Full profile for the signed-in user.

    Lazy badge evaluation: the profile read is where new unlocks surface, so
    one read never has to trust a fan-out write path to have fired.
    """
    await service.evaluate_badges(db, current_user)
    await db.commit()
    include_secret = bool(current_user.is_admin)
    payload = await service.profile(db, current_user, include_secret=include_secret)
    if not include_secret:
        # Progressive reveal: keep unlocked badges + the next three locked
        # ones, so the wall grows instead of showing 25 empty slots.
        unlocked = [b for b in payload["badges"] if b["unlocked"]]
        locked = [b for b in payload["badges"] if not b["unlocked"]][:3]
        payload["badges"] = unlocked + locked
    payload["rules_version"] = CURRENT_RULES_VERSION
    payload["rules_accepted"] = current_user.rules_ack_version == CURRENT_RULES_VERSION
    return payload


@router.post("/onboarding/community")
async def onboarding_community(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Step 1: acknowledge the community rules and unlock L2 (comments etc.)."""
    await service.award(
        db, current_user, "onboarding.ack_rules", ref_type="rules", ref_id=CURRENT_RULES_VERSION
    )
    await service.evaluate_badges(db, current_user)
    await db.commit()
    roles = await service._user_role_names(db, current_user)
    return {"level": service.level_snapshot(current_user, roles)}


@router.post("/onboarding/author")
async def onboarding_author(
    body: AuthorOnboardingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Step 2: accept the editorial standards and unlock L3 (submission)."""
    if not body.accept_rules:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="accept_rules must be true to unlock author rights",
        )
    # 记录确认版本——投稿门禁（require_rules_ack）读同一字段。
    await service.award(
        db, current_user, "onboarding.ack_rules", ref_type="rules", ref_id=CURRENT_RULES_VERSION
    )
    current_user.rules_ack_version = CURRENT_RULES_VERSION
    current_user.rules_ack_at = utcnow()
    await service.award(
        db, current_user, "onboarding.author", ref_type="rules", ref_id=CURRENT_RULES_VERSION
    )
    await service.evaluate_badges(db, current_user)
    db.add(
        AuditLog(
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            action="gamification.author_onboarding",
            target_type="user",
            target_id=str(current_user.id),
            payload={"rules_version": CURRENT_RULES_VERSION},
        )
    )
    await db.commit()
    roles = await service._user_role_names(db, current_user)
    return {
        "level": service.level_snapshot(current_user, roles),
        "rules_version": CURRENT_RULES_VERSION,
    }


@router.post("/rules/ack")
async def acknowledge_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Re-confirm the current rules after a revision (idempotent, no XP)."""
    current_user.rules_ack_version = CURRENT_RULES_VERSION
    current_user.rules_ack_at = utcnow()
    await db.commit()
    return {"rules_version": CURRENT_RULES_VERSION}


@router.get("/checkin")
async def get_checkin_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """每日签到状态：今日是否已签、连续天数、累计天数与 XP 口径。"""
    return await service.checkin_status(db, current_user)


@router.post("/checkin")
async def post_daily_checkin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """执行每日签到（每天一次，重复签到幂等返回当前状态）。

    连续每满 7 天额外发放 weekly_bonus（见 service.daily_checkin）。
    """
    return await service.daily_checkin(db, current_user)


@router.get("/users/{user_id}/level", response_model=PublicUserLevel)
async def get_user_level(
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> PublicUserLevel:
    """Public level badge (shown next to comments and on the author page)."""
    tenant_id = require_tenant_id()
    user = (
        await db.execute(select(User).where(User.id == user_id, User.tenant_id == tenant_id))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    roles = await service._user_role_names(db, user)
    return PublicUserLevel(
        user_id=user.id,
        username=user.username,
        level=service.level_snapshot(user, roles),
    )


@router.post("/admin/users/{user_id}/grant", response_model=LevelGrantRequest)
async def grant_points(
    user_id: int,
    body: LevelGrantRequest,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> LevelGrantRequest:
    """L9 only: manually credit XP (editorial merit, event rewards)."""
    tenant_id = require_tenant_id()
    target = (
        await db.execute(select(User).where(User.id == user_id, User.tenant_id == tenant_id))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await service.grant_admin_xp(
        db, actor=current_admin, target=target, points=body.points, note=body.note
    )
    db.add(
        AuditLog(
            tenant_id=tenant_id,
            actor_user_id=current_admin.id,
            action="gamification.grant",
            target_type="user",
            target_id=str(user_id),
            payload={"points": body.points, "note": body.note},
        )
    )
    await db.commit()
    return body


@router.get("/levels/{level}")
async def get_level_detail(level: int) -> dict[str, object]:
    if level < 1 or level > 9:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown level")
    return level_payload(level)
