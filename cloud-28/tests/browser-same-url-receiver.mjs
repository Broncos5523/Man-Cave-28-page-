import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base=process.env.PREVIEW_URL;
assert.match(base||'',/^https:\/\/same-url-[a-z0-9.-]+\.workers\.dev\/?$/);
const target=base+'/staging/player.html?rotate=off';
const mock=[
"(function(){",
" const app={",
"  auth(){return {signInAnonymously(){return Promise.resolve({user:{uid:'mock-tv'}})}}},",
"  database(){return {ref(path){",
"   if(path!=='screens/third')throw Error('Wrong Firebase path '+path);",
"   return {on(event,success){",
"    if(event!=='value')throw Error('Unexpected Firebase event');",
"    window.__MC_TEST_COMMAND__=value=>success({val:()=>value});",
"    window.__MC_TEST_COMMAND__({type:'rotation'});",
"   },set(){throw Error('Firebase write forbidden');},update(){throw Error('Firebase write forbidden');}};",
"  }}}",
" };",
" window.firebase={",
"  app(){if(!window.__MC_TEST_APP__)throw Error('App absent');return window.__MC_TEST_APP__;},",
"  initializeApp(){window.__MC_TEST_APP__=app;return app;}",
" };",
"})();"
].join('\n');

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
 viewport:{width:720,height:1280},deviceScaleFactor:1,
 userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'
});
await context.route(/^https:\/\/www\.gstatic\.com\/firebasejs\/10\.14\.1\/firebase-.*-compat\.js/,route=>{
 const url=route.request().url();
 return route.fulfill({status:200,contentType:'application/javascript',
  body:url.endsWith('firebase-app-compat.js')?mock:'// other compat modules mocked'});
});
const page=await context.newPage(),errors=[],steps=[];
page.on('pageerror',e=>errors.push(String(e.stack||e).slice(0,360)));
try{
 const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(response?.status(),200);
 await page.waitForFunction(()=>window.__MC_TV3_REMOTE__?.getState?.().connected===true,null,{timeout:18000});
 const opening=await page.evaluate(()=>({
   attached:!!window.__MC_TV3_REMOTE__,
   initial:window.__MC_TV3_REMOTE__.getState(),
   fit:window.__MC_ONN_ROTATION__,
   player:window.__MC_PRODUCTION?.current,
   remoteScripts:[...document.scripts].filter(s=>s.src.includes('/staging/tv3-remote.js')).length
 }));
 assert.equal(opening.remoteScripts,1);
 assert.equal(opening.initial.desired,'rotation');
 assert.equal(opening.fit,'off');
 steps.push({name:'same address receives Firebase',...opening});
 for(const board of ['page1_nfl','page3_broncos']){
   await page.evaluate(board=>window.__MC_TEST_COMMAND__({type:'board',board,updatedAt:Date.now()}),board);
   await page.waitForFunction(id=>window.__MC_TV3_REMOTE__?.getState?.().held===id,board,{timeout:18000});
   const result=await page.evaluate(()=>{
     const frame=document.getElementById('mc-tv3-single-board');
     return {state:window.__MC_TV3_REMOTE__.getState(),
       overlay:!!frame,overlaySrc:frame?.getAttribute('src'),
       originalPlayerPresent:!!window.__MC_PRODUCTION};
   });
   assert.ok(result.overlay);
   assert.ok(result.overlaySrc?.includes('/staging/boards/'+board));
   assert.equal(result.originalPlayerPresent,true);
   steps.push({name:'controller board command',board,...result});
 }
 await page.evaluate(()=>window.__MC_TEST_COMMAND__({type:'rotation',updatedAt:Date.now()}));
 await page.waitForFunction(()=>window.__MC_TV3_REMOTE__?.getState?.().desired==='rotation' &&
   !document.getElementById('mc-tv3-single-board'),null,{timeout:12000});
 steps.push({name:'return to rotation',state:await page.evaluate(()=>window.__MC_TV3_REMOTE__.getState())});
 assert.equal(errors.length,0,'Page errors: '+errors.join(' | '));
 console.log('PASS_ORIGINAL_URL_CONTROLLER_SEND_AND_ROTATION',JSON.stringify({url:target,commands:2,errors:errors.length}));
}finally{
 fs.writeFileSync('same-address-receiver-result.json',JSON.stringify({steps,errors,
  exactPath:'/staging/player.html?rotate=off',mockFirebase:true},null,2));
 await browser.close();
}
