import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const root=new URL('../cloudflare-static-dist/',import.meta.url);
const runtimeDir=new URL('staging/runtime/',root);
const rawRoot=(name)=>readFileSync(new URL(name,root),'utf8');
const rawStage=(name)=>readFileSync(new URL(name,runtimeDir),'utf8');

function imageURL(script) {
 const match=/  const imageURL = value => \{[\s\S]*?\n  \};/.exec(script);
 assert.ok(match,'Known original helper must still be present');
 const context={URL,location:{href:'https://example.workers.dev/staging/boards/page1_nfl'},
   origin:'https://example.workers.dev',
   IMAGE_HOSTS:new Set(['a.espncdn.com','assets.nhle.com','cdn.nba.com'])};
 return runInNewContext(match[0]+'\nimageURL',context);
}

test('all cloned runtimes preserve the original outside of exact image routing helper',()=>{
 const names=readdirSync(runtimeDir).filter(name=>/^runtime.*\.js$/.test(name));
 assert.ok(names.length>=20);
 const oldHelper=/  const imageURL = value => \{[\s\S]*?\n  \};/;
 for(const name of names){
   const original=rawRoot(name),clone=rawStage(name);
   assert.ok(original.length>1000,'Original '+name+' must be complete');
   const a=original.match(oldHelper)?.[0],b=clone.match(oldHelper)?.[0];
   if(!a)assert.equal(clone,original);
   else {
     assert.ok(b,'Staging clone missing known helper '+name);
     let unchanged=clone.replace(b,a);
     if(name==='runtime_redsox_p3_v7t.js'){
       const safe="if(node.tagName==='IMG')proxyImages(node.parentNode||document);";
       const legacy="if(node.tagName==='IMG')proxyImages(node.parentNode);";
       assert.ok(original.includes(legacy),'Expected approved Red Sox observer source');
       assert.ok(unchanged.includes(safe),'Stage-only Red Sox null-parent guard missing');
       assert.ok(!original.includes(safe),'Gold Master runtime must remain untouched');
       unchanged=unchanged.replace(safe,legacy);
     }
     assert.equal(unchanged,original);
   }
 }
});

test('known ESPN image path bypasses Worker while data/unknown hosts stay unchanged',()=>{
 const original=imageURL(rawRoot('runtime_nfl_p1_v7j.js'));
 const direct=imageURL(rawStage('runtime_nfl_p1_v7j.js'));
 const logo='https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/dal.png';
 const combo='https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/scoreboard/dal.png&w=120';
 const unsafe='https://a.espncdn.com/apis/site/scoreboard';
 assert.match(original(logo),/\/proxy\?url=/);
 assert.equal(direct(logo),logo);
 assert.equal(direct(combo),combo);
 assert.equal(direct(unsafe),original(unsafe));
 assert.equal(direct('https://somewhere.example/logo.png'),'https://somewhere.example/logo.png');
 assert.equal(direct('http://a.espncdn.com/i/teamlogos/xx.png'),original('http://a.espncdn.com/i/teamlogos/xx.png'));
 assert.equal(direct('https://a.espncdn.com:444/i/teamlogos/xx.png'),original('https://a.espncdn.com:444/i/teamlogos/xx.png'));
 assert.equal(direct('https://user:secret@a.espncdn.com/i/xx.png'),original('https://user:secret@a.espncdn.com/i/xx.png'));
 assert.equal(direct('https://assets.nhle.com/logos/bruins.svg'),original('https://assets.nhle.com/logos/bruins.svg'));
});

test('board HTML uses staging-only runtime files, originals remain available',()=>{
 const ids=['page1_nfl','page2_nfl','page1_nba','page1_cbb'];
 for(const id of ids){
   const markup=readFileSync(new URL('staging/boards/'+id+'.html',root),'utf8');
   assert.match(markup,/\/staging\/runtime\/runtime_[a-z0-9_]+\.js\?board=/);
   assert.doesNotMatch(markup,/src="\/runtime_[a-z0-9_]+\.js/);
 }
});
