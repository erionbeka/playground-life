#!/usr/bin/env python3
"""Minimal Markdown -> print-ready HTML converter (first-party tooling).

Copyright (c) 2026 Erion Beka. All rights reserved. Proprietary.

Used to turn the documents under docs/ into HTML that a headless browser
(Chromium/Edge) can print to PDF:

    py -3 scripts/md2html.py <input.md> <output.html>
    msedge --headless --disable-gpu --no-pdf-header-footer \
        "--print-to-pdf=out.pdf" file:///<abs-path>/output.html

Supports the subset of Markdown used by the project docs: ATX headings
(#..###), bold/italic/inline-code, unordered and ordered lists, blockquotes,
horizontal rules and simple pipe tables. Not a general-purpose parser.
"""

import sys
import html
import pathlib
import re

CSS = """
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Times New Roman", Georgia, serif; font-size: 11pt; line-height: 1.45; color: #111; }
h1 { font-size: 17pt; text-align: center; margin: 0 0 2pt; }
h2 { font-size: 12.5pt; margin: 16pt 0 6pt; border-bottom: 1px solid #999; padding-bottom: 2pt; page-break-after: avoid; }
h3 { font-size: 11.5pt; margin: 12pt 0 4pt; page-break-after: avoid; }
p { margin: 5pt 0; text-align: justify; }
ul, ol { margin: 5pt 0 5pt 20pt; padding: 0; }
li { margin: 2pt 0; }
blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #f4f4f4; border-left: 3px solid #888; font-size: 10pt; }
hr { border: none; border-top: 1px solid #bbb; margin: 12pt 0; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }
th, td { border: 1px solid #666; padding: 5pt; vertical-align: top; text-align: left; }
th { background: #eee; }
strong { font-weight: bold; }
"""


def inline(t):
    t = html.escape(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"<em>\1</em>", t)
    t = re.sub(r"`(.+?)`", r"<code>\1</code>", t)
    return t


def is_special(s):
    if s == "":
        return True
    if s == "---":
        return True
    if re.match(r"^#{1,3} ", s):
        return True
    if s.startswith(">"):
        return True
    if s.startswith("|"):
        return True
    if re.match(r"^[-*] ", s):
        return True
    if re.match(r"^\d+\. ", s):
        return True
    return False


def convert(text):
    lines = text.replace("\r\n", "\n").split("\n")
    out = []
    i = 0
    n = len(lines)
    while i < n:
        s = lines[i].strip()
        if s == "":
            i += 1
            continue
        if s == "---":
            out.append("<hr>")
            i += 1
            continue
        m = re.match(r"^(#{1,3}) (.*)$", s)
        if m:
            lvl = len(m.group(1))
            out.append(f"<h{lvl}>{inline(m.group(2))}</h{lvl}>")
            i += 1
            continue
        if s.startswith(">"):
            buf = []
            while i < n and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip().lstrip(">").strip())
                i += 1
            out.append("<blockquote>" + inline(" ".join(buf)) + "</blockquote>")
            continue
        if s.startswith("|"):
            rows = []
            while i < n and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                rows.append(cells)
                i += 1
            out.append(render_table(rows))
            continue
        if re.match(r"^[-*] ", s):
            items = []
            while i < n and re.match(r"^[-*] ", lines[i].strip()):
                parts = [lines[i].strip()[2:].strip()]
                i += 1
                while i < n and not is_special(lines[i].strip()):
                    parts.append(lines[i].strip())
                    i += 1
                items.append(" ".join(parts))
            out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ul>")
            continue
        if re.match(r"^\d+\. ", s):
            items = []
            while i < n and re.match(r"^\d+\. ", lines[i].strip()):
                parts = [re.sub(r"^\d+\. ", "", lines[i].strip())]
                i += 1
                while i < n and not is_special(lines[i].strip()):
                    parts.append(lines[i].strip())
                    i += 1
                items.append(" ".join(parts))
            out.append("<ol>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ol>")
            continue
        parts = [s]
        i += 1
        while i < n and not is_special(lines[i].strip()):
            parts.append(lines[i].strip())
            i += 1
        out.append("<p>" + inline(" ".join(parts)) + "</p>")
    return "\n".join(out)


def render_table(rows):
    if not rows:
        return ""
    body = rows
    header = None
    if len(rows) >= 2 and all(set(c) <= set("-: ") for c in rows[1]):
        header = rows[0]
        body = rows[2:]
    h = "<table>"
    if header:
        h += "<tr>" + "".join(f"<th>{inline(c)}</th>" for c in header) + "</tr>"
    for r in body:
        h += "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>"
    h += "</table>"
    return h


def document(body, css=CSS, title=""):
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>{html.escape(title)}</title>"
        f"<style>{css}</style></head><body>{body}</body></html>"
    )


def main():
    if len(sys.argv) != 3:
        print("usage: md2html.py <input.md> <output.html>", file=sys.stderr)
        raise SystemExit(2)
    src = pathlib.Path(sys.argv[1])
    dst = pathlib.Path(sys.argv[2])
    body = convert(src.read_text(encoding="utf-8"))
    dst.write_text(document(body, title=src.stem), encoding="utf-8")
    print("wrote", dst)


if __name__ == "__main__":
    main()
