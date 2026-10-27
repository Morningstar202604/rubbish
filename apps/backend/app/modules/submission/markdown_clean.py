"""Clean pymupdf4llm output for the online reader.

Applied at upload time (``manuscript.convert_to_markdown``) so new submissions
get exactly the same treatment as the imported back catalogue.

Issues fixed here (all visible to readers on /reader/<id>):
1. Raw HTML tags (`<sup>1,*</sup>`) — the reader has no rehype-raw, so they
   render as literal text.
2. Journal boilerplate at the top: running header, "Open Access", received /
   accepted dates, the old site URL, the 48pt masthead, and the duplicate
   title/authors/affiliation block that the page header already shows.
3. Masthead artefacts: "Rubbish - 于荒诞处见同路人", page numbers, and running
   heads repeated in the middle of the body.
4. Inline noise: `关键词 **:** x`, bold inside headings, spaces left inside CJK
   runs by PDF line breaking.
"""

from __future__ import annotations

import re

BOILER = re.compile(
    r"^\s*(?:#{1,6}\s*)?\**\s*(?:"
    r"Rubbish\s*[-—]\s*于荒诞处见同路人|"
    r"Open Access(\s*Research Article)?|Research Article|"
    r"Received\s+\d|Accepted\s+\d|"
    r"https?://\S+|"
    r"RUBBISH\s*$|RUBBIS\s*H\s*$|"
    r"MID:\s*\S*|"
    r"Volume\s+\S+\s*\|.*|"
    r"\d{1,3}"
    r")\s*\**\s*$",
    re.I,
)

ABSTRACT_START = re.compile(r"^\s*(?:#+\s*)?(摘\s*要|Abstract|ABSTRACT|抽\s*象)\b", re.I)

TAG = re.compile(r"</?(?:sup|sub|i|b|em|strong|span|font|div|p|br)\b[^>]*>", re.I)
CJK_GAP = re.compile(r"(?<=[\u4e00-\u9fff])[ \t]+(?=[\u4e00-\u9fff])")


def strip_tags(md: str) -> str:
    """Drop inline HTML: the reader renders Markdown only (no rehype-raw)."""
    md = TAG.sub("", md)
    md = md.replace("<br>", " ").replace("<br/>", " ").replace("<br />", " ")
    return md


def drop_prefix(md: str) -> str:
    """Drop everything before 摘要/Abstract.

    The page header already renders title, authors and discipline, so keeping
    a second title block only pushes the abstract below the fold.
    """
    lines = md.split("\n")
    for i, line in enumerate(lines[:80]):
        if ABSTRACT_START.match(line):
            return "\n".join(lines[i:]).lstrip("\n")
    return md


def _is_running_head(line: str) -> bool:
    """Running heads survive as `**Rubbish -** 于荒诞处见同路人`.

    The bold marker sits *inside* the phrase, so an anchored regex is
    fragile: strip `#`/`*`/whitespace and compare the compact form.
    """
    compact = re.sub(r"[\s#*]", "", line)
    return compact in {
        "Rubbish-于荒诞处见同路人",
        "Rubbish—于荒诞处见同路人",
        "于荒诞处见同路人",
        "RUBBISH",
        "RUBBISHVolume",
    }


def drop_running_heads(md: str) -> str:
    out = []
    for line in md.split("\n"):
        s = line.strip()
        if len(s) < 120 and (_is_running_head(s) or BOILER.match(s)):
            continue
        out.append(line)
    md = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", md).strip()


def tidy_inline(md: str) -> str:
    """Inline cleanup that readers actually notice."""
    md = re.sub(
        r"^(关键词|关键字|Keywords?)\s*\*\*\s*[:：]\s*\*\*[ 	]*",
        lambda m: f"{m.group(1)}：",
        md,
        flags=re.M | re.I,
    )
    md = re.sub(r"\*\*\s*([:：])\s*\*\*", lambda m: m.group(1), md)
    md = re.sub(
        r"^(#{1,6})\s*\*\*([^*]+)\*\*\s*",
        lambda m: f"{m.group(1)} {m.group(2).strip()} ",
        md,
        flags=re.M,
    )
    md = CJK_GAP.sub("", md)
    return md


def clean(md: str) -> str:
    md = strip_tags(md)
    md = drop_prefix(md)
    md = drop_running_heads(md)
    md = tidy_inline(md)
    md = re.sub(
        r"^(#{1,6})([^\s#])",
        lambda m: f"{m.group(1)} {m.group(2)}",
        md,
        flags=re.M,
    )
    # 摘要现在是正文第一屏，统一成 H2（原来是 H3，字号比小节标题还小）
    md = re.sub(r"^#{3,6}\s*(摘\s*要|Abstract|ABSTRACT)\s*$", r"## \1", md, flags=re.M)
    return md


__all__ = ["clean"]
