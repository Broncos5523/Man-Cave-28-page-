"""Man Cave Fantasy Cloud. Official Yahoo OAuth; isolated from sports player.
Private data and tokens never appear in public unauthenticated responses."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlencode

import redis
import requests
from cryptography.fernet import Fernet
from flask import Flask, Response, jsonify, redirect, render_template, request, session, url_for

ROOT=Path(__file__).resolve().parent
SESSION_KEY=os.environ.get("FANTASY_SESSION_SECRET","")
PIN=os.environ.get("FANTASY_VIEW_PIN","")
CLIENT_ID=os.environ.get("YAHOO_CLIENT_ID","")
CLIENT_SECRET=os.environ.get("YAHOO_CLIENT_SECRET","")
REDIRECT_URI=os.environ.get("YAHOO_REDIRECT_URI","")
REDIS_URL=os.environ.get("FANTASY_REDIS_URL","")
LEAGUE_ID=os.environ.get("YAHOO_LEAGUE_ID","")
GAME_KEY=os.environ.get("YAHOO_GAME_KEY","nfl")
CACHE_SECONDS=45
YAHOO_BASE="https://fantasysports.yahooapis.com/fantasy/v2"
YAHOO_TOKEN="https://api.login.yahoo.com/oauth2/get_token"
YAHOO_AUTHORIZE="https://api.login.yahoo.com/oauth2/request_auth"
app=Flask(__name__,template_folder=str(ROOT/"runtime"/"templates"),static_folder=str(ROOT/"runtime"/"static"))
app.secret_key=SESSION_KEY or secrets.token_hex(32)
app.config.update(SESSION_COOKIE_SECURE=True,SESSION_COOKIE_HTTPONLY=True,
  SESSION_COOKIE_SAMESITE="Lax",PERMANENT_SESSION_LIFETIME=timedelta(days=30))
rlock=threading.RLock()
attempts={}
last_error=""
last_standings=0
last_rosters=0
worker_started=False

def store():
    if not REDIS_URL: return None
    return redis.Redis.from_url(REDIS_URL,socket_connect_timeout=5,socket_timeout=5,decode_responses=False)

def ready():
    return bool(SESSION_KEY and len(SESSION_KEY)>=32 and PIN and len(PIN)>=8
      and CLIENT_ID and CLIENT_SECRET and REDIRECT_URI.startswith("https://")
      and LEAGUE_ID.isdigit() and REDIS_URL)

def cipher():
    key=hashlib.sha256(("fantasy-tokens-v1:"+SESSION_KEY).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))

def token_get():
    db=store()
    if db is None:return None
    raw=db.get("man-cave-fantasy:oauth:v1")
    if not raw:return None
    try:return json.loads(cipher().decrypt(raw))
    except Exception:return None

def token_save(token):
    # Refresh tokens can rotate; always persist the replacement first.
    value=cipher().encrypt(json.dumps(token,separators=(",",":")).encode())
    db=store()
    if db is None:raise RuntimeError("durable token store not configured")
    db.set("man-cave-fantasy:oauth:v1",value)

def token_valid():
    with rlock:
        t=token_get()
        if not t:return None
        if time.time()+120<float(t.get("expires_at",0)) and t.get("access_token"):
            return t["access_token"]
        response=requests.post(YAHOO_TOKEN,timeout=18,
          auth=(CLIENT_ID,CLIENT_SECRET),
          data={"grant_type":"refresh_token","refresh_token":t["refresh_token"],
                "redirect_uri":REDIRECT_URI})
        response.raise_for_status()
        fresh=response.json()
        if "access_token" not in fresh:raise RuntimeError("Yahoo refresh did not return access token")
        updated={"access_token":fresh["access_token"],
           "refresh_token":fresh.get("refresh_token",t["refresh_token"]),
           "expires_at":time.time()+float(fresh.get("expires_in",3600))}
        token_save(updated)
        return updated["access_token"]

def yahoo_get(path):
    if not path.startswith("/") or "://" in path or ".." in path:
        raise ValueError("Invalid Yahoo API path")
    token=token_valid()
    if not token:raise RuntimeError("Yahoo authorization not connected")
    response=requests.get(YAHOO_BASE+path,params={"format":"json"},
      headers={"Authorization":"Bearer "+token,"Accept":"application/json"},
      timeout=22)
    response.raise_for_status()
    return response.json()

def fields(v):
    """Yahoo's JSON often uses [ {field:...}, {field:...} ] for one object."""
    if isinstance(v,dict):return v
    out={}
    if isinstance(v,list):
        for item in v:
            if isinstance(item,dict):out.update(item)
    return out

