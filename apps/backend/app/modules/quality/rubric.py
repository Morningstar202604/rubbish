"""Paper quality rubric — RQS v1.0 (frozen).

Why code and not a spreadsheet: the score is shown next to every article and
is used for issue ordering. If the weights lived in an editable table, two
articles scored in different months would not be comparable. The rubric is
versioned; changing it requires bumping ``RUBRIC_VERSION`` and re-scoring the
whole catalog in one batch.

Four article types, one ladder
------------------------------
A satirical journal still publishes different *kinds* of writing. Judging a
three-page essay by the checklist of an empirical article is not rigour, it
is a category error — so the rubric defines four profiles with different
weights. Within a profile the weights are frozen; across profiles the total
is always 100 and the grade bands are shared.

- ``research`` 研究论文: IMRaD, references, figures.
- ``review``   综述: literature-led, heavier citation weight.
- ``essay``    随笔 / 评论: argument-led, citation light, prose weight high.
- ``note``     研究简报: short empirical report, figures matter most.

Dimensions
----------
structure / length / references / figures / abstract / typesetting / language.
Each scorer returns a 0–1 ratio; the profile weight turns it into points.

Grade bands (fixed)
-------------------
A+ 卓越 ≥90 · A 优秀 ≥80 · B 良好 ≥70 · C 合格 ≥60 · D 待改进 <60

Quality coefficient (QC) = RQS / 50 → 0.00–2.00. This is a presentation
device ("系数"), not a citation metric; it is never called an impact factor.
"""

from __future__ import annotations

from dataclasses import dataclass, field

RUBRIC_VERSION = "1.0"

DIMENSIONS: tuple[tuple[str, str], ...] = (
    ("structure", "结构完整性"),
    ("length", "篇幅充实度"),
    ("references", "引用规范与可核实性"),
    ("figures", "图表规范"),
    ("abstract", "摘要与关键词"),
    ("typesetting", "排版规范"),
    ("language", "语言与可读性"),
)

# 每类稿件一套权重；每套都必须合计 100（test_quality_rubric 守住）。
PROFILES: dict[str, dict[str, int]] = {
    "research": {
        "structure": 20,
        "length": 12,
        "references": 22,
        "figures": 15,
        "abstract": 11,
        "typesetting": 10,
        "language": 10,
    },
    "review": {
        "structure": 18,
        "length": 12,
        "references": 25,
        "figures": 12,
        "abstract": 10,
        "typesetting": 10,
        "language": 13,
    },
    "essay": {
        "structure": 22,
        "length": 12,
        "references": 8,
        "figures": 8,
        "abstract": 12,
        "typesetting": 8,
        "language": 30,
    },
    "note": {
        "structure": 18,
        "length": 14,
        "references": 18,
        "figures": 18,
        "abstract": 12,
        "typesetting": 10,
        "language": 10,
    },
}

PROFILE_LABELS = {
    "research": "研究论文",
    "review": "综述",
    "essay": "随笔 / 评论",
    "note": "研究简报",
}

GRADE_BANDS: tuple[tuple[str, str, int, int], ...] = (
    ("A+", "卓越", 90, 100),
    ("A", "优秀", 80, 89),
    ("B", "良好", 70, 79),
    ("C", "合格", 60, 69),
    ("D", "待改进", 0, 59),
)

# 六个必需节（与 docs/editorial-standards.md 3.1 对齐）
REQUIRED_SECTIONS: tuple[str, ...] = (
    "引言",
    "相关工作",
    "方法",
    "结果",
    "讨论",
    "结论",
)

# 每个画像要求的结构节（少而准，避免把随笔判成残废论文）
PROFILE_SECTIONS: dict[str, tuple[str, ...]] = {
    "research": REQUIRED_SECTIONS,
    "review": ("引言", "相关工作", "讨论", "结论"),
    "essay": ("引言", "讨论", "结论"),
    "note": ("引言", "方法", "结果", "结论"),
}

MIN_REFERENCES: dict[str, int] = {
    "research": 8,
    "review": 15,
    "essay": 0,
    "note": 4,
}

LENGTH_TIERS: dict[str, tuple[int, int, int]] = {
    # (short_floor, medium_floor, long_floor) —— 汉字数
    "research": (2500, 5000, 8000),
    "review": (3000, 6000, 10000),
    "essay": (1500, 3000, 6000),
    "note": (1200, 2500, 5000),
}

