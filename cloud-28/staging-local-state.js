/* Staging-only: bypass no-op Worker state and heartbeat calls.
 * Approved player itself keeps authoritative state in localStorage.
 */
(function(){
 'use strict';
 const native=window.fetch.bind(window);
 window.fetch=function(input,init){
  const raw=typeof input==='string'?input:input?.url;
  if(!raw)return native(input,init);
  let url;try{url=new URL(raw,location.href);}catch{return native(input,init);}
  if(url.origin!==location.origin||url.search)return native(input,init);
  const method=String(init?.method||input?.method||'GET').toUpperCase();
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  if(url.pathname==='/staging/api/state'&&method==='GET')
   return Promise.resolve(new Response('{"spots":{},"playback":{}}',{status:200,headers}));
  if((url.pathname==='/staging/api/state'||url.pathname==='/staging/api/heartbeat')&&method==='POST'){
   const h=new Headers(init?.headers||input?.headers||{});
   if(h.get('Content-Type')?.toLowerCase().startsWith('application/json')!==true)
    return Promise.resolve(new Response('{"error":"JSON required"}',{status:415,headers}));
   const body=init?.body;
   if(typeof body!=='string'||body.length>250000)
    return Promise.resolve(new Response('{"error":"Invalid player state"}',{status:400,headers}));
   try{
    const data=JSON.parse(body);
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid state');
   }catch{
    return Promise.resolve(new Response('{"error":"Malformed JSON"}',{status:400,headers}));
   }
   return Promise.resolve(new Response('{"ok":true,"storage":"browser-local"}',{status:200,headers}));
  }
  return native(input,init);
 };
 window.__MC_STAGING_LOCAL_STATE__=true;
})();
