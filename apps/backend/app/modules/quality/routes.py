"""Quality module — public rubric + per-article RQS display."""

from __future__ import annotations

from fastapi import APIRouter

from app.modules.quality.rubric import rubric_payload

router = APIRouter(prefix="/quality", tags=["quality"])


@router.get("/rubric")
async def get_rubric() -> dict[str, object]:
    """The frozen scoring rubric. Public so authors can self-check."""
    return rubric_payload()
