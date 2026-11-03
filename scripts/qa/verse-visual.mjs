// Real map rendering with injected starting stage; mobile interactions are touch only.
// The unknown-stage card uses a controlled in-memory verse fixture, not a data file change.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const OUT=process.env.QA_OUT??'docs/qa-verse', BASE=process.env.QA_BASE_URL??'http://127.0.0.1:47315/'
const MODE=process.env.QA_MODE??'mobile', PROFILE=process.env.QA_PROFILE??'Pixel 7 landscape'
assert.ok(['mobile','desktop'].includes(MODE))
const verses=JSON.parse(fs.readFileSync(new URL('../../data/verses.json',import.meta.url),'utf8'))
fs.mkdirSync(OUT,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const ctx=await browser.newContext(MODE==='mobile'?{...devices[PROFILE]}:{viewport:{width:1280,height:720}})
const page=await ctx.newPage(), errors=[], report={mode:MODE,profile:MODE==='mobile'?PROFILE:'desktop',cases:[],errors}
page.on('pageerror',e=>errors.push(e.message))
const prefix=MODE==='desktop'?'desktop':PROFILE==='Pixel 7 landscape'?'mobile':'iphone'
const shot=async name=>page.screenshot({path:`${OUT}/${prefix}-${name}.png`,scale:'css'})
const tap=async(x,y)=>{const box=await page.locator('canvas').boundingBox();assert.ok(box);await page.touchscreen.tap(box.x+box.width*x/640,box.y+box.height*y/360)}
const confirm=async()=>MODE==='mobile'?tap(30,180):page.keyboard.press('Enter')
const startMap=async(data,expectPanel=true)=>{
  await page.evaluate(data=>{const g=window.__SAKE_GAME__;for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('worldmap',data)},data)
  await page.waitForFunction(({expectPanel})=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('worldmap');return g.scene.isActive('worldmap') && (expectPanel ? !!s.versePanel?.visible : !!s.cardGo)}, {expectPanel}, {timeout:15000})
  await page.waitForTimeout(150)
}
const info=()=>page.evaluate(()=>{
  const s=window.__SAKE_GAME__.scene.getScene('worldmap'), t=s.verseText, b=t?.getBounds(), bg=s.children.list.find(o=>o.type==='Image'&&/^map-(world|c2)/.test(o.texture.key))
  return {map:s.cm?.id,stage:s.pickIndex,picking:s.picking,open:s.openStages,banner:s.bannerLabel?.text,bg:bg?.texture.key,text:t?.text,width:t?.displayWidth,height:t?.displayHeight,scale:t?.scaleX,panelVisible:s.versePanel?.visible,bounds:b?{x:b.x,y:b.y,right:b.right,bottom:b.bottom}:null,party:s.party?{x:s.party.x,y:s.party.y,texture:s.party.texture.key}:null}
})
const checkVerse=(screen,stage,limit=360)=>{
  const expected=verses[String(stage)];assert.ok(expected,`stage ${stage} fixture`)
  const suffix=`\n— ${expected.ref}`;assert.ok(screen.text.endsWith(suffix),`stage ${stage}: ref`)
  const body=screen.text.slice(0,-suffix.length),lines=body.split('\n')
  assert.equal(body.replaceAll('\n',''),`「${expected.text}」`,`stage ${stage}: full original text`)
  for(const line of lines.slice(0,-1))assert.match(line,/[，。！？；：、,.!?;:]$/u,`stage ${stage}: punctuation breaks only`)
  assert.ok(screen.width<=limit+0.1,`stage ${stage}: visible width ${screen.width}`)
  if(screen.bounds)assert.ok(screen.bounds.x>=-1&&screen.bounds.right<=641&&screen.bounds.y>=-1&&screen.bounds.bottom<=361,`stage ${stage}: text within screen ${JSON.stringify(screen.bounds)}`)
  return lines
}
try{
  await page.goto(BASE);await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000});await page.waitForTimeout(800)
  // C1 original map; choose stage 2 using actual touch or keyboard.
  await startMap({from:2,to:3,next:'play',pick:true})
  let s=await info();assert.equal(s.map,1);assert.equal(s.bg,'map-world');assert.ok(s.picking);checkVerse(s,3);await shot('map-stage3')
  if(MODE==='mobile'){const p=await page.evaluate(()=>{const i=window.__SAKE_GAME__.scene.getScene('worldmap').icons[2];return{x:i.x,y:i.y}});await tap(p.x,p.y)}
  else await page.keyboard.press('ArrowLeft')
  await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('worldmap').verseText?.text.includes('箴言 24:13'),null,{timeout:5000})
  s=await info();checkVerse(s,2);report.cases.push({screen:'c1-pick-3-to-2',...s})
  // Real stage 6 now uses the C2 map, not the old black card.
  await startMap({from:5,to:6,next:'play',stageNo:6})
  s=await info();assert.equal(s.map,2);assert.equal(s.bg,'map-c2-dark');assert.equal(s.banner,'大陸2・第一關・購物中心');assert.ok(s.party.x<150,'starts at pier');checkVerse(s,6);assert.ok(s.text.includes('站立得穩'));await shot('c2-stage6')
  report.cases.push({screen:'c2-pier-to-stage6',...s})
  await confirm();await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('worldmap');return s.walking||s.leaving},null,{timeout:6000})
  await confirm();await page.waitForFunction(()=>window.__SAKE_GAME__.scene.isActive('play'),null,{timeout:10000})
  assert.equal(await page.evaluate(()=>window.__SAKE_GAME__.registry.get('stageNo')),6,'touch/keyboard continues to stage 6')
  report.cases.push({screen:'stage6-continue',stage:6})
  // Each C2 verse is rendered through actual stage selection on the new map.
  for(const stage of [6,7,8,9,10]){
    await startMap({from:10,to:stage,next:'play',pick:true})
    s=await info();assert.equal(s.map,2);assert.deepEqual(s.open,[6,7,8,9,10]);assert.ok(s.picking&&s.panelVisible);checkVerse(s,stage)
    if(stage===9){assert.ok(s.text.includes('同在'));await shot('c2-stage9')}
    report.cases.push({screen:'c2-pick',stage,...s})
  }
  // Actually change selection 8→7; tapping badge confirms immediately on mobile.
  await startMap({from:6,to:8,next:'play',pick:true})
  s=await info();assert.deepEqual(s.open,[6,7,8]);checkVerse(s,8)
  if(MODE==='mobile'){const p=await page.evaluate(()=>{const i=window.__SAKE_GAME__.scene.getScene('worldmap').icons[7];return{x:i.x,y:i.y}});await tap(p.x,p.y)}
  else{await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('worldmap').pickIndex===7);await page.keyboard.press('Enter')}
  await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('worldmap');return !s.picking&&s.data_.to===7&&s.verseText.text.includes('箴言 12:10')},null,{timeout:5000})
  s=await info();checkVerse(s,7);assert.equal(await page.evaluate(()=>window.__SAKE_GAME__.registry.get('stageNo')),7);report.cases.push({screen:'c2-select-8-to-7',...s})
  // Green map uses the same verse path and a separate temporary browser profile.
  await page.evaluate(()=>localStorage.setItem('sake-kuma-c2-cleared-v1','1'))
  await startMap({from:10,to:9,next:'play',pick:true});s=await info();assert.equal(s.bg,'map-c2-green');checkVerse(s,9);report.cases.push({screen:'c2-green',...s})
  await page.evaluate(()=>localStorage.removeItem('sake-kuma-c2-cleared-v1'))
  // Unknown mapped stage uses a synthetic verse only in memory; no production verse is changed.
  const fixture={text:'這是一段測試經文，完整詞語應當保留。',ref:'測試 1:1'}
  await page.evaluate(async fixture=>{const mod=await import('/data/verses.json?import');mod.default['11']=fixture},fixture)
  await startMap({from:10,to:11,next:'play',stageNo:11},false)
  const card=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('worldmap');const t=s.children.list.find(x=>typeof x.text==='string'&&x.text.includes('測試 1:1'));const b=t?.getBounds();return t&&{text:t.text,width:t.displayWidth,bounds:b?{x:b.x,y:b.y,right:b.right,bottom:b.bottom}:null}})
  verses['11']=fixture;assert.ok(card,'synthetic fallback verse visible');checkVerse(card,11,560);await shot('fallback11');report.cases.push({screen:'synthetic-fallback-stage11',...card})
  assert.deepEqual(errors,[]);report.passed=true;console.log('PASS',JSON.stringify(report))
}catch(e){report.passed=false;report.error=e.stack??String(e);console.error(report.error);await page.screenshot({path:`${OUT}/${prefix}-failure.png`,scale:'css'}).catch(()=>{})}
finally{fs.writeFileSync(`${OUT}/${prefix}.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
if(!report.passed)process.exitCode=1
