const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/tmp/salmon-bear-readonly/node_modules/playwright');
const root=process.env.QA_OUT || '/tmp/qa-art20-4dab', port=Number(process.env.QA_PORT || 18795);
const log=fs.openSync(path.join(root,'preview-server.log'),'w');
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:['ignore',log,log]});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const result={scope:'isolated Phaser tiles; not game; dimensions for test only',views:[]}; let browser;
 try {
  await sleep(1200); browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const mode of [{name:'desktop',width:1280,height:720,mobile:false},{name:'mobile',width:844,height:390,mobile:true}]){
   const ctx=await browser.newContext({viewport:{width:mode.width,height:mode.height},isMobile:mode.mobile,hasTouch:mode.mobile});
   for(const asset of ['corridor-mid','training-mid']){
    const page=await ctx.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(String(e))); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())}); page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`)});
    await page.goto(`http://127.0.0.1:${port}/preview.html?name=${asset}`,{waitUntil:'networkidle'}); await page.waitForFunction(()=>window.previewReady===true);
    await page.screenshot({path:path.join(root,`preview-${mode.name}-${asset}.png`)});
    const position=await page.evaluate(()=>window.shiftTile(37)); await sleep(100);
    const canvas=await page.locator('canvas').count(); result.views.push({mode:mode.name,asset,errors,canvas,afterScrollPosition:position});
    await page.close();
   }
   await ctx.close();
  }
  fs.writeFileSync(path.join(root,'preview-browser-report.json'),JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2));
  if(result.views.some(v=>v.errors.length||v.canvas!==1))process.exitCode=1;
 }catch(e){console.error(e.stack||e);process.exitCode=1;}
 finally{if(browser)await browser.close();server.kill('SIGTERM');fs.closeSync(log);}
})();
