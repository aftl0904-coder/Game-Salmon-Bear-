import { chromium } from 'playwright'
import fs from 'node:fs'
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:4777/'
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']})
let failed=false
for (const stage of [1,6]) {
 const context=await browser.newContext({viewport:{width:1280,height:720}})
 const page=await context.newPage(); const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 try {
  await page.goto(base)
  await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000})
  await page.waitForTimeout(800)
  await page.evaluate(stage=>{const g=window.__SAKE_GAME__;g.registry.set('stageNo',stage);g.registry.set('difficulty','normal');g.registry.set('playMode','1p');g.registry.set('soloCast','boy');g.registry.set('stageRound',1);for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('play')},stage)
  await page.waitForTimeout(3500); await page.keyboard.press('Enter')
  await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:15000})
  await page.waitForTimeout(400)
  await page.screenshot({path:`docs/qa-trailer/capture-stage${stage}.png`})
  const initial=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'); return {x:s.boy.x,y:s.boy.y,stageNo:s.stageNo}})
  await page.evaluate(()=>{const canvas=document.querySelector('canvas');const chunks=[];const rec=new MediaRecorder(canvas.captureStream(30),{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:4000000});window.__videoDone=new Promise(resolve=>{rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=()=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob(chunks,{type:'video/webm'}))}});window.__videoRec=rec;rec.start()})
  await page.keyboard.down('d');await page.waitForTimeout(1200);await page.keyboard.press('g');await page.waitForTimeout(1000);await page.keyboard.press('f');await page.waitForTimeout(2200);await page.keyboard.press('g');await page.waitForTimeout(2200);await page.keyboard.up('d');await page.waitForTimeout(300)
  await page.evaluate(()=>window.__videoRec.stop())
  const data=await page.evaluate(()=>window.__videoDone)
  fs.writeFileSync(`docs/trailer/source/stage${stage}.webm`,Buffer.from(data,'base64'))
  const end=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {x:s.boy.x,y:s.boy.y,stageNo:s.stageNo}})
  console.log(JSON.stringify({stage,initial,end,errors,recording:`docs/trailer/source/stage${stage}.webm`,note:'stage setup injected; input keyboard; not full playthrough'}))
  if(errors.length||end.x<=initial.x)failed=true
 } catch(e){console.error('FAIL stage',stage,e.stack);failed=true}
 finally {await context.close()}
}
await browser.close();if(failed)process.exitCode=1
