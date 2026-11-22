// Read-only multi-league image parity and 30s rotation check on isolated img-source Preview.
// No Cloudflare deployment, no controller/Firebase writes, no production player changes.
import {chromium} from 'playwright';
import fs from 'node:fs';

const ORIGIN='https://img-source-man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},deviceScaleFactor:1,
 userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await context.newPage();
const watchdog=setTimeout(()=>{console.error('MULTILEAGUE_TIMEOUT');process.exit(1)},190000);
const failures=[],responses=[],boards=[];
let active='none',fatal=null;
page.on('pageerror',error=>failures.push({board:active,error:String(error).slice(0,260)}));
page.on('response',response=>{
 let url;try{url=new URL(response.url());}catch{return;}
 if(response.status()>=400&&(url.hostname==='a.espncdn.com'||(url.origin===ORIGIN&&url.pathname==='/proxy')))
  responses.push({board:active,host:url.hostname,path:url.pathname,status:response.status()});
});
try{
 const manifest=await (await page.request.get(ORIGIN+'/staging/boards.json',{timeout:25000})).json();
 if(manifest.boards.length!==28)throw Error('Approved 28-board manifest changed');
 const sports=['NBA','CBB','CFB','NHL','MLB','WNBA'];
 for(const sport of sports){
  const target=manifest.boards.find(x=>String(x.sport).toUpperCase()===sport&&Number(x.page)===1);
  if(!target)throw Error('Missing league Page 1: '+sport);
  active=target.id;
  const start=Date.now();
  const answer=await page.goto(ORIGIN+'/staging/boards/'+target.id,
    {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(5000);
  const view=await page.evaluate(()=>{
   const all=[...document.images];
   return {
    images:all.length,
    loaded:all.filter(x=>x.complete&&x.naturalWidth>0).length,
    broken:all.filter(x=>x.complete&&x.naturalWidth===0).length,
    stagingRuntime:[...document.scripts].find(s=>s.src.includes('/staging/runtime/'))?.src||null,
    directESPN:all.filter(x=>(x.currentSrc||x.src).startsWith('https://a.espncdn.com/')).length
   };
  });
  const row={sport,id:target.id,status:answer?.status(),ms:Date.now()-start,...view};
  boards.push(row);console.log('MULTILEAGUE_IMAGE_BOARD',JSON.stringify(row));
  if(answer?.status()!==200)throw Error('Board HTTP '+answer?.status()+' '+target.id);
  if(row.broken>0)throw Error('Broken images on '+sport+': '+row.broken);
  if(row.images>0&&row.loaded<row.images)throw Error('Images have not fully loaded '+sport);
  await page.screenshot({path:'image-league-'+sport+'.png'}).catch(()=>{});
 }
 // Check original player still transitions at its real 30s interval.
 active='rotation';
 const started=Date.now();
 const response=await page.goto(ORIGIN+'/staging/player.html?rotate=off&qa=image-source',
   {waitUntil:'domcontentloaded',timeout:30000});
 if(response?.status()!==200)throw Error('Player failed to load');
 await page.waitForFunction(()=>window.__MC_PRODUCTION?.current==='page1_nfl' &&
  document.querySelector('#stage iframe.current')?.dataset.board==='page1_nfl',null,{timeout:45000});
 const first=Date.now();
 await page.waitForFunction(()=>window.__MC_PRODUCTION?.current==='page2_nfl' &&
  document.querySelector('#stage iframe.current')?.dataset.board==='page2_nfl',null,{timeout:65000});
 const interval=Date.now()-first;
 const rotation={first:'page1_nfl',second:'page2_nfl',elapsedMs:interval,
   totalSinceNavigationMs:Date.now()-started};
 console.log('MULTILEAGUE_ROTATION',JSON.stringify(rotation));
 if(interval<20000||interval>65000)throw Error('Approved 30-second rotation timing changed');
 if(failures.length)throw Error('JavaScript page errors: '+JSON.stringify(failures.slice(0,4)));
 if(responses.some(x=>x.host==='a.espncdn.com'))
  throw Error('Failed direct ESPN images on multi-league preview');
 console.log('PASS_ALL_SPORTS_AND_ORIGINAL_ROTATION',JSON.stringify({boards:boards.length,rotation}));
}catch(error){
 fatal=String(error.stack||error);console.error('MULTILEAGUE_IMAGE_FAILURE',fatal.slice(0,1800));
}finally{
 fs.writeFileSync('multi-league-image-report.json',JSON.stringify({
  passed:!fatal,boardChecks:boards,errors:failures.slice(0,30),
  failedResponses:responses.slice(0,45),fatal,
  productionChanged:false,physicalTvTested:false},null,2));
 await browser.close();clearTimeout(watchdog);
 if(fatal)process.exitCode=1;
}
