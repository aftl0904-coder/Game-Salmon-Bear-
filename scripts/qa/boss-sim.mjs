#!/usr/bin/env node
// scripts/qa/boss-sim.mjs — Boss 戰模擬（普通難度；估算，唔係實測）
// 用法：node scripts/qa/boss-sim.mjs        （用下面內置數據）
//       node scripts/qa/boss-sim.mjs --test
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// ===== 可改常數 =====
const CFG = {
  runs: 1000, seed: 20261224, maxCycles: 300,
  boringSec: 180, tooFastSec: 45,
  phaseBreakMs: 2500,           // 轉階段停頓（唔截斷當時破綻）
  stamina: { cap: 1, regenPerSec: 0.55, idleMs: 380 },
  tiredCdMul: 1.6,
  sword: { cost: 0.32, cdMs: 480, base: 3, lv3Bonus: 1 },
  gun: { cost: 0.52, cdMs: 893, base: 3 },       // Lv2：2粒都中；Lv3：扇形3粒，預設中2粒
  gunHitsByLv: lv => (lv >= 2 ? 2 : 1),
  types: {                       // B5、B10、B17：每下攻擊獨立判斷打中
    newbie: { name: '新手', hit: 0.40, lv: 0, back: 0.0 },
    normal: { name: '普通', hit: 0.65, lv: 1, back: 0.2 },
    expert: { name: '熟手', hit: 0.85, lv: 3, back: 0.5 }
  },
  // 第1關用實際節奏：守1500→預警＋出招2500(B12預設)→破綻2500→喘2000
  // 第2–7關冇統一數據：預設一輪8500ms，40%時間打得入（windowFrac，每關可改）
  defaultCycleMs: 8500, defaultWindowFrac: 0.4
};
const BOSSES = {
  stage1: { name: '武者王', hp: 60, back: true, rhythm: { cycleMs: 8500, offsetMs: 4000, windowMs: 2500 } },
  stage2: { name: '女王蜂', hp: 36 },
  stage3: { name: '鏡鴞', hp: 36 },
  stage4: { name: '泥鬃', hp: 40 },
  stage5: { name: '△畝大佬', hp: 48 },
  stage6: { name: '洗地機X-9', hp: 55, back: true },
  stage7: { name: '馴獸師', hp: 55, thresholds: [0.66, 0.30], lastPhaseSpeed: 1.3 }
};

