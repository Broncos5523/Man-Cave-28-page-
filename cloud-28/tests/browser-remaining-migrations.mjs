import {chromium} from 'playwright';
import fs from 'node:fs';
import {remainingBoardIds} from '../remaining-board-api.mjs';
const host='https://man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:720,height:1280}});
const requested=(process.env.REMAINING_BOARDS||'').split(',').map(x=>x.trim()).filter(Boolean);
const selected=requested.length?remainingBoardIds.filter(x=>requested.includes(x)):remainingBoardIds;
if(requested.some(id=>!remainingBoardIds.includes(id))||selected.length===0)throw Error('Invalid targeted board test IDs');
const results=[];
try{
  for(const board of selected){
    const page=await context.newPage(),errors=[],responses=[],sourceFailures=[];
    page.on('pageerror',e=>errors.push(String(e.message||e)));
    page.on('response',async r=>{
      const u=new URL(r.url());
      if(r.url().includes('/api/board/'+board))
        responses.push({status:r.status(),body:r.ok()?'current JSON':(await r.text().catch(()=>'' )).slice(0,600)});
      if(!r.ok()&&sourceFailures.length<30&&
         (u.pathname==='/proxy'||u.pathname.startsWith('/api/board/')||u.pathname.startsWith('/production/api/')))
        sourceFailures.push({status:r.status(),path:u.pathname,
          upstream:u.pathname==='/proxy'?(u.searchParams.get('url')||'').slice(0,220):null});
    });
    const result={board,pass:false};
    try{
      const apiPromise=page.waitForResponse(r=>r.url().includes('/api/board/'+board)&&r.ok(),{timeout:70000});
      const response=await page.goto(host+'/staging/boards/'+board+'.html?migration=remaining-r3',{waitUntil:'domcontentloaded',timeout:45000});
      if(response?.status()!==200)throw Error('Board navigation failed');
      // Compare the rendered DOM against the exact current-season HTTP payload.
      // Some original approved boards never persist the JSON to localStorage;
      // using that optional cache as the source falsely failed real page data.
      const apiResponse=await apiPromise;
      const verifiedFeed=await apiResponse.json();
      if(verifiedFeed?.board!==board||verifiedFeed?.dataState!=='current')
        throw Error('Current-season board JSON was not verified');
      await page.waitForFunction(({id,expected})=>{
        try{
          const f=expected;if(f?.dataState!=='current'||!window.MCBoard?.ready)return false;
          const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
          const numeric=s=>Number(String(s).replace(/[%+,]/g,''));
          if(id.startsWith('page2_'))return f.leaders.players.every(p=>[...document.querySelectorAll('[data-athlete-id]')].some(c=>c.dataset.athleteId===p.id&&
            norm(c.querySelector('.leader-name,h3')?.textContent)===norm(p.name)&&
            numeric(c.querySelector('.leader-stat strong,.value')?.textContent)===numeric(p.value)));
          if(id.startsWith('page3_'))return f.teamPanels.snapshot.every(p=>[...document.querySelectorAll('#teamstats .rank,#offense .rank,#defense .rank')].some(c=>
            norm(c.querySelector('.lbl')?.textContent)===norm(p.label)&&numeric(c.querySelector('.num')?.textContent)===numeric(p.value)&&
            c.querySelector('.place')?.textContent.includes('#'+p.rank)));
          return true;
        }catch{return false;}
      },{id:board,expected:verifiedFeed},{timeout:55000});
      Object.assign(result,await page.evaluate(({id,f})=>{
        const sport=f.context.sport;
        const cfg={nhl:['.srow','.srec'],mlb:['.standRow','.standRec'],wnba:['.standing-row','.record']}[sport];
        const rows=cfg?[...document.querySelectorAll(cfg[0])].map(r=>r.querySelector(cfg[1])?.textContent.trim()):[];
        return {year:f.context.statsYear,mode:f.context.mode,teamCount:f.standings.groups.flatMap(g=>g.entries).length,
          records:rows,expectedRecords:f.standings.groups.flatMap(g=>g.entries).map(t=>t.record||[t.wins,t.losses,...(sport==='nhl'?[t.otLosses]:[])].join('-')),
          players:f.leaders?.players.length,snapshot:f.teamPanels?.snapshot.length,matches:f.playoffs?.matches.length,
          apNames:id==='page1_cfb'?[...document.querySelectorAll('.rankrow .rteam')].map(r=>r.textContent.trim()):[],
          expectedAP:f.rankings?.poll.ranks.slice(0,25).map(r=>r.team.location||r.team.shortDisplayName||r.team.nickname||r.team.name),
          loadedImages:[...document.images].filter(i=>i.complete&&i.naturalWidth>0).length};
      },{id:board,f:verifiedFeed}));
      if(errors.length)throw Error('JavaScript: '+errors.join(' | '));
      if(!result.loadedImages)throw Error('No original imagery loaded');
      if(board.startsWith('page1_')&&board!=='page1_cfb'){
        const canonical=x=>String(x).replace(/,.*$/,'').replace(/[–−]/g,'-').replace(/\s/g,'');
        const got=result.records.map(canonical).sort(),want=result.expectedRecords.map(canonical).sort();
        if(got.length!==want.length||JSON.stringify(got)!==JSON.stringify(want))throw Error('Displayed conference records do not match verified feed');
      }
      if(board==='page1_cfb'&&JSON.stringify(result.apNames)!==JSON.stringify(result.expectedAP))throw Error('Displayed AP teams differ from verified feed');
      result.pass=true;
    }catch(e){result.error=e.message;result.jsErrors=errors;result.responses=responses;result.sourceFailures=sourceFailures;
      result.diagnostic=await page.evaluate(id=>{
        let feed=null;try{feed=JSON.parse(localStorage.getItem('mc-v2-feed-'+id))}catch{}
        return {ready:!!window.MCBoard?.ready,feedState:feed?.dataState,players:feed?.leaders?.players,snapshot:feed?.teamPanels?.snapshot,
          domPlayers:[...document.querySelectorAll('[data-athlete-id]')].map(c=>({id:c.dataset.athleteId,name:c.querySelector('.leader-name,h3')?.textContent,value:c.querySelector('.leader-stat strong,.value')?.textContent})),
          domStats:[...document.querySelectorAll('#teamstats .rank,#offense .rank,#defense .rank')].map(c=>c.textContent)};
      },board).catch(()=>null);
    }
    await page.screenshot({path:board+'-render.png',fullPage:true}).catch(()=>{});
    results.push(result);console.log('BOARD_RENDER_RESULT',JSON.stringify(result));
    await page.close();
  }
}finally{await browser.close();}
fs.writeFileSync('remaining-render-matrix.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:results.filter(r=>r.pass).length,total:results.length,results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
