/* Cloudflare /staging/ only — remap public ESPN/NHL reads to secure same-origin relay.
 * Original Gold Master scripts, calculations and DOM remain unchanged.
 * Does not affect GitHub controller, Firebase assignments or Render production.
 */
(function(){
  'use strict';
  if(!/^\/staging\/boards\/[a-z0-9_]+\.html$/.test(location.pathname))return;
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
    if(raw&&location.pathname==='/staging/boards/page4_broncos.html'){
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
        if(location.pathname==='/staging/boards/page4_broncos.html'&&url.hostname==='sports.core.api.espn.com'){
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
})();
