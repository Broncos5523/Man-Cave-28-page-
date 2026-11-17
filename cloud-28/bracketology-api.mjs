/* Original metadata-only monitor. A full projected field is never invented. */
let saved=null,savedAt=0;
const unescape=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export async function bracketologyApi(request){
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':status===200?'public, max-age=75600':'no-store','X-Content-Type-Options':'nosniff'}});
  if(request.method!=='GET')return json({ok:false,error:'GET only'},405);
  if(saved&&Date.now()-savedAt<21*3600000)return json(saved);
  const now=new Date(),year=now.getUTCFullYear()+(now.getUTCMonth()>=9?1:0);
  const source='https://www.espn.com/espn/feature/story/_/page/bracketology/ncaa-bracketology-'+year+'-march-madness-men-field-predictions';
  try{
    const response=await fetch(source,{headers:{Accept:'text/html','User-Agent':'ManCaveSportsBook-v8l'},signal:AbortSignal.timeout(13000)});
    if(!response.ok)throw Error('Official ESPN article HTTP '+response.status);
    const reader=response.body.getReader(),parts=[];let bytes=0;
    for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);bytes+=value.length;if(bytes>=450000){await reader.cancel();break;}}
    const joined=new Uint8Array(bytes);let offset=0;for(const p of parts){joined.set(p,offset);offset+=p.length;}
    const page=new TextDecoder().decode(joined);
    const meta=key=>{
      const tag=(page.match(/<meta\b[^>]*>/gi)||[]).find(t=>new RegExp('(?:property|name)=["\x27]'+key+'["\x27]','i').test(t));
      return unescape(/\bcontent=(["'])([\s\S]*?)\1/i.exec(tag||'')?.[2]||'');
    };
    const title=meta('og:title');if(!title||!/bracketology|march madness/i.test(page.slice(0,7000)))throw Error('Official article metadata unverified');
    let published='',modified='';
    for(const match of page.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
      try{const data=JSON.parse(match[1]),item=Array.isArray(data)?data.find(d=>d?.datePublished):data;
        if(item){published=item.datePublished||published;modified=item.dateModified||modified;}}catch{}
    }
    saved={source:'ESPN',sourceUrl:source,title,summary:meta('og:description'),articlePublishedAt:published,articleModifiedAt:modified,
      checkedAt:new Date().toISOString(),season:year,projectedTeams:null,projectedRegions:null,completeProjectedBracket:false,status:'metadata-only',
      note:'Official article metadata only. Approved historical recap remains labelled; no current projected field is verified.'};
    savedAt=Date.now();return json(saved);
  }catch(error){return json({ok:false,status:'source-unavailable',season:year,sourceUrl:source,completeProjectedBracket:false,error:error.message},503);}
}
