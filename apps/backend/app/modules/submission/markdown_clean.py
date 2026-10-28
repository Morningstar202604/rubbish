"""Structural cleanup for pymupdf4llm output (reader-facing Markdown).

Why a structural pass and not more regex patches
------------------------------------------------
The submitted PDFs typeset CJK with SimSun and Latin with Times/Bahnschrift.
pymupdf4llm turns every font switch into a bold run, so one paper produced
930 ``**`` markers; it also merges a heading with the paragraph that follows
on the same visual line ("## 2 研究方法 ### 2.1 动物实验 **实验采用…"), and
sometimes puts an image inside a heading line.

Reader symptoms (verified on /reader/44 and /reader/64):
- 刊头 `Open Access Research Article Received … Accepted …` 留在正文顶部
- 标题 + 作者 + 机构 + 邮箱挤成一条 H1
- `## 摘要 (Abstract) **目的：…` —— 小节标题和摘要正文同一行
- 正文出现成百上千个 ``**``，读起来像被随机加粗
- `### 类为皮质醇）持续升高。 ![](data:image…)` —— 图片被当成标题

So this module does five things in order:

1. normalise line endings and strip inline boilerplate fragments;
2. split lines that contain several heading markers into separate lines;
3. demote "headings" that are really body text / table captions / images;
4. strip font-switch bold noise (dense ``**`` runs on one line);
5. drop the duplicated title block (the page header already renders it).

Every rule is covered by ``tests/test_markdown_clean.py``.
"""

from __future__ import annotations

import re

# --- 1. boilerplate ------------------------------------------------------

BOILER_FRAGMENTS = re.compile(
    r"(?:"
    r"Open\s*Access(?:\s*Research\s*Article)?"
    r"|Research\s*Article"
    r"|Received\s+\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+(?:\d{4}|20xx)[,，]?"
    r"|Accepted\s+\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+(?:\d{4}|20xx)[,，]?"
    r"|MID:\s*(?:None|xxxx?/[\w./-]+|\S*)"
    r"|https?://\S+"
    r")\s*",
    re.I,
)

RUNNING_HEAD = re.compile(
    r"^\s*(?:[>*_#]{0,3}\s*)*(?:#{1,6}\s*)?\**\s*(?:"
    r"Rubbish\s*[-—]\s*于荒诞处见同路人"
    r"|于荒诞处[，,]?\s*见同路人"
    r"|Where the absurd dwells.*"
    r"|(?:Rubbish|RUBBISH|RUBBIS\s*H)\s*(?:\|\s*Volume.*)?"
    r"|\d{1,3}"
    r")\s*\**\s*$",
    re.I,
)

# 行首页脚：可带 blockquote 标记与粗体页码前缀（"**1** "）。
VOLUME_FOOTER = re.compile(
    r"^[ \t]*(?:>[ \t]*)?(?:\*\*\d+\*\*[ \t]+)?[_*]*[ \t]*Rubbish[ \t]*[_*]*"
    r"[ \t]*\|[ \t]*Volume.*$",
    re.I | re.M,
)
# 与正文粘在同一行的页脚（分页把页脚拼进了段落末尾）。
VOLUME_FOOTER_INLINE = re.compile(
    r"[ \t]+[_*]*[ \t]*Rubbish[ \t]*[_*]*[ \t]*\|[ \t]*Volume[^\n]*",
    re.I,
)

ABSTRACT_ONLY = re.compile(r"^\s*(?:#{1,6}\s*)?(摘\s*要|Abstract|ABSTRACT|抽\s*象)\b", re.I)

# --- 2/3. headings -------------------------------------------------------

HEADING_MARK = re.compile(r"(?<![\w#])(#{1,6})[ \t]+")
SECTION_WORDS = re.compile(
    r"^(?:\d+(?:\.\d+)*[.、]?\s+|摘\s*要|Abstract|ABSTRACT|关键词|关键字|Keywords?"
    r"|参\s*考\s*文\s*献|References|致\s*谢|Acknowledg|声\s*明|结\s*论|讨论|结果|方法|引言|绪论)",
    re.I,
)
SENTENCE_END = re.compile(r"[。！？；]$")
IMAGE_REF = re.compile(r"!\[[^\]]*\]\([^)]*\)")
BOLD = re.compile(r"\*\*([^*\n]+)\*\*")
CJK_GAP = re.compile(r"(?<=[\u4e00-\u9fff])[ \t]+(?=[\u4e00-\u9fff])")
TAG = re.compile(r"</?(?:sup|sub|i|b|em|strong|span|font|div|p|br)\b[^>]*>", re.I)

