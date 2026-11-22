import {chromium} from 'playwright';
import fs from 'node:fs';
const host=process.env.PREVIEW_URL||'https://man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true}),results=[];
try{
  for(const board of ['page4_celtics','page4_arizona_cbb','page4_fever']){
    const context=await browser.newContext({viewport:{width:720,height:1280}}),page=await context.newPage();
    const errors=[],responses=[];let payload=null;
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',async r=>{
      if(r.url().includes('/production/api/page4-live?board='+board)){
        responses.push(r.status());if(r.ok())payload=await r.json().catch(()=>null);
      }
    });
    const row={board,pass:false};
    try{
      await page.goto(host+'/staging/boards/'+board+'.html',{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>!!window.__MC_PAGE4_LIVE_STATUS__?.lastSuccess,null,{timeout:65000});
      // Chromium page script can apply the decoded response before our async
      // response-event observer finishes its own r.json(). Wait for the actual
      // payload rather than falsely failing a successful Arizona render.
      if(!payload)await new Promise((resolve,reject)=>{
        const timeout=Date.now()+5500;
        const tick=()=>payload?resolve():Date.now()>timeout?
          reject(Error('Current-season response was not captured')):setTimeout(tick,75);
        tick();
      });
      const state=await page.evaluate(id=>{
        const fever=id==='page4_fever',cbb=id==='page4_arizona_cbb';
        const cards=[...document.querySelectorAll(fever?'.fvp4-leader-card':cbb?'#leadersStack .azp4-leader-card':'#leadersStack .leader-card')];
        // Keep selectors tied to the original approved markup.
        const leaders=cards.map(c=>({name:c.querySelector(fever?'.fvp4-leader-name':'.leader-name,.azp4-leader-name')?.textContent,
          value:c.querySelector(fever?'.fvp4-leader-num':'.leader-num,.azp4-leader-num')?.textContent}));
        const name=document.querySelector(fever?'#fvSpotName':'#spotName')?.textContent;
        return {leaders,name,spotPlayer:(document.querySelector(fever?'#fvFirst':'#spotFirst')?.textContent||'')+' '+(document.querySelector(fever?'#fvLast':'#spotLast')?.textContent||''),
          spotStats:Array.from({length:3},(_,i)=>({label:document.querySelector(fever?'#fvL'+i:'#spotLabel'+i)?.textContent,value:document.querySelector(fever?'#fvV'+i:'#spotValue'+i)?.textContent})),source:document.querySelector('#fresh')?.textContent,
          season:window.__MC_PAGE4_LIVE_STATUS__.season,verified:window.__MC_PAGE4_LIVE_STATUS__.verifiedPlayers,
          imageCount:[...document.images].filter(i=>i.complete&&i.naturalWidth>0).length};
      },board);
      Object.assign(row,state);
      const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
      if(state.leaders.length!==6)throw Error('Expected six original leader cards, found '+state.leaders.length);
      for(const leader of payload.leaders)if(!state.leaders.some(p=>norm(p.name)===norm(leader.name)&&Number(p.value)===Number(leader.value)))
        throw Error('Leader identity/value did not render: '+leader.name+' '+leader.value);
      const spotlight=payload.roster.find(p=>norm(p.name)===norm(state.spotPlayer));
      for(const stat of state.spotStats){const expected=spotlight?.stats?.[stat.label];
        if(expected==null?stat.value!=='—':Number(stat.value)!==Number(Number(expected).toFixed(1)))throw Error('Spotlight stat did not render: '+stat.label+' '+stat.value);}
      if(!state.source.includes(payload.seasonLabel)||!state.imageCount)throw Error('Original imagery or season timestamp missing');
      const selector=board==='page4_fever'?'#fvSpotName':'#spotName';
      await page.waitForFunction(({sel,was})=>document.querySelector(sel)?.textContent!==was,{sel:selector,was:state.name},{timeout:9500});
      row.rotatedSpotlight=true;row.responses=responses;
      if(errors.length)throw Error('JavaScript: '+errors.join(' | '));
      row.pass=true;
    }catch(error){row.error=error.message;row.jsErrors=errors;row.responses=responses;}
    await page.screenshot({path:board+'-players.png',fullPage:true}).catch(()=>{});
    results.push(row);console.log('PAGE4_RENDER_RESULT',JSON.stringify(row));await context.close();
  }
}finally{await browser.close();}
fs.writeFileSync('page4-render-matrix.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
