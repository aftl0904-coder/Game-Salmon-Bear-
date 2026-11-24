#!/usr/bin/env node
// scripts/qa/run-sim.mjs — 玩家模擬（估算，唔係真實數據）
// 用法：node scripts/qa/run-sim.mjs all-stages.json   （頂層 stages:{stage1:{...},...}）
//       node scripts/qa/run-sim.mjs stage1.json
//       node scripts/qa/run-sim.mjs --test
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// ===== 可改常數（全部係假設，要用真人試玩數據校正）=====
const CFG = {
  runs: 2000,            // 每個配置模擬次數
  seed: 20261224,
  hearts: 6,
  speed: 116,            // 平均行速：倫寶105、琪寶寶127 取中間
  respawnSec: 3,         // 死咗到可以再郁
  fallSec: 2,            // 跌坑動畫
  bossCycleSec: 10,      // Boss 一輪（守備＋預警＋出招＋破綻＋喘氣）
  bossOpeningsDefault: 8,// 打死 Boss 要幾多個破綻（1P）；關卡可用 bossOpenings 覆寫
  maxRestarts: 150,      // 超過就當「卡關」
  pitRefW: 48,           // 坑闊 48px 時用 pitBase 機率，闊啲按比例加
  pitCap: 0.6,
  movingPitMul: 1.5,     // 要靠移動台嘅坑
  extraPerStageSec: { story: 90, minigame: 60, shop: 30 }, // 劇情／小遊戲／商店，唔入模擬
  hazardFields: ['spikes', 'durians', 'crushers', 'debris', 'bulldozers', 'drips',
    'steamVents', 'floorJunk', 'spotlights', 'conveyors', 'slipZones', 'slippery', 'sticky'],
  // 每遇到一次嘅中招機率；理由見交付說明
  types: {
    newbie: { name: '新手', walk: 0.55, enemy: 0.30, hazard: 0.22, pitBase: 0.12, boss: 0.40, fightSec: 6.0, hazardSec: 2.0 },
    normal: { name: '普通', walk: 0.70, enemy: 0.15, hazard: 0.10, pitBase: 0.05, boss: 0.22, fightSec: 4.0, hazardSec: 1.2 },
    expert: { name: '熟手', walk: 0.85, enemy: 0.05, hazard: 0.03, pitBase: 0.015, boss: 0.08, fightSec: 2.5, hazardSec: 0.5 }
  },
  // 2P 假設：血池合計、打得快、但畫面亂少少；跌坑只有跌嗰個返存檔點，隊伍唔使重行
  coop: { hearts: 12, enemyMul: 1.15, fightMul: 0.65, bossOpeningMul: 0.6, rejoinSec: 4 }
};

const num = v => typeof v === 'number' && Number.isFinite(v);
const arr = v => (Array.isArray(v) ? v : []);
const xOf = v => (num(v) ? v : num(v?.x) ? v.x : num(v?.x0) ? v.x0 : null);
const r1 = n => Math.round(n * 10) / 10;
const mmss = s => { const r = Math.round(s); return `${Math.floor(r / 60)}分${String(r % 60).padStart(2, "0")}秒`; };

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function build(d) {
  const ev = [];
  arr(d.enemies).forEach(e => { const x = xOf(e); if (num(x)) ev.push({ kind: 'enemy', x, id: `敵 ${x}${e.species ? ' ' + e.species : ''}` }); });
  for (const f of CFG.hazardFields) arr(d[f]).forEach(h => { const x = xOf(h); if (num(x)) ev.push({ kind: 'hazard', x, id: `${f} ${x}` }); });
  arr(d.pits).forEach(p => {
    const x0 = num(p?.x0) ? p.x0 : p?.x, x1 = num(p?.x1) ? p.x1 : num(p?.w) ? p.x + p.w : null;
    const mv = !!p.moving || arr(d.movingPlatforms).some(m => num(m?.x) && m.x < x1 && m.x + (m.w || 0) > x0); // 遊戲數據冇 moving 欄位：有移動台跨住個坑就當要靠移動台
    if (num(x0) && num(x1)) ev.push({ kind: 'pit', x: x0, w: x1 - x0, moving: mv, id: `坑 ${x0}-${x1}` });
  });
  [...arr(d.heals), ...arr(d.hotSprings)].forEach(h => { const x = xOf(h); if (num(x)) ev.push({ kind: 'heal', x, id: `回血 ${x}` }); });
  const segEnd = Math.max(0, ...arr(d.segments).map(s => s?.x1).filter(num));
  const bossX = num(d.boss?.triggerX) ? d.boss.triggerX : null;
  // 終點後備：Boss 觸發點 → worldW → 段落終點 → 最遠物件
  const endX = bossX ?? (num(d.worldW) ? d.worldW : segEnd || Math.max(0, ...ev.map(e => e.x)) + 100);
  if (bossX !== null) ev.push({ kind: 'boss', x: bossX, id: 'Boss', openings: num(d.bossOpenings) ? d.bossOpenings : CFG.bossOpeningsDefault });
  ev.sort((a, b) => a.x - b.x || (a.kind === 'boss') - (b.kind === 'boss'));
  const cps = [0, ...arr(d.checkpoints).map(xOf).filter(num)].sort((a, b) => a - b);
  return { ev, cps, endX };
}

