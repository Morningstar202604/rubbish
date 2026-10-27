"""RQS v1.0 rubric tests — the score must be deterministic and banded."""

from __future__ import annotations

from app.modules.quality.rubric import (
    PaperMetrics,
    evaluate,
    grade_for,
    rubric_payload,
    score_abstract,
    score_length,
    score_references,
)


def _full_paper() -> PaperMetrics:
    return PaperMetrics(
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


def test_length_tiers() -> None:
    assert score_length(PaperMetrics(cjk_chars=1000)) == 2.5
    assert score_length(PaperMetrics(cjk_chars=2600)) == 8.0
    assert score_length(PaperMetrics(cjk_chars=6000)) == 10.0
    assert score_length(PaperMetrics(cjk_chars=9000)) == 12.0


def test_references_reward_doi_verifiability() -> None:
    base = PaperMetrics(references=10, reference_style="bracket", reference_dois=10)
    unverified = score_references(base)
    verified = score_references(
        PaperMetrics(references=10, reference_style="bracket", reference_dois=10, doi_resolved=10)
    )
    assert verified > unverified
    assert verified <= 22


def test_abstract_requires_four_elements() -> None:
    full = score_abstract(
        PaperMetrics(
            abstract_chars=300,
            has_problem=True,
            has_method=True,
            has_result=True,
            has_conclusion=True,
            keywords=4,
        )
    )
    partial = score_abstract(PaperMetrics(abstract_chars=300, has_problem=True, keywords=4))
    assert full == 11
    assert partial < full


def test_rubric_payload_weights_sum_to_100() -> None:
    payload = rubric_payload()
    assert sum(d["weight"] for d in payload["dimensions"]) == 100
    assert payload["coefficient_formula"] == "RQS / 50"
