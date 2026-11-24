#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

// 所有門檻及統計欄位集中於此。
const CFG = Object.freeze({
  binPx: 300,
  rewardGapPx: 800,
  highDanger: 4,
  checkpointGapPx: 1500,
  bossCheckpointPx: 1000,
  pitEnemyPx: 40,
  barMax: 10,
  hazards: [
    'pits', 'spikes', 'durians', 'crushers',
    'windVents', 'bulldozers', 'conveyors',
    'slipZones', 'slippery', 'debris', 'floorJunk'
  ],
  rewards: ['honey', 'coins', 'secrets']
});

const arr = v => Array.isArray(v) ? v : [];
const num = v =>
  typeof v === 'number' && Number.isFinite(v);

const xOf = v =>
  num(v) ? v : num(v?.x) ? v.x : null;

const fmt = n =>
  Number.isInteger(n)
    ? String(n)
    : String(Number(n.toFixed(2)));

function span(v) {
  if (num(v)) return [v, v];
  if (!v || typeof v !== 'object') return null;

  if (num(v.x0) && num(v.x1)) {
    return [
      Math.min(v.x0, v.x1),
      Math.max(v.x0, v.x1)
    ];
  }

  if (!num(v.x)) return null;

  return [
    v.x,
    v.x + (num(v.w) ? Math.max(0, v.w) : 0)
  ];
}

function analyze(input) {
  const d =
    input && typeof input === 'object' ? input : {};

  const hazards = CFG.hazards
    .flatMap(field =>
      arr(d[field]).map(v => ({
        field,
        span: span(v)
      }))
    )
    .filter(v => v.span);

  const enemies = arr(d.enemies)
    .map(xOf)
    .filter(num);

  const rewards = CFG.rewards
    .flatMap(k => arr(d[k]).map(xOf))
    .filter(num);

  const cps = [
    ...new Set(
      arr(d.checkpoints).map(xOf).filter(num)
    )
  ].sort((a, b) => a - b);

  const bossX = num(d.boss?.triggerX)
    ? d.boss.triggerX
    : null;

  const ends = arr(d.segments)
    .map(s => s?.x1)
    .filter(num);

  const candidates = [
    d.worldW,
    d.length,
    ...ends,
    ...enemies,
    ...rewards,
    ...cps,
    ...hazards.map(h => h.span[1]),
    bossX
  ].filter(num);

  const length = Math.max(0, ...candidates);

  // 一般採左閉右開；最後一格包含關卡終點。
  const inBin = (x, a, b) =>
    x >= a &&
    (x < b || (b === length && x === b));

  const rows = [];

  for (let a = 0; a < length; a += CFG.binPx) {
    const b = Math.min(a + CFG.binPx, length);

    const ec = enemies.filter(x =>
      inBin(x, a, b)
    ).length;

    const hc = hazards.filter(h =>
      h.span[0] === h.span[1]
        ? inBin(h.span[0], a, b)
        : h.span[0] < b && h.span[1] > a
    ).length;

    const rc = rewards.filter(x =>
      inBin(x, a, b)
    ).length;

    const cc = cps.filter(x => inBin(x, a, b));

    rows.push({
      a,
      b,
      enemies: ec,
      hazards: hc,
      rewards: rc,
      checkpoints: cc,
      danger: hc
    });
  }

  const warnings = [];

  // 獎勵空窗包括起點及終點。
  const rewardPositions = [
    ...new Set(
      rewards.filter(x => x > 0 && x < length)
    )
  ].sort((a, b) => a - b);

  const anchors = [0, ...rewardPositions, length];

  for (let i = 1; i < anchors.length; i++) {
    const gap = anchors[i] - anchors[i - 1];

    if (gap > CFG.rewardGapPx) {
      warnings.push(
        `A 無獎勵間距 ` +
        `${fmt(anchors[i - 1])}–${fmt(anchors[i])}` +
        `：${fmt(gap)}px`
      );
    }
  }

  // 喘息：兩格中心之間有正長度的role=rest段。
  for (let i = 1; i < rows.length; i++) {
    const p = rows[i - 1];
    const r = rows[i];
    const c0 = (p.a + p.b) / 2;
    const c1 = (r.a + r.b) / 2;

    const rest = arr(d.segments).some(s =>
      s?.role === 'rest' &&
      num(s.x0) &&
      num(s.x1) &&
      s.x1 > s.x0 &&
      s.x0 < c1 &&
      s.x1 > c0
    );

    if (
      p.danger >= CFG.highDanger &&
      r.danger >= CFG.highDanger &&
      !rest
    ) {
      warnings.push(
        `B 連續高危 ${fmt(p.a)}–${fmt(r.b)}` +
        `：${p.danger}/${r.danger}，無標記喘息段`
      );
    }
  }

  // 存檔間距計至Boss；沒有Boss則計至終點。
  const routeEnd =
    bossX !== null &&
    bossX >= 0 &&
    bossX <= length
      ? bossX
      : length;

  const cpAnchors = [
    0,
    ...cps.filter(x => x > 0 && x < routeEnd),
    routeEnd
  ];

  for (let i = 1; i < cpAnchors.length; i++) {
    const gap = cpAnchors[i] - cpAnchors[i - 1];

    if (gap > CFG.checkpointGapPx) {
      warnings.push(
        `C 存檔間距 ` +
        `${fmt(cpAnchors[i - 1])}–${fmt(cpAnchors[i])}` +
        `：${fmt(gap)}px`
      );
    }
  }

  if (
    bossX !== null &&
    bossX >= 0 &&
    bossX <= length &&
    !cps.some(x =>
      x <= bossX &&
      bossX - x <= CFG.bossCheckpointPx
    )
  ) {
    warnings.push(
      `D Boss前${CFG.bossCheckpointPx}px內無存檔點` +
      `（Boss ${fmt(bossX)}）`
    );
  }

  // 包括坑內及坑外指定距離的敵人錨點。
  for (const p of arr(d.pits)) {
    const s = span(p);
    if (!s) continue;

    for (const x of enemies) {
      if (
        x >= s[0] - CFG.pitEnemyPx &&
        x <= s[1] + CFG.pitEnemyPx
      ) {
        warnings.push(
          `E 敵人x=${fmt(x)}接近或位於坑 ` +
          `${fmt(s[0])}–${fmt(s[1])}`
        );
      }
    }

    // 額外提示，不代表一定有bug。
    for (const x of cps) {
      if (x >= s[0] && x < s[1]) {
        warnings.push(
          `F 存檔點x=${fmt(x)}位於坑 ` +
          `${fmt(s[0])}–${fmt(s[1])}，須核對重生高度`
        );
      }
    }
  }

  const lines = [
    `長度=${fmt(length)}px；格寬=${CFG.binPx}px；` +
    `危險度=每格重疊危險物數（非死亡率）`
  ];

  for (const r of rows) {
    lines.push(
      `${fmt(r.a)}–${fmt(r.b)} | ` +
      `敵${r.enemies} 危${r.hazards} 獎${r.rewards} ` +
      `存檔:${
        r.checkpoints.length
          ? r.checkpoints.map(fmt).join(',')
          : '無'
      }`
    );
  }

  lines.push(
    '警告：',
    ...(warnings.length ? warnings : ['無']),
    '緊張度代理曲線：'
  );

  for (const r of rows) {
    lines.push(
      `${fmt(r.a)}–${fmt(r.b)} ` +
      '#'.repeat(Math.min(CFG.barMax, r.danger)) +
      (r.danger > CFG.barMax ? '+' : '') +
      ` (${r.danger})`
    );
  }

  return {
    rows,
    warnings,
    text: lines.join('\n')
  };
}

