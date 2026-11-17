/* Cloudflare /staging/ only — remap public ESPN/NHL reads to secure same-origin relay.
 * Original Gold Master scripts, calculations and DOM remain unchanged.
 * Does not affect GitHub controller, Firebase assignments or Render production.
 */
(function(){
  'use strict';
  // Cloudflare static-assets canonicalization redirects *.html to extensionless URLs.
  const board=/^\/staging\/boards\/([a-z0-9_]+)(?:\.html)?\/?$/.exec(location.pathname);
  if(!board)return;
  const allow=new Set([
    'site.api.espn.com','sports.core.api.espn.com','site.web.api.espn.com',
    'a.espncdn.com','a.espn.com',
    'api-web.nhle.com','api.nhle.com',
    'statsapi.mlb.com','lookup-service-prod.mlb.com',
    'assets.nhle.com','cdn.nba.com','cdn.wnba.com',
    'www.mlbstatic.com','img.mlbstatic.com'
  ]);
  const native=window.fetch.bind(window);
  window.fetch=function(input,init){
    const raw=typeof input==='string'?input:(input&&typeof input.url==='string'?input.url:'');
    // The approved Gold Master calls proxied() BEFORE fetch(), producing
    // /proxy?url=<encoded ESPN Core URL>. Intercept that actual request shape
    // as well as direct HTTPS; otherwise the Worker returns a Core 403.
    if(raw&&board[1]==='page4_broncos'){
      try{
        const source=raw.startsWith('/proxy?')
          ? new URL(raw,'https://man-cave-local.invalid').searchParams.get('url')
          : raw;
        const core=new URL(source);
        const match=core.hostname==='sports.core.api.espn.com'&&
          /^\/v2\/sports\/football\/leagues\/nfl\/seasons\/(\d{4})\/types\/2\/athletes\/(\d{5,10})\/statistics(?:\/0)?\/?$/.exec(core.pathname);
        if(match){
          return native('/migration-api/nfl/season-stats?season='+encodeURIComponent(match[1])+
            '&athlete='+encodeURIComponent(match[2])+'&team=7',init);
        }
      }catch(e){/* Leave unrelated traffic unchanged. */}
    }
    if(raw&&raw.startsWith('https://')){
      try{
        const url=new URL(raw);
        // Targeted Broncos Page 4 source-compatibility route.
        // ESPN Core responds HTTP 403 from Cloudflare. Use its accessible Site
        // player-stat record but require the Worker to verify exact season/team.
        // The original board's stat/spotlight parsing remains unchanged.
        if(board[1]==='page4_broncos'&&url.hostname==='sports.core.api.espn.com'){
          const match=/^\/v2\/sports\/football\/leagues\/nfl\/seasons\/(\d{4})\/types\/2\/athletes\/(\d{5,10})\/statistics(?:\/0)?$/.exec(url.pathname);
          if(match){
            return native('/migration-api/nfl/season-stats?season='+encodeURIComponent(match[1])+'&athlete='+encodeURIComponent(match[2])+'&team=7',init);
          }
        }
        if(allow.has(url.hostname)){
          return native('/proxy?url='+encodeURIComponent(url.href),init);
        }
      }catch(e){/* fall through to existing fetch semantics */}
    }
    return native(input,init);
  };
  window.__MC_CLOUDFLARE_PUBLIC_FEED_RELAY__='staging-only';
  if(board[1]==='page3_arizona_cfb'){
    // The locked source calls a missing loadSchedule(). Supply only that data
    // bridge and call its existing renderers; no original markup/CSS is edited.
    window.loadSchedule=async function(){
      const response=await native('/api/board/page3_arizona_cfb',{cache:'no-store'});
      if(!response.ok)throw Error('Verified Arizona schedule unavailable');
      const feed=await response.json();
      if(feed.board!=='page3_arizona_cfb'||feed.dataState!=='current'||!feed.schedule?.length)
        throw Error('Unverified Arizona schedule contract');
      const events=feed.schedule.map(e=>({id:e.id,date:e.date,season:e.season,competitions:[{
        venue:{fullName:e.venue},status:{type:{state:e.state,completed:e.completed,detail:e.status}},
        competitors:[{homeAway:'away',team:{id:e.away.id},score:e.away.score},
          {homeAway:'home',team:{id:e.home.id},score:e.home.score}]}]}));
      const completed=events.filter(e=>e.competitions[0].status.type.completed).sort((a,b)=>a.date.localeCompare(b.date));
      const live=events.find(e=>e.competitions[0].status.type.state==='in'&&!e.competitions[0].status.type.completed);
      const next=live||events.filter(e=>e.competitions[0].status.type.state==='pre'&&Date.parse(e.date)>=Date.now()).sort((a,b)=>a.date.localeCompare(b.date))[0];
      if(completed.length){window.renderLast?.(completed.at(-1));window.renderFive?.(completed);}
      if(next)window.renderNext?.(next,!!live);
      window.__MC_CFB_SCHEDULE_COMPAT__={current:true,year:feed.context.year,games:events.length};
    };
  }
})();
