#!/usr/bin/env node
/**
 * skill-stats — Skill 使用回数の期間集計
 * ------------------------------------------------------------
 * 使い方:
 *   node .claude/hooks/skill-stats.js
 *   node .claude/hooks/skill-stats.js --since 2026-06-26
 *   node .claude/hooks/skill-stats.js --since 2026-06-26 --until 2026-07-10
 *
 * skill-log.js が書く .claude/logs/skill-usage.jsonl を読み、skill 別に集計する。
 */

'use strict';
const fs = require('fs');
const path = require('path');

const LOG = path.resolve(__dirname, '..', 'logs', 'skill-usage.jsonl');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const since = arg('--since');
const until = arg('--until');

let lines = [];
try {
  lines = fs.readFileSync(LOG, 'utf8').split(/\r?\n/).filter(Boolean);
} catch (e) {
  console.log('ログ未生成（まだ skill が発火していないか logger 未導入）:', LOG);
  process.exit(0);
}

const counts = {};
let total = 0;
let minTs = null;
let maxTs = null;
for (const ln of lines) {
  let o;
  try { o = JSON.parse(ln); } catch (e) { continue; }
  const day = (o.ts || '').slice(0, 10);
  if (since && day < since) continue;
  if (until && day > until) continue;
  counts[o.skill] = (counts[o.skill] || 0) + 1;
  total++;
  if (!minTs || o.ts < minTs) minTs = o.ts;
  if (!maxTs || o.ts > maxTs) maxTs = o.ts;
}

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
const range = since || until ? `期間 ${since || '最初'}〜${until || '最新'}` : '全期間';
console.log('');
console.log(`=== skill 使用集計（${range}）===`);
if (!total) {
  console.log('該当期間の記録なし。');
  process.exit(0);
}
const w = Math.max(...sorted.map(([k]) => k.length), 8);
for (const [k, v] of sorted) console.log(`  ${k.padEnd(w)}  ${String(v).padStart(4)} 回`);
console.log(`  ${'-'.repeat(w + 8)}`);
console.log(
  `  合計 ${total} 回 / ${sorted.length} skill（記録 ${minTs ? minTs.slice(0, 10) : '-'}〜${maxTs ? maxTs.slice(0, 10) : '-'}）`
);
console.log('');
