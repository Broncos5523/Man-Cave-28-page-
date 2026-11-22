// Read-only comparison of broken upstream Core data calls in baseline PR2 and
// image-source Preview. No source, controller, Firebase or production writes.
import {chromium} from 'playwright';
import fs from 'node:fs';

const sites=[
 {name:'original-staging',url:'https://pr-2-man-cave-28-page.broncos5523.workers.dev'},
 {name:'image-source',url:'https://img-source-man-cave-28-page.broncos5523.workers.dev'}
];
const boards=['page3_broncos','page3_redsox'];
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},
 userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await context.newPage();
const report=[];let active='unknown',errors=[],responses=[];
page.on('pageerror',e=>errors.push({active,message:String(e).slice(0,300)}));
page.on('response',res=>{
 let u;try{u=new URL(res.url());}catch{return;}
 if(u.pathname!=='/proxy'||res.status()<400)return;
 let target=null;try{target=new URL(u.searchParams.get('url'));}catch{}
 responses.push({active,status:res.status(),
    targetHost:target?.hostname||'invalid',targetPath:target?.pathname||'invalid'});
});
for(const site of sites)for(const board of boards){
 active=site.name+'/'+board;
 const start=Date.now(),from=responses.length,err=errors.length;
 const nav=await page.goto(site.url+'/staging/boards/'+board,{waitUntil:'domcontentloaded',timeout:35000});
 await page.waitForTimeout(7800);
 const pageState=await page.evaluate(()=>{
  const imgs=[...document.images];
  return {loaded:imgs.filter(x=>x.complete&&x.naturalWidth>0).length,
    broken:imgs.filter(x=>x.complete&&x.naturalWidth===0).length};
 });
 const current=responses.slice(from),newErrors=errors.slice(err);
 const counts={};
 for(const r of current){
  const key=r.status+' '+r.targetHost+r.targetPath;
  counts[key]=(counts[key]||0)+1;
 }
 const row={site:site.name,board,http:nav?.status(),ms:Date.now()-start,
    proxyErrors:current.length,byTarget:counts,errors:newErrors,pageState};
 report.push(row);
 console.log('PROXY_502_BASELINE_COMPARE',JSON.stringify(row));
}
console.log('PROXY_502_COMPARE_SUMMARY',JSON.stringify({
  baselineErrors:report.filter(x=>x.site==='original-staging').reduce((n,x)=>n+x.proxyErrors,0),
  experimentalErrors:report.filter(x=>x.site==='image-source').reduce((n,x)=>n+x.proxyErrors,0),
  productionModified:false}));
fs.writeFileSync('proxy-502-comparison.json',JSON.stringify(report,null,2));
await browser.close();
