#!/usr/bin/env node
// scripts/qa/log-report.mjs — 讀 `?log=1`「複製紀錄」嘅 TSV，出每關指標（真數據，唔係估算）
// 用法：node scripts/qa/log-report.mjs playlog.tsv   |   node scripts/qa/log-report.mjs --test
// 欄位：t_ms mode diff stage event hero x cause dmg hp_after extra
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const BIN = 200;
export function parse(tsv) {
  const rows = tsv.trim().split(/\r?\n/).map(l => l.split('\t'));
  const head = rows.shift();
  return rows.filter(r => r.length >= head.length - 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '-'])));
}
const kv = s => Object.fromEntries((s || '').split(';').filter(x => x.includes('=')).map(x => x.split('=')));

export function analyse(ev) {
  const out = {};
  for (const e of ev) {
    const k = `${e.stage}|${e.mode}`;
    const S = out[k] ??= { stage: +e.stage, mode: e.mode, hurts: 0, deaths: 0, continues: 0, clears: [], causes: {}, deathBins: {}, hurtBins: {}, fps: [], lastX: null };
    const x = Number(e.x), bin = Number.isFinite(x) ? Math.floor(x / BIN) * BIN : null;
    if (e.event === 'hurt') { S.hurts++; S.causes[e.cause] = (S.causes[e.cause] || 0) + 1; if (bin !== null) S.hurtBins[bin] = (S.hurtBins[bin] || 0) + 1; }
    if (e.event === 'death') { S.deaths++; if (bin !== null) S.deathBins[bin] = (S.deathBins[bin] || 0) + 1; }
    if (e.event === 'continue') S.continues++;
    if (e.event === 'clear') { const m = kv(e.extra); S.clears.push({ sec: +m.sec, deaths: +m.deaths }); }
    if (e.event === 'fps') { const m = kv(e.extra); S.fps.push({ avg: +m.avg, min: +m.min1s }); }
    if (Number.isFinite(x)) S.lastX = x;
  }
  return Object.values(out).sort((a, b) => a.stage - b.stage || a.mode.localeCompare(b.mode));
}

const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
export function report(stats) {
  const L = [];
  for (const S of stats) {
    const runs = Math.max(1, S.clears.length);
    L.push(`##### 第${S.stage}關 ${S.mode} #####`);
    L.push(`過關 ${S.clears.length} 次｜死 ${S.deaths}（每次過關 ${(S.deaths / runs).toFixed(2)}）｜受傷 ${S.hurts}｜續關 ${S.continues}`);
    if (S.clears.length) L.push(`用時：${S.clears.map(c => Math.round(c.sec) + '秒').join('、')}`);
    L.push(`受傷原因：${top(S.causes, 5).map(([c, n]) => `${c}×${n}`).join('、') || '冇'}`);
    L.push(`死亡熱點（每${BIN}px）：${top(S.deathBins, 3).map(([b, n]) => `${b}–${+b + BIN}×${n}`).join('、') || '冇'}`);
    L.push(`受傷熱點（每${BIN}px）：${top(S.hurtBins, 3).map(([b, n]) => `${b}–${+b + BIN}×${n}`).join('、') || '冇'}`);
    if (S.fps.length) L.push(`FPS：平均 ${Math.min(...S.fps.map(f => f.avg))}–${Math.max(...S.fps.map(f => f.avg))}，最低一秒 ${Math.min(...S.fps.map(f => f.min))}`);
    if (!S.clears.length && S.lastX !== null) L.push(`⚠ 冇過關紀錄：最後喺 x≈${S.lastX}（可能係放棄點）`);
  }
  return L.join('\n');
}

function test() {
  const tsv = ['t_ms\tmode\tdiff\tstage\tevent\thero\tx\tcause\tdmg\thp_after\textra',
    '1000\t2P\tnormal\t1\thurt\tgirl\t1650\tenemy:barrel\t1\t5\t-',
    '2000\t2P\tnormal\t1\thurt\tboy\t5150\tpit\t1\t0\t-',
    '2100\t2P\tnormal\t1\tdeath\tboy\t5150\tpit\t-\t-\t-',
    '2200\t2P\tnormal\t1\tcontinue\t-\t5000\t-\t-\t-\t-',
    '90000\t2P\tnormal\t1\tclear\t-\t5600\t-\t-\t-\tsec=310;deaths=1',
    '90001\t2P\tnormal\t1\tfps\t-\t-\t-\t-\t-\tavg=58;min1s=41',
    '95000\t2P\tnormal\t2\thurt\tgirl\t800\tenemy:squirrel\t1\t5\t-'].join('\n');
  const s = analyse(parse(tsv));
  assert.equal(s.length, 2);
  assert.equal(s[0].deaths, 1); assert.equal(s[0].hurts, 2); assert.equal(s[0].deathBins[5000], 1);
  assert.deepEqual(s[0].clears, [{ sec: 310, deaths: 1 }]);
  assert.equal(s[0].fps[0].min, 41);
  assert.match(report(s), /冇過關紀錄：最後喺 x≈800/);
  console.log('PASS 1個測試');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const a = process.argv[2];
  if (a === '--test') test();
  else if (!a) { console.error('用法：node log-report.mjs <playlog.tsv> 或 --test'); process.exitCode = 1; }
  else console.log(report(analyse(parse(fs.readFileSync(a, 'utf8')))));
}
