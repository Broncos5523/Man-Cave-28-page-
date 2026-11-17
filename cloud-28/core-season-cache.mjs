/* Verified public season-stat fallback for ESPN Core's Worker-only HTTP 403.
 * Scores/schedules do not use this path. Expired entries are never current. */
const SOURCE='https://raw.githubusercontent.com/Broncos5523/Man-Cave-28-page-/cloudflare-live-data/espn-core-season-cache.json';
let saved=null,pending=null,checkedAt=0;
export function coreKey(url){
  const u=new URL(url);
  if(u.hostname!=='sports.core.api.espn.com')return null;
  const match=/^\/v2\/sports\/(basketball|football)\/leagues\/(nba|wnba|mens-college-basketball|college-football)\/seasons\/(20\d{2})\/types\/2\/(teams|athletes)\/(\d+)\/statistics(?:\/0)?\/?$/.exec(u.pathname);
  if(!match)return null;
  return u.pathname.replace(/\/$/,'').replace(/\/statistics(?:\/0)?$/,'/statistics'+(match[4]==='athletes'?'/0':''));
}
export function validatedCoreEntry(dataset,key,now=Date.now()){
  if(dataset?.schema!==1||!key)throw Error('Unrecognized season cache');
  const entry=dataset.entries?.[key],stamp=Date.parse(entry?.fetchedAt),age=now-stamp;
  if(!Number.isFinite(stamp)||age< -60000||age>900000)throw Error('Season cache expired');
  const year=/\/seasons\/(\d{4})\//.exec(key)?.[1],data=entry.data;
  if(!year||!String(data?.seasonType?.$ref||'').includes('/seasons/'+year+'/types/2?')||
     !String(data?.season?.$ref||'').includes('/seasons/'+year+'?')||!Array.isArray(data?.splits?.categories))
    throw Error('Season cache year/type contract mismatch');
  const own=coreKey(entry.sourceUrl);
  if(own!==key)throw Error('Season cache identity mismatch');
  const identity=new URL(data.$ref);identity.hostname='sports.core.api.espn.com';
  if(coreKey(identity.toString())!==key)throw Error('Season cache subject mismatch');
  return {...data,__mcSource:{kind:'verified-public-season-cache',fetchedAt:entry.fetchedAt,maxAgeSeconds:900}};
}
async function dataset(){
  if(saved&&Date.now()-checkedAt<30000)return saved;
  if(pending)return pending;
  pending=(async()=>{
    const response=await fetch(SOURCE,{headers:{Accept:'application/json','User-Agent':'ManCaveSportsBook-v8l'},signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Public season cache unavailable');
    const bytes=await response.arrayBuffer();if(bytes.byteLength>5*1024*1024)throw Error('Season cache exceeds bound');
    const data=JSON.parse(new TextDecoder().decode(bytes));saved=data;checkedAt=Date.now();return data;
  })();
  try{return await pending;}finally{pending=null;}
}
export async function currentCoreFallback(url){
  const key=coreKey(url);if(!key)return null;
  try{
    const data=validatedCoreEntry(await dataset(),key);
    const ttl=Math.max(0,Math.min(30,Math.floor((900000-(Date.now()-Date.parse(data.__mcSource.fetchedAt)))/1000)));
    return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json',
      'Cache-Control':ttl?'public, max-age='+ttl:'no-store','X-Content-Type-Options':'nosniff',
      'X-Man-Cave-Data-Source':'verified-public-season-cache','X-Man-Cave-Source-Checked':data.__mcSource.fetchedAt}});
  }catch{return null;}
}
