#!/usr/bin/env node
/**
 * skill-log — Skill 発火ロガー（PreToolUse on Skill・非ブロック）
 * ------------------------------------------------------------
 * Skill ツールが呼ばれるたびに { ts, skill } を1行ずつ JSONL 追記するだけ。
 * 判定・ブロックは一切しない（常に通過）。集計は skill-stats.js。
 *
 * 目的: 「どの skill が実際に効いたか / 鳴らず死蔵か」を数値化する。
 * 限界: 記録はフック導入後のみ（遡及不可）。Skill ツール経由の発火のみ捕捉。
 */

"use strict";
const fs = require("fs");
const path = require("path");

const LOG_DIR = path.resolve(__dirname, "..", "logs"); // .claude/logs/
const LOG = path.join(LOG_DIR, "skill-usage.jsonl");

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    const p = JSON.parse(raw || "{}");
    const ti = p.tool_input || {};
    const skill = ti.skill || ti.name || "";
    if (skill) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), skill }) + "\n");
    }
  } catch (e) {
    /* 記録失敗は黙って無視（作業を止めない） */
  }
  process.exit(0); // 常に通過（記録のみ）
});
