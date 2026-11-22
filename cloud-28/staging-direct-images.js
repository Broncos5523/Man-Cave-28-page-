/* Cloudflare staging only — narrowly bypass public ESPN image proxy for IMG tags.
 * No global innerHTML hooks, observers, fetch patches, or original artwork changes.
 * Only approved HTTPS ESPN image origins and image-style paths are permitted.
 */
(function(){
 'use strict';
 const counters={count:0};
 window.__MC_STAGING_DIRECT_IMAGE_REWRITES__=counters;
 const HOSTS=new Set(['a.espncdn.com','a.espn.com']);
 function direct(raw){
  if(typeof raw!=='string'||!raw.includes('/proxy?'))return raw;
  try{
   const original=new URL(raw.replace(/&amp;/gi,'&'),location.href);
   if(original.origin!==location.origin||original.pathname!=='/proxy')return raw;
   const url=new URL(original.searchParams.get('url'));
   if(url.protocol!=='https:'||!HOSTS.has(url.hostname)||url.username||url.password||
      url.port||!/^\/(?:i\/|combiner\/)/.test(url.pathname))return raw;
   counters.count++;
   return url.href;
  }catch{return raw;}
 }
 window.__MC_STAGING_DIRECT_IMAGE_URL__=direct;

 const prop=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
 if(prop?.set&&prop?.get&&prop.configurable){
  Object.defineProperty(HTMLImageElement.prototype,'src',{
   configurable:true,enumerable:prop.enumerable,
   get(){return prop.get.call(this);},
   set(v){return prop.set.call(this,direct(v));}
  });
 }
 const set=Element.prototype.setAttribute;
 Element.prototype.setAttribute=function(name,value){
  if(this.tagName==='IMG'&&String(name).toLowerCase()==='src')value=direct(String(value));
  return set.call(this,name,value);
 };
})();
