import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const host=process.env.BOARD_HOST||'https://man-cave-28-page.broncos5523.workers.dev';
const boards=(process.env.MIGRATION_BOARDS||'page1_cbb,page2_nba,page3_broncos').split(',');
const browser=await chromium.launch({headless:true});
try{
  for(const board of boards){
    // A fresh storage context proves data reached the renderer on first visit.
    const context=await browser.newContext({viewport:{width:720,height:1280}}),page=await context.newPage();
    const errors=[],api=[];
    page.on('pageerror',e=>errors.push(e.stack||String(e)));
    page.on('response',r=>{if(r.url().includes('/api/board/'+board))api.push(r.status());});
    await page.goto(host+'/staging/boards/'+board+'.html?migration=priority-r1',{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(id=>{
      try{
        const feed=JSON.parse(localStorage.getItem('mc-v2-feed-'+id));
        if(feed?.dataState!=='current'||!window.MCBoard?.ready)return false;
        if(id==='page3_broncos')return feed.teamPanels.snapshot.every(p=>
          [...document.querySelectorAll('#offense .rank,#defense .rank')].some(r=>
            r.querySelector('.lbl')?.textContent===p.label&&r.querySelector('.num')?.textContent===p.value));
        return true;
      }catch{return false;}
    },board,{timeout:60000});
    const state=await page.evaluate(id=>{
      const feed=JSON.parse(localStorage.getItem('mc-v2-feed-'+id)),text=s=>document.querySelector(s)?.textContent.trim();
      const detail={board:id,year:feed.context.year,ready:window.MCBoard.ready,sections:feed.migration?.sections,
        ticker:feed.ticker?.selected?.length,loadedImages:[...document.images].filter(i=>i.complete&&i.naturalWidth>0).length};
      if(id==='page1_cbb')Object.assign(detail,{rankNames:[...document.querySelectorAll('#power .r')].map(r=>r.children[2]?.textContent),
        expected:feed.rankings.poll.ranks.map(r=>(r.team.location||r.team.shortDisplayName||r.team.nickname||r.team.name).toUpperCase()),
        recap:text('#tourTitle'),matches:document.querySelectorAll('.match[data-event-id]').length,
        teams:feed.standings.groups.flatMap(g=>g.entries).length,archiveYear:feed.playoffs.season});
      if(id==='page2_nba')Object.assign(detail,{players:[...document.querySelectorAll('[data-athlete-id]')].map(c=>({id:c.dataset.athleteId,name:c.querySelector('.leader-name,h3')?.textContent})),
        expected:feed.leaders.players.map(p=>({id:p.id,name:p.name.toUpperCase()})),teamPanels:feed.teamPanels.leaders.length});
      if(id==='page3_broncos')Object.assign(detail,{record:text('#record'),expected:feed.standings.groups.flatMap(g=>g.entries).find(t=>t.id==='7'),
        snapshot:feed.teamPanels.snapshot,schedule:feed.schedule.length,stats:[...document.querySelectorAll('#offense .rank,#defense .rank')].map(c=>({label:c.querySelector('.lbl')?.textContent,value:c.querySelector('.num')?.textContent}))});
      return detail;
    },board);
    console.log('RENDERER_OBSERVATION',JSON.stringify(state));
    assert.ok(api.includes(200));assert.ok(!api.some(x=>x>=400));assert.deepEqual(errors,[]);
    assert.ok(state.loadedImages>0,'Original packaged imagery must load');
    if(board==='page1_cbb'){
      assert.deepEqual(state.rankNames,state.expected);assert.equal(state.matches,60);
      assert.ok(state.recap.includes(state.archiveYear+' NCAA TOURNAMENT RECAP'));assert.ok(state.teams>=350);
    }
    if(board==='page2_nba'){
      assert.equal(state.players.length,6);assert.equal(state.teamPanels,5);
      for(const p of state.expected)assert.ok(state.players.some(r=>r.id===p.id&&r.name===p.name));
    }
    if(board==='page3_broncos'){
      assert.equal(state.record,state.expected.record||[state.expected.wins,state.expected.losses].join('-'));
      assert.equal(state.snapshot.length,8);assert.ok(state.schedule>=17);
      for(const p of state.snapshot)assert.ok(state.stats.some(r=>r.label===p.label&&r.value===p.value));
    }
    await page.screenshot({path:board+'-cloudflare.png',fullPage:true});
    console.log('PASS_ORIGINAL_RENDERER',JSON.stringify(state));
    await context.close();
  }
}finally{await browser.close();}
