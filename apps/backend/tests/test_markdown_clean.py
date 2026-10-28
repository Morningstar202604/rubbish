"""Markdown reader cleanup tests — the noise readers complained about."""

from __future__ import annotations

from app.modules.submission.markdown_clean import clean

SAMPLE = """Rubbish - 于荒诞处见同路人

Open Access
Research Article
Received 17th April 2026,
Accepted 28th April 2026
https://mts-rubbish.github.io/

RUBBISH

AI 能否取代导师
Rui Tang<sup>1,*</sup>，Ying Cai<sup>2</sup>

### 摘要

本文讨论 AI 能否取代导师。<sup>1</sup>

关键词 **:** 人工智能；导师

### **1** 引言

正文第一段。

**Rubbish -** 于荒诞处见同路人

#### Rubbish - 于荒诞处见同路人

正文第二段。
"""


def test_drops_boilerplate_before_abstract() -> None:
    out = clean(SAMPLE)
    assert out.startswith("## 摘要")
    assert "mts-rubbish" not in out
    assert "Received 17th April" not in out
    assert "Open Access" not in out


def test_drops_html_tags() -> None:
    out = clean(SAMPLE)
    assert "<sup>" not in out
    assert "</sup>" not in out
    # 作者行在摘要之前，被 drop_prefix 一并裁掉（页面头部已有作者）
    assert "Rui Tang" not in out


def test_drops_running_heads_everywhere() -> None:
    out = clean(SAMPLE)
    assert "于荒诞处见同路人" not in out


def test_normalises_keyword_label() -> None:
    out = clean(SAMPLE)
    # 唯一保留的粗体：关键词标签（阅读器里作为字段名，视觉上需要区分）
    assert "**关键词**：" in out
    assert "**:**" not in out


def test_heading_bold_removed_and_space_added() -> None:
    out = clean(SAMPLE)
    assert "### 1 引言" in out
    assert "**1**" not in out


def test_abstract_promoted_to_h2() -> None:
    out = clean(SAMPLE)
    assert out.splitlines()[0] == "## 摘要"


def test_cjk_gaps_collapsed() -> None:
    md = "本文 讨论 中文 排版\n"
    assert clean(md).strip() == "本文讨论中文排版"


def test_drops_volume_footer_variants() -> None:
    for line in (
        "RUBBISH | Volume XX | February 2026 | XXXX",
        "> RUBBISH | Volume XX | March 2026 | XXXX",
        "**1** Rubbish | Volume XX | February 2026 | XXXX",
        "_Rubbish_ | Volume 9 | October 2026 | 2609",
    ):
        assert clean(line) == "", line


def test_drops_footer_merged_into_paragraph() -> None:
    md = "正文结束居民区的 _Rubbish_ | Volume 9 | October 2026 | 2609\n下一段"
    out = clean(md)
    assert "Volume" not in out
    assert "正文结束居民区的" in out
    assert "下一段" in out


def test_drops_english_tagline() -> None:
    md = "**Where the absurd dwells, fellow wayfarers meet.**"
    assert clean(md) == ""
