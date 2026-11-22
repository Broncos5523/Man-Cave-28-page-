// One-time read-only traffic profiler for isolated Cloudflare Preview.
// Distinguishes unique public endpoints from duplicated client requests.
import {chromium} from 'playwright';
import fs from 'node:fs';

const origin='https://pr-2-man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true});
// Bound the smoke job even if a page script blocks browser navigation.
const watchdog=setTimeout(()=>{console.error('QUOTA_PROFILE_WATCHDOG_90S');process.exit(1)},90000);
const context=await browser.newContext({viewport:{width:720,height:1280},
  userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await context.newPage();
const records=[],out=[],failed=[];
let active='none';
page.on('request',req=>{
  let u;try{u=new URL(req.url());}catch{return;}
  if(u.origin!==origin||u.pathname!=='/proxy')return;
  let target=null;
  try{target=new URL(u.searchParams.get('url'));}catch{return;}
  records.push({board:active,endpoint:target.hostname+target.pathname+target.search,
    host:target.hostname,path:target.pathname,at:Date.now()});
});
page.on('response',res=>{
  if(res.status()<400)return;
  const url=new URL(res.url());
  if(url.origin===origin&&url.pathname==='/proxy')
    failed.push({status:res.status(),board:active});
});
try{
 for(const bid of ['page1_nfl','page2_nfl']){
  active=bid;const started=Date.now();
  const response=await page.goto(origin+'/staging/boards/'+bid,{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForTimeout(12000);
  const view=await page.evaluate(()=>({
    cache:window.__MC_STAGING_FEED_CACHE_STATS__||null,
    directRewrites:window.__MC_STAGING_DIRECT_IMAGE_REWRITES__?.count||0,
    imgCount:document.images.length,
    loadedImages:[...document.images].filter(img=>img.complete&&img.naturalWidth>0).length,
    directEspnImages:[...document.images].filter(img=>/^https:\/\/a\.espncdn\.com\//.test(img.currentSrc||img.src)).length,
    brokenImages:[...document.images].filter(img=>img.complete&&img.naturalWidth===0).length
  }));
  out.push({board:bid,status:response?.status(),ms:Date.now()-started,...view});
 }
}catch(e){out.push({board:active,error:String(e).slice(0,450)});}
const endpoints=new Map(),grouped=new Map(),hosts=new Map();
for(const r of records){
 endpoints.set(r.endpoint,(endpoints.get(r.endpoint)||0)+1);
 const cat=/\/(scoreboard|summary|standings|statistics|stats|athletes|leaders|roster)(\/|$)/i.exec(r.path)?.[1]||'other';
 grouped.set(cat,(grouped.get(cat)||0)+1);
 hosts.set(r.host,(hosts.get(r.host)||0)+1);
}
const top=[...endpoints.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12)
 .map(([endpoint,count])=>({endpoint,count}));
const report={
 boardChecks:out,proxyTotal:records.length,uniqueProxyTargets:endpoints.size,
 repeatedProxyCalls:records.length-endpoints.size,
 categories:Object.fromEntries(grouped),hosts:Object.fromEntries(hosts),
 topRequests:top,
 requestsByBoard:Object.fromEntries(out.map(x=>[x.board,records.filter(r=>r.board===x.board).length])),
 firstTenSeconds:records.filter(r=>r.at-records[0]?.at<10000).length,
 failures:failed,
 productionModified:false
};
console.log('PUBLIC_PROXY_PROFILE',JSON.stringify(report));
fs.writeFileSync('quota-proxy-profile.json',JSON.stringify(report,null,2));
await browser.close();
clearTimeout(watchdog);
