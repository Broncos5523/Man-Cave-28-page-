import {chromium} from 'playwright';
import fs from 'node:fs';
const host='https://man-cave-28-page.broncos5523.workers.dev';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const numeric=s=>Number(String(s).replace(/[,%+]/g,''));
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const board of ['page4_bruins','page4_redsox','page4_arizona_cfb']){
  const context=await browser.newContext({viewport:{width:720,height:1280}}),page=await context.newPage();
  const data=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async r=>{
   const u=new URL(r.url());if(u.pathname!=='/proxy'||!r.ok())return;
   const source=u.searchParams.get('url');if(!source||!/api-web\.nhle|api\.nhle|statsapi\.mlb|sports\.core\.api/.test(source))return;
   try{data.push({source,body:await r.json()})}catch{}
  });
  const result={board,pass:false};
  try{
   await page.goto(host+'/staging/boards/'+board+'.html',{waitUntil:'domcontentloaded',timeout:45000});
   const child=board==='page4_arizona_cfb';
   const match=()=>child?page.frames().find(f=>f.url().includes('/hosted/page4_arizona_cfb/')):page;
   let expected=[];
   await new Promise((resolve,reject)=>{
    const until=Date.now()+65000;
    const check=()=>{
     try{
     if(board==='page4_bruins'){
      const club=data.find(d=>d.source.includes('/club-stats/BOS/now'))?.body;
      const real=data.find(d=>d.source.includes('/skater/realtime'))?.body;
      if(club&&real){
       if(String(club.season)!=='20262027'){reject(Error('NHL club season mismatch'));return;}
       if(!Array.isArray(real.data)||!Array.isArray(club.skaters))throw Error('NHL skater/realtime source shape changed');
       const rt=new Map(real.data.map(p=>[p.playerId,p]));
       const rows=club.skaters.map(p=>({...p,...rt.get(p.playerId)}));
       const preferred={goals:8477956,assists:8477956,points:8477956,plusMinus:8478840,hits:8477507,penaltyMinutes:8479661};
       expected=Object.keys(preferred).map(key=>{
        const highest=Math.max(...rows.map(p=>Number(p[key])).filter(Number.isFinite));
        const tied=rows.filter(p=>Number(p[key])===highest),p=tied.find(p=>p.playerId===preferred[key])||tied[0];
        if(!p)throw Error('NHL leader unavailable: '+key);
        const first=p.firstName?.default||p.firstName,last=p.lastName?.default||p.lastName;
        return {key,name:first[0]+'. '+last,value:highest};
       });resolve();return;
      }
     }else if(board==='page4_redsox'){
      const group=g=>data.find(d=>d.source.includes('/stats?')&&new URL(d.source).searchParams.get('group')===g&&new URL(d.source).searchParams.get('teamId')==='111')?.body?.stats?.flatMap(s=>s.splits||[]);
      const H=group('hitting'),P=group('pitching');
      if(H?.length&&P?.length){
       if([...H,...P].some(r=>r.season!=='2026'||r.team?.id!==111)){reject(Error('MLB season/team mismatch'));return;}
       expected=[['avg',H,'avg',true],['homeRuns',H,'homeRuns'],['rbi',H,'rbi'],['ops',H,'ops',true],['pitchingSO',P,'strikeOuts'],['stolenBases',H,'stolenBases']].map(([key,rows,stat,qualify])=>{
        const p=[...rows].filter(p=>(!qualify||Number(p.stat.plateAppearances)>=500)&&Number.isFinite(Number(p.stat[stat]))).sort((a,b)=>Number(b.stat[stat])-Number(a.stat[stat]))[0];
        if(!p)throw Error('MLB leader unavailable: '+key);
        const parts=p.player.fullName.split(/\s+/);return {key,name:parts[0][0]+'. '+parts.slice(1).join(' '),value:Number(p.stat[stat])};
       });resolve();return;
      }
     }else{
      const leaders=data.find(d=>d.source.includes('/types/2/teams/12/leaders'))?.body;
      if(leaders){
       expected=[['passingLeader','PASSING YARDS'],['rushingLeader','RUSHING YARDS'],['receivingLeader','RECEIVING YARDS'],['totalTackles','TACKLES'],['sacks','SACKS'],['interceptions','INTERCEPTIONS']].map(([key,label])=>{
        const p=leaders.categories.find(c=>c.name===key)?.leaders?.[0];
        const id=/\/athletes\/(\d+)/.exec(p?.athlete?.$ref||'')?.[1];
        const athlete=data.find(d=>new URL(d.source).pathname.endsWith('/athletes/'+id))?.body;
        return {key:label,id,name:athlete?.displayName,value:p?.value};
       });
       if(expected.every(p=>p.name&&Number.isFinite(p.value))){resolve();return;}
      }
     }
     if(Date.now()>until){reject(Error('Native current-season source contract unavailable'));return;}
     setTimeout(check,250);
     }catch(error){reject(error instanceof Error?error:Error(String(error)));}
    };check();
   });
   const frame=match();if(!frame)throw Error('Native embedded app not found');
   await frame.waitForFunction(({id,expected})=>{
    const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const number=s=>Number(String(s).replace(/[,%+]/g,''));
    const rows=[...document.querySelectorAll(id==='page4_bruins'?'.bp4-leader':id==='page4_redsox'?'.rs4-leader':'._leaderCard_w3kwp_9')];
    return expected.every(p=>rows.some(c=>{
     const name=c.querySelector('.bp4-leader-name,.rs4-leader-name,._leaderText_w3kwp_9 strong')?.textContent;
     const value=c.querySelector('.bp4-leader-num,.rs4-leader-num,._leaderValue_w3kwp_9')?.textContent;
     return norm(name)===norm(p.name)&&number(value)===Number(p.value);
    }));
   },{id:board,expected},{timeout:30000});
   Object.assign(result,{leaders:expected,sourceCount:data.length,jsErrors:errors});
   const selector=board==='page4_bruins'?'#bp4Name':board==='page4_redsox'?'#rs4Name':'._nameBlock_w3kwp_6';
   const before=await frame.locator(selector).textContent();
   await frame.waitForFunction(({sel,before})=>document.querySelector(sel)?.textContent!==before,{sel:selector,before},{timeout:9500});
   result.rotatedSpotlight=true;
   const images=await frame.evaluate(()=>[...document.images].filter(i=>i.complete&&i.naturalWidth>0).length);
   if(!images||errors.length)throw Error('Missing original imagery or JavaScript error');
   result.loadedImages=images;result.pass=true;
  }catch(error){result.error=error.message;result.jsErrors=errors;result.sources=data.map(d=>({url:d.source,keys:Object.keys(d.body)}));}
  await page.screenshot({path:board+'-native.png',fullPage:true}).catch(()=>{});
  console.log('NATIVE_PAGE4_RESULT',JSON.stringify(result));results.push(result);await context.close();
 }
}finally{await browser.close();}
fs.writeFileSync('native-page4-matrix.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
