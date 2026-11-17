import test from "node:test";
import assert from "node:assert/strict";
import app,{validExternal,ttlFor} from "../cloudflare-live-proxy.mjs";

const host="https://man-cave-28-page.broncos5523.workers.dev";
test("public feed allowlist rejects SSRF, HTTP and credentials",()=>{
  for(const url of [
    "http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
    "https://127.0.0.1:8080/secrets",
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://sports.core.api.espn.com.evil.example/api",
    "https://user:pass@site.api.espn.com/api",
    "https://site.api.espn.com:8443/api",
    "javascript:alert(1)"
  ]) assert.throws(()=>validExternal(url),{name:"Error"},url);
});
test("public sports hosts accepted; scoreboard TTL stays short",()=>{
  const u=validExternal("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  assert.equal(u.hostname,"site.api.espn.com");
  assert.equal(ttlFor(u),35);
});
test("read-only Cloudflare relay delivers ESPN JSON and strips incoming secrets",async()=>{
  const native=globalThis.fetch;
  let called;
  globalThis.fetch=async (url,options)=>{
    called={url,options};
    return new Response(JSON.stringify({events:[{id:"test"}]}),{
      status:200,headers:{"Content-Type":"application/json"}
    });
  };
  try {
    const url=host+"/proxy?url="+encodeURIComponent("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
    const out=await app.fetch(new Request(url,{headers:{Cookie:"private",Authorization:"Bearer no"}}),{},null);
    assert.equal(out.status,200);
    assert.deepEqual(await out.json(),{events:[{id:"test"}]});
    assert.equal(out.headers.get("X-Man-Cave-Data-Source"),"public-upstream");
    assert.equal(called.url,"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
    assert.equal(called.options.headers.Cookie,undefined);
    assert.equal(called.options.headers.Authorization,undefined);
  }finally {globalThis.fetch=native;}
});
test("rejects unsupported upstream content type without leaking it",async()=>{
  const native=globalThis.fetch;
  globalThis.fetch=async()=>new Response("<html>not json</html>",{headers:{"Content-Type":"text/html"}});
  try {
    const url=host+"/proxy?url="+encodeURIComponent("https://site.api.espn.com/fake");
    const r=await app.fetch(new Request(url),{},null);
    assert.equal(r.status,502);
  }finally {globalThis.fetch=native;}
});
test("blocks non-GET relay and arbitrary domain",async()=>{
  const bad=host+"/proxy?url="+encodeURIComponent("https://example.com/data");
  assert.equal((await app.fetch(new Request(bad),{},null)).status,403);
  assert.equal((await app.fetch(new Request(host+"/proxy",{method:"POST"}),{},null)).status,405);
});
test("migration health advertises unported features accurately",async()=>{
  const r=await app.fetch(new Request(host+"/migration-api/health"),{},null);
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.boardApi,"NOT PORTED");
  assert.equal(data.firebaseTV,"NOT SWITCHED");
});
test("other requests defer to static assets",async()=>{
  const seen=[];
  const env={ASSETS:{fetch:async req=>{seen.push(new URL(req.url).pathname);return new Response("staged", {status:200});}}};
  const r=await app.fetch(new Request(host+"/staging/"),env,{});
  assert.equal(r.status,200);assert.equal(await r.text(),"staged");
  assert.deepEqual(seen,["/staging/"]);
});
