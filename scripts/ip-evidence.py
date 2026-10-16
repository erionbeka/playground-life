#!/usr/bin/env python3
"""Generate a timestamped authorship-evidence manifest for this repository.

Copyright (c) 2026 Erion Beka. All rights reserved. Proprietary.

Records the repository state (commit and tree identifiers), independent
SHA-256 digests of the tracked tree and of key first-party documents, and
instructions for external timestamping. Writes, under docs/legal/evidence/:

    ip-evidence-manifest.md      human-readable summary
    ip-evidence-manifest.json    machine-readable, full detail
    ip-evidence-manifest.sha256  checksum of the JSON file

Usage:
    py -3 scripts/ip-evidence.py

This is evidence of provenance only. It is not legal advice.
"""

import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs" / "legal" / "evidence"
PRODUCT = "Playground Life"
AUTHOR = "Erion Beka"

KEY_DOCS = [
    "LICENSE",
    "COPYRIGHT",
    "NOTICE",
    "AUTHORS",
    "README.md",
    "package.json",
    "docs/ip-provenance.md",
    "docs/legal/team-ip-confirmation.md",
    "docs/legal/team-ip-confirmation-sq.md",
    "docs/legal/authorship-declaration.md",
    "docs/legal/authorship-declaration-sq.md",
    "docs/legal/ip-assignment.md",
    "docs/legal/mutual-nda.md",
]

SUBTREES = ["src", "server", "docs", "scripts"]


def git(*args):
    """Run a git command in the repository root and return stdout."""
    return subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout


