"""Level ladder — the frozen 9-tier permission ladder.

The ladder is intentionally code, not a database table: every level carries
capabilities that are enforced elsewhere (require_editor, require_reviewer,
admin gates). A configurable table would drift away from the enforcement
points and produce "level 8 user who cannot edit" ghosts.

Two tracks combine into one effective level:

- **Merit track** (L1–L4): earned automatically from XP.
- **Staff track** (L5–L9): granted by role. A staff role sets a *floor*;
  XP never promotes into a staff tier on its own, because review and
  editorial power are accountability, not a participation reward.

Effective level = max(merit level from XP, role floor, admin=9).
"""

from __future__ import annotations

from dataclasses import dataclass

SCORING_VERSION = "1.0"


@dataclass(frozen=True)
class LevelSpec:
    level: int
    code: str
    name: str
    title: str
    track: str
    xp_floor: int
    roles: tuple[str, ...]
    capabilities: tuple[str, ...]
    description: str


LEVELS: tuple[LevelSpec, ...] = (
    LevelSpec(
        level=1,
        code="novice",
        name="L1 小白读者",
        title="路人",
        track="merit",
        xp_floor=0,
        roles=(),
        capabilities=(
            "浏览目录与全文",
            "下载 PDF / Markdown",
            "本地阅读进度",
            "公开评论只读",
        ),
        description="刚注册的读者。可无条件阅读全部已刊文章，但还不能发言、不能投稿。",
    ),
    LevelSpec(
        level=2,
        code="reader",
        name="L2 注册读者",
        title="读者",
        track="merit",
        xp_floor=30,
        roles=(),
        capabilities=(
            "L1 全部权限",
            "发表评论",
            "关注作者 / 订阅学科",
            "建立阅读列表",
            "跨设备阅读进度",
        ),
        description="完成初始阅读量后解锁社交与收藏能力：评论、关注、阅读列表。",
    ),
    LevelSpec(
        level=3,
        code="author",
        name="L3 作者",
        title="投稿人",
        track="merit",
        xp_floor=150,
        roles=(),
        capabilities=(
            "L2 全部权限",
            "提交稿件",
            "查看审稿意见与版本历史",
            "申请 ORCID 关联",
        ),
        description="获得投稿资格。投稿前必须完整阅读并确认《投稿规范》。",
    ),
    LevelSpec(
        level=4,
        code="senior-author",
        name="L4 常驻作者",
        title="常驻作者",
        track="merit",
        xp_floor=400,
        roles=(),
        capabilities=(
            "L3 全部权限",
            "稿件优先进入排版队列",
            "个人主页展示已刊作品",
        ),
        description="有稳定发表记录的作者，享有排版优先与公开作品页。",
    ),
    LevelSpec(
        level=5,
        code="reviewer",
        name="L5 审稿人",
        title="同行评审",
        track="staff",
        xp_floor=0,
        roles=("reviewer",),
        capabilities=(
            "L4 全部读者侧权限",
            "接收审稿邀请",
            "提交审稿意见与评分",
            "查看匿名稿",
        ),
        description="由编辑部授予 reviewer 角色。审稿权限不靠积分购买。",
    ),
    LevelSpec(
        level=6,
        code="senior-reviewer",
        name="L6 资深审稿人",
        title="资深评审",
        track="staff",
        xp_floor=0,
        roles=("senior_reviewer",),
        capabilities=(
            "L5 全部权限",
            "审稿质量进入编辑参考榜",
            "可被指定为争议稿第三审",
        ),
        description="累计完成足量高质量审稿后由编辑提名，进入资深评审池。",
    ),
    LevelSpec(
        level=7,
        code="section-editor",
        name="L7 栏目编辑",
        title="栏目编辑",
        track="staff",
        xp_floor=0,
        roles=("section_editor",),
        capabilities=(
            "L6 全部权限",
            "负责单一学科栏目的初审与送审",
            "推荐录用名单",
        ),
        description="按学科分工的栏目编辑，权限限定在本栏目。",
    ),
    LevelSpec(
        level=8,
        code="editor",
        name="L8 执行编辑",
        title="执行编辑",
        track="staff",
        xp_floor=0,
        roles=("editor",),
        capabilities=(
            "L7 全部权限",
            "全学科分配审稿人",
            "作出录用 / 修回 / 拒稿决定",
            "编排卷期",
        ),
        description="对全刊稿件有裁决权，决定进入公开目录的最终形态。",
    ),
    LevelSpec(
        level=9,
        code="editor-in-chief",
        name="L9 主编 / 管理员",
        title="主编",
        track="staff",
        xp_floor=0,
        roles=("admin",),
        capabilities=(
            "L8 全部权限",
            "用户与角色管理",
            "期刊设置、评分模型与公告",
            "审计日志与全站数据",
        ),
        description="站点最高权限。仅主编可查看全部等级与全部隐藏成就。",
    ),
)

LEVEL_BY_NUMBER = {spec.level: spec for spec in LEVELS}
MERIT_MAX_LEVEL = 4
STAFF_ROLE_TO_LEVEL = {
    "reviewer": 5,
    "senior_reviewer": 6,
    "section_editor": 7,
    "editor": 8,
}


def merit_level_for_xp(xp: int) -> int:
    """Highest merit tier whose XP floor is met (never above L4)."""
    level = 1
    for spec in LEVELS:
        if spec.track != "merit":
            continue
        if xp >= spec.xp_floor:
            level = spec.level
    return min(level, MERIT_MAX_LEVEL)


def effective_level(xp: int, roles: list[str], is_admin: bool) -> int:
    """max(merit, role floor), with admin pinned to 9."""
    if is_admin:
        return 9
    level = merit_level_for_xp(xp)
    for role in roles:
        level = max(level, STAFF_ROLE_TO_LEVEL.get(role, 0))
    return level


def level_payload(level: int) -> dict[str, object]:
    spec = LEVEL_BY_NUMBER[level]
    return {
        "level": spec.level,
        "code": spec.code,
        "name": spec.name,
        "title": spec.title,
        "track": spec.track,
        "capabilities": list(spec.capabilities),
        "description": spec.description,
    }


def ladder_payload() -> list[dict[str, object]]:
    return [
        {
            "level": spec.level,
            "code": spec.code,
            "name": spec.name,
            "title": spec.title,
            "track": spec.track,
            "xp_floor": spec.xp_floor,
            "roles": list(spec.roles),
            "capabilities": list(spec.capabilities),
            "description": spec.description,
        }
        for spec in LEVELS
    ]


__all__ = [
    "LEVELS",
    "LEVEL_BY_NUMBER",
    "MERIT_MAX_LEVEL",
    "SCORING_VERSION",
    "STAFF_ROLE_TO_LEVEL",
    "effective_level",
    "ladder_payload",
    "level_payload",
    "merit_level_for_xp",
]
