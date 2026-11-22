// Compare the same Indiana Fever board artwork on the verified PR2 baseline
// and the experimental ESPN image-source Preview. Both are read-only.
import {chromium} from 'playwright';
import fs from 'node:fs';
const sites=[
  {label:'baseline',host:'https://pr-2-man-cave-28-page.broncos5523.workers.dev'},
  {label:'image-source',host:'https://img-source-man-cave-28-page.broncos5523.workers.dev'}
];
const boardIds=['page3_fever','page4_fever'];
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},
  userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await context.newPage();
const results=[],failures=[];
let active='none';
page.on('response',res=>{
 if(res.status()<400)return;
 const u=new URL(res.url());
 if(u.hostname==='a.espncdn.com'||u.pathname==='/proxy')
  failures.push({active,status:res.status(),origin:u.origin,path:u.pathname});
});
for(const site of sites)for(const id of boardIds){
 active=site.label+':'+id;
 const response=await page.goto(site.host+'/staging/boards/'+id,{waitUntil:'domcontentloaded',timeout:35000});
 await page.waitForTimeout(5500);
 const row=await page.evaluate(()=>{
  const imgs=[...document.images];
  return {
   total:imgs.length,loaded:imgs.filter(x=>x.complete&&x.naturalWidth>0).length,
   broken:imgs.filter(x=>x.complete&&x.naturalWidth===0).map(x=>{
    const style=getComputedStyle(x),rect=x.getBoundingClientRect();
    return {
     src:x.getAttribute('src'),currentSrc:x.currentSrc,alt:x.alt||'',
     className:typeof x.className==='string'?x.className:'',
     display:style.display,visibility:style.visibility,opacity:style.opacity,
     width:Math.round(rect.width),height:Math.round(rect.height),
     datasetDirect:x.dataset.direct||'',parentText:x.parentElement?.textContent?.trim().slice(0,70)||''
    };
   })
  };
 });
 const value={label:site.label,id,status:response?.status(),...row};
 results.push(value);
 console.log('FEVER_IMAGE_COMPARISON',JSON.stringify(value));
 await page.screenshot({path:'fever-'+site.label+'-'+id+'.png',fullPage:true}).catch(()=>{});
}
const summary={checkedAt:new Date().toISOString(),results,networkFailures:failures,
 productionModified:false,physicalTvTested:false};
const baseline=results.filter(x=>x.label==='baseline');
const current=results.filter(x=>x.label==='image-source');
summary.brokenCountMatches=boardIds.every(id=>baseline.find(x=>x.id===id)?.broken.length===current.find(x=>x.id===id)?.broken.length);
summary.visibleBroken=results.map(x=>({label:x.label,id:x.id,count:x.broken.filter(b=>b.display!=='none'&&b.visibility!=='hidden'&&b.opacity!=='0'&&b.width>0&&b.height>0).length}));
console.log('FEVER_COMPARE_SUMMARY',JSON.stringify({sameCount:summary.brokenCountMatches,visibleBroken:summary.visibleBroken,networkFailureCount:failures.length}));
fs.writeFileSync('fever-image-compare.json',JSON.stringify(summary,null,2));
await browser.close();