def children_named(node,name):
    if isinstance(node,dict):
        if name in node:yield node[name]
        for val in node.values():yield from children_named(val,name)
    elif isinstance(node,list):
        for val in node:yield from children_named(val,name)

def scalar(value,default=None):
    if isinstance(value,dict):
        return value.get("total",value.get("value",default))
    return value if value is not None else default

def flt(value):
    try:return float(scalar(value))
    except (TypeError,ValueError):return None

def integer(value,default=None):
    try:return int(str(scalar(value)))
    except (TypeError,ValueError):return default

def logo_from(t):
    for item in children_named(t,"team_logo"):
        if isinstance(item,dict) and str(item.get("url","")).startswith("https://"):
            return item["url"]
    for raw in children_named(t,"url"):
        if isinstance(raw,str) and ("logo" in raw.lower() or "image" in raw.lower()) and raw.startswith("https://"):
            return raw
    return ""

def team_from(t):
    f=fields(t)
    teamkey=str(f.get("team_key",""))
    idnum=integer(f.get("team_id"))
    if idnum is None and ".t." in teamkey:idnum=integer(teamkey.rsplit(".t.",1)[-1])
    info={"team_id":idnum,"team_key":teamkey,"team_name":str(f.get("name","")),
        "logo_url":logo_from(t),
        "score":flt(f.get("team_points")),
        "live_projection":flt(f.get("team_projected_points")),
        "original_projection":None,"starters":[],"bench":[]}
    # No fabricated Yahoo win probabilities or remaining-player counts.
    return info

def scoreboard_from(data):
    result=[]
    for item in children_named(data,"matchup"):
        nested=list(children_named(item,"team"))
        teams=[]
        for value in nested:
            t=team_from(value)
            if t["team_id"] is not None and t["team_name"]:teams.append(t)
        uniq={t["team_id"]:t for t in teams}
        if len(uniq)==2:
            result.append({"left":list(uniq.values())[0],"right":list(uniq.values())[1]})
    seen=set();clean=[]
    for m in result:
        pair=tuple(sorted((m["left"]["team_id"],m["right"]["team_id"])))
        if pair not in seen:
            seen.add(pair);clean.append(m)
    return clean

def standings_from(data):
    result={}
    for item in children_named(data,"team"):
        f=fields(item)
        k=str(f.get("team_key",""))
        if ".t." not in k:continue
        tid=integer(f.get("team_id"),integer(k.split(".t.")[-1]))
        if tid is None:continue
        details=next(iter(children_named(item,"team_standings")),None)
        if details is None:continue
        rank=integer(fields(details).get("rank"))
        outcomes=fields(fields(details).get("outcome_totals",{}))
        w=integer(outcomes.get("wins"),0)
        l=integer(outcomes.get("losses"),0)
        ties=integer(outcomes.get("ties"),0)
        row={"team_id":tid,"team_name":str(f.get("name","")),
             "rank":rank,"wins":w,"losses":l,"ties":ties,
             "record":f"{w}-{l}"+(f"-{ties}" if ties else ""),
             "win_pct":flt(outcomes.get("percentage"))}
        if rank is not None and 1<=rank<=20:result[tid]=row
    return sorted(result.values(),key=lambda x:x["rank"])

