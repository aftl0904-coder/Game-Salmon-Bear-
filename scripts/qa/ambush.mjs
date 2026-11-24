#!/usr/bin/env node
// scripts/qa/ambush.mjs — 敵人突襲檢查（只改醒來位 unlockX；估算）
// 用法：node scripts/qa/ambush.mjs   |   node scripts/qa/ambush.mjs --test
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// ===== 可改常數 =====
const CFG = {
  playerSpeed: 105,          // A8：用較慢嘅倫寶，一路向前行
  screenAheadPx: 320 + 32,   // A1：主角喺中間＋向前預留32 → 前方可見352px（敵人中心入畫）
  contactPad: 14,            // 碰撞盒半闊相加（主角6＋敵人約8，★）
  minReactSec: 1.0,          // 少過呢個＝反應唔切
  targetReactSec: 1.2,       // 建議改到呢個
  clumpPx: 120, simulSec: 1.0,
  minUnlockGap: 100,         // A13：unlockX ≤ x−100
  warnSec: 0.8,
  behaviour: {
    walker: { speed: 32 },                                      // 冇數據嘅種類
    s7charge: { walk: 48, dashSpeed: 220, dashPx: 160 },        // A5
    s7hop: { hopSpeed: 160, hopPx: 160 },                       // ★ 照舊稿
    s7can: { walk: 32, range: 180, projSpeed: 120 },            // A6 預設
    flyer: { height: 92 }                                       // 蜜蜂：行路唔會撞到
  }
};
const SPECIES = { 衝: 's7charge', 跳: 's7hop', 罐: 's7can', 盾: 'walker', 蜂: 'flyer' };
// x/unlockX/種類（第6關遭遇戰 2400–3100 排除，A12）
const STAGES = {
  1: { cps: [1340, 2640, 4140, 4980], e: '300/160魚 520/380魚 900/780魚 1700/1510桶 1740/1510魚 2160/2040桶 2280/2040魚 2880/2760桶 3000/2760象 3420/3300魚 3600/3480桶 3700/3480象 3780/3660桶 3940/3660魚 4340/4220魚 4800/4680桶' },
  2: { cps: [1320, 2220, 3080], e: '600/360蜂 900/760鼠 960/760鼠 1030/900鼠 1520/1440蜂 1720/1620蜂 1880/1700魚 2060/1960蜂 2450/2330鼠 2500/2330鼠 2560/2330鼠 2650/2500豬 2900/2780蜂 2980/2860象' },
  3: { cps: [1340, 2280, 3080], e: '520/320蝦 800/620攤 1200/980攤 1250/1080蝦 1640/1500鏡 1900/1760鏡 2000/1860蝦 2420/2300蝦 2970/2800鏡' },
  4: { cps: [1320, 2420, 3100], e: '420/220僵 480/220僵 870/660鐘 930/830的 1220/1040鐘 1520/1480僵 1560/1480僵 1820/1700僵 1860/1700僵 1900/1800僵 1980/1920的 2200/2100的 2340/2260鐘' },
  5: { cps: [1430, 2380], e: '280/150魚 400/280魚 520/400魚 820/680蜂 950/760蜂 1080/960蜂 1320/1200蜂 1640/1540鏡 1740/1640鏡 2140/2040鏡 2260/2160鏡 2500/2380的 2640/2520的 3040/2920的' },
  6: { cps: [700, 1600, 3100, 4520], skip: [2400, 3100], e: '200/80衝 480/360跳 920/800盾 1100/800罐 1240/1120跳 1400/1120衝 1780/1660盾 1940/1660罐 2080/1960跳 2260/1960衝 2440/2320盾 2620/2320罐 2780/2660跳 2940/2660跳 3540/3420盾 3740/3420罐 3880/3760跳 4060/3760衝 4200/4080盾 4380/4080罐' },
  7: { cps: [800, 1960, 3100, 4520], e: '200/80衝 600/480跳 960/840盾 1140/840罐 1280/1160跳 1520/1160衝 1660/1540盾 1820/1540罐 2150/2040盾 2200/1990罐 2600/2480跳 2660/2480衝 3240/3120盾 3420/3120罐 3580/3460跳 3760/3460衝 4060/3940盾 4280/3940跳' }
};
const parse = s => s.split(' ').map(t => { const m = t.match(/(\d+)\/(\d+)(.+)/); return { x: +m[1], u: +m[2], sp: m[3] }; });
const r2 = n => Math.round(n * 100) / 100;