MAX_HEADING_CHARS = 60


def strip_tags(md: str) -> str:
    """Drop inline HTML: the reader renders Markdown only (no rehype-raw)."""
    md = TAG.sub("", md)
    return md.replace("<br>", " ").replace("<br/>", " ").replace("<br />", " ")


def normalise(md: str) -> str:
    md = md.replace("\r\n", "\n").replace("\r", "\n")
    md = VOLUME_FOOTER.sub("", md)
    md = VOLUME_FOOTER_INLINE.sub("", md)
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def _looks_like_running_head(line: str) -> bool:
    compact = re.sub(r"[\s#*_>]", "", line)
    return compact in {
        "Rubbish-于荒诞处见同路人",
        "Rubbish—于荒诞处见同路人",
        "于荒诞处见同路人",
        "于荒诞处，见同路人",
        "RUBBISH",
        "Rubbish",
    }


def strip_boilerplate(md: str) -> str:
    """Remove masthead fragments wherever they appear.

    Article 44's first line is
    ``**Open Access Research Article** Received 8th March 2026 Accepted … ``:
    several fragments on one line, so a line-anchored rule misses it.
    """
    out = []
    for line in md.split("\n"):
        stripped = BOILER_FRAGMENTS.sub("", line).strip(" *_")
        if not stripped:
            continue
        if _looks_like_running_head(stripped) or RUNNING_HEAD.match(stripped):
            continue
        out.append(stripped)
    return "\n".join(out)


def split_merged_headings(md: str) -> str:
    """One line can carry several headings: ``## X ### Y #### Z body``."""
    out = []
    for line in md.split("\n"):
        marks = list(HEADING_MARK.finditer(line))
        if len(marks) <= 1:
            out.append(line)
            continue
        cursor = 0
        for m in marks:
            chunk = line[cursor : m.start()].strip()
            if chunk:
                out.append(chunk)
            cursor = m.start()
        out.append(line[cursor:].strip())
    return "\n".join(out)


def _heading_text(line: str) -> tuple[str, str]:
    m = re.match(r"^(#{1,6})\s+(.*)$", line)
    if not m:
        return "", line
    return m.group(1), m.group(2).strip()


def demote_bad_headings(md: str) -> str:
    """A heading must be short, section-like and text-only.

    Everything else is body text: table captions (``#### 表 1. …``), wrapped
    prose (``### 也侵蚀着…``), and headings that swallowed an image.
    """
    out = []
    for line in md.split("\n"):
        hashes, text = _heading_text(line)
        if not hashes:
            out.append(line)
            continue
        body = IMAGE_REF.sub("", text).strip()
        images = IMAGE_REF.findall(text)
        too_long = len(body) > MAX_HEADING_CHARS
        sentence = bool(SENTENCE_END.search(body))
        caption = re.match(r"^(表|图|Table|Figure|Fig\.?)\s*\d", body)
        sectionish = bool(SECTION_WORDS.match(body))
        if caption:
            out.append(f"**{body}**")
        elif too_long or sentence or (not sectionish and len(body) > 24):
            # 标题吞了正文：能拆就拆出前导的小节名，其余还原成段落。
            head, rest = _split_label(body)
            if head:
                out.append(f"{hashes} {head}")
                if rest:
                    out.append(rest)
            else:
                out.append(body)
        else:
            out.append(f"{hashes} {body}")
        for img in images:
            out.append(img)
    return "\n".join(out)


def _split_label(text: str) -> tuple[str, str]:
    """``摘要 (Abstract) 目的：…`` → (``摘要 (Abstract)``, ``目的：…``)."""
    m = re.match(
        r"^((?:\d+(?:\.\d+)*[.、]?\s+)?(?:摘\s*要|Abstract|关键词|关键字|Keywords?|"
        r"参\s*考\s*文\s*献|References|致\s*谢|声\s*明|结\s*论|讨论|结果|方法|引言|绪论)"
        r"(?:\s*[（(][^）)]{0,20}[）)])?)[，,:：\s]*(.*)$",
        text,
        re.I,
    )
    if not m:
        return "", text
    return m.group(1).strip(), m.group(2).strip()