def players_from(data):
    result=[]
    for item in children_named(data,"player"):
        f=fields(item)
        key=str(f.get("player_key",""))
        if not key:continue
        name=fields(f.get("name",{}))
        selected=fields(f.get("selected_position",{}))
        slot=str(selected.get("position",""))
        if not slot:
            slot=next((str(x) for x in children_named(selected,"position") if isinstance(x,str)),"")
        points=flt(f.get("player_points"))
        if points is None:
            points=next((flt(v) for v in children_named(item,"player_points") if flt(v) is not None),None)
        image=str(f.get("image_url",""))
        if not image.startswith("https://"):image=""
        p={"name":str(name.get("full",f.get("display_name",""))),
           "player_id":str(f.get("player_id","")),
           "position":str(f.get("display_position","")),
           "slot":slot,"nfl_team":str(f.get("editorial_team_abbr","")),
           "current_points":points,
           "projected_points":flt(f.get("player_projected_points")),
           "headshot_url":image}
        if p["name"] and slot:result.append(p)
    uniq={}
    for p in result:uniq[p["player_id"] or p["name"]]=p
    return list(uniq.values())

def league_meta(data):
    raw=next(iter(children_named(data,"league")),None)
    f=fields(raw)
    return {"name":str(f.get("name") or "Yahoo Fantasy League"),
            "week":integer(f.get("current_week"),None),
            "team_count":integer(f.get("num_teams"),None)}

def cache_read():
    db=store()
    if db is None:return None
    raw=db.get("man-cave-fantasy:dashboard:v1")
    if not raw:return None
    try:return json.loads(raw)
    except (TypeError,ValueError):return None

def cache_write(payload):
    db=store()
    if db is None:raise RuntimeError("Fantasy cache storage unavailable")
    db.set("man-cave-fantasy:dashboard:v1",json.dumps(payload,separators=(",",":")))

def refresh_once():
    global last_error,last_standings,last_rosters
    now=time.time()
    if not ready() or token_get() is None:return
    previous=cache_read() or {}
    metadata=league_meta(yahoo_get("/league/"+GAME_KEY+".l."+LEAGUE_ID))
    week=metadata["week"]
    if week is None:raise RuntimeError("Yahoo current fantasy week missing")
    board=scoreboard_from(yahoo_get("/league/"+GAME_KEY+".l."+LEAGUE_ID+"/scoreboard;week="+str(week)))
    if not board:raise RuntimeError("Yahoo scoreboards missing; original data retained")
    if metadata["team_count"] and len(board)*2!=metadata["team_count"]:
        raise RuntimeError("Yahoo returned incomplete league matchups; original data retained")
    if previous.get("week")==week:
        oldteams={}
        for m in previous.get("matchups",[]):
            for side in ("left","right"):
                t=m.get(side,{})
                if t.get("team_id") is not None:oldteams[t["team_id"]]=t
        for m in board:
            for side in ("left","right"):
                t=m[side];old=oldteams.get(t["team_id"],{})
                for key in ("starters","bench"):
                    if old.get(key):t[key]=old[key]
    if now-last_rosters>=180 or not previous or previous.get("week")!=week:
        for m in board:
            for side in ("left","right"):
                t=m[side]
                key=t["team_key"]
                if not key:continue
                try:
                    raw=yahoo_get("/team/"+key+"/roster;week="+str(week)+"/players/stats;type=week;week="+str(week))
                    members=players_from(raw)
                    if members:
                        t["starters"]=[p for p in members if p["slot"].upper() not in ("BN","IR","IR+","NA")]
                        t["bench"]=[p for p in members if p["slot"].upper() in ("BN","IR","IR+","NA")]
                except (requests.RequestException,RuntimeError,ValueError):
                    # Use same-week prior data rather than inventing a lineup.
                    pass
        last_rosters=now
    standings=previous.get("standings",[]) if previous.get("week")==week else []
    if now-last_standings>=600 or not standings:
        try:
            updated=standings_from(yahoo_get("/league/"+GAME_KEY+".l."+LEAGUE_ID+"/standings"))
            if updated:standings=updated;last_standings=now
        except (requests.RequestException,RuntimeError,ValueError):
            pass
    payload={"league_id":LEAGUE_ID,"league_name":metadata["name"],"week":week,
         "team_count":metadata["team_count"] or len(board)*2,
         "matchup_count":len(board),"matchups":board,
         "standings":standings,"captured_at_unix":now,"source":"Yahoo Fantasy Sports API"}
    cache_write(payload)
    last_error=""

