#!/usr/bin/env node
// scripts/qa/economy.mjs — 金幣經濟反推：攤檔每關要俾幾多金幣（1P，普通難度；估算）
// 用法：node scripts/qa/economy.mjs   |   node scripts/qa/economy.mjs --test
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// ===== 可改常數 =====
const CFG = {
  runs: 3000, seed: 20261224,
  startCoins: 0,                         // E4
  restCost: 6, restEveryStage: true,     // E14：每關休息一次
  c2From: 6, c2Mul: 1.75,                // E10：Math.round
  // 新手只買Lv1；買嘢次序（武器＝劍或槍，價錢一樣）
  buyOrder: [['鞋', 8], ['武器', 10], ['盔甲', 10], ['大心心', 12]],
  pick: { newbie: 0.6, normal: 0.8 },    // E7
  // 地上金幣（每粒1）、會跌金幣嘅打爛物件（E5 未確認：每個1幣；第7關未知當1）
  coins:  [19, 7, 3, 7, 7, 29, 16],
  breakCoins: [4, 2, 1, 2, 2, 2, 1],
  // E18：PR #147 真數據每關平均死亡次數（死亡次數當 Poisson）
  deaths: { newbie: [2.5, 1.5, 1.1, 1.4, 0.6, 2.2, 1.7], normal: [0.6, 0.3, 0.2, 0.3, 0.1, 0.6, 0.5] },
  rebuyWithin: 2,                        // E13：死咗之後兩關內買返死前全部
  targets: [0.8, 0.9, 0.95]              // 成功率門檻 → 答案範圍
};
const price = (p, stage) => (stage >= CFG.c2From ? Math.round(p * CFG.c2Mul) : p);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const binom = (n, p, R) => { let k = 0; for (let i = 0; i < n; i++) if (R() < p) k++; return k; };
const poisson = (m, R) => { let k = 0, p = Math.exp(-m), s = p; const u = R(); while (u > s) { k++; p *= m / k; s += p; } return k; };

// 一次遊玩；reward[i]＝第i+1關攤檔金幣；回傳有冇失敗同原因
function playOnce(type, reward, R, stages = 7) {
  let wallet = CFG.startCoins, owned = new Set(), lost = null;
  for (let i = 0; i < stages; i++) {
    const st = i + 1;
    wallet += binom(CFG.coins[i], CFG.pick[type], R) + binom(CFG.breakCoins[i], CFG.pick[type], R) + reward[i];
    if (poisson(CFG.deaths[type][i], R) > 0 && owned.size) { lost = { items: new Set(owned), by: i + CFG.rebuyWithin }; owned.clear(); }
    if (CFG.restEveryStage) { if (wallet < CFG.restCost) return { fail: `第${st}關休息唔夠錢` }; wallet -= CFG.restCost; }
    const notOwned = CFG.buyOrder.filter(([n]) => !owned.has(n));
    if (notOwned.length && wallet < Math.min(...notOwned.map(([, p]) => price(p, st)))) return { fail: `第${st}關買唔起Lv1` };
    // 先買返失去嘅（買得幾多買幾多），之後每關最多買一樣新嘢
    for (const [name, p] of CFG.buyOrder) if (lost?.items.has(name) && !owned.has(name) && wallet >= price(p, st)) { wallet -= price(p, st); owned.add(name); }
    const next = CFG.buyOrder.find(([n]) => !owned.has(n) && !lost?.items.has(n));
    if (next && wallet >= price(next[1], st)) { wallet -= price(next[1], st); owned.add(next[0]); }
    if (lost) { if ([...lost.items].every(n => owned.has(n))) lost = null; else if (i >= lost.by) return { fail: `第${st}關仲未買返死前裝備` }; }
  }
  return { fail: null };
}
function successRate(type, reward, runs = CFG.runs, seed = CFG.seed) {
  const R = rng(seed), why = {}; let ok = 0;
  for (let n = 0; n < runs; n++) { const r = playOnce(type, reward, R); if (!r.fail) ok++; else why[r.fail] = (why[r.fail] || 0) + 1; }
  return { rate: ok / runs, why };
}
// 第一大陸（1–5關）一個數 r1、第二大陸（6–7關）一個數 r2；搵最細組合
function solve(type, target) {
  for (let total = 0; total <= 400; total++) for (let r1 = 0; r1 <= total; r1++) {
    const r2 = total - r1; if (r2 < r1) continue;   // 第二大陸唔少過第一大陸
    const reward = [r1, r1, r1, r1, r1, r2, r2];
    if (successRate(type, reward, 600).rate >= target && successRate(type, reward).rate >= target) return { r1, r2 };
  }
  return null;
}
function report() {
  const L = ['1P｜普通難度｜攤檔每關一次、免費、按表現（E15未確認）｜敵人唔跌金幣、打爛物件1幣（E5未確認）'];
  for (const type of ['newbie', 'normal']) {
    L.push(`##### ${type === 'newbie' ? '新手' : '普通'} #####`);
    const noStall = successRate(type, [0, 0, 0, 0, 0, 0, 0]);
    L.push(`攤檔俾0幣：成功率${Math.round(noStall.rate * 100)}%；主要失敗：${Object.entries(noStall.why).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k}（${Math.round(v / CFG.runs * 100)}%）`).join('、') || '冇'}`);
    for (const t of CFG.targets) {
      const s = solve(type, t);
      L.push(s ? `成功率≥${t * 100}%：第1–5關每關攤檔約${s.r1}幣，第6–7關約${s.r2}幣` : `成功率≥${t * 100}%：400幣內搵唔到`);
    }
  }
  return L.join('\n');
}
function test() {
  // 1：冇死、拾晒、冇攤檔：第3關剩6幣，休息後0 → 買唔起
  const save = CFG.deaths.normal; CFG.deaths.normal = [0, 0, 0, 0, 0, 0, 0];
  assert.equal(playOnce('normal', [0, 0, 0, 0, 0, 0, 0], () => 0).fail, '第3關買唔起Lv1');
  assert.equal(playOnce('normal', [10, 10, 10, 10, 10, 20, 20], () => 0).fail, null);
  // 2：一粒都執唔到又冇攤檔 → 第1關休息唔夠錢
  assert.equal(playOnce('normal', [0, 0, 0, 0, 0, 0, 0], () => 0.99).fail, '第1關休息唔夠錢');
  CFG.deaths.normal = save;
  // 3：第二大陸價錢：鞋8×1.75＝14
  assert.equal(price(8, 6), 14);
  console.log('PASS 3個測試');
}
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) { if (process.argv[2] === '--test') test(); else console.log(report()); }
export { playOnce, successRate, solve, CFG };
