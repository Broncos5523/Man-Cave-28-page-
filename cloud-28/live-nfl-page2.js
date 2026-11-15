/* MAN CAVE SPORTS BOOK — NFL PAGE 2 LIVE DATA BINDING
   This script is injected by the cloud adapter only. Original approved
   Page 2 HTML, layout, CSS and image assets remain byte-for-byte untouched.
   ESPN live league leaders / team leaders, sourced MVP tracker and ticker.
*/
(function(){
'use strict';
var state={lastSuccess:null,lastAttempt:null,error:null,playerCount:0,teamCount:0,api:'page2_nfl'};
window.__MC_NFL_P2_SYNC__=state;
var busy=false,hadGood=false;
function query(s,root){return (root||document).querySelector(s)}
function all(s,root){return Array.prototype.slice.call((root||document).querySelectorAll(s))}
function set(s,v,root){var el=query(s,root);if(el&&v!==null&&v!==undefined)el.textContent=String(v)}
function safeSrc(img,url){if(img&&typeof url==='string'&&/^https:\/\//.test(url)){img.src=url;img.onerror=function(){this.onerror=null;this.style.opacity='.2'}}}
function dateLabel(value){
 var dt=new Date(value||'');
 if(!isFinite(dt.getTime()))return '2026 SEASON';
 return dt.toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}).toUpperCase();
}
function upperName(t){
 return String(t&&((t.short||t.name))||'').toUpperCase();
}
function colors(team){
 var map={
 ARI:'#97233F',ATL:'#A71930',BAL:'#241773',BUF:'#00338D',CAR:'#0085CA',CHI:'#0B162A',
 CIN:'#FB4F14',CLE:'#311D00',DAL:'#003594',DEN:'#FB4F14',DET:'#0076B6',GB:'#203731',
 HOU:'#03202F',IND:'#002C5F',JAX:'#006778',KC:'#E31837',LV:'#A5ACAF',LAC:'#0080C6',
 LAR:'#003594',MIA:'#008E97',MIN:'#4F2683',NE:'#002244',NO:'#D3BC8D',NYG:'#0B2265',
 NYJ:'#125740',PHI:'#004C54',PIT:'#FFB612',SEA:'#002244',SF:'#AA0000',TB:'#D50A0A',
 TEN:'#0C2340',WAS:'#5A1414'};
 var hex=(team&&team.color)||map[team&&team.abbr]||'#4B86B4';
 return /^#?[0-9a-f]{6}$/i.test(hex)?(hex.charAt(0)==='#'?hex:'#'+hex):'#4B86B4';
}
function teamRecord(data,t){
 var entries=(data.standings&&data.standings.groups||[]).reduce(function(a,g){return a.concat(g.entries||[])},[]);
 var found=entries.find(function(x){return x.abbr===t.abbr||x.id===t.id});
 return found&&found.record||'—';
}
function paintPlayer(card,player,date){
 var team=player.team||{},name=player.name||'—',logo=team.logo||'';
 set('.leader-name',name.toUpperCase(),card);
 set('.leader-team span',upperName(team),card);
 set('.leader-stat strong',player.value,card);
 set('.leader-footer',date+' • '+String(player.label).toUpperCase()+' LEADER',card);
 safeSrc(query('.player-photo',card),player.headshot);
 safeSrc(query('.team-watermark',card),logo);
 safeSrc(query('.mini-logo',card),logo);
 card.style.setProperty('--tc',colors(team));
 card.style.setProperty('--tc2','#DCEAF8');
}
function paintTeam(card,item){
 var team=item.team||{},label=String(item.label).toUpperCase();
 set('.team-name',upperName(team),card);
 set('.team-stat strong',item.value,card);
 var unit=({'PASSING OFFENSE':'PASS YDS/G','RUSHING OFFENSE':'RUSH YDS/G',
  'TEAM SACKS':'SACKS','INTERCEPTIONS':'INT','PASSING TDS':'PASS TD'})[label]||label;
 set('.team-stat span',unit,card);
 safeSrc(query('.team-logo',card),team.logo);
 card.style.setProperty('--tc',colors(team));
}
function paintAward(data,date){
 var source=data.awards||{},a=(source.items||[])[0];
 if(!a)return;
 var team=a.team||{},stats=a.stats||{},sourceDate=dateLabel(a.date);
 var label='LATEST VERIFIED • '+sourceDate;
 set('.hero-ribbon span',label);
 set('.hero-label','NFL.COM MVP TRACKER • '+sourceDate);
 var name=query('.hero-name');
 if(name){const parts=String(a.name||'').toUpperCase().split(/\s+/);name.replaceChildren(document.createTextNode(parts[0]||'—'),document.createElement('br'),document.createTextNode(parts.slice(1).join(' ')))}
 set('.hero-team span',String(team.name||'').toUpperCase());
 safeSrc(query('.hero-photo'),a.headshot);
 safeSrc(query('.hero-team-logo'),team.logo);
 safeSrc(query('.hero-team img'),team.logo);
 set('.hero-main-stat strong','—');set('.hero-main-stat span','TRACKER SNAPSHOT');
 var cells=all('.hero-substats div');
 if(cells.length>=3){
  var rt=stats.QBRating&&stats.QBRating.displayValue,
      td=stats.passingTouchdowns&&stats.passingTouchdowns.displayValue;
  set('b',rt||'—',cells[0]);set('span','PASSER RTG',cells[0]);
  set('b',td||'—',cells[1]);set('span','PASS TD',cells[1]);
  set('b',teamRecord(data,team),cells[2]);set('span','TEAM RECORD',cells[2]);
 }
 set('.hero-note','Latest available NFL.com MVP Tracker entry: '+sourceDate+
  '. Season statistics refreshed '+date+'.');
}
function paintTicker(data){
 var events=(data.ticker&&data.ticker.selected)||[];
 var texts=events.slice(0,12).map(function(ev){
  var away=ev.away||{},home=ev.home||{},status=ev.status||'';
  var score=ev.state==='post'||ev.state==='in'?
    ' '+(away.score||'0')+'–'+(home.score||'0'):'';
  return String(away.abbr||'AWAY')+' @ '+String(home.abbr||'HOME')+score+' • '+status;
 });
 if(!texts.length)return;
 var track=query('.ticker-track');if(!track)return;
 while(track.firstChild)track.removeChild(track.firstChild);
 var repeated=['NFL SCOREBOARD'].concat(texts).concat(['NFL SCOREBOARD']).concat(texts);
 repeated.forEach(function(t){
  var span=document.createElement('span');
  if(t==='NFL SCOREBOARD'){var i=document.createElement('i');i.textContent=t;span.appendChild(i)}
  else span.textContent=t;
  track.appendChild(span);
 });
}
function paint(data){
 var players=data.leaders&&data.leaders.players||[],
     teams=data.teamPanels&&data.teamPanels.leaders||[];
 if(players.length<5||teams.length<5||data.dataState==='unavailable')
  throw Error('Incomplete NFL live feed; retaining last verified display');
 var date=dateLabel(data.fetchedAt||data.context&&data.context.asOf);
 var pMap={};players.forEach(function(p){pMap[String(p.label).toUpperCase()]=p});
 var tMap={};teams.forEach(function(t){tMap[String(t.label).toUpperCase()]=t});
 var pCount=0,tCount=0;
 all('.leader-card').forEach(function(card){
  var key=query('.leader-kicker span',card);
  var item=key&&pMap[key.textContent.trim().toUpperCase()];
  if(item){paintPlayer(card,item,date);pCount++}
 });
 all('.team-card').forEach(function(card){
  var key=query('.team-cat',card);
  var item=key&&tMap[key.textContent.trim().toUpperCase()];
  if(item){paintTeam(card,item);tCount++}
 });
 if(pCount!==6||tCount!==5)throw Error('Page 2 DOM matching failed');
 set('.season span','2026 • AS OF '+date);
 set('.section-title span','NFL REGULAR SEASON • AS OF '+date);
 set('.team-header span','2026 • AS OF '+date);
 set('.safe-note','NFL PAGE 2 • LIVE SEASON LEADERS • AS OF '+date);
 paintAward(data,date);
 paintTicker(data);
 state.lastSuccess=new Date().toISOString();state.playerCount=pCount;state.teamCount=tCount;
 state.error=null;hadGood=true;
}
function refresh(){
 if(busy)return;busy=true;state.lastAttempt=new Date().toISOString();
 var ctrl=new AbortController(),timer=setTimeout(function(){ctrl.abort()},22000);
 fetch('/api/board/page2_nfl?fresh='+Date.now(),{signal:ctrl.signal,cache:'no-store'})
  .then(function(r){if(!r.ok)throw Error('NFL feed HTTP '+r.status);return r.json()})
  .then(paint).catch(function(e){
    state.error=String(e&&e.message||e);
    // Never present the October snapshot as though it is current.
    if(!hadGood){set('.season span','LIVE DATA UNAVAILABLE');
      set('.section-title span','NFL • LIVE DATA DELAYED • DO NOT RELY ON OCT 8 SNAPSHOT');
      set('.team-header span','WAITING FOR CURRENT NFL DATA');}
  }).then(function(){clearTimeout(timer);busy=false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});
else refresh();
setInterval(refresh,60000);
addEventListener('online',refresh);
})();
