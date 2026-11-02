import { boot, OUT } from './owllib.mjs'
const { page, S, b, ev } = await boot('boy')
for (let i = 0; i < 400; i++) {
  const hit = await ev(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen; if (q.act === 'feathers' && q.cued && q.t > 250 && q.t < 480) { s.scene.pause(); return q.t } return null })
  if (hit !== null) { await page.screenshot({ path: `${OUT}/feathers-warn.png` }); console.log('paused at t=', hit); break }
  await page.waitForTimeout(20)
}
await b.close()
