#!/usr/bin/env node
// scripts/qa/reach.mjs — 跳躍可達檢查（靜態估算，唔可以取代實機試玩）
// 用法：node scripts/qa/reach.mjs data/levels/stage1.json
//       node scripts/qa/reach.mjs all-stages.json   （頂層有 stages:{...} 都得）
//       node scripts/qa/reach.mjs --test
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// ===== 常數（★＝推算值，要實機確認）=====
const P = Object.freeze({
  bodyW: 12, bodyH: 24,
  gUp: 700,             // 上升重力
  jumpV: 360,           // 起跳速度 → 全跳約 92.6px
  gDown: 896,           // ★ 下落重力（700×1.28）
  maxFall: 653,         // ★ 最大下落速度
  shoe: 1.0,            // 鞋跳高倍率（未定，當 1.0）
  itemR: 6,             // ★ 收集品半徑
  ventLift: 150,        // 風口彈高
  ventW: 16,            // ★ 風口可企闊度
  bounceMul: 1.5,       // ★ 彈地 = 全跳 × 1.5
  movingMode: 'plusMinus', // ★ 移動台 range 當 ±range（最闊位置），要睇時機
  borderline: 8,        // 差距少過 8px → 要實機確認
  heroes: {
    lunbo:  { name: '倫寶',  speed: 105, glide: null },
    kibobo: { name: '琪寶寶', speed: 127, glide: null, ventGlide: { mul: 0.18, cap: 40 } } // 風扇滑翔只喺風口彈起之後有：落下重力×0.18、最快40px/s（Player.ts applyAirGravity）
  }
});

const HALF = P.bodyW / 2;
const APEX = (P.jumpV ** 2) / (2 * P.gUp) * P.shoe;
const num = v => typeof v === 'number' && Number.isFinite(v);
const arr = v => (Array.isArray(v) ? v : []);
const r1 = n => Math.round(n * 10) / 10;

// ---- 落下距離表（每1ms），由頂點開始 ----
function dropTable(glide) {
  const t = [0]; let y = 0, vy = 0;
  for (let ms = 1; ms <= 20000; ms++) {
    const g = glide ? P.gDown * glide.mul : P.gDown;
    vy = Math.min(glide ? glide.cap : P.maxFall, vy + g * 0.001); y += vy * 0.001; t.push(y);
  }
  return t;
}
const TABLES = {};
for (const [k, h] of Object.entries(P.heroes)) { TABLES[k] = dropTable(null); if (h.ventGlide) TABLES[k + ':glide'] = dropTable(h.ventGlide); }

function timeToDrop(hero, D, glide = false) { // 秒
  if (D <= 0) return 0;
  const t = (glide && TABLES[hero + ':glide']) || TABLES[hero]; let lo = 0, hi = t.length - 1;
  if (t[hi] < D) return hi / 1000 + (D - t[hi]) / P.maxFall;
  while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] >= D) hi = m; else lo = m + 1; }
  return lo / 1000;
}
// 由起點跳，最終高於起點 dh 嘅位置，最遠橫向距離；做唔到回傳 null
function maxReach(hero, apex, dh, glide = false) {
  if (dh > apex) return null;
  const tUp = Math.sqrt(2 * apex / P.gUp);
  return P.heroes[hero].speed * (tUp + timeToDrop(hero, apex - dh, glide));
}
// 統一差距：夠高時用水平差距（闊），唔夠高時用垂直差距（高）
function margin(hero, apex, dh, d, glide = false) {
  const reach = maxReach(hero, apex, dh, glide);
  return reach === null ? { m: apex - dh, unit: '高' } : { m: reach - d, unit: '闊' };
}

