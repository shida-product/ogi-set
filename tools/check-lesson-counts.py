#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
教訓カウントの整合チェッカ — 件数 drift の再発防止。

正本（唯一の真実）= 各カテゴリファイル内の `### ` 見出し（＝1教訓）の実数。
これと以下の手書きカウントが一致するか検証する（**宣言されている箇所だけ** 照合する）:
  - 各カテゴリファイル末尾の `教訓数: N`
  - .agents/lessons.md の索引表にカウント列がある場合の N
  - .agents/lessons/README.md の索引表にカウント列がある場合の N
  - .agents/lessons.md の `全教訓数: N`（= 全カテゴリ実数の合計）

設計方針（テンプレ汎用版）:
  カウントを宣言していない索引・フッタは「未追跡」とみなしてスキップする。
  → プロジェクトがカウント運用を採用していなくても誤検知しない。
  → 一度カウントを書いたら、以降は実数とずれた瞬間に検出される。

不一致があれば一覧表示して exit 1。pre-commit で .agents/lessons 配下が変更されたら自動実行する。
使い方: python tools/check-lesson-counts.py
"""
import re, io, sys, os, glob

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

LESSONS_DIR = ".agents/lessons"
SUMMARY = ".agents/lessons.md"
README = os.path.join(LESSONS_DIR, "README.md")

def read(path):
    try:
        with open(path, "rb") as f:
            return f.read().decode("utf-8", errors="replace")
    except OSError:
        return ""

def actual_counts():
    """カテゴリ名 -> 実 ### 見出し数"""
    out = {}
    for p in sorted(glob.glob(os.path.join(LESSONS_DIR, "*.md"))):
        name = os.path.splitext(os.path.basename(p))[0]
        if name == "README":
            continue
        out[name] = len(re.findall(r"(?m)^### ", read(p)))
    return out

def footer_count(name):
    m = re.search(r"教訓数:\s*(\d+)", read(os.path.join(LESSONS_DIR, name + ".md")))
    return int(m.group(1)) if m else None

def index_counts(path, link_re):
    """索引表から カテゴリ名 -> 宣言カウント（カウント列がある行だけ）"""
    out = {}
    for line in read(path).splitlines():
        m = link_re.search(line)
        if m:
            out[m.group(1)] = int(m.group(2))
    return out

def main():
    actual = actual_counts()
    problems = []

    # 1) 各カテゴリ footer（宣言がある時だけ照合）
    for name, n in actual.items():
        fc = footer_count(name)
        if fc is not None and fc != n:
            problems.append(f"{name}.md footer 教訓数={fc} だが実数={n}")

    # 2) lessons.md 索引（| [lessons/css.md](lessons/css.md) | 18 | のようにカウント列がある時だけ）
    sm_idx = index_counts(SUMMARY, re.compile(r"\[lessons/([a-z-]+)\.md\][^|]*\|\s*(\d+)\s*\|"))
    for name, n in actual.items():
        if name in sm_idx and sm_idx[name] != n:
            problems.append(f"lessons.md 索引 {name}={sm_idx[name]} だが実数={n}")

    # 3) README.md 索引（| [css.md](css.md) | 18 | のようにカウント列がある時だけ）
    rm_idx = index_counts(README, re.compile(r"\[([a-z-]+)\.md\]\(\1\.md\)\s*\|\s*(\d+)\s*\|"))
    for name, n in actual.items():
        if name in rm_idx and rm_idx[name] != n:
            problems.append(f"README.md 索引 {name}={rm_idx[name]} だが実数={n}")

    # 4) lessons.md の全教訓数（宣言がある時だけ）
    total_actual = sum(actual.values())
    m = re.search(r"全教訓数:\s*(\d+)", read(SUMMARY))
    if m and int(m.group(1)) != total_actual:
        problems.append(f"lessons.md 全教訓数={m.group(1)} だが実数合計={total_actual}")

    if problems:
        print("教訓カウントの不整合を検出しました（正本 = 各ファイルの `### ` 実数）:")
        for p in problems:
            print(f"  ✗ {p}")
        print(f"\n実数: {actual}（合計 {total_actual}）")
        print("対処: 各 footer / lessons.md 索引・全教訓数 / README.md 索引 を実数に合わせてください。")
        return 1
    print(f"教訓カウント整合 OK（{len(actual)} カテゴリ / 合計 {total_actual} / 宣言箇所のみ照合）")
    return 0

if __name__ == "__main__":
    sys.exit(main())
