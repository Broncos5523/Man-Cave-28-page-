import {leagueMeta,gameKeyFrom,scoreboardFrom,standingsFrom,playersFrom} from "./yahoo-parser.mjs";

/* Isolated private Fantasy Worker: no public Yahoo proxy and no browser tokens. */
const YAHOO_API="https://fantasysports.yahooapis.com/fantasy/v2";
const TOKEN_URL="https://api.login.yahoo.com/oauth2/get_token";
const AUTHORIZE_URL="https://api.login.yahoo.com/oauth2/request_auth";
const cookies={session:"mc_fantasy_session",state:"mc_fantasy_oauth"};
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer","X-Frame-Options":"SAMEORIGIN"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,"Content-Type":"application/json; charset=utf-8"}});
const html=(body,status=200)=>new Response(body,{status,headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
const now=()=>Math.floor(Date.now()/1000);
const encode=s=>btoa(String.fromCharCode(...new Uint8Array(s))).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
const decode=s=>Uint8Array.from(atob(s.replaceAll("-","+").replaceAll("_","/")),c=>c.charCodeAt(0));
const random=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
function cookie(request,name){
  return (request.headers.get("Cookie")||"").split(";").map(x=>x.trim())
    .find(x=>x.startsWith(name+"="))?.slice(name.length+1)||"";
}
function setCookie(name,value,seconds){
  return name+"="+value+"; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age="+seconds;
}
async function hmac(value,secret){
  const k=await crypto.subtle.importKey("raw",new TextEncoder().encode("fantasy-session-v1:"+secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return encode(await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(value)));
}
async function issue(value,secret,ttl){
  const body=encode(new TextEncoder().encode(JSON.stringify({value,expires:now()+ttl})));
  return body+"."+await hmac(body,secret);
}
async function verify(signed,secret){
  const parts=signed.split(".");
  if(parts.length!==2 || parts[0].length>1000 || parts[1].length>100)return null;
  const mac=await hmac(parts[0],secret);
  // Compare digests without short-circuiting on the first mismatch.
  if(mac.length!==parts[1].length)return null;
  let diff=0;for(let i=0;i<mac.length;i++)diff|=mac.charCodeAt(i)^parts[1].charCodeAt(i);
  if(diff)return null;
  try{
    const p=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    return p.expires>now()?p.value:null;
  }catch{return null;}
}
async function encrypt(value,secret){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("fantasy-oauth-v1:"+secret));
  const key=await crypto.subtle.importKey("raw",digest,"AES-GCM",false,["encrypt"]);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const bytes=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(value)));
  return {iv:encode(iv),data:encode(bytes)};
}
async function decrypt(value,secret){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("fantasy-oauth-v1:"+secret));
  const key=await crypto.subtle.importKey("raw",digest,"AES-GCM",false,["decrypt"]);
  const bytes=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(value.iv)},key,decode(value.data));
  return JSON.parse(new TextDecoder().decode(bytes));
}
const configured=e=>Boolean(e.FANTASY_SESSION_SECRET?.length>=32&&e.FANTASY_VIEW_PIN?.length>=8
  &&e.YAHOO_CLIENT_ID&&e.YAHOO_CLIENT_SECRET&&/^\d+$/.test(e.YAHOO_LEAGUE_ID||"")
  &&e.PUBLIC_BASE_URL?.startsWith("https://"));
