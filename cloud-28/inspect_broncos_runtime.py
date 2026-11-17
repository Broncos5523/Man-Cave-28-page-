#!/usr/bin/env python3
"""Read-only contract audit focused on the Broncos Page 4 shown in screenshot."""
import re, pathlib, sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
import low_bandwidth_server as low
root=low.approved.original.GOLD
app=low.approved.APP
print("=== BRONCOS PAGE4 REFERENCED SCRIPT FILES ===",flush=True)
b=(root/"boards/page4_broncos.html").read_text(errors="replace")
for x in re.findall(r'<script\b[^>]*\bsrc=["\x27]([^"\x27]+)',b,re.I):
    print("SCRIPT",x[:260],flush=True)
for x in re.findall(r'<link\b[^>]*\bhref=["\x27]([^"\x27]+)',b,re.I):
    if ".css" in x:print("STYLE",x[:200],flush=True)
print("=== LIVE DATA REFERENCES INSIDE HTML ===",flush=True)
for x in re.finditer(r'(?:fetch\s*\(|[A-Za-z\-/]{0,30}api/board|runtime_[a-zA-Z0-9_]+\.js|data-live|standings|espn|ticker)',b,re.I):
    at=x.start()
    snippet=b[max(0,at-80):at+180]
    if "base64" in snippet or len(snippet)>300:continue
    if re.search(r"fetch\s*\(|api/board|runtime_|source|sport",snippet,re.I):print("HTMLREF",re.sub(r'\s+',' ',snippet)[:230],flush=True)
    if at>200000:break
print("=== RELEVANT RUNTIME FILES ===",flush=True)
for p in sorted(root.rglob("*.js")):
    if re.search(r'nfl|bronco|page4',str(p),re.I) and "node_modules" not in str(p):
        print("SCRIPTFILE",p.relative_to(root),p.stat().st_size,flush=True)
        if p.stat().st_size<25000:
            src=p.read_text(errors="replace")
            for i,l in enumerate(src.splitlines(),1):
                if i<25 or re.search(r'fetch\(|/api/board|endpoint|\\.leaders|\\.stats|\\.ticker|\\.context|\\bapi\\b',l,re.I):
                    print("CODE",p.name,i,l[:240],flush=True)
print("=== APPROVED SERVER ROUTE ORIGIN ===",flush=True)
src=(root/"server.py").read_text(errors="replace").splitlines()
for i,l in enumerate(src,1):
    if re.search(r"def do_GET|/api/board|page4|def respond|def send_json",l):
        a=max(0,i-3);z=min(len(src),i+15)
        print("SERVER_SNIPPET",i,flush=True)
        for j in range(a,z):print("SERVER",j+1,src[j][:230],flush=True)
print("=== DYNAMIC REPLACEMENT ADAPTER ===",flush=True)
p=app/"production"/"adapters.py"
if p.exists():
  src=p.read_text(errors="replace").splitlines()
  for i,l in enumerate(src,1):
    if re.search(r"def adapt_board|page4|runtime_|fetch\(",l,re.I):
        print("ADAPTER",i,l[:220],flush=True)