// ---- 讀資料 ----
function span(v) {
  if (Array.isArray(v) && v.length >= 2) return [v[0], v[1]];
  if (!v || typeof v !== 'object') return null;
  if (num(v.x0) && num(v.x1)) return [Math.min(v.x0, v.x1), Math.max(v.x0, v.x1)];
  if (num(v.x) && num(v.w)) return [v.x, v.x + v.w];
  return null;
}
function surfaces(d) {
  const pits = arr(d.pits).map(span).filter(Boolean).sort((a, b) => a[0] - b[0]);
  const extents = [d.worldW, d.boss?.arenaX1, ...arr(d.segments).map(s => s?.x1), ...pits.map(p => p[1])].filter(num); // 冇 worldW 就用段落／Boss場終點
  const W = Math.max(0, ...extents) || 1000;
  const S = [];
  let x = 0, gi = 0;
  for (const [p0, p1] of pits) {
    if (p0 > x) S.push({ id: `地面${++gi}`, kind: 'ground', x0: x, x1: p0, h: 0 });
    x = Math.max(x, p1);
  }
  if (x < W) S.push({ id: `地面${++gi}`, kind: 'ground', x0: x, x1: W, h: 0 });
  const add = (list, kind) => arr(list).forEach(v => {
    const s = span(v); if (!s || !num(v.h)) return;
    S.push({ id: `${kind === 'step' ? '台階' : '平台'} ${s[0]}-${s[1]}@${v.h}`, kind, x0: s[0], x1: s[1], h: v.h });
  });
  add(d.steps, 'step'); add(d.platforms, 'platform'); add(d.shelves, 'platform');
  arr(d.movingPlatforms).forEach(v => {
    if (!num(v.x) || !num(v.w) || !num(v.h)) return;
    const r = num(v.range) ? v.range : 0;
    S.push({ id: `移動台 ${v.x}闊${v.w}@${v.h}`, kind: 'moving', x0: v.x - r, x1: v.x + v.w + r, h: v.h });
  });
  arr(d.windVents).forEach(v => {
    const vx = num(v) ? v : v?.x; if (!num(vx)) return;
    S.push({ id: `風口 ${vx}`, kind: 'vent', x0: vx - P.ventW / 2, x1: vx + P.ventW / 2, h: 0, apex: num(v?.lift) ? v.lift : P.ventLift });
  });
  arr(d.bouncy).forEach(v => {
    const s = span(v); if (!s) return;
    S.push({ id: `彈地 ${s[0]}-${s[1]}`, kind: 'bounce', x0: s[0], x1: s[1], h: num(v.h) ? v.h : 0, apex: APEX * P.bounceMul });
  });
  return { S, pits, W };
}
const centre = s => [s.x0 - HALF, s.x1 + HALF]; // 腳企得到嘅中心範圍
const gap = (a, b) => Math.max(0, b[0] - a[1], a[0] - b[1]);

function edge(hero, A, B) {
  return margin(hero, A.apex ?? APEX, B.h - A.h, gap(centre(A), centre(B)), A.kind === 'vent');
}
function reachSet(hero, S, start, thr) {
  const ok = new Set([start]); let grew = true;
  while (grew) {
    grew = false;
    for (const B of S) {
      if (ok.has(B)) continue;
      for (const A of ok) if (edge(hero, A, B).m >= thr) { ok.add(B); grew = true; break; }
    }
  }
  return ok;
}
function grade(reachAt) {
  if (reachAt(P.borderline)) return 'safe';
  if (reachAt(0)) return 'edge';
  if (reachAt(-P.borderline)) return 'near';
  return 'no';
}
const isOk = g => g === 'safe' || g === 'edge';
const isBorder = g => g === 'edge' || g === 'near';
function combine(g, extra = '') {
  const lb = isOk(g.lunbo), kb = isOk(g.kibobo);
  let label = lb && kb ? 'OK' : lb ? '只限倫寶' : kb ? '只限琪寶寶' : '兩個都唔得';
  const border = Object.entries(g).filter(([, v]) => isBorder(v)).map(([k]) => P.heroes[k].name);
  return { label, border, text: label + (border.length ? ` ⚠要實機確認（${border.join('、')}）` : '') + extra };
}
const fmtM = b => (b ? `${b.m >= 0 ? '+' : ''}${r1(b.m)}${b.unit}` : '冇起跳點');