FIGURE_FLOOR: dict[str, int] = {"research": 2, "review": 1, "essay": 0, "note": 1}

ABSTRACT_MIN = 200
ABSTRACT_MAX = 350


@dataclass
class PaperMetrics:
    """Everything the rubric reads. Filled by the offline PDF analysis.

    Every field is a measured fact, never an opinion: the rubric must be
    replayable on the same PDF and produce the same score.
    """

    article_type: str = "research"
    cjk_chars: int = 0
    total_chars: int = 0
    pages: int = 0
    paragraphs: int = 0
    paragraph_cv: float = 0.0
    section_hits: dict[str, bool] = field(default_factory=dict)
    abstract_chars: int = 0
    has_problem: bool = False
    has_method: bool = False
    has_result: bool = False
    has_conclusion: bool = False
    keywords: int = 0
    references: int = 0
    reference_style: str = "none"  # bracket / plain / none
    reference_dois: int = 0
    doi_resolved: int = 0
    figure_numbers: int = 0
    figure_citations: int = 0
    table_numbers: int = 0
    table_citations: int = 0
    fonts: list[str] = field(default_factory=list)
    title_chars: int = 0
    title_lines: int = 1
    # 默认 False：空 metrics 必须得 0 分（评分器不得给「没测到」发底分）。
    has_a4: bool = False
    has_affiliation_block: bool = False


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _profile(m: PaperMetrics) -> dict[str, int]:
    return PROFILES.get(m.article_type, PROFILES["research"])


def ratio_structure(m: PaperMetrics) -> float:
    required = PROFILE_SECTIONS.get(m.article_type, REQUIRED_SECTIONS)
    hits = sum(1 for name in required if m.section_hits.get(name))
    ratio = hits / len(required)
    # 只命中 1–2 节的「随笔式碎片」结构分腰斩：有引言不等于有论文骨架。
    if hits <= 2:
        ratio = min(ratio, 0.5)
    return round(ratio, 4)


def ratio_length(m: PaperMetrics) -> float:
    short, medium, long = LENGTH_TIERS.get(m.article_type, LENGTH_TIERS["research"])
    if m.cjk_chars >= long:
        return 1.0
    if m.cjk_chars >= medium:
        return 0.82
    if m.cjk_chars >= short:
        return 0.66
    if m.cjk_chars >= short * 0.6:
        return 0.38
    if m.cjk_chars >= 1000:
        return 0.18
    return 0.0


def ratio_references(m: PaperMetrics) -> float:
    floor = MIN_REFERENCES.get(m.article_type, 8)
    if floor == 0 and m.references == 0:
        # 随笔画像不强制引用；但没有引用也拿不到引用分。
        return 0.0
    if m.references <= 0:
        return 0.0
    density = _clamp(m.references / max(floor, 1)) * 0.45
    style = (
        0.25 if m.reference_style == "bracket" else 0.10 if m.reference_style == "plain" else 0.0
    )
    doi_ratio = _clamp(m.doi_resolved / m.references) * 0.30
    return round(min(density + style + doi_ratio, 1.0), 4)


def ratio_figures(m: PaperMetrics) -> float:
    floor = FIGURE_FLOOR.get(m.article_type, 2)
    if m.figure_numbers == 0 and m.table_numbers == 0:
        return 0.0 if floor > 0 else 0.35
    fig = 0.0
    if m.figure_numbers:
        fig = 0.45 + 0.30 * _clamp(m.figure_citations / m.figure_numbers)
    tab = 0.0
    if m.table_numbers:
        tab = 0.15 + 0.10 * _clamp(m.table_citations / m.table_numbers)
    total = fig + tab
    if floor > 0 and m.figure_numbers < floor:
        total *= 0.7
    return round(min(total, 1.0), 4)


def ratio_abstract(m: PaperMetrics) -> float:
    if m.abstract_chars <= 0:
        return 0.0
    in_band = ABSTRACT_MIN <= m.abstract_chars <= ABSTRACT_MAX
    length = 0.36 if in_band else 0.18 if m.abstract_chars >= 120 else 0.05
    elements = sum([m.has_problem, m.has_method, m.has_result, m.has_conclusion]) * 0.135
    keywords = 0.23 if 3 <= m.keywords <= 8 else 0.10 if m.keywords > 0 else 0.0
    return round(min(length + elements + keywords, 1.0), 4)


