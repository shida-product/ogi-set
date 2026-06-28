# AI 引き継ぎドキュメント

> このファイルは「次の AI が 1 分で現在地に戻る」ための短い handover です。
> 完了済みの詳細ログは `.agents/changelog.md`、恒久ルールは `.agents/RULES.md` / `.agents/lessons.md` を参照してください。

## セッション開始時（AI が自律的に実行）

1. `.agents/RULES.md` と `.agents/lessons.md` を読む。
2. `.agents/state/locks.md` で他セッションの編集状況を確認する。
3. この handover の Current Focus / Next Actions / Boundaries を確認する。
4. 着手ドメインに応じて `.agents/RULES.md` §9-2 の Workflow Routing に従う。
5. 編集開始前に `locks.md` に自分の行を追記する（`ai-session.md` 参照）。

## セッション終了時（AI が自律的に実行）

`.agents/workflows/session-close.md` に従い、このファイルを更新する。ユーザーからの明示指示は不要。

---

## Current Focus

`set-price-optimizer.html`（セット会計サポート＝最安組合せ計算ツール）の単一ファイル開発。
AIエージェント・ボイラープレート一式を本フォルダに導入済み。次の機能改修からこの handover を起点にする。

## Next Actions

| 優先 | タスク | 状態 |
|:---:|---|:---:|
| 1 | 開発環境（.agents 一式 / git / pre-commit関所）の導入 | ✅ |
| 2 | `set-price-optimizer.html` の改修要件をユーザーと確定 | ☐ |

凡例: ☐ 未着手 / ◐ 進行中 / ✅ 完了

## 確定仕様・境界

- 本体はフロントエンド単一ファイル（HTML+CSS+vanilla JS）。ビルド工程なし。
- Python は未導入。pre-commit の文字化けlintは Python 導入までは自動 skip される。
- 整形/Lint は npm（prettier / eslint）。使う場合は `npm install` を先に実行。
- 既存の CSS クラス名・価格計算ロジックは無断で改変しない（モック整合）。
