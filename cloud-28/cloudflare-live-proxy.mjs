import {buildNflPage2} from './nfl-page2-contract.mjs';
import {buildNflPage1} from './nfl-page1-contract.mjs';
/*
 * MAN CAVE SPORTS BOOK — CLOUDFLARE READ-ONLY PUBLIC DATA RELAY
 * Experimental: only /proxy. Approved board files untouched.
 * Exact public-sports-host allowlist; never proxies arbitrary URLs or secrets.
 * Static artwork bypasses Worker via assets.run_worker_first.
 */
const HOSTS = new Set([
  "site.api.espn.com", "sports.core.api.espn.com", "site.web.api.espn.com",
  "site.web.api.espn.com", "a.espncdn.com", "a.espn.com",
  "api-web.nhle.com", "api.nhle.com", "assets.nhle.com",
  "statsapi.mlb.com", "lookup-service-prod.mlb.com",
  "www.mlbstatic.com", "img.mlbstatic.com",
  "cdn.nba.com", "cdn.wnba.com"
]);
const IMAGE_HOSTS = new Set(["a.espncdn.com","assets.nhle.com","www.mlbstatic.com","img.mlbstatic.com","cdn.nba.com","cdn.wnba.com"]);
const TEXT_MIME = /^(application\/(json|[^;\s]+\+json)|text\/plain)(;|$)/i;
const IMAGE_MIME = /^image\/(png|jpeg|gif|webp|svg\+xml|avif)(;|$)/i;
const h = { "X-Content-Type-Options":"nosniff", "Cache-Control":"no-store" };
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...h,"Content-Type":"application/json; charset=utf-8"}});

function ttlFor(url) {
  if(IMAGE_HOSTS.has(url.hostname)) return 86400;
  if(/\/statistics(?:\/|$)/.test(url.pathname)||/\/stats(?:\/|$)/.test(url.pathname)||/\/athletes(?:\/|$)/.test(url.pathname))return 240;
  if(/\/scoreboard/.test(url.pathname)||/\/summary/.test(url.pathname))return 35;
  return 60;
}
function validExternal(raw) {
  if(typeof raw!=="string"||raw.length>1850)throw Error("Invalid public data URL");
  let u;
  try {u=new URL(raw);} catch {throw Error("Malformed public data URL");}
  if(u.protocol!=="https:"||u.port||u.username||u.password||!HOSTS.has(u.hostname.toLowerCase()))
    throw Error("Upstream host not approved");
  if(u.hash) u.hash="";
  return u;
}

/*
 * Read-only NFL Page4 compatibility response.
 * Core API is HTTP 403 from Cloudflare. The official ESPN Site API is reachable,
 * but includes career "totals"; NEVER use those. Select an explicit year + team
 * row from categories[].statistics[] and preserve the original Core season/type
 * reference so the approved page's existing validity checks still run.
 */
function seasonStatsFromSite(data,season,athlete,team="7") {
  if(!data||!Array.isArray(data.categories))throw Error("ESPN athlete statistics missing categories");
  const seasonType=(data.filters||[]).find(filter=>filter?.name==="seasontype");
  if(String(seasonType?.value)!=="2")throw Error("ESPN did not confirm regular-season statistics");
  const categories=[],selectedYears=new Set();
  for(const category of data.categories) {
    if(!category||!Array.isArray(category.statistics)||!Array.isArray(category.names))continue;
    const matches=category.statistics.filter(row=>Number(row?.season?.year)===season&&String(row?.teamId||"")===team);
    const entry=matches[0];
    if(!entry||!Array.isArray(entry.stats))continue;
    selectedYears.add(Number(entry.season.year));
    const stats=[];
    for(let i=0;i<Math.min(category.names.length,entry.stats.length);i++) {
      const name=category.names[i],raw=entry.stats[i];
      if(typeof name!=="string"||!name||raw===null||raw===undefined||String(raw).trim()==="")continue;
      const number=Number(String(raw).replace(/[, %]/g,""));
      if(!Number.isFinite(number))continue;
      stats.push({name,value:number,displayValue:String(raw)});
    }
    if(stats.length)categories.push({name:String(category.name||""),stats});
  }
  if(!categories.length||selectedYears.size!==1||!selectedYears.has(season))
    throw Error("No verified current-year regular-season Denver player statistics");
  const ref="https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/"+season+"/types/2/athletes/"+athlete+"/statistics/0?lang=en&region=us";
  return {
    $ref:ref,
    season:{$ref:"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/"+season+"?lang=en&region=us",year:season},
    seasonType:{$ref:"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/"+season+"/types/2?lang=en&region=us"},
    splits:{id:"0",name:"Regular Season",categories},
    dataSource:"ESPN site common v3 individual season-by-year records (NOT career totals)"
  };
}
async function verifiedNflSeasonStats(request,ctx) {
  if(request.method!=="GET")return json({ok:false,error:"GET only"},405);
  const qs=new URL(request.url).searchParams;
  const year=qs.get("season"),athlete=qs.get("athlete"),team=qs.get("team")||"7";
  if(!/^20(2[4-9]|3[0-5])$/.test(year||"")||!/^\d{5,10}$/.test(athlete||"")||team!=="7")
    return json({ok:false,error:"Only verified Denver regular-season athlete requests are supported"},400);
  const season=Number(year);
  const target="https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/"+athlete+"/stats?season="+season+"&seasontype=2";
  // Reuse the existing strict host validator, size cap, and edge caching.
  const proxyRequest=new Request("https://man-cave-relay.invalid/proxy?url="+encodeURIComponent(target));
  const upstream=await relay(proxyRequest,ctx);
  if(!upstream.ok)return json({ok:false,error:"Public player statistics temporarily unavailable"},503);
  try {
    const raw=await upstream.json();
    const verified=seasonStatsFromSite(raw,season,athlete,team);
    return new Response(JSON.stringify(verified),{status:200,headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"public, max-age=180",
      "X-Content-Type-Options":"nosniff",
      "X-Man-Cave-Data-Source":"espn-site-season-row"
    }});
  }catch(e){
    return json({ok:false,error:"Player season validation failed; no career totals substituted"},503);
  }
}

