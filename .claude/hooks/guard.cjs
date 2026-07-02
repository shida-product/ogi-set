#!/usr/bin/env node
/**
 * 危険操作ガード（PreToolUse hook 本体・汎用テンプレ版）
 * ------------------------------------------------------------
 * Bash / PowerShell / Edit / Write などツールの実行内容を検査し、
 *   - 破滅的かつ不可逆な操作 → deny（機械的に遮断）
 *   - 破壊的だが文脈次第の操作 → ask（人間に承認を求める）
 *   - それ以外               → 何も出力せず通常フローへ
 * を判定する。RULES.md §6 Danger Zone / lessons.md Critical Rules に対応。
 *
 * 設計方針:
 *   - 保守的キャリブレーション。誤爆最小を優先（ガードは"網"であり最終防衛は人間レビュー）。
 *   - JSON 解析失敗時は fail-open（通常フローへ）。ここが落ちても全作業を止めない。
 *   - プロジェクト固有の禁止対象（決済キー・特定ファイル等）は、このファイルに
 *     ルールを追記して育てる。テンプレ初期値は「どのプロジェクトでも危険」な操作のみ。
 *
 * 入力(stdin JSON): { "tool_name": "...", "tool_input": { "command": "...", "file_path": "..." } }
 * 出力(stdout JSON):
 *   deny/ask 時: { "hookSpecificOutput": { "hookEventName": "PreToolUse",
 *                  "permissionDecision": "deny|ask", "permissionDecisionReason": "..." } }
 *   通過時: 出力なし
 */

"use strict";

function emit(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: decision, // "deny" | "ask"
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let cmd = "";
  let filePath = "";
  try {
    const payload = JSON.parse(raw || "{}");
    const ti = payload.tool_input || {};
    cmd = ti.command || "";
    // Edit / Write / MultiEdit / NotebookEdit はファイルパスで判定
    filePath = ti.file_path || ti.notebook_path || "";
  } catch (e) {
    process.exit(0); // fail-open: 解析不能なら通常フローへ
  }

  // ===== ファイル編集ツールの判定（Edit/Write 経由）=====
  if (typeof filePath === "string" && filePath) {
    const base = filePath.replace(/\\/g, "/");

    // DENY: 秘密情報ファイルの編集（.env / 認証情報 / 鍵）。RULES §6-2 Danger Zone #1
    //   .env.sample / .env.example / .env.template は雛形なので許可。
    if (
      /(^|\/)\.env(\.(?!sample|example|template)[^/]+)?$/i.test(base) ||
      /(^|\/)(secrets?|credentials?)\.(json|ya?ml|env)$/i.test(base) ||
      /(^|\/)(id_rsa|id_ed25519)(\.pub)?$/i.test(base) ||
      /\.pem$/i.test(base)
    ) {
      emit(
        "deny",
        "秘密情報ファイルの編集は禁止（RULES §6-2 Danger Zone #1）。API キー・DB 接続・認証情報等の機密。雛形は .sample / .example に分離し、実体は手動で。"
      );
    }

    // ASK: CI/CD パイプライン定義の編集（RULES §6-2 Danger Zone #4）
    if (/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i.test(base)) {
      emit(
        "ask",
        "CI/CD パイプライン定義の編集（RULES §6-2 Danger Zone #4）。デプロイフロー破壊の恐れ。意図的なら承認を。"
      );
    }

    // ASK: ロックファイルの編集（RULES §6-2 Danger Zone #5）
    if (
      /(^|\/)(package-lock\.json|pnpm-lock\.ya?ml|yarn\.lock|composer\.lock|poetry\.lock)$/i.test(
        base
      )
    ) {
      emit(
        "ask",
        "ロックファイルの直接編集（RULES §6-2 Danger Zone #5）。バージョン整合性破壊の恐れ。更新はパッケージマネージャ経由で。"
      );
    }
  }

  if (typeof cmd !== "string" || cmd.trim() === "") process.exit(0);

  // ===== DENY（破滅的かつ不可逆・例外を作らない）=====

  // 1) force push / 履歴改変（特に main へ）。RULES §6-1 / §6-2 #3
  if (/git\s+push\b[^\n]*?(--force\b|--force-with-lease\b|(^|\s)-f(\s|$))/i.test(cmd)) {
    emit(
      "deny",
      "force push / 履歴改変は禁止（RULES §6 Danger Zone）。やむを得ない場合はバックアップブランチを作成し、ユーザーの明示許可を得てから手動で。"
    );
  }

  // 2) 秘密情報ファイルへの上書き・リダイレクト・削除（shell 経由）。Danger Zone #1
  if (
    />>?\s*['"]?\S*(\/|^|\\)?\.env(\b|['"\s]|$)/i.test(cmd) ||
    /(Set-Content|Add-Content|Out-File)\b[^|]*\.env\b/i.test(cmd) ||
    /\b(rm|del|Remove-Item)\b[^|]*(\.env\b|secrets?\.(json|ya?ml)|\.pem\b|id_rsa\b)/i.test(cmd)
  ) {
    emit(
      "deny",
      "秘密情報ファイルの書き換え・削除は禁止（RULES §6-2 Danger Zone #1）。変更が必要なら手動で。"
    );
  }

  // ===== ASK（破壊的だが文脈次第・人間が承認）=====

  // 3) あらゆる git push（main は push で自動デプロイされる構成があるため毎回確認）
  if (/git\s+push\b/i.test(cmd)) {
    emit(
      "ask",
      "push は明示確認の上で（RULES A5 / §6）。main への push が本番自動デプロイに繋がる構成では特に注意。差分・ブランチを確認してから承認を。"
    );
  }

  // 4) 破壊的 git（作業ツリー・履歴の巻き戻し）→ バックアップブランチ提案を促す
  if (
    /git\s+reset\s+--hard\b/i.test(cmd) ||
    /git\s+clean\s+-[a-z]*f/i.test(cmd) ||
    /git\s+checkout\s+--(\s|$)/i.test(cmd)
  ) {
    emit(
      "ask",
      "破壊的な git 操作（RULES §6-1）。未コミット変更を失う恐れ。実行前にバックアップブランチ作成を検討。"
    );
  }

  // 5) PowerShell でのファイル書き換え → 文字化け事故防止（lessons Critical Rule #1）
  //    Set-Content/Add-Content/Out-File、または既知ソース拡張子への > / >> リダイレクト
  if (
    /\b(Set-Content|Add-Content|Out-File)\b/i.test(cmd) ||
    />>?\s*['"]?\S*\.(php|css|js|jsx|ts|tsx|vue|html?|md|json|ya?ml|py|txt)\b/i.test(cmd)
  ) {
    emit(
      "ask",
      "PowerShell でのファイル書き換えは日本語文字化け事故の元（lessons Critical Rule #1）。ファイル編集は原則 Edit/Write ツールを使う。意図的なら承認を。"
    );
  }

  // 通過: 何も出力しない（通常の許可フローへ）
  process.exit(0);
});