def worker():
    global last_error
    while True:
        try:
            if ready() and token_get() is not None:
                with rlock:refresh_once()
        except Exception as e:
            # Never print OAuth tokens, API URLs, response bodies or private league data.
            last_error=type(e).__name__
            print("Fantasy cloud refresh deferred:",last_error,flush=True)
        time.sleep(CACHE_SECONDS)

def authorized():
    return bool(PIN and len(PIN)>=8 and session.get("fantasy_view") is True)

def setup_page(message="",error=False):
    body=("<h2>MAN CAVE SPORTS BOOK</h2><h1>YAHOO FANTASY CLOUD</h1>"
          "<p>Your original V24.8 fantasy graphics are preserved.</p>")
    if not SESSION_KEY or len(SESSION_KEY)<32 or not PIN or len(PIN)<8:
        body+="<p>Cloud service deployed. Secure dashboard access has not been configured yet.</p>"
    elif not authorized():
        body+=("<form action='/unlock' method='post'>"
               "<label>Private display passphrase<input name='pin' type='password' autocomplete='off' required></label>"
               "<button type='submit'>Unlock Fantasy Board</button></form>")
    else:
        body+="<p>Dashboard unlocked.</p><p><a href='/'>Open preserved V24.8 dashboard</a></p>"
        if not ready():
            body+="<p>Yahoo credentials, callback or private storage are not configured yet.</p>"
        elif token_get() is None:
            body+="<form action='/connect/yahoo' method='post'><button type='submit'>Connect Yahoo Fantasy</button></form>"
        else:body+="<p>Yahoo account authorized. Live data will appear when API access is provisioned.</p>"
    if message:body+="<p class='message'>"+("ERROR: " if error else "")+str(message).replace("<","&lt;")+"</p>"
    return """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Man Cave Fantasy Cloud — Setup</title>
    <style>body{background:#071322;color:#eff5ff;font-family:Arial,sans-serif;min-height:100vh;display:grid;place-items:center;margin:0}
    main{width:min(90%,540px);text-align:center;padding:35px;border:1px solid #355678;border-radius:18px;background:#0c203b}
    h2{font-size:14px;color:#ffd46a;letter-spacing:3px}h1{font-size:clamp(26px,6vw,42px)}
    p{line-height:1.6;color:#bacce0}input,button{display:block;width:100%;padding:16px;box-sizing:border-box;margin-top:12px;border-radius:8px;font-size:17px}
    button{background:#ffcd63;color:#06101e;font-weight:bold;border:0;cursor:pointer}input{background:#112e50;color:white;border:1px solid #536b87}
    label{display:block;text-align:left;color:#d2e3f0}a{color:#ffd46a}.message{color:#ffd46a}</style></head><body><main>"""+body+"</main></body></html>"

@app.after_request
def headers(response):
    if not request.path.startswith("/static/"):
        response.headers["Cache-Control"]="no-store"
    response.headers["X-Content-Type-Options"]="nosniff"
    response.headers["Referrer-Policy"]="no-referrer"
    response.headers["X-Frame-Options"]="SAMEORIGIN"
    return response

@app.get("/healthz")
def healthz():
    return jsonify({"ok":True,"service":"fantasy-cloud","configured":ready(),"private":True})

@app.get("/setup")
def setup():
    return Response(setup_page(),mimetype="text/html")