const base=e=>String(e.PUBLIC_BASE_URL||"").replace(/\/$/,"");
const callback=e=>base(e)+"/oauth/yahoo/callback";
const stateStub=e=>e.FANTASY_STATE.get(e.FANTASY_STATE.idFromName("private-yahoo-fantasy-v1"));
function safeText(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");}
// Signed, session-bound form permits support Safari/in-app browsers with unusual
// Origin/Sec-Fetch-Site metadata without disabling CSRF protection.
async function formSubject(request,env,action){
  return action==="unlock" ? "form:unlock" : "form:connect:"+await hmac(cookie(request,cookies.session),env.FANTASY_SESSION_SECRET);
}
async function formPermit(request,env,action){
  if(!env.FANTASY_SESSION_SECRET)return "";
  return issue(await formSubject(request,env,action),env.FANTASY_SESSION_SECRET,1800);
}
async function validFormPermit(form,request,env,action){
  if(!env.FANTASY_SESSION_SECRET)return false;
  const signed=String(form.get("form_token")||"");
  if(signed.length>1000)return false;
  return await verify(signed,env.FANTASY_SESSION_SECRET)===await formSubject(request,env,action);
}
function setupPage({unlocked=false,config=false,connected=false,error="",detail="",formToken=""}={}){
  const permit="<input type='hidden' name='form_token' value='"+formToken+"'>";
  const fields=unlocked?(
    !config ? "<p>The private Cloudflare settings are not configured. Add Worker secrets before connecting Yahoo.</p>" :
    "<p>"+(connected?"Yahoo account previously authorized. Reconnect after approval if needed.":"Yahoo authorization is not connected yet.")+"</p>"+
    "<form method='post' action='/connect/yahoo'>"+permit+"<button type='submit'>"+(connected?"Reconnect Yahoo Fantasy":"Connect Yahoo Fantasy")+"</button></form>"+
    "<p class='muted'>This uses Yahoo's official consent screen. Never paste credentials or tokens into a chat.</p>"+
    "<p><a href='/api/status'>Private connection status</a> · <a href='/'>Original V24.8 dashboard</a></p>"
  ):"<form method='post' action='/unlock'>"+permit+"<label>Private display passphrase<input type='password' name='pin' required autocomplete='off'></label><button type='submit'>Unlock Fantasy Board</button></form>";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Man Cave Fantasy — Private Setup</title><style>
  body{font:16px system-ui;background:#071322;color:#f5f8ff;display:grid;place-items:center;min-height:100vh;margin:0}
  main{width:min(90vw,520px);background:#10223d;border:1px solid #476083;border-radius:18px;padding:28px;box-sizing:border-box}
  h1{font-size:clamp(24px,6vw,36px)}small{color:#ffcc65;letter-spacing:.2em;font-weight:700}
  p{line-height:1.5;color:#d5e0f1}label{display:block}input,button{box-sizing:border-box;width:100%;padding:15px;margin:12px 0;border-radius:8px;font:inherit}
  input{color:white;background:#102d50;border:1px solid #6182a7}button{background:#ffcc65;color:#061321;border:0;font-weight:800}
  a{color:#ffcf76}.muted{font-size:13px}.error{color:#ff9898}</style>
  <main><small>MAN CAVE SPORTS BOOK</small><h1>YAHOO FANTASY CLOUD</h1>
  <p>Approved V24.8 original graphics preserved.</p>
  ${error?"<p class='error'>"+safeText(error)+"</p>":""}${detail?"<p>"+safeText(detail)+"</p>":""}
  ${fields}</main></html>`;
}
function redirect(url,extraCookie){
  const h=new Headers(headers);h.set("Location",url);
  if(extraCookie)h.append("Set-Cookie",extraCookie);
  return new Response(null,{status:303,headers:h});
}
 async function handler(request,env,ctx){
  const u=new URL(request.url),path=u.pathname;
  if(path==="/healthz"&&request.method==="GET")
    return json({ok:true,service:"fantasy-edge",private:true,configured:configured(env)});
  if(path==="/unlock"&&request.method==="POST"){
    if(Number(request.headers.get("Content-Length")||0)>2048)return json({error:"too large"},413);
    const form=await request.formData();
    if(!await validFormPermit(form,request,env,"unlock"))
      return html(setupPage({error:"Private form expired. Reopen the setup page and try again.",
        formToken:await formPermit(request,env,"unlock")}),403);
    const pin=String(form.get("pin")||"");
    const check=await stateStub(env).fetch("https://internal/auth-check",{method:"POST",
      body:JSON.stringify({pin,ip:request.headers.get("CF-Connecting-IP")||"unknown"})});
    if(!check.ok)return html(setupPage({error:check.status===429?"Too many attempts; try again later.":"Passphrase not accepted.",
      formToken:await formPermit(request,env,"unlock")}),check.status);
    return redirect("/setup",setCookie(cookies.session,await issue("fantasy-owner",env.FANTASY_SESSION_SECRET,7*86400),7*86400));
  }
  const unlocked=env.FANTASY_SESSION_SECRET && (await verify(cookie(request,cookies.session),env.FANTASY_SESSION_SECRET))==="fantasy-owner";
  if(path==="/oauth/yahoo/callback"&&request.method==="GET"){
    if(!unlocked || !configured(env))return redirect("/setup");
    const got=u.searchParams.get("state")||"";
    const expected=await verify(cookie(request,cookies.state),env.FANTASY_SESSION_SECRET);
    if(!expected || expected!==got || u.searchParams.has("error") || !u.searchParams.get("code"))
      return html(setupPage({unlocked:true,config:true,error:"Yahoo consent failed or OAuth state did not match.",
        formToken:await formPermit(request,env,"connect")}),400);
    const result=await stateStub(env).fetch("https://internal/token-exchange",{method:"POST",
      body:JSON.stringify({code:u.searchParams.get("code"),redirect_uri:callback(env)})});
    if(!result.ok)return html(setupPage({unlocked:true,config:true,error:"Yahoo token exchange failed; check app credentials and approved callback.",
      formToken:await formPermit(request,env,"connect")}),502);
    return redirect("/setup",setCookie(cookies.state,"",0));
  }
  if(!unlocked){
    if(request.method==="GET"&&path==="/setup")return html(setupPage({
      formToken:await formPermit(request,env,"unlock")}));
    return redirect("/setup");
  }
  if(path==="/setup"&&request.method==="GET"){
    const status=await stateStub(env).fetch("https://internal/status");
    const summary=await status.json();
    return html(setupPage({unlocked:true,config:configured(env),connected:summary.connected,
      formToken:await formPermit(request,env,"connect")}));
  }
  if(path==="/connect/yahoo"&&request.method==="POST"){
    if(Number(request.headers.get("Content-Length")||0)>2048)return json({error:"too large"},413);
    const form=await request.formData();
    if(!await validFormPermit(form,request,env,"connect"))
      return html(setupPage({unlocked:true,config:configured(env),error:"Private form expired. Reopen setup and try again.",
        formToken:await formPermit(request,env,"connect")}),403);
    if(!configured(env) || new URL(request.url).origin!==base(env))
      return html(setupPage({unlocked:true,error:"Cloudflare Worker settings or public URL are incomplete.",
        formToken:await formPermit(request,env,"connect")}),503);
    const state=random();
    const auth=new URL(AUTHORIZE_URL);
    for(const [k,v] of Object.entries({client_id:env.YAHOO_CLIENT_ID,redirect_uri:callback(env),
      response_type:"code",state}))auth.searchParams.set(k,v);
    return redirect(auth.toString(),setCookie(cookies.state,await issue(state,env.FANTASY_SESSION_SECRET,600),600));
  }
  if(path==="/api/status"&&request.method==="GET"){
    const response=await stateStub(env).fetch("https://internal/status");
    return new Response(response.body,{status:response.status,headers:{...headers,"Content-Type":"application/json"}});
  }
  if(path==="/api/data"&&request.method==="GET"){
    const response=await stateStub(env).fetch("https://internal/data");
    return new Response(response.body,{status:response.status,headers:{...headers,"Content-Type":"application/json"}});
  }
  if(request.method!=="GET"&&request.method!=="HEAD")return json({error:"method not allowed"},405);
  // Authenticated original artwork, HTML and browser assets. No public static bypass.
  const response=await env.ASSETS.fetch(request);
  const h=new Headers(response.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);
  return new Response(response.body,{status:response.status,headers:h});
}
export default {
  async fetch(request,env,ctx){
    try{return await handler(request,env,ctx);}
    catch{return json({error:"Private Fantasy service temporarily unavailable"},503);}
  },
  async scheduled(_event,env,ctx){
    if(configured(env))ctx.waitUntil(stateStub(env).fetch("https://internal/refresh").then(()=>{}).catch(()=>{}));
  }
};

export class FantasyState {
  constructor(state,env){this.state=state;this.env=env;this.inFlight=null;}
  async fetch(request){
    const route=new URL(request.url).pathname;
    try{
      if(route==="/auth-check"){
        const {pin,ip}=await request.json();
        const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("ip:"+String(ip).slice(0,100)));
        const key="attempts:"+encode(digest), t=Date.now();
        const tries=(await this.state.storage.get(key)||[]).filter(x=>t-x<300000);
        if(tries.length>=12)return json({ok:false},429);
        const good=await this.equalPins(pin||"",this.env.FANTASY_VIEW_PIN||"");
        if(!good){tries.push(t);await this.state.storage.put(key,tries);return json({ok:false},403);}
        await this.state.storage.delete(key);
        return json({ok:true});
      }
      if(route==="/token-exchange"){
        const {code,redirect_uri}=await request.json();
        if(typeof code!=="string"||code.length>5000||redirect_uri!==callback(this.env))return json({ok:false},400);
        const t=await this.tokenRequest({grant_type:"authorization_code",code,redirect_uri});
        if(!t.access_token||!t.refresh_token)return json({ok:false},502);
        await this.storeToken(t);
        return json({ok:true});
      }
      if(route==="/status"){
        const token=await this.state.storage.get("token-v1");
        const error=await this.state.storage.get("last-error-v1")||null;
        const cached=await this.state.storage.get("dashboard-v1");
        return json({configured:configured(this.env),connected:!!token,
          data_age_seconds:cached?.captured_at_unix?Math.max(0,now()-cached.captured_at_unix):null,
          matchups:cached?.matchup_count??null,last_error:error});
      }
      if(route==="/data"){
        const d=await this.state.storage.get("dashboard-v1");
        if(!d)return json({loading:true,message:"Waiting for first verified Yahoo Fantasy refresh."});
        const age=now()-(d.captured_at_unix||0);
        if(age>150)return json({loading:true,message:"Last verified snapshot is stale. Live scores unavailable."});
        return json({...d,data_age_seconds:age});
      }
      if(route==="/refresh"){
        if(!this.inFlight)this.inFlight=this.refresh().finally(()=>{this.inFlight=null;});
        await this.inFlight;
        return json({ok:true});
      }
      return json({error:"not found"},404);
    }catch{
      return json({error:"Yahoo private state temporarily unavailable"},503);
    }
  }
  async equalPins(a,b){
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(this.env.FANTASY_SESSION_SECRET||"no-secret"),
      {name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const [x,y]=await Promise.all([crypto.subtle.sign("HMAC",key,new TextEncoder().encode(String(a))),
      crypto.subtle.sign("HMAC",key,new TextEncoder().encode(String(b)))]);
    const u=new Uint8Array(x),v=new Uint8Array(y);
    let mismatch=0;for(let i=0;i<u.length;i++)mismatch|=u[i]^v[i];
    return mismatch===0&&configured(this.env);
  }
  async tokenRequest(values){
    const body=new URLSearchParams(values);
    const r=await fetch(TOKEN_URL,{method:"POST",redirect:"manual",headers:{
      "Authorization":"Basic "+btoa(this.env.YAHOO_CLIENT_ID+":"+this.env.YAHOO_CLIENT_SECRET),
      "Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body});
    if(!r.ok)throw new Error("token HTTP "+r.status);
    return r.json();
  }
  async storeToken(t){
    await this.state.storage.put("token-v1",await encrypt({
      access_token:t.access_token,refresh_token:t.refresh_token,
      expires_at:now()+(Number(t.expires_in)||3600)},this.env.FANTASY_SESSION_SECRET));
  }
  async accessToken(){
    const stored=await this.state.storage.get("token-v1");
    if(!stored)return null;
    const token=await decrypt(stored,this.env.FANTASY_SESSION_SECRET);
    if(token.expires_at>now()+120)return token.access_token;
    const r=await this.tokenRequest({grant_type:"refresh_token",refresh_token:token.refresh_token,
      redirect_uri:callback(this.env)});
    if(!r.access_token)throw new Error("refresh token response missing access_token");
    await this.storeToken({...r,refresh_token:r.refresh_token||token.refresh_token});
    return r.access_token;
  }
  async yahoo(path,access){
    if(!path.startsWith("/")||path.includes("..")||path.includes("://"))throw new Error("invalid Yahoo resource");
    const r=await fetch(YAHOO_API+path+(path.includes("?")?"&":"?")+"format=json",{
      headers:{"Authorization":"Bearer "+access,"Accept":"application/json"},redirect:"manual"});
    if(!r.ok)throw new Error("yahoo HTTP "+r.status);
    return r.json();
  }
  async refresh(){
    const error=(phase,reason)=>this.state.storage.put("last-error-v1",{phase,reason,at:now()});
    try{
      if(!configured(this.env))return;
      const access=await this.accessToken();
      if(!access)return;
      const game=/^[a-z]{2,6}$/.test(this.env.YAHOO_GAME_KEY||"nfl")?(this.env.YAHOO_GAME_KEY||"nfl"):"nfl";
      let published=await this.state.storage.get("game-key-v1");
      if(!published||published.code!==game||now()-published.at>21600){
        const key=gameKeyFrom(await this.yahoo("/game/"+game,access));
        if(!key)throw new Error("Yahoo current-season numeric game key missing");
        published={code:game,key,at:now()};
        await this.state.storage.put("game-key-v1",published);
      }
      const prefix="/league/"+published.key+".l."+this.env.YAHOO_LEAGUE_ID;
      const meta=leagueMeta(await this.yahoo(prefix,access));
      if(!meta.week)throw new Error("Yahoo current week missing");
      const matchups=scoreboardFrom(await this.yahoo(prefix+"/scoreboard;week="+meta.week,access));
      if(!matchups.length||meta.team_count&&matchups.length*2!==meta.team_count)
        throw new Error("Yahoo scoreboard missing or incomplete");
      const prior=await this.state.storage.get("dashboard-v1");
      const oldTeams=new Map();
      if(prior?.week===meta.week)for(const m of prior.matchups||[])
        for(const side of ["left","right"])if(m[side]?.team_id!==null)oldTeams.set(m[side].team_id,m[side]);
      const teams=matchups.flatMap(m=>[m.left,m.right]);
      for(const team of teams){
        const old=oldTeams.get(team.team_id);
        if(old){team.starters=old.starters||[];team.bench=old.bench||[];}
      }
      const cursor=Number(await this.state.storage.get("roster-cursor-v1")||0);
      // Three rotating rosters per minute; 12-team league completes a sweep in four minutes.
      for(let n=0;n<Math.min(3,teams.length);n++){
        const t=teams[(cursor+n)%teams.length];
        if(!t.team_key)continue;
        try{
          const raw=await this.yahoo("/team/"+t.team_key+"/roster;week="+meta.week+
            "/players/stats;type=week;week="+meta.week,access);
          const people=playersFrom(raw);
          if(people.length){
            t.starters=people.filter(p=>!["BN","IR","IR+","NA"].includes(p.slot.toUpperCase()));
            t.bench=people.filter(p=>["BN","IR","IR+","NA"].includes(p.slot.toUpperCase()));
          }
        }catch{/* Keep same-week previous values. Never fabricate players. */}
      }
      await this.state.storage.put("roster-cursor-v1",(cursor+3)%teams.length);
      let standings=prior?.week===meta.week ? prior.standings||[] : [];
      const previousStandings=Number(await this.state.storage.get("standings-time-v1")||0);
      if(now()-previousStandings>600||!standings.length){
        try{
          const latest=standingsFrom(await this.yahoo(prefix+"/standings",access));
          if(latest.length){standings=latest;await this.state.storage.put("standings-time-v1",now());}
        }catch{/* Preserve previously verified same-week standings only. */}
      }
      await this.state.storage.put("dashboard-v1",{
        league_id:this.env.YAHOO_LEAGUE_ID,league_name:meta.name,week:meta.week,
        team_count:meta.team_count||teams.length,matchup_count:matchups.length,
        matchups,standings,captured_at_unix:now(),source:"Yahoo Fantasy Sports API"});
      await this.state.storage.delete("last-error-v1");
    }catch(e){
      const msg=String(e?.message||"Unknown");
      // Only fixed, non-sensitive error classes or HTTP status codes; never provider bodies or URLs.
      const code=/^yahoo HTTP (\d{3})$/.exec(msg);
      await error("refresh",code?"Yahoo API HTTP "+code[1]:
        /^token HTTP \d{3}$/.test(msg)?"Yahoo OAuth HTTP error":"Yahoo scoreboard or connection not ready");
    }
  }
}