def ratio_typesetting(m: PaperMetrics) -> float:
    points = 0.0
    if m.has_a4:
        points += 0.3
    if m.has_affiliation_block:
        points += 0.2
    if 5 <= m.title_chars <= 80:
        points += 0.3
    elif m.title_chars > 0:
        points += 0.1
    if m.pages >= 3:
        points += 0.2
    return round(min(points, 1.0), 4)


def ratio_language(m: PaperMetrics) -> float:
    if m.cjk_chars == 0:
        return 0.0
    ratio = m.cjk_chars / max(m.total_chars, 1)
    points = 0.4 if ratio >= 0.55 else 0.25 if ratio >= 0.3 else 0.1
    # 段落长度均一度：CV 过低（全篇同样长）或过高（碎片化）都扣分。
    if 0.25 <= m.paragraph_cv <= 0.9:
        points += 0.4
    elif m.paragraph_cv > 0:
        points += 0.2
    if m.paragraph_cv > 0 or m.pages >= 4:
        points += 0.2
    return round(min(points, 1.0), 4)


_RATIOS = {
    "structure": ratio_structure,
    "length": ratio_length,
    "references": ratio_references,
    "figures": ratio_figures,
    "abstract": ratio_abstract,
    "typesetting": ratio_typesetting,
    "language": ratio_language,
}


def grade_for(score: float) -> tuple[str, str]:
    """Band lookup that tolerates fractional scores.

    区间必须按「下限」降序比较，不能写成 ``low <= score <= high`` 的整数
    闭区间：79.5 既不落在 [70,79] 也不在 [80,89]，会直接掉进 D——一个
    79.5 分的稿子被判「待改进」是评分口径的硬 bug。
    """
    for code, label, low, _high in GRADE_BANDS:
        if score >= low:
            return code, label
    return "D", "待改进"


def evaluate(m: PaperMetrics) -> dict[str, object]:
    """Run the rubric. Returns score, grade, coefficient and per-dimension detail."""
    profile = _profile(m)
    breakdown: dict[str, dict[str, object]] = {}
    total = 0.0
    for key, label in DIMENSIONS:
        weight = profile[key]
        ratio = _RATIOS[key](m)
        points = round(weight * ratio, 2)
        total += points
        breakdown[key] = {
            "label": label,
            "score": points,
            "max": weight,
            "ratio": ratio,
        }
    total = round(_clamp(total, 0, 100), 1)
    grade, grade_label = grade_for(total)
    return {
        "rubric_version": RUBRIC_VERSION,
        "article_type": m.article_type,
        "article_type_label": PROFILE_LABELS.get(m.article_type, "研究论文"),
        "score": total,
        "grade": grade,
        "grade_label": grade_label,
        "coefficient": round(total / 50, 2),
        "breakdown": breakdown,
    }


def rubric_payload() -> dict[str, object]:
    return {
        "version": RUBRIC_VERSION,
        "dimensions": [{"key": key, "label": label} for key, label in DIMENSIONS],
        "profiles": {
            name: {"label": PROFILE_LABELS[name], "weights": weights}
            for name, weights in PROFILES.items()
        },
        "grades": [
            {"code": code, "label": label, "min": low, "max": high}
            for code, label, low, high in GRADE_BANDS
        ],
        "required_sections": list(REQUIRED_SECTIONS),
        "profile_sections": {k: list(v) for k, v in PROFILE_SECTIONS.items()},
        "min_references": MIN_REFERENCES,
        "length_tiers": {
            k: {"short": v[0], "medium": v[1], "long": v[2]} for k, v in LENGTH_TIERS.items()
        },
        "abstract_band": [ABSTRACT_MIN, ABSTRACT_MAX],
        "coefficient_formula": "RQS / 50",
    }


__all__ = [
    "ABSTRACT_MAX",
    "ABSTRACT_MIN",
    "DIMENSIONS",
    "GRADE_BANDS",
    "MIN_REFERENCES",
    "PROFILES",
    "PROFILE_LABELS",
    "REQUIRED_SECTIONS",
    "RUBRIC_VERSION",
    "PaperMetrics",
    "evaluate",
    "grade_for",
    "rubric_payload",
]