@app.post("/unlock")
def unlock():
    ip=request.remote_addr or "unknown"
    now=time.time()
    series=[v for v in attempts.get(ip,[]) if now-v<300]
    if len(series)>=12:return Response(setup_page("Too many attempts. Try later.",True),status=429,mimetype="text/html")
    candidate=request.form.get("pin","")
    if not PIN or not hmac.compare_digest(candidate,PIN):
        series.append(now);attempts[ip]=series
        return Response(setup_page("Passphrase did not match.",True),status=403,mimetype="text/html")
    attempts.pop(ip,None)
    session.clear()
    session.permanent=True;session["fantasy_view"]=True
    return redirect("/setup")

@app.get("/")
def index():
    if not authorized():return redirect("/setup")
    return render_template("dashboard.html")

@app.get("/api/data")
def data():
    if not authorized():return jsonify({"error":"private"}),401
    try:payload=cache_read()
    except redis.RedisError:return jsonify({"error":"storage temporarily unavailable"}),503
    if not payload:
        return jsonify({"loading":True,"message":"Yahoo authorization or first verified refresh pending."})
    age=time.time()-float(payload.get("captured_at_unix",0))
    result=dict(payload)
    if age>150:
        # Never display stale scores as if they were live.
        return jsonify({"loading":True,"message":"Live scores temporarily unavailable; last verified snapshot is stale."})
    result["data_age_seconds"]=max(0,round(age))
    return jsonify(result)

@app.post("/connect/yahoo")
def connect():
    if not authorized():return jsonify({"error":"not authorized"}),401
    if not ready():return Response(setup_page("Cloud secrets and persistent storage must be configured first.",True),status=503,mimetype="text/html")
    try:
        store().ping()
    except redis.RedisError:
        return Response(setup_page("Private persistent storage unavailable.",True),status=503,mimetype="text/html")
    state=secrets.token_urlsafe(32)
    session["yahoo_oauth_state"]=state
    target=YAHOO_AUTHORIZE+"?"+urlencode({"client_id":CLIENT_ID,
          "redirect_uri":REDIRECT_URI,"response_type":"code","state":state})
    return redirect(target)

@app.get("/oauth/yahoo/callback")
def callback():
    if not authorized():return Response(setup_page("Please unlock the dashboard before connecting Yahoo.",True),status=403,mimetype="text/html")
    state=session.pop("yahoo_oauth_state","")
    if not state or not hmac.compare_digest(state,request.args.get("state","")):
        return Response(setup_page("Yahoo connection state did not match. Retry from Setup.",True),status=400,mimetype="text/html")
    if request.args.get("error"):
        return Response(setup_page("Yahoo authorization was declined or access is not active yet.",True),status=400,mimetype="text/html")
    code=request.args.get("code","")
    if not code:return Response(setup_page("Yahoo did not send an authorization code.",True),status=400,mimetype="text/html")
    try:
        response=requests.post(YAHOO_TOKEN,timeout=20,auth=(CLIENT_ID,CLIENT_SECRET),
          data={"grant_type":"authorization_code","code":code,"redirect_uri":REDIRECT_URI})
        response.raise_for_status()
        value=response.json()
        if not value.get("access_token") or not value.get("refresh_token"):
            raise RuntimeError("Yahoo authorization tokens missing")
        token_save({"access_token":value["access_token"],"refresh_token":value["refresh_token"],
             "expires_at":time.time()+float(value.get("expires_in",3600))})
        return redirect("/setup")
    except (requests.RequestException,ValueError,redis.RedisError,RuntimeError):
        # Do not echo response body, authorization code or tokens.
        return Response(setup_page("Yahoo connection could not be finalized. Check provisioning and callback settings.",True),status=502,mimetype="text/html")

def start_worker():
    global worker_started
    if not worker_started:
        worker_started=True
        threading.Thread(target=worker,name="fantasy-yahoo-poller",daemon=True).start()
start_worker()
