# AI ハーネス（hooks / pre-commit / 診断ツール）

`.agents/` の正本ルールを「機械的に守らせる網」。AI が暴走しても事故に至りにくくするための、
ツール非依存な土台（`harimomi-wordpress` の運用知見を汎用化して取り込んだもの）。

> ガードは網であって最終防衛ではない。最終防衛は人間レビュー＋ RULES。
> どれも fail-open / 自動 skip 設計で、ハーネス自身が作業を止めないことを優先している。

---

## 1. 危険操作ガード（PreToolUse hook）

| 項目 | 値 |
|---|---|
| 本体 | `.claude/hooks/guard.cjs` |
| 配線 | `.claude/settings.json` の `hooks.PreToolUse` |
| 有効化 | Claude Code が `.claude/settings.json` を自動ロード（手動操作不要） |

Bash / PowerShell / Edit / Write 等の実行内容を検査し、3 段階で判定する。

- **deny（機械遮断）**: force push / 履歴改変、秘密情報ファイル（`.env` 実体・`secrets.json`・`*.pem` 等）の書き換え・削除
- **ask（人間が承認）**: あらゆる `git push`、`reset --hard` / `clean -f` / `checkout --`、CI 定義・ロックファイルの編集、PowerShell でのファイル書き換え（文字化け事故防止）
- **通過**: それ以外（何も出力しない）

`.env.sample` / `.env.example` / `.env.template` は雛形なので deny しない。

### プロジェクト固有ルールの追加

`guard.cjs` のテンプレ初期値は「どのプロジェクトでも危険」な操作のみ。決済キー・特定の本番ファイル等、
プロジェクト固有の禁止対象は `guard.cjs` に `emit('deny'|'ask', '理由')` 行を追記して育てる
（例: WordPress なら `wp-config.php`、Stripe なら `sk_live_` キーのベタ書き）。

> 注意: 本体は CommonJS。ルートの `package.json` が `"type": "module"` でも動くよう拡張子は `.cjs`。

---

## 2. commit 関所（pre-commit フック）

| 項目 | 値 |
|---|---|
| 本体 | `.githooks/pre-commit` |
| 検査 | `tools/lint-encoding.py`（文字化け）/ `tools/check-lesson-counts.py`（教訓カウント drift） |

**有効化は各クローンで 1 回だけ**（git は既定で `.githooks` を見ないため）:

```bash
git config core.hooksPath .githooks
```

- 文字化け（U+FFFD・CJK 直後の孤立 `E`）を検出したら commit を中止。正当な表記なら該当行に `lint-encoding-ignore` を付ける。
- `.agents/lessons` を触った commit では教訓カウント整合も検査（カウントを宣言している箇所のみ照合）。
- **実行可能な Python が無ければ自動 skip**（commit は止めない）。Microsoft Store スタブも除外。

手動実行:

```bash
python tools/lint-encoding.py            # 全走査
python tools/lint-encoding.py --staged   # ステージ済みのみ
python tools/check-lesson-counts.py
```

---

## 3. skill 計測

| 項目 | 値 |
|---|---|
| ロガー | `.claude/hooks/skill-log.cjs`（PreToolUse on Skill・非ブロック） |
| 集計 | `.claude/hooks/skill-stats.cjs` |
| 記録先 | `.claude/logs/skill-usage.jsonl`（gitignore 済み） |

「どの skill が実際に効いたか / 鳴らず死蔵か」を数値化する。記録はフック導入後のみ（遡及不可）。

```bash
node .claude/hooks/skill-stats.cjs
node .claude/hooks/skill-stats.cjs --since 2026-06-26 --until 2026-07-10
```

---

## 4. `.agents/` 健康診断（read-only）

```bash
node .agents/tools/agents-doctor.cjs
```

1 ファイルも変更せず、`.agents/` 配下の行数 / KB / 最終更新を一覧し、
🔴 予算超過（`handover.md` のふくらみ等）・🟡 lock 残存・リンク切れ を高確度フラグで出す。
判断（移送・退役）は人間が行う。

---

## 5. ローカル権限（任意）

毎回の許可プロンプトを減らしたい場合、`.claude/settings.local.json.sample` をコピーして
`.claude/settings.local.json` を作る（実体は gitignore 済み）。読み取り系・安全な操作だけを `allow` に列挙し、
秘密情報や破壊的操作は列挙しない。
