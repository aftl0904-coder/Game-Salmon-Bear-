import { chromium } from 'playwright'
const [, , cast = 'boy', mode = 'jumpy', stageArg = '1'] = process.argv
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'easy'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate(([c, st]) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', +st); g.registry.set('difficulty', 'easy'); g.registry.set('playMode', 'solo'); g.registry.set('soloCast', c); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, [cast, stageArg])
await page.waitForTimeout(3000)
for (let i = 0; i < 10; i++) { if (!(await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro))) break; await page.keyboard.press('Enter'); await page.waitForTimeout(600) }
const st = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; if (!s.boy.hp) return null; h.hp = 6; const sc = window.__SAKE_GAME__.scene.getScenes(true).map((x) => x.scene.key).join(','); return { x: Math.round(h.x), y: Math.round(h.y), vx: Math.round(h.body.velocity.x), vy: Math.round(h.body.velocity.y), onG: h.body.blocked.down || h.body.touching.down, sc, ended: s.ended, bf: !!s.bossFight, intro: !!s.storyIntro, en: s.enemies.getChildren().filter((e) => e.active).map((e) => [e.species ?? e.texture.key, Math.round(e.x), Math.round(e.body?.velocity?.x ?? 0), e.fsm, Math.round(e.y), e.name || e.__id || (e.__id = Math.random().toString(36).slice(2, 6))]).filter((e) => Math.abs(e[1] - h.x) < 450) } })
await page.keyboard.down('d')
const t0 = Date.now(); const trace = []; let lastJump = 0
while ((Date.now() - t0) / 1000 < 220 && !(trace.length && trace[trace.length-1][1] > 5500 && (Date.now()-t0)/1000 > 40)) {
  const s = await st(); if (!s) break
  const t = (Date.now() - t0) / 1000
  trace.push([+t.toFixed(2), s.x, s.y, s.vx, s.onG, s.en])
  if (s.sc.includes('minigame') || s.intro) { await page.keyboard.up('d'); await page.keyboard.press('Enter'); await page.waitForTimeout(400); await page.keyboard.down('d'); continue }
  if (s.sc.includes('pause')) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); continue }
  if (s.ended || s.bf) { console.log('end', s.ended, s.bf, s.x); break }
  if (mode === 'jumpy' && t - lastJump > 0.9) { lastJump = t; await page.keyboard.press('g') }
  if (mode === 'jumpy') await page.keyboard.press('f')
  await page.waitForTimeout(100)
}
await page.keyboard.up('d')
await page.screenshot({ path: '/opt/cursor/artifacts/run1-end.png' })
console.log(JSON.stringify(await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; const b = h.body; return { x: h.x, y: h.y, pose: h.pose, grav: b.allowGravity, blk: b.blocked, touch: b.touching, vel: [b.velocity.x, b.velocity.y], sz: [b.width, b.height], world: s.physics.world.bounds.width, camX: s.cameras.main.scrollX, ended: s.ended, bf: !!s.bossFight, altar: s.altar ? 1 : 0 } })))
// stalls: windows where x changed < 3px over >=1.5s
const stalls = []; let i = 0
while (i < trace.length) { let j = i; while (j + 1 < trace.length && Math.abs(trace[j + 1][1] - trace[i][1]) < 4) j++; if (trace[j][0] - trace[i][0] >= 1.5) stalls.push({ t0: trace[i][0], t1: trace[j][0], x: trace[i][1], y: trace[i][2], onG: trace[i][4], near: trace[i][5] }); i = j + 1 }
const ser = {}; for (const r of trace) for (const e of r[5]) (ser[e[5]] ??= { sp: e[0], pts: [] }).pts.push([r[0], e[1], e[3], e[4], r[1]])
const estalls = []; for (const [id, v] of Object.entries(ser)) { let a = 0; const p = v.pts; while (a < p.length) { let c = a; while (c + 1 < p.length && Math.abs(p[c + 1][1] - p[a][1]) < 3 && !['ATTACK', 'HURT', 'DEAD'].includes(p[c + 1][2])) c++; if (p[c][0] - p[a][0] >= 3) estalls.push({ id, sp: v.sp, x: p[a][1], y: p[a][3], fsm: p[a][2], t0: p[a][0], t1: p[c][0], heroX: p[a][4] }); a = c + 1 } }
console.log(JSON.stringify({ estalls }))
console.log(JSON.stringify({ cast, mode, last: trace[trace.length - 1]?.slice(0, 3), stalls, errs }))
await b.close()
