import { chromium } from 'playwright'
import fs from 'node:fs'
const out = 'docs/qa-c2s2'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
// Seed a valid stage-6-cleared checkpoint solely to enter stage 7 through the ordinary menu.
const gear = { heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 }
await context.addInitScript(({ gear }) => {
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
  localStorage.setItem('sake-kuma-run-v1', JSON.stringify({ version: 1, runId: 'qa-soak', startStage: 6, lastCleared: 6, nextStage: 7, gear: { boy: gear, girl: gear }, growth: {}, eligible: true, coins: 100, purse: { boy: 100, girl: 0 }, hp: { boy: 5 }, friends: [], charm: null, mode: '1p', solo: 'boy', puffLeft: false }))
}, { gear })
const page = await context.newPage()
const log = { description: '1P automated keyboard operation; seeded checkpoint, no teleport, hp manipulation or victory injection; not a human playthrough', start: new Date().toISOString(), samples: [], errors: [] }
page.on('pageerror', e => log.errors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') log.errors.push('console: ' + m.text()) })
await page.goto('http://127.0.0.1:47418/?c2=1')
await page.waitForTimeout(4000)
async function state() { return page.evaluate(() => { const g = window.__SAKE_GAME__; const active = g.scene.getScenes(true).map(s => s.scene.key); const p = g.scene.getScene('play'); return { active, stage: p?.stageNo, started: p?.started, ended: p?.ended, intro: !!p?.storyIntro, continue: p?.awaitingContinue, x: p?.boy && Math.round(p.boy.x), hp: p?.boy?.hp, boss: p?.queen?.qphase, now: p?.time?.now } }) }
for (let i=0; i<25; i++) {
  const s = await state()
  if (s.active.includes('play') && s.stage === 7 && s.started && !s.intro) break
  await page.keyboard.press('Enter'); await page.waitForTimeout(1200)
}
let initial = await state()
if (!(initial.active.includes('play') && initial.stage === 7 && initial.started)) {
  log.initial = initial; log.failure = 'could not enter stage 7 through menu'; fs.writeFileSync(`${out}/soak-1p.json`, JSON.stringify(log,null,2)); await browser.close(); process.exit(1)
}
const start = Date.now(); let lastSample = 0, loop = 0, held = false
while (Date.now() - start < 605000) {
  loop++
  const s = await state()
  if (s.active.includes('play') && s.stage === 7 && s.started && !s.ended && !s.intro) {
    if (!held) { await page.keyboard.down('d'); held = true }
    await page.keyboard.press('f')
    if (loop % 3 === 0) await page.keyboard.press('g')
    if (loop % 20 === 0) await page.keyboard.press('t')
  } else {
    if (held) { await page.keyboard.up('d'); held = false }
    // Continue, card and menu paths are handled by ordinary keys only.
    await page.keyboard.press(s.continue ? 'Space' : 'Enter')
  }
  if (Date.now() - lastSample >= 10000) {
    lastSample = Date.now(); log.samples.push({ elapsed: Math.round((lastSample - start)/1000), ...s })
    fs.writeFileSync(`${out}/soak-1p.json`, JSON.stringify(log,null,2)+'\n')
    console.log('1p soak', Math.round((lastSample-start)/1000), 's', JSON.stringify(s))
  }
  await page.waitForTimeout(320)
}
if (held) await page.keyboard.up('d')
log.durationSec = Math.round((Date.now()-start)/1000); log.end = new Date().toISOString(); log.final = await state(); log.completed = true
await page.screenshot({ path: `${out}/soak-1p-final.png` })
fs.writeFileSync(`${out}/soak-1p.json`, JSON.stringify(log,null,2)+'\n')
console.log('completed 1p soak', log.durationSec, 'seconds, errors', log.errors.length)
await browser.close()