def drop_title_block(md: str) -> str:
    """Drop everything before 摘要/Abstract — the page header shows the title.

    When a paper has no abstract marker, still drop the leading title/author/
    affiliation block: a run of short lines with digits, daggers and emails
    before the first real paragraph.
    """
    lines = md.split("\n")
    for i, line in enumerate(lines[:80]):
        if ABSTRACT_ONLY.match(line):
            return "\n".join(lines[i:]).lstrip("\n")
    for i, line in enumerate(lines[:40]):
        text = line.strip()
        if len(text) >= 120 and not text.startswith(("#", "!", "|", "**")):
            keep: list[str] = []
            for prev in reversed(lines[max(0, i - 3) : i]):
                if prev.strip().startswith("#"):
                    keep.insert(0, prev.strip())
                    break
            return "\n".join(keep + lines[i:]).lstrip("\n")
    return md


def strip_bold_noise(md: str) -> str:
    """Remove font-switch bold from body text.

    The PDFs alternate CJK/Latin fonts, so pymupdf4llm wraps spans in ``**``;
    the markers are frequently *unbalanced*, so counting matched pairs is not
    enough — a line that opens ``**`` and never closes renders as literal
    asterisks (article 44 had 930 of them).

    Body text therefore loses all bold: the sources use font switches, not
    real emphasis, and stray ``**`` in a journal reader is worse than no
    emphasis. ``tidy_inline`` re-adds the one intentional label
    (``**关键词**：``) afterwards.
    """
    out = []
    for line in md.split("\n"):
        if "**" not in line:
            out.append(line)
            continue
        # 唯一保留的粗体：关键词标签（**关键词**：…）
        if re.match(r"^\s*\*\*(关键词|关键字|Keywords?)\*\*\s*[:：]", line, re.I):
            out.append(line)
            continue
        # 其余一律清掉：包括带 # 的标题行与表格行 —— 标题里的 ** 只是
        # 字体切换的残留，表格里的 ** 会让 GFM 表格断列。
        out.append(line.replace("**", ""))
    return "\n".join(out)


def tidy_inline(md: str) -> str:
    # 关键词 **:** x → 关键词：x
    md = re.sub(
        r"^(关键词|关键字|Keywords?)\s*\*{0,2}\s*[:：]\s*\*{0,2}\s*",
        lambda m: f"**{m.group(1)}**：",
        md,
        flags=re.M | re.I,
    )
    md = re.sub(r"\*\*\s*([:：])\s*\*\*", lambda m: m.group(1), md)
    md = CJK_GAP.sub("", md)
    # 标题内不再保留粗体（无意义，且会被目录取词）
    md = re.sub(
        r"^(#{1,6})\s*\*\*([^*]+)\*\*\s*",
        lambda m: f"{m.group(1)} {m.group(2).strip()} ",
        md,
        flags=re.M,
    )
    md = re.sub(r"^(#{1,6})([^\s#])", lambda m: f"{m.group(1)} {m.group(2)}", md, flags=re.M)
    # 摘要统一 H2
    md = re.sub(r"^#{3,6}\s*(摘\s*要|Abstract|ABSTRACT)\s*$", r"## \1", md, flags=re.M)
    return md


def demote_long_headings(md: str) -> str:
    """Final safety net: a heading longer than a title is body text.

    Runs after bold removal so length is measured on real text — font-switch
    ``**`` used to inflate it and 60–200 char "headings" slipped through.
    """
    out = []
    for line in md.split("\n"):
        hashes, text = _heading_text(line)
        if hashes and len(text) > MAX_HEADING_CHARS:
            head, rest = _split_label(text)
            if head and len(head) <= MAX_HEADING_CHARS:
                out.append(f"{hashes} {head}")
                if rest:
                    out.append(rest)
                continue
            out.append(text)
            continue
        out.append(line)
    return "\n".join(out)


def clean(md: str) -> str:
    md = normalise(strip_tags(md))
    md = strip_boilerplate(md)
    md = split_merged_headings(md)
    md = drop_title_block(md)
    # 先去掉字体切换伪粗体：标题长度要按真实文字量测。
    md = strip_bold_noise(md)
    md = demote_bad_headings(md)
    md = demote_long_headings(md)
    md = tidy_inline(md)
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    return md


__all__ = ["clean"]
