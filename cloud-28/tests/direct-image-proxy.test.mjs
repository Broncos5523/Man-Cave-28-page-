import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../staging-direct-images.js',import.meta.url),'utf8');
const origin='https://preview.example';
const logo='https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/buf.png';
const proxied='/proxy?url='+encodeURIComponent(logo);
function setup(){
 class Element{
  constructor(tagName='DIV'){this.tagName=tagName;this.attrs={};}
  getAttribute(n){return this.attrs[n]||null;}
  setAttribute(n,v){this.attrs[n]=String(v);}
 }
 class HTMLImageElement extends Element{constructor(){super('IMG');}}
 Object.defineProperty(HTMLImageElement.prototype,'src',{
  configurable:true,get(){return this.attrs.src||'';},
  set(value){this.attrs.src=String(value);}
 });
 const nativeFetch=()=>Promise.resolve('original fetch');
 const window={fetch:nativeFetch};
 runInNewContext(source,{window,Element,HTMLImageElement,URL,
  location:{origin,href:origin+'/staging/boards/page1_nfl'}});
 return {window,Element,HTMLImageElement,nativeFetch};
}
test('only IMG.src uses direct approved HTTPS ESPN image',()=>{
 const {window,HTMLImageElement,nativeFetch}=setup();
 const img=new HTMLImageElement();
 img.src=proxied;
 assert.equal(img.src,logo);
 assert.equal(window.fetch,nativeFetch);
 assert.equal(window.__MC_STAGING_DIRECT_IMAGE_REWRITES__.count,1);
 img.setAttribute('src',proxied);
 assert.equal(img.src,logo);
 assert.equal(window.__MC_STAGING_DIRECT_IMAGE_REWRITES__.count,2);
});
test('does not alter non-image DOM operations',()=>{
 const {Element}=setup();
 const div=new Element('DIV');
 div.setAttribute('data-raw',proxied);
 assert.equal(div.getAttribute('data-raw'),proxied);
});
test('blocks non-ESPN hosts, non-image URLs, credentials, HTTP and unknown paths',()=>{
 const direct=setup().window.__MC_STAGING_DIRECT_IMAGE_URL__;
 for(const u of [
  '/proxy?url='+encodeURIComponent('https://other.example/i/image.png'),
  '/proxy?url='+encodeURIComponent('http://a.espncdn.com/i/image.png'),
  '/proxy?url='+encodeURIComponent('https://a.espncdn.com/apis/site/scoreboard'),
  '/proxy?url='+encodeURIComponent('https://x:y@a.espncdn.com/i/image.png'),
  '/proxy?url='+encodeURIComponent('https://a.espncdn.com:8443/i/image.png'),
  'https://a.espncdn.com/i/logo.png',
  '/api/board/page1_nfl'
 ])assert.equal(direct(u),u);
});
