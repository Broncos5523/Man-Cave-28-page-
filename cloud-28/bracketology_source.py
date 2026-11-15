"""Metadata-only ESPN Bracketology source watcher for 2027.

IMPORTANT: The official article does not expose a complete, validated 76-team
regional projected bracket through this interface. Never call it a live
projection or replace the approved 2026 tournament recap with invented teams.
"""
from datetime import datetime, timezone
from html import unescape
from urllib.request import Request, urlopen
import json,re,time,threading

_SOURCE='https://www.espn.com/espn/feature/story/_/page/bracketology/ncaa-bracketology-2027-march-madness-men-field-predictions'
_LOCK=threading.Lock()
_CACHE=None
_AT=0
_TTL=21*3600
def collect():
    with urlopen(Request(_SOURCE,headers={'User-Agent':'Mozilla/5.0 (compatible; ManCaveSportsBook/1.0)'}),timeout=14) as r:
        if r.status!=200:raise RuntimeError('ESPN article unavailable')
        page=r.read(450000).decode('utf-8','replace')
    def meta(tag,key):
        pattern=r'<meta\b[^>]*\b'+tag+r'=["\x27]'+re.escape(key)+r'["\x27][^>]*>'
        m=re.search(pattern,page,re.I)
        if not m:return ''
        c=re.search(r'\bcontent=["\x27]([^"\x27]*)',m.group(),re.I)
        return unescape(c.group(1)).strip() if c else ''
    published=modified=''
    for raw in re.findall(r'<script\b[^>]*type=["\x27]application/ld\+json["\x27][^>]*>(.*?)</script>',page,re.S|re.I):
        try:
            data=json.loads(unescape(raw))
            if isinstance(data,list):data=next((x for x in data if isinstance(x,dict) and 'datePublished' in x),{})
            if isinstance(data,dict):
                published=data.get('datePublished') or published
                modified=data.get('dateModified') or modified
        except (ValueError,TypeError):continue
    title=meta('property','og:title')
    description=meta('property','og:description')
    if not title or not re.search(r'bracketology|march madness',page[:7000],re.I):
        raise RuntimeError('Official ESPN article metadata not verified')
    return {'source':'ESPN','sourceUrl':_SOURCE,'title':title,
        'summary':description,'articlePublishedAt':published,
        'articleModifiedAt':modified,'checkedAt':datetime.now(timezone.utc).isoformat(),
        'season':2027,'projectedTeams':None,'projectedRegions':None,
        'completeProjectedBracket':False,'status':'metadata-only',
        'note':'ESPN 2027 article metadata verified; complete 76-team field not publicly extractable. Keep 2026 historical recap clearly labeled.'}

def cached():
    global _CACHE,_AT
    if _CACHE and time.monotonic()-_AT<_TTL:return _CACHE
    with _LOCK:
        if _CACHE and time.monotonic()-_AT<_TTL:return _CACHE
        try:
            value=collect()
            _CACHE=value;_AT=time.monotonic()
            return value
        except Exception:
            if _CACHE:return {**_CACHE,'status':'source-check-delayed'}
            raise