// 由「活動」開始到第一次可以傷害主角嘅秒數
function reactTime(kind, gap) {
  const v = CFG.playerSpeed, B = CFG.behaviour, g = Math.max(0, gap - CFG.contactPad);
  if (kind === 'flyer') return null;
  if (kind === 's7charge') {
    const t1 = Math.max(0, gap - B.s7charge.dashPx) / (v + B.s7charge.walk);
    const left = Math.min(gap, B.s7charge.dashPx) - v * CFG.warnSec - CFG.contactPad;
    return left <= 0 ? t1 + Math.max(0, Math.min(gap, B.s7charge.dashPx) - CFG.contactPad) / v : t1 + CFG.warnSec + left / (v + B.s7charge.dashSpeed);
  }
  if (kind === 's7hop') return CFG.warnSec + Math.max(0, g - v * CFG.warnSec) / (v + B.s7hop.hopSpeed);
  if (kind === 's7can') {
    const t1 = Math.max(0, gap - B.s7can.range) / (v + B.s7can.walk);
    return t1 + CFG.warnSec + Math.max(0, Math.min(gap, B.s7can.range) - v * CFG.warnSec) / (v + B.s7can.projSpeed);
  }
  return g / (v + B.walker.speed);
}
function evalEnemy(e, u = e.u) {
  const kind = SPECIES[e.sp] ?? 'walker';
  const actPos = Math.max(u, e.x - CFG.screenAheadPx);   // A9：醒來或入畫，較遲嗰個
  return { kind, actPos, gap: e.x - actPos, react: reactTime(kind, e.x - actPos), seenSec: Math.max(0, u - (e.x - CFG.screenAheadPx)) / CFG.playerSpeed };
}
function suggest(e, cps) {
  const floor = Math.max(...cps.filter(c => c <= e.x - CFG.minUnlockGap), 0, e.x - CFG.screenAheadPx);
  for (let u = e.u; u >= floor; u -= 10) { const r = evalEnemy(e, u).react; if (r !== null && r >= CFG.targetReactSec) return { u, r }; }
  const r = evalEnemy(e, floor).react;
  return { u: floor, r, blocked: r < CFG.minReactSec };
}
function analyze(id) {
  const S = STAGES[id], list = parse(S.e).filter(e => !(S.skip && e.x >= S.skip[0] && e.x <= S.skip[1]));
  const rows = list.map(e => ({ ...e, ...evalEnemy(e) }));
  const slow = rows.filter(r => r.react !== null && r.react < CFG.minReactSec);
  const clumps = [], near = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j]; if (Math.abs(a.x - b.x) >= CFG.clumpPx) continue;
    if (a.u === b.u) clumps.push([a, b]);
    else if (Math.abs(a.actPos - b.actPos) / CFG.playerSpeed < CFG.simulSec) near.push([a, b]);
  }
  const worst = [...slow].sort((a, b) => a.react - b.react).slice(0, 3).map(r => ({ ...r, fix: suggest(r, S.cps) }));
  return { rows, slow, clumps, near, worst, flyers: rows.filter(r => r.kind === 'flyer') };
}
function report() {
  const L = ['假設：主角以105px/s一路向前；前方可見352px；反應時間＝醒來或入畫（較遲）→第一次可傷害'];
  for (const id of Object.keys(STAGES)) {
    const a = analyze(id), name = r => `${r.x}${r.sp}`;
    L.push(`##### 第${id}關 #####`);
    L.push(`(a) 反應唔切（<${CFG.minReactSec}秒）：${a.slow.length ? a.slow.map(r => `${name(r)} ${r2(r.react)}秒`).join('、') : '冇'}`);
    L.push(`(b) 同醒來位夾擊（<${CFG.clumpPx}px）：${a.clumps.length ? a.clumps.map(([p, q]) => `${name(p)}＋${name(q)}`).join('、') : '冇'}`);
    L.push(`    唔同醒來位但差唔多同時：${a.near.length ? a.near.map(([p, q]) => `${name(p)}＋${name(q)}`).join('、') : '冇'}`);
    if (a.flyers.length) L.push(`    飛行（離地92px，行路唔撞到，攻擊方式未確認）：${a.flyers.map(name).join('、')}`);
    L.push('(c) 最差3個：');
    for (const w of a.worst) L.push(w.fix.blocked
      ? `    ${name(w)} ${r2(w.react)}秒 → unlockX ${w.u}→${w.fix.u}都只得${r2(w.fix.r)}秒（畫面或存檔點限制，改unlockX解決唔到）`
      : `    ${name(w)} ${r2(w.react)}秒（入畫後已見${r2(w.seenSec)}秒）→ unlockX ${w.u}→${w.fix.u}，變${r2(w.fix.r)}秒`);
    if (!a.worst.length) L.push('    冇');
  }
  return L.join('\n');
}
function test() {
  // 1：普通敵人隔140px醒 → (140−14)/(105+32)=0.92秒
  assert.equal(r2(reactTime('walker', 140)), 0.92);
  // 2：飛行敵人唔計
  assert.equal(reactTime('flyer', 100), null);
  // 3：unlockX 早過畫面邊緣冇用：x=1000，unlockX 500 同 648 結果一樣
  const e = { x: 1000, u: 500, sp: '魚' };
  assert.equal(evalEnemy(e).react, evalEnemy(e, 648).react);
  console.log('PASS 3個測試');
}
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) { if (process.argv[2] === '--test') test(); else console.log(report()); }
export { analyze, reactTime, CFG };