def git_optional(*args):
    try:
        out = git(*args)
        return out.strip()
    except subprocess.CalledProcessError:
        return ""


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def listing_digest(pathspec=None):
    args = ["ls-tree", "-r", "HEAD"]
    if path:
        pass
    if pathspec:
        args += ["--", subtree]
    listing = git(*args)
    return hashlib.sha256(tree_listing.encode("utf-8")).hexdigest()


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    head = git("rev-parse", "HEAD").strip()
    tree = git("rev-parse", "HEAD^{tree}").strip()
    commit_date = git("show", "-s", "--format=%cI", "HEAD").strip()
    try:
        branch = git("rev-parse", "--abbrev-ref", "HEAD").strip()
    except subprocess.CalledProcessError:
        branch = ""
    try:
        remote = git("config", "--get", "remote.origin.url").strip()
    except subprocess.CalledProcessError:
        remote = ""

    count = git("rev-list", "--count", "HEAD").strip()
    history = git("log", "--reverse", "--format=%cI|%H").strip().splitlines()
    first = history[0].split("|") if history else ["", ""]
    last = history[-1].split("|") if history else ["", ""]

    tree_listing = git("ls-tree", "-r", "HEAD")
    tree_digest = hashlib.sha256(tree_listing.encode("utf-8")).hexdigest()
    tracked = len([ln for ln in tree_listing.splitlines() if ln.strip()])

    subtrees = {}
    for sub in SUBTREES:
        listing = git("ls-tree", "-r", "HEAD", "--", sub)
        subtrees[sub] = {
            "files": len([ln for ln in listing.splitlines() if ln.strip()]),
            "sha256": hashlib.sha256(listing.encode("utf-8")).hexdigest(),
        }

    key_docs = []
    for rel in KEY_DOCS:
        p = ROOT / rel
        if not p.exists():
            continue
        data = p.read_bytes()
        key_docs.append(
            {"path": rel, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        )
    key_digest = hashlib.sha256(
        "\n".join(f"{d['path']}  {d['sha256']}" for d in key_docs).encode("utf-8")
    ).hexdigest()

    payload = {
        "manifest_version": 1,
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "product": PRODUCT,
        "author": AUTHOR,
        "repository": {
            "branch": branch,
            "commit": head,
            "tree": tree,
            "commit_date_utc": last[0] if last else "",
            "remote": remote,
            "tracked_files": tracked,
            "commits": int(count) if count.isdigit() else count,
            "first_commit": first[1] if len(first) > 1 else "",
            "first_commit_date_utc": first[0] if first else "",
        },
        "digests": {
            "tree_listing_sha256": tree_digest,
            "subtrees": subtrees,
            "key_documents_sha256": key_digest,
        },
        "key_documents": key_docs,
    }

    json_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    manifest_digest = hashlib.sha256(json_text.encode("utf-8")).hexdigest()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "ip-evidence-manifest.json").write_text(json_text, encoding="utf-8")
    (OUT_DIR / "ip-evidence-manifest.sha256").write_text(
        f"{manifest_digest}  ip-evidence-manifest.json\n", encoding="utf-8"
    )

    def row(cells):
        return "| " + " | ".join(str(c) for c in cells) + " |"

    md = []
    md.append("# IP Evidence Manifest — Playground Life")
    md.append("")
    md.append(f"**Generated (UTC):** {payload['generated_utc']}  ")
    md.append(f"**Product:** {PRODUCT}  ")
    md.append(f"**Author / owner:** {AUTHOR}  ")
    md.append(f"**Manifest file SHA-256:** `{manifest_digest}`")
    md.append("")
    md.append(
        "> This manifest records the state of the repository at generation time. "
        "It is intended as **evidence of provenance** — it supports, but does not "
        "replace, the copyright that subsists automatically under Law No. 08/L-205. "
        "It is not legal advice."
    )
    md.append("")
    md.append("## Repository state")
    md.append("")
    md.append(row(["Field", "Value"]))
    md.append(row(["---", "---"]))
    md.append(row(["Branch", f"`{branch}`"]))
    md.append(row(["Commit", f"`{head}`"]))
    md.append(row(["Tree", f"`{tree}`"]))
    md.append(row(["Commit date (UTC)", payload["repository"]["commit_date_utc"]]))
    md.append(row(["Remote", remote or "—"]))
    md.append(row(["Tracked files", tracked]))
    md.append(row(["Commits (history)", count]))
    md.append(row(["First commit", f"`{first[1]}`" if len(first) > 1 else "—"]))
    md.append(row(["First commit date (UTC)", first[0] if first else "—"]))
    md.append("")
    md.append("## Independent content digests (SHA-256)")
    md.append("")
    md.append(
        "Computed independently of git, so a third party can verify file contents "
        "without trusting the repository."
    )
    md.append("")
    md.append(row(["Scope", "Files", "SHA-256"]))
    md.append(row(["---", "---", "---"]))
    md.append(row(["Full tracked tree", tracked, f"`{tree_digest}`"]))
    for sub, info in subtrees.items():
        md.append(row([f"`{sub}/`", info["files"], f"`{info['sha256']}`"]))
    md.append("")
    md.append("## Key documents")
    md.append("")
    md.append(row(["Path", "Bytes", "SHA-256"]))
    md.append(row(["---", "---", "---"]))
    for d in key_docs:
        md.append(row([f"`{d['path']}`", d["bytes"], f"`{d['sha256']}`"]))
    md.append("")
    md.append(f"**Key-documents digest (SHA-256):** `{key_digest}`")
    md.append("")
    md.append("## Timestamping / notarisation (optional, recommended)")
    md.append("")
    md.append(
        "To prove that this manifest existed at a given moment, obtain an "
        "independent timestamp of its SHA-256:"
    )
    md.append("")
    md.append("- **OpenTimestamps** (free, blockchain-anchored):")
    md.append("")
    md.append("  ```")
    md.append("  ots stamp docs/legal/evidence/ip-evidence-manifest.json")
    md.append("  # later, after the Bitcoin anchor is confirmed:")
    md.append("  ots upgrade docs/legal/evidence/ip-evidence-manifest.json.ots")
    md.append("  ots verify docs/legal/evidence/ip-evidence-manifest.json.ots")
    md.append("  ```")
    md.append("")
    md.append(
        "- **Notary** (Republic of Kosovo): present this manifest, or a printed "
        "PDF of it, to a notary and have the date certified."
    )
    md.append(
        "- **GPG** (optional detached signature with a personal key): "
        "`gpg --armor --detach-sign docs/legal/evidence/ip-evidence-manifest.json`"
    )
    md.append("")
    md.append("## Files in this bundle")
    md.append("")
    md.append("- `ip-evidence-manifest.md` — this summary.")
    md.append("- `ip-evidence-manifest.json` — full machine-readable detail.")
    md.append("- `ip-evidence-manifest.sha256` — checksum of the JSON file.")
    md.append("")
    md.append("---")
    md.append("")
    md.append("*Evidence of provenance only. Not legal advice.*")
    md.append("")

    (OUT_DIR / "ip-evidence-manifest.md").write_text("\n".join(md), encoding="utf-8")
    print("wrote", OUT_DIR / "ip-evidence-manifest.md")
    print("wrote", OUT_DIR / "ip-evidence-manifest.json")
    print("manifest sha256:", manifest_digest)


if __name__ == "__main__":
    sys.exit(main())
