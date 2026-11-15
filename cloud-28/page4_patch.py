"""Data-only browser patches for approved immutable NBA/CBB Page 4 HTML."""
NBA_BOOT='renderLeaders();renderSpot(0,false);updateTicker();refreshSpotStats();refreshLeaders();'
NBA_TIMER='setInterval(()=>{refreshSpotStats();refreshLeaders()},600000);'
NBA_APPLY=r"""
window.__MC_NBA_P4_APPLY__=function(payload){
  const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const byId=new Map(payload.roster.map(p=>[String(p.id),p]));
  const byName=new Map(payload.roster.map(p=>[normalize(p.name),p]));
  SPOTLIGHT.forEach(p=>{
    const current=byId.get(String(p.id))||byName.get(normalize(p.first+' '+p.last));
    p.stats=p.stats.map(([label])=>[label,current?.stats?.[label]!=null?
      Number(current.stats[label]).toFixed(1):'—']);
  });
  const previous=new Map(leaders.map(p=>[p.key,p]));
  leaders=payload.leaders.map(p=>({...previous.get(p.key),...p}));
  renderLeaders();renderSpot(spotIndex,false);
  window.__MC_NBA_P4_SNAPSHOT__={season:payload.season,
    spotlights:SPOTLIGHT.map(p=>({id:p.id,name:p.first+' '+p.last,stats:p.stats})),
    leaders:leaders.map(p=>({name:p.name,category:p.cat,value:p.value}))};
};
"""
CBB_BOOT='p4RenderSpot(0,false);p4RenderLeaders();'
CBB_APPLY=r"""
window.__MC_CBB_P4_APPLY__=function(payload){
  const normalize=p4Norm;
  const byId=new Map(payload.roster.map(p=>[String(p.id),p]));
  const byName=new Map(payload.roster.map(p=>[normalize(p.name),p]));
  P4SPOT.forEach(p=>{
    const current=byId.get(String(p.id))||byName.get(normalize(p.first+' '+p.last));
    p.stats=p.stats.map(([label])=>[label,current?.stats?.[label]!=null?
      Number(current.stats[label]).toFixed(1):'—']);
  });
  const previous=new Map(p4Leaders.map(p=>[p.key,p]));
  p4Leaders=payload.leaders.map(p=>({...previous.get(p.key),...p}));
  p4RenderSpot(p4Index,false);p4RenderLeaders();
  window.__MC_CBB_P4_SNAPSHOT__={season:payload.season,
    spotlights:P4SPOT.map(p=>({id:p.id,name:p.first+' '+p.last,stats:p.stats})),
    leaders:p4Leaders.map(p=>({name:p.name,category:p.cat,value:p.value}))};
};
"""
def patch_html(board,html):
    if board=='page4_celtics':
        if html.count(NBA_BOOT)!=1 or html.count(NBA_TIMER)!=1:
            raise RuntimeError('Approved NBA Page 4 anchors changed; refusing data patch')
        html=html.replace(NBA_BOOT,'renderLeaders();renderSpot(0,false);updateTicker();',1)
        html=html.replace(NBA_TIMER,'/* live current-season stats owned by cloud data adapter */',1)
        end='</script>'
        if html.count(end)!=2:raise RuntimeError('Approved NBA script structure changed')
        offset=html.rfind(end)
        html=html[:offset]+'\n'+NBA_APPLY+html[offset:]
    elif board=='page4_arizona_cbb':
        if html.count(CBB_BOOT)!=1:raise RuntimeError('Approved Arizona Page 4 anchor changed')
        html=html.replace(CBB_BOOT,CBB_APPLY+'\n'+CBB_BOOT,1)
        for old in ('setTimeout(()=>{p4RefreshSpot();p4RefreshLeaders()},1200);',
                    'setInterval(()=>{p4RefreshSpot();p4RefreshLeaders()},7*60*1000);'):
            if html.count(old)!=1:raise RuntimeError('Approved Arizona updater structure changed')
            html=html.replace(old,'/* current-season stats owned by cloud data adapter */',1)
    else:
        return html
    if html.count('</body>')!=1:raise RuntimeError('Approved Page 4 body structure changed')
    return html.replace('</body>','<script defer src="/production/live-page4-basketball.js?v=20261115-1"></script></body>',1)