function analyze(input) {
  const d = input && typeof input === 'object' ? input : {};
  const { S, pits } = surfaces(d);
  const start = S.find(s => s.kind === 'ground' && s.x0 <= 0) || S[0];
  const rows = [];
  if (!start) return { rows, text: '冇資料' };
  const sets = {};
  for (const hero of Object.keys(P.heroes)) {
    sets[hero] = {};
    for (const thr of [P.borderline, 0, -P.borderline]) sets[hero][thr] = reachSet(hero, S, start, thr);
  }
  const best = (hero, fn) => { // 喺樂觀可達面入面搵最好差距
    let b = null;
    for (const A of sets[hero][-P.borderline]) { const m = fn(A); if (!b || m.m > b.m) b = m; }
    return b;
  };

  // (a) 平台／台階／移動台
  for (const B of S.filter(s => ['step', 'platform', 'moving'].includes(s.kind))) {
    const g = {}, why = [];
    for (const hero of Object.keys(P.heroes)) {
      g[hero] = grade(thr => sets[hero][thr].has(B));
      why.push(`${P.heroes[hero].name}${fmtM(best(hero, A => (A === B ? { m: -1e9, unit: '' } : edge(hero, A, B))))}`);
    }
    const note = B.kind === 'moving' ? '（移動台按最闊位置計，要睇時機）' : '';
    rows.push({ cat: 'a', id: B.id, ...combine(g, note), why: why.join('／') });
  }
  // (b) 收集品
  const items = [
    ...arr(d.secrets).map(v => ({ ...v, t: '秘密' })),
    ...arr(d.honey).map(v => ({ ...v, t: '蜂蜜' })),
    ...arr(d.highCoins ?? d.coins).map(v => ({ ...v, t: '高位金幣' }))
  ].filter(v => num(v.x) && num(v.h));
  for (const it of items) {
    const target = [it.x - P.itemR - HALF, it.x + P.itemR + HALF];
    const need = it.h - P.itemR - P.bodyH; // 腳要到嘅高度
    const im = (hero, A) => margin(hero, A.apex ?? APEX, need - A.h, gap(centre(A), target), A.kind === 'vent');
    const g = {}, why = [];
    for (const hero of Object.keys(P.heroes)) {
      g[hero] = grade(thr => [...sets[hero][thr]].some(A => im(hero, A).m >= thr));
      why.push(`${P.heroes[hero].name}${fmtM(best(hero, A => im(hero, A)))}`);
    }
    const overPit = pits.some(([p0, p1]) => it.x > p0 && it.x < p1) &&
      !S.some(s => s.kind !== 'ground' && it.x >= s.x0 - HALF && it.x <= s.x1 + HALF);
    rows.push({ cat: 'b', id: `${it.t} ${it.x}@${it.h}`, ...combine(g, overPit ? '（喺坑上空，攞完可能跌落坑）' : ''), why: why.join('／') });
  }
  // (c) 坑
  for (const [p0, p1] of pits) {
    const L = S.find(s => s.kind === 'ground' && s.x1 === p0);
    const R = S.find(s => s.kind === 'ground' && s.x0 === p1);
    if (!R) continue;
    const g = {}, how = [];
    for (const hero of Object.keys(P.heroes)) {
      const direct = L ? margin(hero, APEX, 0, (p1 - HALF) - (p0 + HALF)) : null;
      const viaGraph = grade(thr => sets[hero][thr].has(R));
      const dGrade = direct ? (direct.m >= P.borderline ? 'safe' : direct.m >= 0 ? 'edge' : direct.m >= -P.borderline ? 'near' : 'no') : 'no';
      g[hero] = isOk(dGrade) ? dGrade : viaGraph;
      how.push(`${P.heroes[hero].name}${isOk(dGrade) ? '直接跳' : isOk(viaGraph) ? '靠平台' : '過唔到'}(${fmtM(direct)})`);
    }
    rows.push({ cat: 'c', id: `坑 ${p0}-${p1}（闊${p1 - p0}）`, ...combine(g), why: how.join('／') });
  }

  const head = {
    a: '(a) 平台／台階', b: '(b) 秘密／蜂蜜／高位金幣', c: '(c) 坑'
  };
  const lines = [`全跳頂點≈${r1(APEX)}px；同高最遠：倫寶≈${r1(maxReach('lunbo', APEX, 0))}px、琪寶寶≈${r1(maxReach('kibobo', APEX, 0))}px（滑翔只計風口之後）`];
  for (const c of ['a', 'b', 'c']) {
    lines.push(head[c]);
    for (const r of rows.filter(r => r.cat === c)) lines.push(`  ${r.id} | ${r.text} | ${r.why}`);
  }
  const flag = rows.filter(r => r.label !== 'OK' || r.border.length);
  lines.push('(d) 要留意：', ...(flag.length ? flag.map(r => `  ${r.id} → ${r.text}`) : ['  冇']));
  return { rows, text: lines.join('\n') };
}

// ===== 測試 =====
function test() {
  const find = (r, id) => r.rows.find(x => x.id.startsWith(id));
  // 1：60px 坑，兩個都直接跳得過
  const t1 = analyze({ worldW: 400, pits: [{ x0: 150, x1: 210 }] });
  assert.equal(find(t1, '坑 150').label, 'OK');
  assert.equal(find(t1, '坑 150').border.length, 0);
  // 2：144px 坑冇平台：普通跳兩個都過唔到（滑翔只限風口之後）
  const t2 = analyze({ worldW: 500, pits: [{ x0: 150, x1: 294 }] });
  assert.equal(find(t2, '坑 150').label, '兩個都唔得');
  // 3：地面收集品：200高兩個都唔得；124高差少過8px → 要實機確認
  const t3 = analyze({ worldW: 300, secrets: [{ x: 150, h: 200 }], honey: [{ x: 100, h: 124 }] });
  assert.equal(find(t3, '秘密 150').label, '兩個都唔得');
  assert.equal(find(t3, '秘密 150').border.length, 0);
  assert.equal(find(t3, '蜂蜜 100').label, '兩個都唔得');
  assert.equal(find(t3, '蜂蜜 100').border.length, 2);
  for (const [n, t] of [['1 窄坑', t1], ['2 闊坑', t2], ['3 高位收集品', t3]]) console.log(`=== ${n} ===\n${t.text}\n`);
  console.log('PASS 3個測試');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) try {
  const a = process.argv[2];
  if (a === '--test') test();
  else if (!a) { console.error('用法：node reach.mjs <stage.json> 或 --test'); process.exitCode = 1; }
  else {
    const input = JSON.parse(fs.readFileSync(a, 'utf8'));
    if (input.stages) for (const [k, v] of Object.entries(input.stages)) console.log(`##### ${k} #####\n${analyze(v).text}\n`);
    else console.log(analyze(input).text);
  }
} catch (e) { console.error(`讀取／測試失敗：${e.message}`); process.exitCode = 1; }

export { analyze, P };
