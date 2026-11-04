// Controlled fixtures in the real GameScene. Keyboard / emulated phone touch inputs; not a playthrough.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const mode=process.env.QA_MODE ?? 'desktop', out=process.env.QA_OUT ?? 'docs/qa-first-release-growth/combat-20261104', base=process.env.QA_BASE_URL ?? 'http://127.0.0.1:47952/'
fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const context=await browser.newContext(mode==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
const page=await context.newPage(), errors=[], results={scope:'Injected run allocations, target and scene state; real GameScene and controls. Not a natural clear, physical device, or human playtest.',mode,checks:{},errors}
page.on('pageerror',e=>errors.push(e.message))
const tap=async(x,y)=>{const b=await page.locator('canvas').boundingBox(); await page.touchscreen.tap(b.x+b.width*x/640,b.y+b.height*y/360)}
const screenshot=async name=>page.screenshot({path:`${out}/${mode}-${name}.png`,scale:'css'})
const setup=async(axis,points=1)=>page.evaluate(async({axis,points})=>{
 const r=await import('/src/game/run.ts'), game=window.__SAKE_GAME__, s=game.scene.getScene('play')
 const z={hp:0,atk:0,def:0,stam:0,sp:0}, a={...z}; if(axis)a[axis]=points
 if(!r.startNewRun(1,false,'2p','boy',game.registry,{sourceId:null,allocations:{boy:a,girl:z}})) throw Error('fixture start')
 s.initHeroStats(); s.boy.atkCd=0; s.boy.hurtCd=0; s.boy.hurtLock=0; s.boy.grace=0; s.boy.alive=true; s.boy.pose='idle'; s.boy.facing=1; s.boy.setFlipX(false); s.boy.setVelocity(0,0); s.specialCharges=1
 s.girl.hp=s.heroMaxHp(s.girl); s.girl.stam=s.heroStamMax('girl'); s.emitHealth()
 return {boyHp:s.boy.hp,girlHp:s.girl.hp,boyMax:s.heroMaxHp(s.boy),girlMax:s.heroMaxHp(s.girl),stam:s.heroStamMax('boy'),iframes:s.iframes(s.boy),girlIframes:s.iframes(s.girl)}
},{axis,points})
const input=async(kind)=>{if(mode==='mobile')await tap(kind==='attack'?532:584,kind==='attack'?312:264);else await page.keyboard.press(kind==='attack'?'f':'t')}
let passed=false
try{
 await page.goto(base); await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:45000})
 await page.evaluate(async()=>{const r=await import('/src/game/run.ts'),g=window.__SAKE_GAME__;g.registry.set('difficulty','normal');g.registry.set('stageRound',1);if(!r.startNewRun(1,false,'2p','boy',g.registry))throw Error('initial');for(const x of g.scene.getScenes(true))g.scene.stop(x.scene.key);g.scene.start('play')})
 await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('play'),null,{timeout:45000});await page.waitForTimeout(3500)
 if(mode==='mobile') await tap(600,16); else await page.keyboard.press('Enter')
 await page.waitForFunction(()=>{const s=window.__SAKE_GAME__?.scene.getScene('play');return s?.started&&!s.storyIntro&&s.girl},null,{timeout:45000});await page.waitForTimeout(1300)
 // Remove uncontrolled AI only in this test; receiveHit and Phaser overlaps remain real.
 await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.updateEnemies=()=>{};for(const e of s.enemies.getChildren())e.disableBody(true,true);s.__hitLog=[];const original=s.damageEnemy;s.damageEnemy=function(e,d,dir,from){const before=e.hp;const ret=original.call(this,e,d,dir,from);this.__hitLog.push({raw:d,before,after:e.hp,boss:!!e.boss,ret});return ret}})
 const baseline=await setup(null); const hp=await setup('hp'); assert.deepEqual([baseline.boyHp,hp.boyHp,hp.girlHp],[6,7,6]);results.checks.hp={baseline,allocated:hp};await screenshot('hp-one-point')
 const def0=await setup(null); const def1=await setup('def');const hurt=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy;h.hp=7;h.grace=0;h.hurtCd=0;s.hazardHit(h,{knockX:0,knockY:0});return {hp:h.hp,hurtCd:h.hurtCd,incoming:s.incoming(h,1)}});assert.equal(def1.iframes-def0.iframes,60);assert.equal(hurt.hurtCd,def1.iframes);assert.equal(hurt.incoming,1);results.checks.def={baseline:def0.iframes,allocated:def1.iframes,actualHazard:hurt};await screenshot('def-one-point')
 const stam0=await setup(null); const stam1=await setup('stam');assert.ok(stam1.stam>stam0.stam);const recover=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.boy.stam=0;s.boy.lastAtkAt=-10000;s.tickStamina(1000);return s.boy.stam});results.checks.stam={baseline:stam0.stam,allocated:stam1.stam,recover};assert.ok(recover>0.55);await screenshot('stamina-one-point')
 // Actual projectile collision: inject an ordinary existing enemy as stationary target, then use F/touch 攻.
 await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');const e=s.enemies.getChildren()[0];e.enableBody(true,s.boy.x+95,s.boy.y,true,true);e.setActive(true);e.hp=e.maxHp=100;e.fsm='IDLE';e.isDead=false;e.setVelocity(0,0);e.body.allowGravity=false;e.body.reset(e.x,e.y);s.__target=e})
 const attack=async(axis,points,kind='attack')=>{await setup(axis,points);await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.__hitLog=[];s.shots.clear(true,true);s.honeys.clear(true,true);s.attackHitboxes.clear(true,true);s.boy.attackHitbox.disableBody(true,true);s.boy.attackUntil=0;const e=s.__target;e.hp=100;e.fsm='IDLE';e.isDead=false;e.setActive(true);e.enableBody(true,s.boy.x+95,s.boy.y,true,true);e.body.allowGravity=false;e.body.reset(e.x,e.y);s.boy.stam=s.heroStamMax('boy');s.boy.atkCd=0;s.specialCharges=1});await input(kind);await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').__hitLog.length>0,null,{timeout:5000});return page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').__hitLog[0])}
 const atk0=await attack(null,0), atk1=await attack('atk',1);assert.equal(atk1.raw-atk0.raw,1);assert.equal(atk0.before-atk0.after,atk0.raw);assert.equal(atk1.before-atk1.after,atk1.raw);results.checks.atk={baseline:atk0,allocated:atk1};await screenshot('attack-one-point')
 const sp0=await attack(null,0,'special'),sp1=await attack('sp',1,'special');results.checks.sp={baseline:sp0,allocated:sp1};assert.equal(sp1.raw-sp0.raw,1);assert.equal(sp0.before-sp0.after,sp0.raw);assert.equal(sp1.before-sp1.after,sp1.raw);results.checks.sp={baseline:sp0,allocated:sp1};await screenshot('special-one-point')
 // Actual stage-1 boss receiveHit invoked through the same overlap path, not a natural fight.
 await page.evaluate(async()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.__target.disableBody(true,true);const {WarriorKing}=await import('/src/game/enemies/Stage1Boss.ts');const h={floorY:()=>s.boy.y,throwBarrel:()=>{},summon:()=>{},bossEvent:()=>{}};const e=new WarriorKing(s,s.boy.x+95,0,2000,h);s.enemies.add(e);e.act='stalk';s.__target=e})
 const boss0=await attack(null,0),boss3=await attack('atk',3);assert.equal(boss0.before-boss0.after,1);assert.equal(boss3.before-boss3.after,2);results.checks.boss={baseline:boss0,allocated3:boss3};await screenshot('boss-injected')
 const side=await page.evaluate(async()=>{const r=await import('/src/game/run.ts'),s=window.__SAKE_GAME__.scene.getScene('play'),before=localStorage.getItem('sake-kuma-run-v1');r.startSideTrip(s.registry);return {allocation:r.combatGrowth('boy'),max:s.heroMaxHp(s.boy),unchanged:before===localStorage.getItem('sake-kuma-run-v1')}});assert.equal(side.allocation.atk,0);assert.equal(side.max,6);assert.ok(side.unchanged);results.checks.side=side
 assert.deepEqual(errors,[]);passed=true;console.log('PASS',mode,JSON.stringify(results.checks,null,2))
}catch(e){results.error=e.stack??String(e);console.error('FAIL',mode,results.error);await screenshot('failure').catch(()=>{})}
finally{results.passed=passed;fs.writeFileSync(`${out}/${mode}-combat.json`,JSON.stringify(results,null,2)+'\n');await browser.close()}
if(!passed)process.exitCode=1
