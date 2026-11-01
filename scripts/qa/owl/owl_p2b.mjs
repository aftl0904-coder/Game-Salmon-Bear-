import { boot, OUT } from './owllib.mjs'
const { page, S, b, ev } = await boot('boy')
await ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.x = s.queen.x - 200; s.queen.hp = 22; s.queen.updatePhase() })
await page.waitForTimeout(900)
await page.screenshot({ path: `${OUT}/p2-b.png` })
console.log(JSON.stringify(await ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; return { dec: q.decoys.map((d) => ({ x: d.x, y: d.y, a: d.alpha, act: d.active, vis: d.visible, depth: d.depth, tex: d.texture.key })), q: { x: q.x, y: q.y, depth: q.depth }, arena: [q.arenaX0, q.arenaX1], cam: s.cameras.main.scrollX } })))
await b.close()
