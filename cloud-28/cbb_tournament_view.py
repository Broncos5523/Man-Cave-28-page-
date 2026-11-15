"""Stable 2027 in-season CBB Tournament Watch, applied only in transit.

The existing approved 2027 1–4 seed watch is STATIC PRESEASON material, not
verified current ESPN Bracketology. Keep it honest and preserve its team/art
content; display the verified completed tournament when the actual postseason
begins. Neither the original v8l package nor other boards are modified.
"""
# A single exact anchor keeps the patch guarded against source changes.
RUNTIME_ANCHOR="    if(sport!=='cbb')return false;\n    const model=feed.playoffs||{}, matches=model.matches||[];"
RUNTIME_REPLACEMENT="""    if(sport!=='cbb')return false;
    // The currently served playoffs.kind='actual' is the COMPLETED 2026
    // tournament even during the 2026-27 regular season. Do not replace
    // the selected 2027 preseason watch with that historical recap.
    if(board==='page1_cbb'){
      const current=feed.context?.mode==='season'&&Number(feed.context?.year)===2027;
      document.documentElement.dataset.mcTourMode=current?'season-snapshot':'historical';
      if(current){
        const rot=$('#rotator'),grid=$('#liveGrid');
        if(rot)rot.style.display='none';
        if(grid)grid.style.display='grid';
        setText('#tourTitle','2027 TOURNAMENT WATCH');
        setText('#tourSub','APPROVED PRESEASON SNAPSHOT • ESPN DAILY FIELD NOT YET CONNECTED');
        setText('#note','2027 PRESEASON SEED SNAPSHOT • NOT CURRENT ESPN BRACKETOLOGY • FIRST FOUR OUT STATIC');
        window.__MC_CBB_TOURNAMENT_VIEW__={
          mode:'season-snapshot',year:2027,verifiedCurrentESPN:false,
          label:'Approved original 2027 preseason snapshot'
        };
        return true;
      }
    }
    const model=feed.playoffs||{}, matches=model.matches||[];"""

# Scoped CSS operates only in approved 2027 preseason snapshot mode.
# Grid boxes have flex-filled seed rows; no overflowing fixed 4.25cqh rows.
CSS="""<style id="mc-cloud-2027-watch-fit">
html[data-mc-tour-mode="season-snapshot"] #rotator {
  display:none!important;
}
html[data-mc-tour-mode="season-snapshot"] #liveGrid {
  display:grid!important;
  box-sizing:border-box!important;
  height:33.0cqh!important;
  width:100%!important;
  margin:0!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  grid-template-rows:repeat(2,minmax(0,1fr))!important;
  gap:.8cqw!important;
  overflow:hidden!important;
}
html[data-mc-tour-mode="season-snapshot"] #liveGrid .projRegion {
  min-width:0!important;
  min-height:0!important;
  box-sizing:border-box!important;
  display:flex!important;
  flex-direction:column!important;
  padding:.48cqh .75cqw!important;
  overflow:hidden!important;
}
html[data-mc-tour-mode="season-snapshot"] #liveGrid .projRegion h3 {
  flex:0 0 auto!important;
  line-height:1.1!important;
  margin:0 0 .22cqh!important;
}
html[data-mc-tour-mode="season-snapshot"] #liveGrid .seedline {
  flex:1 1 0!important;
  box-sizing:border-box!important;
  height:auto!important;
  min-height:0!important;
  grid-template-columns:3cqw 4cqw minmax(0,1fr)!important;
  overflow:hidden!important;
  padding:0 .1cqw!important;
}
html[data-mc-tour-mode="season-snapshot"] #liveGrid .seedline > span:last-child {
  min-width:0!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
html[data-mc-tour-mode="season-snapshot"] .firstFourOut {
  position:relative!important;
  z-index:4!important;
  display:block!important;
  height:6.05cqh!important;
  margin-top:.42cqh!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
}
html[data-mc-tour-mode="season-snapshot"] .tourney {
  overflow:hidden!important;
}
</style>"""
BOOT="""<script id="mc-cloud-2027-watch-boot">(function(){
  // Show the correct seasonal pane immediately, before ESPN data arrives.
  // Data can switch to actual verified tournament results in postseason.
  var now=Date.now();
  if(now>=Date.UTC(2026,10,1)&&now<Date.UTC(2027,3,1))
    document.documentElement.dataset.mcTourMode='season-snapshot';
})();</script>"""

def patch_html(html):
    if html.count('</head>')!=1:
        raise RuntimeError('Approved CBB Page 1 head structure changed')
    if html.count('id="liveGrid"')!=1 or html.count('class="firstFourOut"')!=1:
        raise RuntimeError('Approved CBB Page 1 tournament snapshot structure changed')
    return html.replace('</head>',BOOT+CSS+'</head>',1)

def patch_runtime(source):
    if source.count(RUNTIME_ANCHOR)!=1:
        raise RuntimeError('Approved CBB Page 1 live runtime tournament anchor changed')
    return source.replace(RUNTIME_ANCHOR,RUNTIME_REPLACEMENT,1)
