#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
文字化け（Mojibake）検出 linter — 再発防止の最後の砦。

検出対象（過去事故 .agents/lessons/encoding.md 参照）:
  - Type-B: U+FFFD（置換文字 `�`）の混入。正当なソースには絶対現れない → 確実にブロック。
  - Type-A: CJK 文字の直後に孤立した大文字 `E`（`、E` `。E` 等）。  lint-encoding-ignore
            PowerShell Set-Content 等のエンコーディング事故の典型アーティファクト。
            `E2E` / `E-mail` / `A〜E` のような正当表記は誤検出しないよう除外。

使い方:
  python tools/lint-encoding.py            # リポジトリ全体を走査（CI / 手動）
  python tools/lint-encoding.py --staged   # git にステージ済みのファイルのみ（pre-commit 用）
  python tools/lint-encoding.py <file>...  # 指定ファイルのみ

誤検出を許容する行には `lint-encoding-ignore` というコメントを書けばスキップされる。
終了コード: 検出あり=1 / なし=0
"""
import re, io, sys, os, subprocess

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# 日本語を含むソース／ドキュメントを広く対象にする（このテンプレは Python / Web / Markdown）。
EXTS = (".py", ".js", ".jsx", ".ts", ".tsx", ".vue", ".php", ".css", ".scss",
        ".html", ".htm", ".md", ".json", ".yml", ".yaml", ".txt")
SKIP_DIRS = {".git", "node_modules", "vendor", "dist", "build", ".githooks",
             ".ruff_cache", "__pycache__", ".venv"}
IGNORE_MARK = "lint-encoding-ignore"

FFFD = "�"  # U+FFFD  lint-encoding-ignore
# Type-A: かな/漢字 or 読点・句点 の直後に、英数字・ハイフンが続かない孤立した E
# （E2E / E-mail / A〜E などの正当表記を除外するため leading から 〜・ を外し、
#   trailing から [A-Za-z0-9-] を除外している）
TYPE_A = re.compile(r"[、。぀-ヺー-ヿ一-鿿]E(?![A-Za-z0-9\-])")


def scan_file(path):
    hits = []
    try:
        with open(path, "rb") as f:
            text = f.read().decode("utf-8", errors="replace")
    except (OSError, ValueError):
        return hits
    for i, line in enumerate(text.split("\n"), 1):
        if IGNORE_MARK in line:
            continue
        if FFFD in line:
            hits.append((i, "U+FFFD", line.strip()[:80]))
        elif TYPE_A.search(line):
            hits.append((i, "Type-A (CJK+孤立E)", line.strip()[:80]))  # lint-encoding-ignore
    return hits


def collect_targets(argv):
    flags = [a for a in argv if a.startswith("--")]
    files = [a for a in argv if not a.startswith("--")]
    if "--staged" in flags:
        out = subprocess.check_output(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"]
        ).decode("utf-8")
        return [p for p in out.splitlines() if p.lower().endswith(EXTS) and os.path.exists(p)]
    if files:
        return [p for p in files if p.lower().endswith(EXTS)]
    targets = []
    for root, dirs, fnames in os.walk("."):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fn in fnames:
            if fn.lower().endswith(EXTS):
                targets.append(os.path.join(root, fn))
    return targets


def main(argv):
    targets = collect_targets(argv)
    total = 0
    for path in sorted(targets):
        hits = scan_file(path)
        if hits:
            total += len(hits)
            print(f"\n✗ {path}")
            for ln, kind, snippet in hits:
                print(f"    L{ln} [{kind}] {snippet}")
    if total:
        print(f"\n文字化けを {total} 件検出しました。コミットを中止します。")
        print("対処: クリーンな状態に戻すか、正当な表記なら該当行に `lint-encoding-ignore` を付けてください。")
        return 1
    print(f"文字化けなし（{len(targets)} ファイル走査）")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
