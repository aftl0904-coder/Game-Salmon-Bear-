import { chromium } from 'playwright'
import fs from 'node:fs'
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:4777'
const browser = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page = await browser.newPage()
await page.addInitScript(() => {
  const Native = window.AudioContext
  window.AudioContext = class extends Native {
    constructor(...args) { super(...args); window.__trailerAudioContext = this; window.__trailerCapture = this.createMediaStreamDestination() }
  }
  const connect = AudioNode.prototype.connect
  AudioNode.prototype.connect = function(destination, ...args) {
    const result = connect.call(this, destination, ...args)
    if (destination === this.context.destination && window.__trailerCapture?.context === this.context) connect.call(this, window.__trailerCapture)
    return result
  }
})
await page.goto(base + '/guide/')
await page.evaluate(async () => {
  const audio = await import('/src/game/audio.ts')
  audio.setMuted(false)
  const ctx = window.__trailerAudioContext
  await ctx.resume()
  const chunks = []
  const recorder = new MediaRecorder(window.__trailerCapture.stream, {mimeType:'audio/webm;codecs=opus', audioBitsPerSecond:160000})
  window.__recorded = new Promise(resolve => { recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data) }; recorder.onstop = () => { const r=new FileReader(); r.onload=()=>resolve(r.result.split(',')[1]); r.readAsDataURL(new Blob(chunks,{type:'audio/webm'})) } })
  recorder.start()
  audio.playSong('story')
  const events = [
    [7000, () => { audio.playSong('sad'); audio.SFX.gulp() }],
    [13000, () => audio.SFX.dread()],
    [20000, () => audio.playSong('stage1')],
    [26700, () => audio.SFX.jump()],
    [29000, () => audio.playSong('ambush')],
    ...[29200,31200,33200,35200,37200,39200].map(t=>[t,()=>audio.SFX.boss()]),
    [41000, () => audio.playSong('mall')],
    [52000, () => { audio.playSong('stage4'); audio.SFX.dread() }],
    [60000, () => audio.SFX.dread()],
    [61000, () => audio.playSong('story')],
    [67000, () => audio.playSong('sad')],
  ]
  events.forEach(([ms,fn]) => setTimeout(fn, ms))
  setTimeout(() => { audio.stopBgm(); recorder.stop() }, 75500)
})
console.log('Recording game Web Audio: 75.5 s real time...')
const b64=await page.evaluate(() => window.__recorded)
fs.writeFileSync('docs/trailer/source/game-audio.webm',Buffer.from(b64,'base64'))
console.log('Saved docs/trailer/source/game-audio.webm; music/effects from src/game/audio.ts')
await browser.close()