const fixtures = [
  {
    name: '1 缺欄位',
    data: { worldW: 300 },
    expect: []
  },
  {
    name: '2 獎勵與存檔長空窗',
    data: {
      worldW: 1800,
      boss: { triggerX: 1700 },
      coins: [{ x: 100 }],
      checkpoints: [100]
    },
    expect: [
      'A 無獎勵間距 100–1800：1700px',
      'C 存檔間距 100–1700：1600px',
      'D Boss前1000px內無存檔點（Boss 1700）'
    ]
  },
  {
    name: '3 跨格危險與坑邊敵人',
    data: {
      worldW: 600,
      conveyors: [{ x0: 0, x1: 600 }],
      slipZones: [{ x0: 0, x1: 600 }],
      windVents: [{ x: 100 }, { x: 400 }],
      crushers: [{ x: 150 }, { x: 450 }],
      pits: [{ x: 280, w: 40 }],
      enemies: [{ x: 260 }],
      coins: [{ x: 300 }]
    },
    expect: [
      'B 連續高危 0–600：5/5，無標記喘息段',
      'E 敵人x=260接近或位於坑 280–320'
    ]
  }
];

function test() {
  for (const f of fixtures) {
    const r = analyze(f.data);
    assert.deepEqual(r.warnings, f.expect);
    console.log(`=== ${f.name} ===\n${r.text}\n`);
  }

  assert.equal(analyze({}).rows.length, 0);

  assert.equal(
    analyze({
      worldW: 600,
      coins: [{ x: 300 }]
    }).rows[1].rewards,
    1
  );

  console.log('PASS 3個例子＋空輸入及格邊界檢查');
}

try {
  if (process.argv[2] === '--test') {
    test();
  } else if (!process.argv[2]) {
    console.error(
      '用法：node pacing.mjs <stage.json> 或 --test'
    );
    process.exitCode = 1;
  } else {
    const input = JSON.parse(
      fs.readFileSync(process.argv[2], 'utf8')
    );
    console.log(analyze(input).text);
  }
} catch (e) {
  console.error(`讀取／測試失敗：${e.message}`);
  process.exitCode = 1;
}
