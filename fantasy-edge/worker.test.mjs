import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";

test("public health reveals no Yahoo credentials",async()=>{
 const env={FANTASY_SESSION_SECRET:"p".repeat(40),FANTASY_VIEW_PIN:"supersecret",
 YAHOO_CLIENT_ID:"test-client",YAHOO_CLIENT_SECRET:"test-secret",
 YAHOO_LEAGUE_ID:"12345",PUBLIC_BASE_URL:"https://example.workers.dev"};
 const response=await worker.fetch(new Request("https://example.workers.dev/healthz"),env,{});
 assert.equal(response.status,200);
 const text=await response.text();
 assert.equal(text.includes("test-secret"),false);
 assert.equal(JSON.parse(text).configured,true);
});
test("private assets and APIs stay locked before the owner signs in",async()=>{
 const env={FANTASY_SESSION_SECRET:"p".repeat(40)};
 for(const path of ["/","/static/man_cave_fantasy_logo.png","/api/data","/api/status"]){
   const response=await worker.fetch(new Request("https://example.workers.dev"+path),env,{});
   assert.equal(response.status,303,path);
   assert.equal(response.headers.get("location"),"/setup");
 }
});
test("setup uses secure browser form and does not include a raw Client ID",async()=>{
 const response=await worker.fetch(new Request("https://example.workers.dev/setup"),{},{});
 const page=await response.text();
 assert.equal(response.status,200);
 assert.match(page,/autocomplete='off'/);
 assert.match(page,/Private display passphrase/);
});