const r1 = n => Math.round(n * 10) / 10;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function rhythmOf(b) {
  if (b.rhythm) return b.rhythm;
  const cycleMs = b.cycleMs ?? CFG.defaultCycleMs, windowMs = cycleMs * (b.windowFrac ?? CFG.defaultWindowFrac);
  return { cycleMs, windowMs, offsetMs: (cycleMs - windowMs) / 2 };
}
function newHero(kind) { return { kind, s: CFG.stamina.cap, sAt: 0, last: -1e9, next: 0 }; }
function regen(h, now) {
  const start = Math.max(h.sAt, h.last + CFG.stamina.idleMs);
  if (now > start) h.s = Math.min(CFG.stamina.cap, h.s + CFG.stamina.regenPerSec * (now - start) / 1000);
  h.sAt = Math.max(h.sAt, now);
}
// 一個破綻窗口入面，一個主角嘅攻擊事件（時間、傷害）
function heroEvents(h, T, w0, w1, canBack, R) {
  const ev = [], W = CFG[h.kind];
  let t = Math.max(w0, h.next);
  while (t < w1) {
    regen(h, t);
    const full = h.s >= W.cost - 1e-9;
    h.s = Math.max(0, h.s - W.cost); h.last = t; h.sAt = t;
    const force = full ? 1 : 0.5;
    let per, shots;
    if (h.kind === 'sword') { per = Math.max(1, Math.round((W.base + (T.lv >= 3 ? W.lv3Bonus : 0)) * force)); shots = 1; }
    else { per = Math.max(1, Math.round(W.base * force)); shots = CFG.gunHitsByLv(T.lv); }
    for (let i = 0; i < shots; i++) if (R() < T.hit) ev.push({ t, d: per * (canBack && R() < T.back ? 2 : 1) });
    const cd = full ? W.cdMs : Math.round(W.cdMs * CFG.tiredCdMul);
    h.next = t + cd; t = h.next;
  }
  return ev;
}
function fightOnce(b, T, kinds, R) {
  const rh = rhythmOf(b), th = b.thresholds ?? [0.66, 0.33];
  const heroes = kinds.map(newHero);
  let hp = b.hp, t = 0, phase = 0, openings = 0;
  for (let c = 0; c < CFG.maxCycles; c++) {
    const sp = phase === th.length && b.lastPhaseSpeed ? b.lastPhaseSpeed : 1;
    const w0 = t + rh.offsetMs / sp, w1 = w0 + rh.windowMs / sp;
    const ev = heroes.flatMap(h => heroEvents(h, T, w0, w1, !!b.back, R)).sort((a, z) => a.t - z.t);
    openings++;
    for (const e of ev) { hp -= e.d; if (hp <= 0) return { sec: e.t / 1000, openings }; }
    t += rh.cycleMs / sp;
    const np = th.filter(x => hp / b.hp < x).length;
    if (np > phase) { phase = np; t += CFG.phaseBreakMs; }
  }
  return { sec: t / 1000, openings, capped: true };
}
function simulate(b, opts = {}) {
  const out = {}, combos = { '1P倫寶': ['gun'], '1P琪寶寶': ['sword'], '2P': ['gun', 'sword'] };
  for (const [tk, base] of Object.entries(CFG.types)) for (const [ck, kinds] of Object.entries(combos)) {
    const T = { ...base, ...(opts[tk] || {}) }, R = rng(opts.seed ?? CFG.seed), runs = opts.runs ?? CFG.runs;
    const secs = [], ops = [];
    for (let i = 0; i < runs; i++) { const r = fightOnce(b, T, kinds, R); secs.push(r.sec); ops.push(r.openings); }
    secs.sort((a, z) => a - z);
    const mean = secs.reduce((a, z) => a + z, 0) / runs;
    out[`${tk}_${ck}`] = { type: base.name, combo: ck, mean, p90: secs[Math.floor(runs * 0.9)], openings: ops.reduce((a, z) => a + z, 0) / runs };
  }
  return out;
}
function report() {
  const L = ['普通難度｜時間由第一輪開始計，唔計開場演出；全部係估算'];
  for (const [k, b] of Object.entries(BOSSES)) {
    L.push(`##### ${k} ${b.name}（HP${b.hp}${b.rhythm ? '，實際節奏' : '，預設40%時間打得入'}${b.back ? '，背脊×2' : ''}）#####`);
    for (const r of Object.values(simulate(b))) {
      const flag = r.mean > CFG.boringSec ? ' ⚠超過3分鐘（悶）' : r.mean < CFG.tooFastSec ? ' ⚠少過45秒（冇成就感）' : '';
      L.push(`${r.type}${r.combo} | 破綻${r1(r.openings)}個 | 平均${r1(r.mean)}秒 慢一成${r1(r.p90)}秒${flag}`);
    }
  }
  return L.join('\n');
}
function test() {
  const T = { hit: 1, lv: 0, back: 0 }, R = () => 0;
  // 1：琪寶寶滿氣一個2500ms破綻＝3+3+3+2+2＝13
  assert.equal(heroEvents(newHero('sword'), T, 0, 2500, false, R).reduce((a, e) => a + e.d, 0), 13);
  // 2：倫寶Lv0一個破綻＝3+3+3＝9（893ms之間回到氣）
  assert.equal(heroEvents(newHero('gun'), T, 0, 2500, false, R).reduce((a, e) => a + e.d, 0), 9);
  // 3：HP1嘅Boss，第一個破綻就打死
  assert.equal(fightOnce({ hp: 1, rhythm: { cycleMs: 8500, offsetMs: 4000, windowMs: 2500 } }, T, ['gun'], R).openings, 1);
  console.log('PASS 3個測試');
}
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) { if (process.argv[2] === '--test') test(); else console.log(report()); }
export { simulate, fightOnce, heroEvents, CFG, BOSSES };