function runOnce(S, T, coop, R) {
  const H = coop ? CFG.coop.hearts : CFG.hearts;
  let t = 0, hearts = H, pos = 0, cp = 0, i = 0, deaths = 0, falls = 0, restarts = 0;
  const fails = {};
  const v = CFG.speed * T.walk;
  const die = id => {
    deaths++; fails[id] = (fails[id] || 0) + 1; t += CFG.respawnSec; hearts = H;
    pos = cp; i = S.ev.findIndex(e => e.x >= cp); restarts++;
  };
  while (i >= 0 && i < S.ev.length) {
    if (restarts > CFG.maxRestarts) return { t, deaths, falls, fails, stuck: true };
    const e = S.ev[i];
    t += Math.max(0, e.x - pos) / v; pos = e.x;
    for (const c of S.cps) if (c <= pos) cp = c;
    if (e.kind === 'enemy' || e.kind === 'hazard') {
      t += e.kind === 'enemy' ? T.fightSec * (coop ? CFG.coop.fightMul : 1) : T.hazardSec;
      const p = e.kind === 'enemy' ? T.enemy * (coop ? CFG.coop.enemyMul : 1) : T.hazard;
      if (R() < Math.min(1, p) && --hearts <= 0) { die(e.id); continue; }
    } else if (e.kind === 'pit') {
      let p = Math.min(T.pitCap ?? CFG.pitCap, T.pitBase * e.w / CFG.pitRefW * (e.moving ? CFG.movingPitMul : 1));
      if (coop) p = 1 - (1 - p) ** 2;
      if (R() < p) {
        falls++; fails[e.id] = (fails[e.id] || 0) + 1; t += CFG.fallSec; hearts--;
        if (hearts <= 0) { die(e.id); continue; }
        if (coop) t += CFG.coop.rejoinSec;
        else { pos = cp; i = S.ev.findIndex(x => x.x >= cp); restarts++; continue; }
      }
    } else if (e.kind === 'heal') hearts = H;
    else if (e.kind === 'boss') {
      const n = Math.max(1, Math.round(e.openings * (coop ? CFG.coop.bossOpeningMul : 1)));
      let dead = false;
      for (let c = 0; c < n; c++) { t += CFG.bossCycleSec; if (R() < T.boss && --hearts <= 0) { dead = true; break; } }
      if (dead) { die('Boss'); continue; }
    }
    i++;
  }
  if (!S.ev.some(e => e.kind === 'boss')) t += Math.max(0, S.endX - pos) / v;
  return { t, deaths, falls, fails, stuck: false };
}

