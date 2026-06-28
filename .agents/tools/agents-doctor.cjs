#!/usr/bin/env node
/**
 * agents-doctor — `.agents/` ドキュメント群の健康診断（read-only）
 * ------------------------------------------------------------
 * 1ファイルも変更しない。現状を「数字と高確度フラグ」で出すだけ。
 * 目的は "整理を急かす" ことではなく "整理が要るか/要らないかを事実で示す" こと。
 *
 * 判定は控えめに2種（誤検知＝無駄な整理の元になるため）:
 *   🔴 予算超過   … 役割上ふくらませてはいけない作業面ファイルが上限超え
 *   🟡 要確認     … アクティブ lock の残存 / .agents 内のリンク切れ
 * 残りは事実の一覧（行数・KB・最終更新）だけを出す。判断は人間（監査役）。
 *
 * 使い方:  node .agents/tools/agents-doctor.js
 */

'use strict';
const fs = require('fs');
const path = require('path');

const AGENTS = path.resolve(__dirname, '..'); // .agents/
const REPO = path.resolve(AGENTS, '..'); // リポジトリルート

// 役割上ふくらませてはいけない作業面ファイルの既定予算。
// メンテ契約ヘッダ <!-- maint: ... budget=100行/20KB ... --> があればそちらを優先。
const DEFAULT_BUDGETS = {
  'handover.md': { lines: 100, kb: 20 },
};

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}
function countLines(s) { return s.split(/\r\n|\r|\n/).length; }
function kb(bytes) { return Math.round((bytes / 1024) * 10) / 10; }
function ageDays(mtimeMs) { return Math.floor((Date.now() - mtimeMs) / 86400000); }

function walkMd(dir) {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'tools' || e.name === 'node_modules') continue;
      out = out.concat(walkMd(p));
    } else if (e.name.endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
}

// メンテ契約ヘッダから予算を読む（あれば）
function budgetFromHeader(content) {
  const m = content.match(/<!--\s*maint:[^>]*-->/i);
  if (!m) return null;
  const h = m[0];
  const lm = h.match(/budget=(\d+)\s*行/);
  const km = h.match(/(\d+)\s*KB/i);
  if (!lm && !km) return null;
  return { lines: lm ? parseInt(lm[1], 10) : null, kb: km ? parseInt(km[1], 10) : null };
}

const red = [];
const yellow = [];
const inventory = [];

// ---- 全 .md を棚卸し ----
const files = walkMd(AGENTS).sort();
for (const p of files) {
  const content = read(p);
  if (content == null) continue;
  const stat = fs.statSync(p);
  const rel = path.relative(AGENTS, p).replace(/\\/g, '/');
  const L = countLines(content);
  const K = kb(stat.size);
  const A = ageDays(stat.mtimeMs);
  inventory.push({ rel, L, K, A });

  // 予算チェック（ヘッダ優先 → 既定）
  const budget = budgetFromHeader(content) || DEFAULT_BUDGETS[rel];
  if (budget) {
    const over = [];
    if (budget.lines && L > budget.lines) over.push(`${L}行 > ${budget.lines}行`);
    if (budget.kb && K > budget.kb) over.push(`${K}KB > ${budget.kb}KB`);
    if (over.length) red.push(`${rel}: 予算超過（${over.join(' / ')}）→ 古い分を changelog/plan へ移送`);
  }
}

// ---- アクティブ lock の残存 ----
const locksPath = path.join(AGENTS, 'state', 'locks.md');
const locksRaw = read(locksPath);
if (locksRaw) {
  // 「## アクティブロック」以下のテーブル行のうち、見出し/区切り/プレースホルダを除く
  const seg = locksRaw.split(/##\s*アクティブロック/)[1] || '';
  const rows = seg.split(/\r?\n/).filter((ln) => {
    const t = ln.trim();
    if (!t.startsWith('|')) return false;
    if (/^\|\s*-+/.test(t)) return false; // 区切り行
    if (/セッション ID|ロックファイル/.test(t)) return false; // ヘッダ
    if (/_\(なし\)_|^\|\s*—|作業開始時に追記/.test(t)) return false; // プレースホルダ
    return true;
  });
  if (rows.length) {
    yellow.push(`state/locks.md: アクティブ lock ${rows.length}件が残存 → 終了済みなら自分の行を削除（stale は30分で他セッションが掃除可）`);
  }
}

// ---- .agents 内のリンク切れ（相対パスのみ・高確度のみ）----
const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
let brokenCount = 0;
const brokenSample = [];
for (const p of files) {
  const content = read(p);
  if (content == null) continue;
  const dir = path.dirname(p);
  let m;
  while ((m = linkRe.exec(content)) !== null) {
    let target = m[1].trim();
    if (!target) continue;
    if (/^(https?:|mailto:|#|<)/i.test(target)) continue; // 外部/アンカー/テンプレ
    target = target.split('#')[0].split('?')[0].trim();
    if (!target) continue;
    if (/^[a-z]+:\/\//i.test(target)) continue;
    const resolved = path.resolve(dir, target);
    // リポジトリ内の相対参照のみ対象
    if (!resolved.startsWith(REPO)) continue;
    if (!fs.existsSync(resolved)) {
      brokenCount++;
      if (brokenSample.length < 8) {
        brokenSample.push(`${path.relative(AGENTS, p).replace(/\\/g, '/')} → ${m[1]}`);
      }
    }
  }
}
if (brokenCount) {
  yellow.push(`リンク切れ ${brokenCount}件（.agents 内の相対リンク）:\n    - ` + brokenSample.join('\n    - ') + (brokenCount > brokenSample.length ? `\n    - …他 ${brokenCount - brokenSample.length}件` : ''));
}

// ---- 出力 ----
const W = (s) => process.stdout.write(s + '\n');
W('');
W('=== agents-doctor: .agents/ 健康診断（read-only・変更なし）===');
W('');

if (red.length) {
  W('🔴 予算超過（作業面がふくらみ過ぎ・移送推奨）');
  red.forEach((r) => W('  - ' + r));
  W('');
}
if (yellow.length) {
  W('🟡 要確認');
  yellow.forEach((y) => W('  - ' + y));
  W('');
}
if (!red.length && !yellow.length) {
  W('✅ 予算超過・lock 残存・リンク切れ なし。整理は不要。');
  W('');
}

// 事実の一覧（判断しない）
W('📋 ドキュメント一覧（行 / KB / 最終更新）— 事実のみ、整理要否の判断材料');
const colName = Math.max(...inventory.map((i) => i.rel.length), 12);
inventory.forEach((i) => {
  const name = i.rel.padEnd(colName);
  const ln = String(i.L).padStart(4);
  const k = String(i.K).padStart(6);
  W(`  ${name}  ${ln}行  ${k}KB  ${i.A}日前`);
});
const totalKb = Math.round(inventory.reduce((a, i) => a + i.K, 0) * 10) / 10;
W('');
W(`  合計: ${inventory.length}ファイル / ${totalKb}KB`);
W('');
W('※ doctor は報告のみ。移送・退役・削除は人間の判断で（整理＝削除でなく"正しい高度への移送"）。');
W('');
