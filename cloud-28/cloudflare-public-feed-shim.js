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
    if(raw&&raw.startsWith('https://')){
      try{
        const url=new URL(raw);
        if(allow.has(url.hostname)){
          return native('/proxy?url='+encodeURIComponent(url.href),init);
        }
      }catch(e){/* fall through to existing fetch semantics */}
    }
    return native(input,init);
  };
  window.__MC_CLOUDFLARE_PUBLIC_FEED_RELAY__='staging-only';
})();
