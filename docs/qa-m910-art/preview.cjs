// Standalone asset QA, not the game. Uses the real JSON's frame list and FPS.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const out = process.env.M910_QA_OUT ? path.resolve(root, process.env.M910_QA_OUT) : __dirname;
fs.mkdirSync(out,{recursive:true});
const src = path.join(root, 'public/art/stage9/enemies');
const items = [
  { id:'jailguard', stem:'s9jailguard', phases:['warning','attack'] }
].map(it => ({...it, meta:JSON.parse(fs.readFileSync(path.join(src,it.stem+'.json'),'utf8')),
  png:'data:image/png;base64,'+fs.readFileSync(path.join(src,it.stem+'.png')).toString('base64')}));
const serial = JSON.stringify(items).replace(/</g,'\\u003c');
const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;background:#e9eef1;color:#182b38;font:16px system-ui}main{max-width:900px;margin:auto;padding:14px}h1{font-size:20px;margin:4px 0}p{margin:8px 0}.warning{color:#9b3122;font-weight:700}.controls{display:flex;gap:8px;flex-wrap:wrap}button{min-height:48px;padding:10px 16px;font-size:15px;background:white;border:2px solid #45667a;border-radius:6px;touch-action:manipulation}.panel{margin-top:12px;border:2px solid #90a9b8;border-radius:8px;padding:12px;background:white}.bg{display:flex;align-items:center;justify-content:center;min-height:380px;background-color:#e1e8e8;background-image:linear-gradient(45deg,#c8d1d1 25%,transparent 25%),linear-gradient(-45deg,#c8d1d1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#c8d1d1 75%),linear-gradient(-45deg,transparent 75%,#c8d1d1 75%);background-size:32px 32px;background-position:0 0,0 16px,16px -16px,-16px 0}canvas{image-rendering:pixelated;max-width:95%;max-height:340px}#state{min-height:48px;font-weight:700}@media(max-width:600px){body{font-size:14px}.bg{min-height:330px}canvas{max-height:300px}}</style></head>
<body><main><h1>Frame-list QA: standalone preview</h1><p class="warning">NOT THE GAME · NOT REAL DEVICE · visual hold only</p><p>Uses current JSON frame list and FPS. Button starts warning → attack → final held pose.</p><div class="controls"><button id="jailguard">Jail guard</button></div><div class="panel"><div id="state">Choose an animation.</div><div class="bg"><canvas id="canvas"></canvas></div><p id="info"></p></div></main><script>
const items=${serial};let timer=0;window.test={ready:false,trace:[]};const canvas=document.querySelector('#canvas'),ctx=canvas.getContext('2d');
async function run(id){clearTimeout(timer);const it=items.find(o=>o.id===id), m=it.meta, img=new Image();img.src=it.png;await img.decode();canvas.width=m.frameWidth;canvas.height=m.frameHeight;canvas.style.width=m.frameWidth*1.5+'px';canvas.style.height=m.frameHeight*1.5+'px';window.test={ready:true,id,phase:'',slot:-1,frame:-1,trace:[],done:false};let phase=0,slot=0;
function draw(){const name=it.phases[phase],anim=m.anims[name],frame=anim.frames[slot];ctx.clearRect(0,0,m.frameWidth,m.frameHeight);ctx.drawImage(img,(frame%m.columns)*m.frameWidth,Math.floor(frame/m.columns)*m.frameHeight,m.frameWidth,m.frameHeight,0,0,m.frameWidth,m.frameHeight);const e={phase:name,slot,frame,fps:anim.fps,at:performance.now()};Object.assign(window.test,e);window.test.trace.push(e);document.querySelector('#state').textContent=id+' · '+name+' · slot '+(slot+1)+'/'+anim.frames.length+' · atlas frame '+frame;document.querySelector('#info').textContent='0-based atlas index · '+anim.fps+' fps · repeated slots deliberately hold a pose';timer=setTimeout(()=>{slot++;if(slot>=anim.frames.length){phase++;slot=0;if(phase>=it.phases.length){window.test.done=true;document.querySelector('#state').textContent+=' · finished, holding final frame';return}}draw()},1000/anim.fps)}draw()}
for(const it of items)document.getElementById(it.id).addEventListener('click',()=>run(it.id));</script></body></html>`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const logs=[];
 for(const [mode,options] of [['desktop',{viewport:{width:1100,height:800}}],['mobile-touch',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]]){
  const context=await browser.newContext(options),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent(html,{waitUntil:'load'});
  for(const it of items){const button=page.locator('#'+it.id);if(mode==='desktop')await button.click();else{const box=await button.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2)}
   await page.waitForFunction(id=>window.test.ready&&window.test.id===id,it.id);
   await page.waitForFunction(p=>window.test.phase===p&&window.test.slot>=1,it.phases[0],{timeout:5000});await page.screenshot({path:path.join(out,mode+'-'+it.id+'-warning.png')});
   await page.waitForFunction(p=>window.test.phase===p&&window.test.slot===1,it.phases[1],{timeout:5000,polling:10});await page.screenshot({path:path.join(out,mode+'-'+it.id+'-attack.png')});
   await page.waitForFunction(()=>window.test.done,null,{timeout:5000});const trace=await page.evaluate(()=>window.test.trace);
   const expected=it.phases.flatMap(p=>it.meta.anims[p].frames.map((frame,slot)=>({phase:p,slot,frame,fps:it.meta.anims[p].fps})));
   assert.deepEqual(trace.map(({phase,slot,frame,fps})=>({phase,slot,frame,fps})),expected);
   assert(trace.every((e,i)=>i===0 || e.at>trace[i-1].at),'monotonic browser ticks');
   const intervals=trace.slice(1).map((e,i)=>({actualMs:e.at-trace[i].at,targetMs:1000/trace[i].fps}));
   assert(intervals.every(t=>t.actualMs>=t.targetMs*0.75&&t.actualMs<=t.targetMs+250),'preview timers follow metadata FPS within browser scheduling tolerance');
   const finalFrame=trace[trace.length-1].frame;await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.test.frame),finalFrame,'preview holds final pose');
   const visible=await page.locator('#canvas').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<a.length;i+=4)if(a[i])return true;return false});assert(visible,'final frame is visible');
   logs.push({mode,id:it.id,input:mode==='desktop'?'mouse':'touch only',trace,expected,intervals,passed:true});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await browser.close();fs.writeFileSync(path.join(out,'preview-log.json'),JSON.stringify(logs,null,2)+'\n');console.log('PASS: desktop mouse and simulated mobile touch; sequences read from JSON, all frames and FPS order verified; not game or physical device');
})().catch(e=>{console.error(e);process.exitCode=1});
