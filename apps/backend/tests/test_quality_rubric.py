"""RQS v1.0 rubric tests — the score must be deterministic and banded."""

from __future__ import annotations

from app.modules.quality.rubric import (
    PROFILES,
    PaperMetrics,
    evaluate,
    grade_for,
    ratio_length,
    ratio_references,
    rubric_payload,
)


def _full_paper(article_type: str = "research") -> PaperMetrics:
    return PaperMetrics(
        article_type=article_type,
        cjk_chars=9000,
        total_chars=12000,
        pages=10,
        paragraphs=30,
        paragraph_cv=0.5,
        section_hits={s: True for s in ("引言", "相关工作", "方法", "结果", "讨论", "结论")},
        abstract_chars=300,
        has_problem=True,
        has_method=True,
        has_result=True,
        has_conclusion=True,
        keywords=5,
        references=20,
        reference_style="bracket",
        reference_dois=20,
        doi_resolved=20,
        figure_numbers=4,
        figure_citations=4,
        table_numbers=2,
        table_citations=2,
        fonts=["SimSun"],
        title_chars=30,
        has_a4=True,
        has_affiliation_block=True,
    )


def test_full_paper_scores_a_plus() -> None:
    result = evaluate(_full_paper())
    assert result["score"] >= 90
    assert result["grade"] == "A+"
    assert result["coefficient"] == round(result["score"] / 50, 2)


def test_empty_paper_scores_zero() -> None:
    result = evaluate(PaperMetrics())
    assert result["score"] == 0
    assert result["grade"] == "D"


def test_grade_bands_are_fixed() -> None:
    assert grade_for(95) == ("A+", "卓越")
    assert grade_for(85) == ("A", "优秀")
    assert grade_for(72) == ("B", "良好")
    assert grade_for(65) == ("C", "合格")
    assert grade_for(20) == ("D", "待改进")


def test_fractional_scores_do_not_fall_through_bands() -> None:
    """79.5 必须落在 B，而不是因为没有闭区间命中掉进 D。"""
    assert grade_for(79.5) == ("B", "良好")
    assert grade_for(69.9) == ("C", "合格")
    assert grade_for(89.5) == ("A", "优秀")
    assert grade_for(0.0) == ("D", "待改进")


def test_length_tiers_per_profile() -> None:
    assert ratio_length(PaperMetrics(cjk_chars=1000)) == 0.18
    assert ratio_length(PaperMetrics(cjk_chars=2600)) == 0.66
    assert ratio_length(PaperMetrics(cjk_chars=6000)) == 0.82
    assert ratio_length(PaperMetrics(cjk_chars=9000)) == 1.0
    # 随笔画像的门槛更低：3000 字即中篇
    assert ratio_length(PaperMetrics(cjk_chars=3200, article_type="essay")) == 0.82


def test_references_reward_doi_verifiability() -> None:
    base = PaperMetrics(references=10, reference_style="bracket", reference_dois=10)
    unverified = ratio_references(base)
    verified = ratio_references(
        PaperMetrics(references=10, reference_style="bracket", reference_dois=10, doi_resolved=10)
    )
    assert verified > unverified
    assert verified <= 1.0


def test_profile_weights_all_sum_to_100() -> None:
    for name, weights in PROFILES.items():
        assert sum(weights.values()) == 100, name


def test_essay_profile_weights_language_heavier() -> None:
    assert PROFILES["essay"]["language"] > PROFILES["research"]["language"]
    assert PROFILES["essay"]["references"] < PROFILES["research"]["references"]


def test_rubric_payload_exposes_profiles() -> None:
    payload = rubric_payload()
    assert payload["version"] == "1.0"
    assert set(payload["profiles"]) == set(PROFILES)
    assert payload["coefficient_formula"] == "RQS / 50"
    assert [g["code"] for g in payload["grades"]] == ["A+", "A", "B", "C", "D"]
