/* Safe Onn/iPhone entry screen acceptance. Staging reads only; no Firebase writes. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base='https://man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true});
const rows=[];
try {
  for(const profile of [
    {name:'phone-portrait',width:390,height:844},
    {name:'onn-hdmi-landscape',width:1920,height:1080}
  ]){
    const context=await browser.newContext({viewport:{width:profile.width,height:profile.height}});
    const page=await context.newPage(),jsErrors=[],writes=[],remote=[];
    page.on('pageerror',error=>jsErrors.push(String(error)));
    page.on('request',req=>{
      const url=new URL(req.url());
      if(req.method()!=='GET'&&req.method()!=='HEAD')writes.push({method:req.method(),path:url.pathname});
      if(/firebase|firestore|identitytoolkit/i.test(url.hostname))remote.push(url.hostname);
    });
    const result={profile:profile.name,pass:false};
    try{
      const res=await page.goto(base+'/staging/device-check.html',{waitUntil:'domcontentloaded',timeout:45000});
      assert.equal(res.status(),200,'Phone/Onn preflight page must exist');
      await page.waitForFunction(()=>/\d+\/6 device\/network checks passed/.test(
        document.querySelector('#summary')?.textContent||''),null,{timeout:70000});
      const state=await page.evaluate(()=>{
        const checks=['secure','screen','motion','worker','manifest','data'];
        return {statuses:Object.fromEntries(checks.map(k=>[k,document.querySelector('#'+k+'-status')?.textContent])),
          summary:document.querySelector('#summary')?.textContent,
          links:[document.querySelector('#rotation-link')?.getAttribute('href'),
            document.querySelector('#receiver-link')?.getAttribute('href')]};
      });
      assert.ok(Object.values(state.statuses).every(x=>x==='PASS'),
        'Original public device/data checks failed: '+JSON.stringify(state.statuses));
      assert.equal(writes.length,0,'Device preflight must never POST or mutate data');
      assert.equal(remote.length,0,'Preflight must not contact Firebase');
      await page.selectOption('#rotation','cw');
      await page.selectOption('#fit','contain');
      const urls=await page.locator('.actions a').evaluateAll(els=>els.map(a=>a.getAttribute('href')));
      assert.deepEqual(urls,[
        '/staging/player.html?rotate=cw&fit=contain',
        '/staging/tv3.html?rotate=cw&fit=contain'
      ],'Receiver/rotation preview links must honor Onn settings');
      assert.equal(jsErrors.length,0,'Preflight JS errors');
      const index=await page.request.get(base+'/staging/');
      assert.equal(index.status(),200);
      const html=await index.text();
      assert.ok(html.includes('All 28 approved layouts and live-data renderers passed automated browser verification'),
        'Staging index still advertises old visual-only status');
      assert.ok(html.includes('/staging/device-check.html'),'Missing iPhone/Onn entry link');
      const status=await page.request.get(base+'/staging/status.json');
      assert.equal(status.status(),200);
      const summary=await status.json();
      assert.equal(summary.boardCount,28);
      assert.ok(String(summary.mode).includes('PHYSICAL ONN UNTESTED'));
      Object.assign(result,{checks:state.statuses,links:urls,pass:true});
    }catch(error){result.error=error.message;result.jsErrors=jsErrors;result.writes=writes;result.firebase=remote;}
    rows.push(result);console.log('ONN_PREFLIGHT_BROWSER_RESULT',JSON.stringify(result));
    await page.screenshot({path:profile.name+'-preflight.png',fullPage:true}).catch(()=>{});
    await context.close();
  }
}finally{await browser.close()}
fs.writeFileSync('onn-preflight-matrix.json',JSON.stringify({checkedAt:new Date().toISOString(),results:rows},null,2));
if(rows.some(r=>!r.pass))process.exitCode=1;
