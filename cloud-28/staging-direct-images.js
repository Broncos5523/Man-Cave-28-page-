/* Man Cave Sports Book -- Cloudflare STAGING ONLY.
 * Direct image elements to the same approved public ESPN CDN artwork rather
 * than spending a billed Worker invocation on /proxy for each logo/headshot.
 * No fetch() rewriting, canvas data reads, UI design or upstream data changes.
 */
(function(){
  'use strict';
  const prior=window.__MC_STAGING_DIRECT_IMAGE_REWRITES__||{count:0};
  window.__MC_STAGING_DIRECT_IMAGE_REWRITES__=prior;
  const TRUSTED_HOSTS=new Set(['a.espncdn.com','a.espn.com']);
  function direct(raw){
    if(typeof raw!=='string'||!raw.includes('/proxy?'))return raw;
    let outer,target;
    try{
      outer=new URL(raw.replace(/&amp;/gi,'&'),location.href);
      if(outer.origin!==location.origin||outer.pathname!=='/proxy')return raw;
      target=new URL(outer.searchParams.get('url'));
      if(target.protocol!=='https:'||!TRUSTED_HOSTS.has(target.hostname)||
         target.username||target.password||target.port||!/^\/(?:i\/|combiner\/)/.test(target.pathname))
        return raw;
      // Browser IMG tags do not require cross-origin JSON/fetch access.
      prior.count++;
      return target.href;
    }catch{return raw;}
  }
  window.__MC_STAGING_DIRECT_IMAGE_URL__=direct;

  // Covers the normal renderer assignment: img.src = proxied(espnImage).
  const source=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  if(source?.get&&source?.set&&source.configurable){
    Object.defineProperty(HTMLImageElement.prototype,'src',{
      configurable:true,enumerable:source.enumerable,
      get(){return source.get.call(this);},
      set(value){return source.set.call(this,direct(value));}
    });
  }
  // Covers img.setAttribute('src', proxied(...)).
  const originalSet=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(name,value){
    if(this.tagName==='IMG'&&String(name).toLowerCase()==='src')
      value=direct(String(value));
    return originalSet.call(this,name,value);
  };
  // Covers markup assembled by team/game renderers via innerHTML.
  function rewriteMarkup(markup){
    if(typeof markup!=='string'||!markup.includes('/proxy?'))return markup;
    return markup.replace(/(\bsrc\s*=\s*)(["'])(.*?)\2/gi,(all,lead,quote,src)=>{
      const resolved=direct(src);
      return lead+quote+resolved+quote;
    });
  }
  const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  if(html?.get&&html?.set&&html.configurable){
    Object.defineProperty(Element.prototype,'innerHTML',{
      configurable:true,enumerable:html.enumerable,
      get(){return html.get.call(this);},
      set(value){return html.set.call(this,rewriteMarkup(value));}
    });
  }
  const adjacent=Element.prototype.insertAdjacentHTML;
  if(typeof adjacent==='function')
    Element.prototype.insertAdjacentHTML=function(position,markup){
      return adjacent.call(this,position,rewriteMarkup(markup));
    };
  // Any late image node from HTML parsing can still be corrected.
  function fix(root){
    if(root?.tagName==='IMG'){
      const raw=root.getAttribute('src');
      const next=direct(raw);
      if(next!==raw)root.setAttribute('src',next);
    }
    root?.querySelectorAll?.('img[src*="/proxy?"]').forEach(img=>{
      const raw=img.getAttribute('src'),next=direct(raw);
      if(next!==raw)img.setAttribute('src',next);
    });
  }
  if(typeof MutationObserver!=='undefined'){
    const obs=new MutationObserver(entries=>{
      for(const entry of entries){
        if(entry.type==='attributes')fix(entry.target);
        for(const node of entry.addedNodes||[])if(node.nodeType===1)fix(node);
      }
    });
    if(document.documentElement)
      obs.observe(document.documentElement,{subtree:true,childList:true,
        attributes:true,attributeFilter:['src']});
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',()=>fix(document),{once:true});
  else fix(document);
})();
