import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out = 'docs/qa-first-release-gallery', base = 'http://127.0.0.1:47390/'
const browser = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] })
const report = []
for (const mode of ['desktop','mobile']) {
  const context = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport:{width:1280,height:720} })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  const tap = async (x,y) => { const b = await page.locator('canvas').boundingBox(); assert.ok(b); await page.touchscreen.tap(b.x + b.width*x/640,b.y + b.height*y/360) }
  const active = n => page.waitForFunction(n => window.__SAKE_GAME__?.scene.isActive(n), n, {timeout:35000})
  const state = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('gallery'); return { group:s.group, index:s.index, action:s.action, texts:s.children.list.flatMap(o=>o.list ?? [o]).filter(o=>typeof o.text==='string').map(o=>o.text) } })
  try {
    await page.goto(base); await active('logo'); await page.waitForTimeout(800)
    if(mode==='mobile') await tap(472,330); else { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter') }
    await active('gallery'); await page.waitForTimeout(400)
    let s=await state(); assert.ok(s.texts.some(t=>t.includes('1 / 20'))); await page.screenshot({path:`${out}/${mode}-final-hero.png`,scale:'css'})
    if(mode==='mobile') await tap(40,190); else await page.keyboard.press('ArrowLeft')
    s=await state(); assert.ok(s.texts.some(t=>t.includes('結局守護者'))); assert.ok(s.texts.some(t=>t.includes('待繪')))
    if(mode==='mobile') await tap(388,69); else await page.keyboard.press('ArrowDown')
    s=await state(); assert.ok(s.texts.some(t=>t.includes('1 / 25')))
    if(mode==='mobile') await tap(40,190); else await page.keyboard.press('ArrowLeft')
    s=await state(); assert.ok(s.texts.some(t=>t.includes('產品化蜜僵')))
    if(mode==='mobile') await tap(472,305); else await page.keyboard.press('3')
    s=await state(); assert.equal(s.action,2); assert.ok(s.texts.some(t=>t.includes('待繪')))
    await page.screenshot({path:`${out}/${mode}-final-pending.png`,scale:'css'})
    if(mode==='mobile') await tap(61,23); else await page.keyboard.press('Escape')
    await active('logo'); assert.deepEqual(errors,[])
    report.push({mode,passed:true,checks:['20 good / 25 bad including pending candidates','three actions and pending status','return via keyboard or touch'],errors})
  } catch(e) { report.push({mode,passed:false,error:e.stack ?? String(e),errors}); await page.screenshot({path:`${out}/${mode}-final-failure.png`}).catch(()=>{}) }
  finally { await context.close() }
}
await browser.close()
fs.writeFileSync(`${out}/final-tests.json`, JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
if(report.some(r=>!r.passed)) process.exitCode=1
