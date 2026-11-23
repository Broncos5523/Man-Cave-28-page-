import {chromium} from 'playwright';
const host='https://man-cave-28-page.broncos5523.workers.dev';
const targets=[
  ['page1_cfb',['OCT 10','WEST VIRGINIA','NEXT GAME']],
  ['page1_cbb',['SEASON OPENING SOON','NEXT']],
  ['page4_broncos',['DATA DELAYED','2026 SEASON','ESPN · Player stats']]
];
const sources=[
 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/12/schedule?season=2026',
 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/12/schedule?season=2027',
 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/7/roster?season=2026',
 'https://man-cave-28-page.broncos5523.workers.dev/api/board/page1_cfb',
 'https://man-cave-28-page.broncos5523.workers.dev/api/board/page1_cbb'
];
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:720,height:1280}});
  await page.goto(host+'/staging/boards/page1_cfb',{waitUntil:'domcontentloaded',timeout:45000});
  const sourceInfo=[];
  for(const url of sources){
    const info=await page.evaluate(async (u)=>{
      try{
        const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(19000)});
        const d=await r.json().catch(()=>({}));
        const events=(d.events||[]).filter(e=>
          new Date(e.date||e.competitions?.[0]?.date||0).getTime()>Date.now()-86400000)
          .slice(0,8).map(e=>({id:e.id,date:e.date,shortName:e.shortName,name:e.name,
            teams:e.competitions?.[0]?.competitors?.map(t=>({team:t.team?.displayName,homeAway:t.homeAway})),
            status:e.competitions?.[0]?.status?.type?.name}));
        return {url:u,status:r.status,year:d.context?.statsYear,events,
          keys:Object.keys(d).slice(0,16),error:d.error,
          upcoming:d.upcoming||d.favorite||d.schedule?.slice?.(0,2)||null};
      }catch(e){return {url:u,error:String(e)}}
    },url);
    sourceInfo.push(info);
  }
  console.log('OFFICIAL_ARIZONA_SCHEDULES',JSON.stringify(sourceInfo).slice(0,16000));
  await page.close();
  for(const [id,markers] of targets){
    const p=await browser.newPage({viewport:{width:720,height:1280}});
    await p.goto(host+'/staging/boards/'+id+'?readOnlyDomProof=1',{waitUntil:'domcontentloaded',timeout:45000});
    await p.waitForTimeout(5500);
    const data=await p.evaluate((markers)=>{
      const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      const hits=[];let n;while((n=walk.nextNode())){
        const value=(n.nodeValue||'').trim().replace(/\\s+/g,' ');
        if(!value||value.length>170)continue;
        for(const marker of markers)if(value.toUpperCase().includes(marker)){
          hits.push({marker,value,
            parent:n.parentElement?.outerHTML?.slice(0,400),
            grandparent:n.parentElement?.parentElement?.outerHTML?.slice(0,850)});
          break;
        }
      }
      return {hits:hits.slice(0,22),bodyStart:document.body.innerText.slice(0,450)};
    },markers);
    console.log('LIVE_PAGE_DOM_TARGET',JSON.stringify({board:id,...data}).slice(0,16000));
    await p.close();
  }
}finally{await browser.close()}
