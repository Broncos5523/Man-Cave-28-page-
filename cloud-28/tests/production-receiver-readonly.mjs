import {chromium} from 'playwright';
import fs from 'node:fs';
const url='https://man-cave-28-page.broncos5523.workers.dev/staging/player.html?rotate=off';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},
  userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await context.newPage();
const runtimeErrors=[];
page.on('pageerror',err=>runtimeErrors.push(String(err).slice(0,280)));
let result={url,production:true,readOnly:true,receiverConnected:false,networkFailures:[],runtimeErrors:[]};
try{
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
 result.status=response?.status();
 if(response?.status()!==200)throw Error('Production player did not respond 200');
 try{
  await page.waitForFunction(()=>window.__MC_TV3_REMOTE__?.getState?.().connected===true,
   null,{timeout:32000});
  result.receiverConnected=true;
 }catch{result.receiverConnected=false;}
 const info=await page.evaluate(()=>{
  const e=window.__MC_TV3_STAGING_EVENTS__||[];
  return {
    installed:!!window.__MC_TV3_REMOTE__,
    localEventKinds:[...new Set(e.map(x=>x.event))].slice(-15),
    authenticated:e.some(x=>x.event==='auth-ok'),
    receiverError:e.some(x=>['auth-failed','read-failed','sdk-load-failed','receiver-error'].includes(x.event)),
    connected:window.__MC_TV3_REMOTE__?.getState?.().connected===true,
    receiverScripts:[...document.scripts].filter(s=>s.src.includes('/staging/tv3-remote.js')).length,
    boardPlayerInstalled:!!document.querySelector('script[src="/staging/player.js"]')
  };
 });
 Object.assign(result,info);
 result.runtimeErrors=runtimeErrors.slice(0,8);
 if(!result.connected)throw Error('Firebase read-only receiver not connected; event kinds: '+result.localEventKinds.join(','));
 if(result.receiverError)throw Error('Firebase receiver reports errors: '+result.localEventKinds.join(','));
 if(result.receiverScripts!==1)throw Error('Duplicate receiver scripts');
 if(!result.boardPlayerInstalled)throw Error('Approved 28-board player absent');
 result.pass=true;
 console.log('PASS_REAL_FIREBASE_RECEIVER_ON_SAME_PRODUCTION_URL',JSON.stringify({
  status:result.status,installed:result.installed,authenticated:result.authenticated,
  connected:result.connected,eventKinds:result.localEventKinds}));
}catch(e){
 result.pass=false;result.error=String(e).slice(0,500);
 console.error('REAL_RECEIVER_PROBE_FAILED',result.error);
 process.exitCode=1;
}finally{
 fs.writeFileSync('production-receiver-readonly.json',JSON.stringify(result,null,2));
 await browser.close();
}