async function relay(request,ctx) {
  if(request.method!=="GET") return json({ok:false,error:"GET only"},405);
  const src=new URL(request.url).searchParams.get("url");
  let target;
  try {target=validExternal(src);}catch(e){return json({ok:false,error:e.message},403);}
  const ttl=ttlFor(target),cacheKey=new Request("https://man-cave-public-cache.invalid/"+encodeURIComponent(target.toString()));
  const edgeCache=typeof caches!=="undefined"?caches.default:null;
  if(edgeCache) {
    const cached=await edgeCache.match(cacheKey);
    if(cached){const headers=new Headers(cached.headers);headers.set("X-Man-Cave-Data-Source","edge-cache");
      return new Response(cached.body,{status:cached.status,headers});}
  }
  let upstream;
  try {
    // Public feeds only. Never send incoming Authorization, Cookie or Xfinity data.
    upstream=await fetch(target.toString(),{
      method:"GET",redirect:"manual",
      headers:{"Accept":IMAGE_HOSTS.has(target.hostname)?"image/avif,image/webp,image/*;q=0.8,*/*;q=0.5":"application/json, text/plain;q=0.9"},
      signal:AbortSignal.timeout(13000)
    });
  } catch(e) {
    return json({ok:false,error:"Sports data source temporarily unavailable"},503);
  }
  if(!upstream.ok) return json({ok:false,error:"Sports data source HTTP "+upstream.status},502);
  if(upstream.status>=300 && upstream.status<400)return json({ok:false,error:"Upstream redirect not approved"},502);
  const type=(upstream.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(!TEXT_MIME.test(type)&&!IMAGE_MIME.test(type))return json({ok:false,error:"Unsupported upstream content type"},502);
  if(IMAGE_MIME.test(type)&&!IMAGE_HOSTS.has(target.hostname))
    return json({ok:false,error:"Image endpoint not approved"},403);
  const cap=IMAGE_MIME.test(type)?8*1024*1024:5*1024*1024;
  if(Number(upstream.headers.get("content-length")||0)>cap)return json({ok:false,error:"Upstream response exceeds relay limit"},502);
  // Bound actual stream bytes even if upstream omits Content-Length.
  const parts=[],reader=upstream.body?.getReader();let size=0;
  if(!reader)return json({ok:false,error:"Sports data source returned empty stream"},502);
  try {
    for (;;) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>cap){await reader.cancel();return json({ok:false,error:"Upstream response exceeds relay limit"},502);}
      parts.push(value);
    }
  } catch {return json({ok:false,error:"Sports data source stream interrupted"},503);}
  const body=new Uint8Array(size);let offset=0;
  for(const bytes of parts){body.set(bytes,offset);offset+=bytes.length;}
  const headers=new Headers({
    "Content-Type":type,
    "Cache-Control":"public, max-age="+ttl,
    "X-Content-Type-Options":"nosniff",
    "X-Man-Cave-Data-Source":"public-upstream",
    "X-Man-Cave-Source-Host":target.hostname
  });
  const answer=new Response(body,{status:200,headers});
  if(edgeCache&&ctx?.waitUntil)ctx.waitUntil(edgeCache.put(cacheKey,answer.clone()));
  return answer;
}
async function nflPage1Api(request,ctx){
  if(request.method!=="GET")return json({ok:false,error:"GET only"},405);
  const scoreUrl="https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=60";
  const score=await relay(new Request("https://man-cave-relay.invalid/proxy?url="+encodeURIComponent(scoreUrl)),ctx);
  if(!score.ok)return json({ok:false,error:"ESPN current NFL scoreboard temporarily unavailable"},503);
  let scoreboard;
  try{scoreboard=await score.json()}catch{return json({ok:false,error:"Invalid ESPN scoreboard"},502)}
  const year=Number(scoreboard?.season?.year||scoreboard?.leagues?.[0]?.season?.year);
  if(!Number.isInteger(year)||year<2024||year>2035)
    return json({ok:false,error:"ESPN NFL season not verified"},503);
  const standingsUrl="https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season="+year+"&seasontype=2";
  const standing=await relay(new Request("https://man-cave-relay.invalid/proxy?url="+encodeURIComponent(standingsUrl)),ctx);
  if(!standing.ok)return json({ok:false,error:"Current NFL standings temporarily unavailable"},503);
  try{
    const payload=buildNflPage1(scoreboard,await standing.json());
    return new Response(JSON.stringify(payload),{status:200,headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"public, max-age=30",
      "X-Content-Type-Options":"nosniff",
      "X-Man-Cave-Data-Source":"verified-espn-nfl-regular-season",
      "X-Man-Cave-Contract":"original-page1-nfl-staging"
    }});
  }catch(e){
    return json({ok:false,error:"NFL season feed failed strict contract verification; no data substituted"},503);
  }
}
async function nflPage2Api(request,ctx){
  if(request.method!=="GET")return json({ok:false,error:"GET only"},405);
  const existing=await nflPage1Api(request,ctx);
  if(!existing.ok)return existing;
  let base;
  try{base=await existing.json()}catch{return json({ok:false,error:"Current NFL base feed unavailable"},503)}
  const year=Number(base?.context?.year);
  if(!Number.isInteger(year)||year<2024||year>2035)
    return json({ok:false,error:"Unsupported NFL season"},503);
  const host="https://site.api.espn.com";
  const leaderUrl=host+"/apis/site/v3/sports/football/nfl/leaders?season="+year+"&seasontype=2";
  const teamUrl=host+"/apis/common/v3/sports/football/nfl/statistics/byteam?season="+year+"&seasontype=2&limit=100";
  const fromUrl=url=>relay(new Request("https://man-cave-relay.invalid/proxy?url="+encodeURIComponent(url)),ctx);
  const [leadersResponse,teamResponse]=await Promise.all([fromUrl(leaderUrl),fromUrl(teamUrl)]);
  if(!leadersResponse.ok||!teamResponse.ok)
    return json({ok:false,error:"Verified NFL current-season player/team leaders unavailable"},503);
  try{
    const result=buildNflPage2(base,await leadersResponse.json(),await teamResponse.json());
    return new Response(JSON.stringify(result),{status:200,headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"public, max-age=60",
      "X-Content-Type-Options":"nosniff",
      "X-Man-Cave-Data-Source":"verified-espn-nfl-league-leaders",
      "X-Man-Cave-Contract":"original-page2-nfl-staging"
    }});
  }catch{
    return json({ok:false,error:"NFL Page 2 season/metrics failed verification; not substituting stale totals"},503);
  }
}
async function stagingPlayerState(request){
  const url=new URL(request.url);
  if(!['/staging/api/state','/staging/api/heartbeat'].includes(url.pathname))
    return json({ok:false,error:'Unknown staging player endpoint'},404);
  if(request.method==='GET'&&url.pathname==='/staging/api/state'){
    // Production player already keeps authoritative spotlight state in
    // this TV browser's localStorage; nothing is stored/shared server-side.
    return json({spots:{},playback:{}});
  }
  if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return json({ok:false,error:'Origin mismatch'},403);
  const ct=(request.headers.get('Content-Type')||'').toLowerCase();
  if(!ct.startsWith('application/json'))return json({ok:false,error:'JSON required'},415);
  const bytes=Number(request.headers.get('Content-Length')||0);
  if(bytes>250000)return json({ok:false,error:'Payload too large'},413);
  try {
    // Bounded parse; no token/analytics storage or external writes.
    const body=await request.text();
    if(body.length>250000)return json({ok:false,error:'Payload too large'},413);
    const parsed=JSON.parse(body);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
      return json({ok:false,error:'Invalid player state'},400);
    return json({ok:true,storage:'browser-local'});
  }catch{return json({ok:false,error:'Malformed JSON'},400);}
}
export default {
  async fetch(request,env,ctx) {
    const path=new URL(request.url).pathname;
    if(path==='/api/board/page1_nfl')return nflPage1Api(request,ctx);
    if(path==='/api/board/page2_nfl')return nflPage2Api(request,ctx);
    if(path==='/staging/api/state'||path==='/staging/api/heartbeat')
      return stagingPlayerState(request);
    if(path==="/proxy")return relay(request,ctx);
    if(path==="/migration-api/nfl/season-stats")return verifiedNflSeasonStats(request,ctx);
    if(path==="/migration-api/health") return json({
      ok:true,mode:"Cloudflare v8l API migration",
      publicEspnRelay:"enabled",boardApi:"PARTIAL NFL PAGES 1 AND 2",firebaseTV:"NOT SWITCHED",
      liveStatistics:"requires per-board verification"
    });
    // All other paths are static and should bypass the Worker in production.
    if(env?.ASSETS?.fetch)return env.ASSETS.fetch(request);
    return json({ok:false,error:"Static asset binding unavailable"},503);
  }
};
export {validExternal,ttlFor,seasonStatsFromSite};
