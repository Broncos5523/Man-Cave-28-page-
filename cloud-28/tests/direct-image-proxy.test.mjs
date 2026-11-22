import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../staging-direct-images.js',import.meta.url),'utf8');
const origin='https://preview.example';
const espn='https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/buf.png';
const proxied='/proxy?url='+encodeURIComponent(espn);
function create(){
  class Element{
    constructor(tagName='DIV'){this.tagName=tagName;this.attrs={};this.markup='';}
    getAttribute(name){return this.attrs[name]||null;}
    setAttribute(name,value){this.attrs[name]=String(value);}
    insertAdjacentHTML(_position,value){this.markup+=value;}
  }
  Object.defineProperty(Element.prototype,'innerHTML',{
    configurable:true,get(){return this.markup;},set(value){this.markup=value;}
  });
  class HTMLImageElement extends Element{
    constructor(){super('IMG');}
  }
  Object.defineProperty(HTMLImageElement.prototype,'src',{
    configurable:true,get(){return this.attrs.src||'';},
    set(value){this.attrs.src=String(value);}
  });
  const nativeFetch=()=>Promise.resolve('native');
  const window={fetch:nativeFetch};
  const document={readyState:'complete',querySelectorAll:()=>[]};
  runInNewContext(source,{window,document,Element,HTMLImageElement,URL,
    location:{origin,href:origin+'/staging/boards/page1_nfl'},
    encodeURIComponent});
  return {window,Element,HTMLImageElement,nativeFetch};
}
test('only approved ESPN image elements bypass same-origin Worker proxy',()=>{
  const {window,HTMLImageElement,nativeFetch}=create();
  const image=new HTMLImageElement();
  image.src=proxied;
  assert.equal(image.src,espn);
  const count1=window.__MC_STAGING_DIRECT_IMAGE_REWRITES__.count;
  image.setAttribute('src',proxied);
  assert.equal(image.src,espn);
  assert.ok(window.__MC_STAGING_DIRECT_IMAGE_REWRITES__.count>count1);
  assert.equal(window.fetch,nativeFetch,'Data and canvas fetch must not be rerouted');
});
test('rewrites markup images synchronously, before DOM download begins',()=>{
  const {Element}=create();
  const div=new Element();
  div.innerHTML='<p><img src="'+proxied+'" alt="BUF"></p>';
  assert.ok(div.innerHTML.includes(espn));
  assert.ok(!div.innerHTML.includes('/proxy?url='));
  div.insertAdjacentHTML('beforeend','<img src="'+proxied+'">');
  assert.equal(div.innerHTML.split(espn).length-1,2);
});
test('leaves unknown hosts, HTTP, non-image data and absolute external URLs alone',()=>{
  const {window}=create();
  const direct=window.__MC_STAGING_DIRECT_IMAGE_URL__;
  for(const url of [
    '/proxy?url='+encodeURIComponent('https://evil.example/i/teamlogos/nfl.png'),
    '/proxy?url='+encodeURIComponent('http://a.espncdn.com/i/teamlogos/nfl.png'),
    '/proxy?url='+encodeURIComponent('https://a.espncdn.com/apis/site/v2/scoreboard'),
    '/proxy?url='+encodeURIComponent('https://a.espncdn.com:8443/i/teamlogos/nfl.png'),
    'https://a.espncdn.com/i/teamlogos/nfl.png',
    '/api/board/page1_nfl'
  ]) assert.equal(direct(url),url);
});
