/*
 * Yahoo Fantasy JSON -> original V24.8 dashboard data contract.
 * Public pure functions only; never invent absent data.
 */
export function fields(v) {
  if (v && !Array.isArray(v) && typeof v === "object") return v;
  if (!Array.isArray(v)) return {};
  const out={};
  // Yahoo team, player and league resources often start with an INNER array
  // of metadata objects and then append points/standings as sibling objects.
  // The older collector accidentally discarded that entire metadata array.
  for (const item of v) {
    if (Array.isArray(item)) Object.assign(out,fields(item));
    else if (item && typeof item === "object") Object.assign(out,item);
  }
  return out;
}
export function* named(node, key) {
  if (node && typeof node === "object") {
    if (!Array.isArray(node) && Object.hasOwn(node, key)) yield node[key];
    for (const value of Object.values(node)) yield* named(value, key);
  }
}
const number = x => {
  const value = x && typeof x === "object" ? x.total ?? x.value : x;
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const int = x => {
  const n=number(x);
  return n === null || !Number.isInteger(n) ? null : n;
};
function logo(obj) {
  for (const v of named(obj,"team_logo")) {
    if (typeof v?.url === "string" && v.url.startsWith("https://")) return v.url;
  }
  return "";
}
export function teamFrom(raw) {
  const f=fields(raw), key=String(f.team_key||"");
  const id=int(f.team_id) ?? int(key.includes(".t.") ? key.split(".t.").pop() : null);
  return {team_id:id,team_key:key,team_name:String(f.name||""),logo_url:logo(raw),
    score:number(f.team_points),live_projection:number(f.team_projected_points),
    original_projection:null,starters:[],bench:[]};
}
export function scoreboardFrom(data) {
  const results=[], seen=new Set();
  for(const match of named(data,"matchup")) {
    const teams=Array.from(named(match,"team")).map(teamFrom)
      .filter(t=>t.team_id!==null && t.team_name);
    const unique=[...new Map(teams.map(t=>[t.team_id,t])).values()];
    if(unique.length!==2) continue;
    const pair=unique.map(t=>t.team_id).sort((a,b)=>a-b).join(":");
    if(!seen.has(pair)){seen.add(pair);results.push({left:unique[0],right:unique[1]});}
  }
  return results;
}
export function standingsFrom(data) {
  const result=new Map();
  for(const value of named(data,"team")) {
    const f=fields(value), id=int(f.team_id) ?? int(String(f.team_key||"").split(".t.").pop());
    const details=Array.from(named(value,"team_standings"))[0];
    if(id===null || !details)continue;
    const d=fields(details), rank=int(d.rank);
    if(rank===null || rank<1 || rank>20)continue;
    const o=fields(d.outcome_totals), w=int(o.wins)??0,l=int(o.losses)??0,t=int(o.ties)??0;
    result.set(id,{team_id:id,team_name:String(f.name||""),rank,wins:w,losses:l,ties:t,
      record:w+"-"+l+(t?"-"+t:""),win_pct:number(o.percentage)});
  }
  return [...result.values()].sort((a,b)=>a.rank-b.rank);
}
export function playersFrom(data) {
  const result=new Map();
  for(const value of named(data,"player")) {
    const f=fields(value),key=String(f.player_key||"");
    if(!key)continue;
    const n=fields(f.name), selected=fields(f.selected_position);
    const slot=String(selected.position||Array.from(named(selected,"position"))[0]||"");
    const pts=number(f.player_points)??Array.from(named(value,"player_points")).map(number).find(x=>x!==null)??null;
    const name=String(n.full||f.display_name||"");
    if(!name || !slot)continue;
    const pic=String(f.image_url||"");
    const row={name,player_id:String(f.player_id||""),position:String(f.display_position||""),
      slot,nfl_team:String(f.editorial_team_abbr||""),current_points:pts,
      projected_points:number(f.player_projected_points),
      headshot_url:pic.startsWith("https://")?pic:""};
    result.set(row.player_id||row.name,row);
  }
  return [...result.values()];
}
export function gameKeyFrom(data) {
  // Yahoo's game code (nfl) is not the season-specific numeric game key.
  // For example, documentation represents league keys as 461.l.1000.
  const raw=Array.from(named(data,"game"))[0];
  const key=String(fields(raw).game_key||"");
  return /^\d{2,5}$/.test(key)?key:null;
}
export function leagueMeta(data) {
  const f=fields(Array.from(named(data,"league"))[0]);
  return {name:String(f.name||"Yahoo Fantasy League"),
    week:int(f.current_week),team_count:int(f.num_teams)};
}
