import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base=process.env.PREVIEW_URL;
assert.match(base||'',/^https:\/\/[a-z0-9.-]+\.workers\.dev$/);
const target=base+'/staging/player.html?rotate=off';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},
  userAgent:'Mozilla/5.0 (Linux; Android 10; onn Google TV) AppleWebKit/537.36 Chrome/83.0.0.0 Safari/537.36'});
const mock=[
  "(function(){",
  "const app={",
  " auth(){return {signInAnonymously(){return Promise.resolve({user:{uid:'fake-onn'}})}}},",
  " database(){return {ref(path){",
  "  if(path!=='screens/third')throw Error('Wrong Firebase path '+path);",
  "  return {on(event,success){window.__MC_TEST_COMMAND__=value=>success({val:()=>value});window.__MC_TEST_COMMAND__({type:'rotation'});},",
  "    set(){throw Error('Unexpected database write');},update(){throw Error('Unexpected database update');}};",
  " }}}",
  "};",
  "window.firebase={app(){if(!window.__APP)throw Error('No app');return window.__APP;},",
  "  initializeApp(){window.__APP=app;return app;}};",
  "})();"
].join('\n');
await context.route(/^https:\/\/www\.gstatic\.com\/firebasejs\/10\.14\.1\/firebase-.*-compat\.js/,route=>
 route.fulfill({status:200,contentType:'text/javascript',
 body:route.request().url().endsWith('firebase-app-compat.js')?mock:'// Firebase SDK already supplied by mocked app'}));
const results=[];
async function assertMode(url,expectOnnReceiver){
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e).slice(0,340)));
 const nav=await page.goto(url,{waitUntil:'domcontentloaded',timeout:42000});
 assert.equal(nav?.status(),200);
 await page.waitForSelector('iframe#receiver-test',{timeout:14000});
 const iframe=page.frameLocator('iframe#receiver-test');
 await iframe.locator('body').waitFor({timeout:15000});
 const inner=page.frames().find(f=>f.url().includes('/staging/player.html'));
 assert.ok(inner,'TV board iframe unavailable');
 if(expectOnnReceiver){
  await inner.waitForFunction(()=>window.__MC_TV3_REMOTE__?.getState?.().connected===true,null,{timeout:26000});
  const state=await inner.evaluate(()=>{
   window.__MC_TEST_COMMAND__({type:'board',board:'page1_nfl',updatedAt:Date.now()});
   return {state:window.__MC_TV3_REMOTE__.getState(),
      frameSrc:document.getElementById('mc-tv3-single-board')?.getAttribute('src'),
      referrer:document.referrer,
      nested:window.top!==window};
  });
  assert.equal(state.state.desired,'page1_nfl');
  assert.equal(state.state.held,'page1_nfl');
  assert.ok(state.frameSrc?.includes('page1_nfl'));
  assert.ok(state.nested);
  results.push({case:'Onn fullscreen wrapper, same URL',pass:true,referrerOrigin:new URL(state.referrer).origin});
 } else {
  await page.waitForTimeout(5500);
  const state=await inner.evaluate(()=>({
    hasReceiver:!!window.__MC_TV3_REMOTE__,referrer:document.referrer,
    nested:window.top!==window
  }));
  assert.equal(state.hasReceiver,false,'Wing receiver must not subscribe to third-TV assignments');
  assert.ok(state.nested);
  results.push({case:'Left/Right GitHub Pages wing iframe',pass:true,referrerOrigin:new URL(state.referrer).origin});
 }
 assert.deepEqual(errors,[],'Unexpected iframe page JS error');
 await page.close();
}
let failure;
try{
 // Same-origin wrapper emulates a fullscreen Android TV host which embeds
 // the same previously bookmarked URL without changing its address.
 const local=base+'/staging/nested-onn-test-host.html';
 await context.route(local,route=>route.fulfill({status:200,contentType:'text/html',
   body:'<!doctype html><html><body><iframe id="receiver-test" src="'+target+'" style="width:720px;height:1280px"></iframe></body></html>'}));
 await assertMode(local,true);
 // The actual Fire TV receivers run on the owner's GitHub Pages origin.
 // The receiver must NOT subscribe to the independent Onn assignment there.
 const wing='https://broncos5523.github.io/left-right-/nested-onn-test-host.html';
 await context.route(wing,route=>route.fulfill({status:200,contentType:'text/html',
   body:'<!doctype html><html><body><iframe id="receiver-test" src="'+target+'" style="width:720px;height:1280px"></iframe></body></html>'}));
 await assertMode(wing,false);
 console.log('PASS_ONN_NESTED_RECEIVER_AND_WING_ISOLATION',JSON.stringify({checks:results.length}));
}catch(e){failure=String(e.stack||e);console.error('NESTED_RECEIVER_CHECK_FAILED',failure.slice(0,1500));}
finally{
 fs.writeFileSync('onn-nested-receiver-check.json',JSON.stringify({results,pass:!failure,failed:failure||null},null,2));
 await browser.close();
 if(failure)process.exitCode=1;
}
