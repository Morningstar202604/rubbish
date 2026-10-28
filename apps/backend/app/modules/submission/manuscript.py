"""Manuscript → Markdown conversion for online reading.

设计取舍（0.6.2）：

- 在线阅读渲染 Markdown（富排版、图片、公式、移动端友好），PDF 原件
  只作为下载通道；浏览器端 PDF 渲染（pdf.js）降级为无 md 稿件的兜底。
- 转换是**尽力而为**：任何失败返回 None（保留 PDF 即可），绝不让上传
  失败。日志记录原因，不向作者报错。
- PDF 用 pymupdf4llm（版面感知的文本流 + 图片抽取，图片以 data URI
  内嵌，Markdown 自包含）再经 ``markdown_clean`` 做结构清洗（双栏拼接
  产生的「标题+正文同行」、字体切换伪粗体、刊头与重跑页眉都在这一步处理）；
  docx 用 mammoth（语义 HTML）+ markdownify。
  老式 .doc / PS / ZIP 不转换（None），阅读器回退 PDF。
- 转换结果纯 Markdown 文本，不含原始 HTML —— 前端 react-markdown
  默认转义 HTML，XSS 面为零。

PDF 解析/渲染在不可控输入上崩溃的隔离：整段转换包在 try/except 里，
pymupdf 自身对损坏文件抛异常而不是 segfault（mupdf 以外挂沙盒态运行
解析器），历史版本的安全公告走依赖审计管道（pip-audit）。
"""

from __future__ import annotations

import base64
import logging
import os
import re
import tempfile
from io import BytesIO
from pathlib import Path

logger = logging.getLogger(__name__)

_MD_SUFFIX = ".md"


def _pdf_to_markdown(contents: bytes) -> str | None:
    """PDF → Markdown（pymupdf4llm），图片内嵌为 data URI。"""
    import pymupdf
    import pymupdf4llm

    doc = pymupdf.open(stream=contents, filetype="pdf")
    try:
        if doc.is_encrypted:
            logger.info("manuscript_convert_skipped reason=encrypted_pdf")
            return None
        with tempfile.TemporaryDirectory(prefix="rubbish-md-") as tmp:
            md = pymupdf4llm.to_markdown(
                doc,
                write_images=True,
                image_path=tmp,
                image_format="png",
                image_size_limit=0.0,
                dpi=110,
            )
            # pymupdf4llm 产出对临时目录图片的文件引用：逐个内嵌为 data URI，
            # 让 Markdown 自包含（阅读器无需额外的图片端点）。
            # 引用可能是裸文件名，也可能是带临时目录的绝对路径（Windows 上实测
            # 为 `![](C:/Users/.../Temp/rubbish-md-xxx/-0001-00.png)`），所以按
            # 文件名匹配所有形如 `](含有该文件名的路径)` 的引用，统一替换。
            for name in sorted(os.listdir(tmp)):
                path = Path(tmp, name)
                if not path.is_file():
                    continue
                b64 = base64.b64encode(path.read_bytes()).decode("ascii")
                data_uri = f"data:image/png;base64,{b64}"
                pattern = r"!\[([^\]]*)\]\(([^)\n]*" + re.escape(name) + r")\)"
                md = re.sub(pattern, f"![\\g<1>]({data_uri})", md)
        md = md.strip()
        return md or None
    finally:
        doc.close()


def _docx_to_markdown(contents: bytes) -> str | None:
    """docx → Markdown（mammoth 语义 HTML + markdownify）。"""
    import mammoth
    from markdownify import markdownify

    result = mammoth.convert_to_html(BytesIO(contents))
    html = result.value
    md = markdownify(html, heading_style="ATX").strip()
    return md or None


def convert_to_markdown(contents: bytes, filename: str) -> str | None:
    """尽力把上传稿件转成 Markdown；不支持或失败一律返回 None。"""
    ext = os.path.splitext(filename or "")[1].lower()
    try:
        if ext == ".pdf":
            md = _pdf_to_markdown(contents)
            # 统一清洗：去 HTML 标签/刊头重跑行/页码，摘要升为 H2。
            # 与历史 267 篇导入稿使用同一函数，保证新旧稿件阅读体验一致。
            from app.modules.submission.markdown_clean import clean

            return clean(md) if md else md
        if ext in (".docx",):
            return _docx_to_markdown(contents)
        if ext in (".txt", ".md", ".markdown"):
            text = contents.decode("utf-8", errors="replace").strip()
            return text or None
        # .doc / .ps / .zip：不转换（阅读器回退 PDF 视图）。
        logger.info("manuscript_convert_skipped reason=unsupported ext=%s", ext)
        return None
    except Exception:
        # 转换是增值能力：损坏/加密/超纲的输入一律静默降级。
        logger.warning("manuscript_convert_failed ext=%s", ext, exc_info=True)
        return None


def markdown_storage_key(file_path: str) -> str:
    """与原稿件同目录、同主名的 .md key（{tenant}/{sid}/{name}.md）。"""
    return str(Path(file_path).with_suffix(_MD_SUFFIX)).replace("\\", "/")


__all__ = ["convert_to_markdown", "markdown_storage_key"]
