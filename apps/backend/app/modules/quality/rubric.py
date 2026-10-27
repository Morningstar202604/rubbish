"""Paper quality rubric — RQS v1.0 (frozen).

Why code and not a spreadsheet: the score is shown next to every article and
is used for issue ordering. If the weights lived in an editable table, two
articles scored in different months would not be comparable. The rubric is
versioned; changing it requires bumping ``RUBRIC_VERSION`` and re-scoring the
whole catalog in one migration-like batch.

Dimensions (total 100)
----------------------
- 结构 structure      20  six mandatory sections + IMRaD skeleton
- 篇幅 length         12  against the short/medium/long tiers
- 引用 references     22  count, numbering style, DOI verifiability
- 图表 figures        15  figure/table presence, numbering, in-text citation
- 摘要 abstract       11  four elements + length band + keywords
- 排版 typesetting    10  page size, font stack, title block sanity
- 语言 language       10  CJK ratio, paragraph variance, sentence length

Grade bands (fixed)
-------------------
A+ 卓越 90–100 · A 优秀 80–89 · B 良好 70–79 · C 合格 60–69 · D 待改进 <60

Quality coefficient (QC) = RQS / 50 → 0.00–2.00. This is a presentation
device ("系数"), not a citation metric; it is never called an impact factor.
"""

from __future__ import annotations

from dataclasses import dataclass, field

RUBRIC_VERSION = "1.0"

DIMENSIONS: tuple[tuple[str, str, int], ...] = (
    ("structure", "结构完整性", 20),
    ("length", "篇幅充实度", 12),
    ("references", "引用规范与可核实性", 22),
    ("figures", "图表规范", 15),
    ("abstract", "摘要与关键词", 11),
    ("typesetting", "排版规范", 10),
    ("language", "语言与可读性", 10),
)

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

MIN_REFERENCES = 8
MIN_CJK_SHORT = 2500
MIN_CJK_MEDIUM = 5000
MIN_CJK_LONG = 8000
ABSTRACT_MIN = 200
ABSTRACT_MAX = 350


@dataclass
class PaperMetrics:
    """Everything the rubric reads. Filled by the offline PDF analysis.

    Every field is a measured fact, never an opinion: the rubric must be
    replayable on the same PDF and produce the same score.
    """

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


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def score_structure(m: PaperMetrics) -> float:
    hits = sum(1 for name in REQUIRED_SECTIONS if m.section_hits.get(name))
    base = 20 * hits / len(REQUIRED_SECTIONS)
    # 有摘要但无 IMRaD 骨架的随笔式稿件，结构分封顶 12。
    if hits <= 2:
        base = min(base, 12)
    return round(base, 2)


def score_length(m: PaperMetrics) -> float:
    if m.cjk_chars >= MIN_CJK_LONG:
        return 12.0
    if m.cjk_chars >= MIN_CJK_MEDIUM:
        return 10.0
    if m.cjk_chars >= MIN_CJK_SHORT:
        return 8.0
    if m.cjk_chars >= MIN_CJK_SHORT * 0.6:
        return 5.0
    if m.cjk_chars >= 1000:
        return 2.5
    return 0.0


def score_references(m: PaperMetrics) -> float:
    if m.references <= 0:
        return 0.0
    density = _clamp(m.references / MIN_REFERENCES, 0, 1) * 10
    style = 5.0 if m.reference_style == "bracket" else 2.0 if m.reference_style == "plain" else 0
    doi_ratio = (m.doi_resolved / m.references) if m.references else 0
    doi_points = _clamp(doi_ratio, 0, 1) * 7
    return round(density + style + doi_points, 2)


def score_figures(m: PaperMetrics) -> float:
    fig = 0.0
    if m.figure_numbers:
        fig += 7
        fig += 5 * _clamp(m.figure_citations / m.figure_numbers, 0, 1)
    tab = 0.0
    if m.table_numbers:
        tab += 1.5
        tab += 1.5 * _clamp(m.table_citations / m.table_numbers, 0, 1)
    return round(min(fig + tab, 15), 2)


def score_abstract(m: PaperMetrics) -> float:
    if m.abstract_chars <= 0:
        return 0.0
    in_band = ABSTRACT_MIN <= m.abstract_chars <= ABSTRACT_MAX
    length = 4.0 if in_band else 2.0 if m.abstract_chars >= 120 else 0.5
    elements = sum([m.has_problem, m.has_method, m.has_result, m.has_conclusion]) * 1.5
    keywords = 2.5 if 3 <= m.keywords <= 8 else 1.0 if m.keywords > 0 else 0.0
    return round(min(length + elements + keywords, 11), 2)


def score_typesetting(m: PaperMetrics) -> float:
    points = 0.0
    if m.has_a4:
        points += 3
    if m.has_affiliation_block:
        points += 2
    if 5 <= m.title_chars <= 80:
        points += 3
    elif m.title_chars > 0:
        points += 1
    if m.pages >= 3:
        points += 2
    return round(min(points, 10), 2)


def score_language(m: PaperMetrics) -> float:
    if m.cjk_chars == 0:
        return 0.0
    ratio = m.cjk_chars / max(m.total_chars, 1)
    points = 4.0 if ratio >= 0.55 else 2.5 if ratio >= 0.3 else 1.0
    # 段落长度均一度：CV 过低（全篇同样长）或过高（碎片化）都扣分。
    if 0.25 <= m.paragraph_cv <= 0.9:
        points += 4
    elif m.paragraph_cv > 0:
        points += 2
    if m.paragraph_cv > 0 or m.pages >= 4:
        points += 2
    return round(min(points, 10), 2)


_SCORERS = {
    "structure": score_structure,
    "length": score_length,
    "references": score_references,
    "figures": score_figures,
    "abstract": score_abstract,
    "typesetting": score_typesetting,
    "language": score_language,
}


def grade_for(score: float) -> tuple[str, str]:
    for code, label, low, high in GRADE_BANDS:
        if low <= score <= high:
            return code, label
    return "D", "待改进"


def evaluate(m: PaperMetrics) -> dict[str, object]:
    """Run the rubric. Returns score, grade, coefficient and per-dimension detail."""
    breakdown: dict[str, dict[str, object]] = {}
    total = 0.0
    for key, label, weight in DIMENSIONS:
        raw = _SCORERS[key](m)
        total += raw
        breakdown[key] = {"label": label, "score": raw, "max": weight}
    total = round(_clamp(total, 0, 100), 1)
    grade, grade_label = grade_for(total)
    return {
        "rubric_version": RUBRIC_VERSION,
        "score": total,
        "grade": grade,
        "grade_label": grade_label,
        "coefficient": round(total / 50, 2),
        "breakdown": breakdown,
    }


def rubric_payload() -> dict[str, object]:
    return {
        "version": RUBRIC_VERSION,
        "dimensions": [
            {"key": key, "label": label, "weight": weight} for key, label, weight in DIMENSIONS
        ],
        "grades": [
            {"code": code, "label": label, "min": low, "max": high}
            for code, label, low, high in GRADE_BANDS
        ],
        "required_sections": list(REQUIRED_SECTIONS),
        "min_references": MIN_REFERENCES,
        "length_tiers": {
            "short": [MIN_CJK_SHORT, MIN_CJK_MEDIUM - 1],
            "medium": [MIN_CJK_MEDIUM, MIN_CJK_LONG - 1],
            "long": [MIN_CJK_LONG, None],
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
    "REQUIRED_SECTIONS",
    "RUBRIC_VERSION",
    "PaperMetrics",
    "evaluate",
    "grade_for",
    "rubric_payload",
]
