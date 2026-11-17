import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../cloudflare-live-proxy.mjs';
test('Legacy ESPN common-v3 reads preserve path and query on the compatible reachable official host',async()=>{
  const original=globalThis.fetch,seen=[];
  globalThis.fetch=async(url)=>{seen.push(url);return new Response('{"requestedSeason":{"year":2026}}',{
    headers:{'Content-Type':'application/json'}});};
  try{
    const source='https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byteam?season=2026&seasontype=2&limit=400';
    const r=await app.fetch(new Request('https://fixture.invalid/proxy?url='+encodeURIComponent(source)),{},null);
    assert.equal(r.status,200);
    assert.equal(seen[0],source.replace('site.web.api.espn.com','site.api.espn.com'));
    assert.equal((await r.json()).requestedSeason.year,2026);
  }finally{globalThis.fetch=original;}
});
