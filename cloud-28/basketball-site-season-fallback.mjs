/* Strict ESPN Site v3 current-season basketball player statistics fallback.
 * ESPN Core often returns 403 from Cloudflare. Only use this official
 * endpoint's exact regular-season + team + year player row; NEVER career totals,
 * older teams, projections, inferred zeros, or unverified stat categories.
 * The original v8l Page4 visual code and contract remain unchanged.
 */
import {requireData as need,number} from './board-contract-common.mjs';

const LEAGUES=new Set(['nba','wnba','mens-college-basketball']);
const REQUIRED=['gamesPlayed','avgPoints','avgRebounds','avgAssists','avgSteals','avgBlocks'];
const COMPOSITE='avgThreePointFieldGoalsMade-avgThreePointFieldGoalsAttempted';
const THREE='avgThreePointFieldGoalsMade';

function finite(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string'||!value.trim()||
    !/^-?\d+(?:\.\d+)?$/.test(value.trim()))return null;
  const v=Number(value.trim());return Number.isFinite(v)?v:null;
}
function madeFromAttempted(value){
  if(typeof value!=='string')return null;
  const m=/^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/.exec(value);
  if(!m)return null;
  const made=Number(m[1]),attempted=Number(m[2]);
  return made>=0&&attempted>=made?made:null;
}

export function siteBasketballSeasonStats(data,{league,team,season,athleteId,verifiedAt=new Date().toISOString()}){
  need(LEAGUES.has(league)&&/^\d+$/.test(String(team))&&/^\d+$/.test(String(athleteId))&&
    Number.isInteger(season)&&season>=2024&&season<=2036,'Unverified ESPN basketball subject');
  need(Array.isArray(data?.categories),'ESPN Site categories not available');
  const type=(data.filters||[]).find(f=>f?.name==='seasontype');
  // NCAA may omit the filter when only a season-type 2 row is published.
  if(type)need(String(type.value)==='2','Not ESPN regular season');
  else need(league==='mens-college-basketball','ESPN regular-season filter missing');
  const avg=data.categories.find(c=>c?.name==='averages');
  need(Array.isArray(avg?.names)&&Array.isArray(avg?.statistics),'ESPN averages category missing');
  const rows=avg.statistics.filter(row=>Number(row?.season?.year)===season&&
    String(row?.teamId)===String(team));
  need(rows.length===1,'Exactly one current-season player/team row required');
  const row=rows[0];
  need(Array.isArray(row.stats)&&row.stats.length===avg.names.length,
    'Player averages are not aligned with source stat names');
  const values=new Map();
  for(let i=0;i<avg.names.length;i++){
    const name=avg.names[i];
    if(typeof name!=='string'||!name)continue;
    const value=finite(row.stats[i]);
    if(value!==null)values.set(name,value);
    else if(name===COMPOSITE){
      const made=madeFromAttempted(row.stats[i]);
      if(made!==null)values.set(THREE,made);
    }
  }
  const played=values.get('gamesPlayed');
  need(Number.isInteger(played)&&played>=0,'ESPN games-played count missing');
  // DNP athletes are valid roster entries but have no verified averages.
  if(played>0)need(REQUIRED.every(key=>values.has(key))&&values.has(THREE),
    'Current-season ESPN player averages incomplete');
  const root='https://sports.core.api.espn.com/v2/sports/basketball/leagues/'+league+
    '/seasons/'+season;
  const ref=root+'/types/2/athletes/'+athleteId+'/statistics/0?lang=en&region=us';
  const output={
    $ref:ref,
    season:{$ref:root+'?lang=en&region=us',year:season},
    seasonType:{$ref:root+'/types/2?lang=en&region=us'},
    splits:{id:'0',name:'Regular Season',categories:[{name:'general',
      stats:[...values].filter(([name])=>name==='gamesPlayed'||REQUIRED.includes(name)||name===THREE)
        .map(([name,value])=>({name,value,displayValue:String(value)}))}]},
    __mcSource:{kind:'verified-espn-site-basketball-season',fetchedAt:verifiedAt}
  };
  return output;
}