function simulate(d, opts = {}) {
  const S = build(d), out = {};
  for (const [k, base] of Object.entries(CFG.types)) for (const coop of [false, true]) {
    const T = { ...base, ...(opts[k] || {}) }, R = rng(opts.seed ?? CFG.seed);
    const runs = opts.runs ?? CFG.runs, ts = [], fails = {};
    let deaths = 0, falls = 0, stuck = 0;
    for (let n = 0; n < runs; n++) {
      const r = runOnce(S, T, coop, R);
      ts.push(r.t); deaths += r.deaths; falls += r.falls; stuck += r.stuck;
      for (const [id, c] of Object.entries(r.fails)) fails[id] = (fails[id] || 0) + c;
    }
    ts.sort((a, b) => a - b);
    out[`${k}_${coop ? '2P' : '1P'}`] = {
      type: base.name, players: coop ? '2P' : '1P',
      mean: ts.reduce((a, b) => a + b, 0) / runs, p50: ts[Math.floor(runs * 0.5)], p90: ts[Math.floor(runs * 0.9)],
      deaths: deaths / runs, falls: falls / runs, stuckRate: stuck / runs,
      top3: Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, c]) => `${id}（每次${r1(c / runs)}）`)
    };
  }
  return out;
}

function report(stages) {
  const lines = [], totals = {}, prevD = [];
  const extra = Object.values(CFG.extraPerStageSec).reduce((a, b) => a + b, 0);
  for (const [name, d] of Object.entries(stages)) {
    const res = simulate(d);
    lines.push(`##### ${name} #####`);
    for (const [k, r] of Object.entries(res)) {
      totals[k] = (totals[k] || 0) + r.mean;
      lines.push(`${r.type}${r.players} | 平均${mmss(r.mean)} 中位${mmss(r.p50)} 慢一成${mmss(r.p90)} | 死${r1(r.deaths)}次 跌坑${r1(r.falls)}次${r.stuckRate ? ` 卡關${r1(r.stuckRate * 100)}%` : ''}`);
      if (k === 'newbie_1P' || k === 'normal_1P') lines.push(`   最多失敗：${r.top3.join('、') || '冇'}`);
    }
    prevD.push([name, res.normal_1P.deaths]);
  }
  lines.push('##### 難度跳升（普通1P死亡次數）#####');
  for (let i = 1; i < prevD.length; i++) {
    const [n, d] = prevD[i], [pn, pd] = prevD[i - 1];
    if (d > 0.5 && d > pd * 1.5) lines.push(`⚠ ${pn}→${n}：${r1(pd)}→${r1(d)}`);
  }
  const k = Object.keys(stages).length;
  lines.push('##### 合計（只計關卡；另加劇情／小遊戲／商店約每關' + mmss(extra) + '）#####');
  for (const [key, s] of Object.entries(totals))
    lines.push(`${CFG.types[key.split('_')[0]].name}${key.split('_')[1]}：關卡${mmss(s)}；連其他約${mmss(s + extra * k)}`);
  lines.push('※ 全部係估算：機率係假設值，要用真人試玩校正。');
  return lines.join('\n');
}

function test() {
  // 1：冇任何嘢，只行路：新手 = 1160 /(116×0.55) = 18.2秒
  const r1x = simulate({ worldW: 1160 }, { runs: 10 });
  assert.equal(Math.round(r1x.newbie_1P.mean * 10) / 10, 18.2);
  assert.equal(r1x.newbie_1P.deaths, 0);
  // 2：全部機率設 0，敵人坑Boss都唔會死
  const zero = { enemy: 0, hazard: 0, pitBase: 0, boss: 0 };
  const r2 = simulate({ enemies: [100, 200], pits: [{ x0: 300, x1: 340 }], boss: { triggerX: 500 }, checkpoints: [250] },
    { runs: 20, newbie: zero, normal: zero, expert: zero });
  for (const v of Object.values(r2)) assert.equal(v.deaths + v.falls, 0);
  // 3：必跌嘅坑 → 卡關 100%
  const one = { pitBase: 10, pitCap: 1 };
  const r3 = simulate({ worldW: 600, pits: [{ x0: 300, x1: 400 }] }, { runs: 5, newbie: one, normal: one, expert: one });
  assert.equal(r3.newbie_1P.stuckRate, 1);
  console.log('PASS 3個測試');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) try {
  const a = process.argv[2];
  if (a === '--test') test();
  else if (!a) { console.error('用法：node run-sim.mjs <stages.json> 或 --test'); process.exitCode = 1; }
  else {
    const input = JSON.parse(fs.readFileSync(a, 'utf8'));
    console.log(report(input.stages ?? { stage: input }));
  }
} catch (e) { console.error(`讀取／測試失敗：${e.message}`); process.exitCode = 1; }

export { simulate, CFG };
