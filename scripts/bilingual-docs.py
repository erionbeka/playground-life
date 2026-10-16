#!/usr/bin/env python3
"""Build a side-by-side bilingual (English | Albanian) HTML for two Markdown
documents that share the same section structure.

Copyright (c) 2026 Erion Beka. All rights reserved. Proprietary.

Usage:
    py -3 scripts/bilingual-docs.py <left.md> <right.md> <out.html> [title]

    msedge --headless --disable-gpu --no-pdf-header-footer \
        "--print-to-pdf=out.pdf" file:///<abs-path>/out.html

Both inputs are split at top-level "## " headings and aligned by position, so
the two documents must use the same number and order of sections. The first
block (everything before the first "## ") becomes the top row.
"""

import html
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from md2html import convert  # noqa: E402

CSS = """
@page { size: A4 landscape; margin: 12mm 12mm 14mm; }
* { box-sizing: border-box; }
body { font-family: "Times New Roman", Georgia, serif; font-size: 9.5pt; line-height: 1.38; color: #111; }
h1 { font-size: 15pt; text-align: center; margin: 0 0 6pt; }
table.bi { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.bi > thead > tr > th {
  font-size: 10pt; text-align: left; background: #eee; color: #333;
  border: 1px solid #999; padding: 3pt 8pt; letter-spacing: 0.03em;
}
table.bi > tbody > tr > td {
  width: 50%; vertical-align: top; padding: 6pt 10pt;
  border-bottom: 1px solid #ccc; border-left: 1px solid #ddd; border-right: 1px solid #ddd;
}
table.bi h2 { font-size: 10.5pt; margin: 2pt 0 4pt; border-bottom: 1px solid #bbb; padding-bottom: 1pt; page-break-after: avoid; }
table.bi h3 { font-size: 10pt; margin: 6pt 0 3pt; page-break-after: avoid; }
table.bi p { margin: 3pt 0; text-align: justify; }
table.bi ul, table.bi ol { margin: 3pt 0 3pt 16pt; padding: 0; }
table.bi li { margin: 1pt 0; }
table.bi blockquote { margin: 4pt 0; padding: 4pt 7pt; background: #f4f4f4; border-left: 3px solid #888; font-size: 9pt; }
table.bi hr { border: none; border-top: 1px solid #bbb; margin: 6pt 0; }
table.bi table { border-collapse: collapse; width: 100%; margin: 4pt 0; font-size: 8.5pt; }
table.bi table th, table.bi table td { border: 1px solid #999; padding: 3pt; vertical-align: top; text-align: left; }
table.bi table th { background: #f0f0f0; }
"""


def split_sections(text):
    """Split Markdown into blocks, starting a new block at each "## " heading."""
    lines = text.replace("\r\n", "\n").split("\n")
    blocks = []
    cur = []
    for ln in lines:
        if ln.startswith("## "):
            blocks.append("\n".join(cur))
            cur = [ln]
        else:
            cur.append(ln)
    blocks.append("\n".join(cur))
    return blocks


def build_html(left_blocks, right_html, title):
    pass


def main():
    if len(sys.argv) < 4:
        print("usage: bilingual-docs.py <left.md> <right.md> <out.html> [title]", file=sys.stderr)
        raise SystemExit(2)
    left_md, right_md, out = sys.argv[1], sys.argv[2], sys.argv[3]
    title = sys.argv[4] if len(sys.argv) > 4 else "Bilingual document"

    left = split_sections(pathlib.Path(left_md).read_text(encoding="utf-8"))
    right = split_sections(pathlib.Path(right_md).read_text(encoding="utf-8"))
    n = max(len(left), len(right))
    left += [""] * (n - len(left))
    right += [""] * (n - len(right))

    rows = "".join(
        "<tr><td>" + convert(l) + "</td><td>" + convert(r) + "</td></tr>"
        for l, r in zip(left, right)
    )
    body = (
        f"<h1>{html.escape(title)}</h1>"
        "<table class='bi'><thead><tr><th>English</th><th>Shqip</th></tr></thead>"
        "<tbody>" + rows + "</tbody></table>"
    )
    pathlib.Path(out).write_text(
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>{html.escape(title)}</title><style>{CSS}</style></head><body>{body}</body></html>",
        encoding="utf-8",
    )
    print("wrote", out)


if __name__ == "__main__":
    main()
