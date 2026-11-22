/* ESPN Site common v3 current-season athlete averages -> exact Core Page4 contract.
 * Data adapter only: zero board HTML/CSS/graphics changes.
 * Use when ESPN Core rejects a Worker-originated request (often HTTP 403).
 * Never use career totals, previous season, another team, postseason or a
 * made-up value. Direct Site API numeric/composite averages only.
 */
const n=x=>{
  if(typeof x!=='string'&&typeof x!=='number')return null;
  const raw=String(x).trim();
  if(!/^(?:\d+|\d+\.\d+|\.\d+)$/.test(raw))return null;
  const value=Number(raw);
  return Number.isFinite(value)&&value>=0?value:null;
};
const required=(ok,message)=>{if(!ok)throw Error(message);};
const AVERAGES=['gamesPlayed','avgPoints','avgRebounds','avgAssists',
  'avgSteals','avgBlocks','avgThreePointFieldGoalsMade'];
export function verifiedBasketballSiteSeasonStat(raw,config,now=new Date()){
  const {league,team,year,athlete,regularSeasonVerified}=config||{};
  required(['nba','wnba','mens-college-basketball'].includes(league),'Unsupported ESPN league');
  required(/^\d{1,5}$/.test(String(team))&&/^\d{4,10}$/.test(String(athlete)),
    'Unverified team/athlete');
  required(Number.isInteger(year)&&year>=2025&&year<=2036&&regularSeasonVerified===true,
    'Regular season must be independently verified');
  required(Array.isArray(raw?.categories),'ESPN Site player categories unavailable');
  const filter=(raw.filters||[]).find(f=>f?.name==='seasontype');
  if(filter)required(String(filter.value)==='2','Site player feed is not regular season');
  const category=raw.categories.find(c=>c?.name==='averages'&&Array.isArray(c.names)&&Array.isArray(c.statistics));
  required(category,'Verified ESPN Site averages absent');
  const matches=category.statistics.filter(row=>Number(row?.season?.year)===year&&String(row?.teamId)===String(team));
  required(matches.length===1,'Exact year and team averages missing or ambiguous');
  const row=matches[0];
  required(Array.isArray(row.stats)&&row.stats.length===category.names.length,
    'ESPN averages source/value alignment changed');
  const source=Object.fromEntries(category.names.map((name,i)=>[name,row.stats[i]]));
  const stats={};
  for(const name of AVERAGES){
    let value=n(source[name]);
    if(name==='avgThreePointFieldGoalsMade'&&value===null){
      const mixed=String(source['avgThreePointFieldGoalsMade-avgThreePointFieldGoalsAttempted']||'').trim();
      const found=/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(mixed);
      if(found){
        const made=n(found[1]),attempted=n(found[2]);
        required(made!==null&&attempted!==null&&made<=attempted,
          'Three-point average made/attempted source malformed');
        value=made;
      }
    }
    required(value!==null,'Missing verified ESPN Site average '+name);
    stats[name]=value;
  }
  required(Number.isInteger(stats.gamesPlayed)&&stats.gamesPlayed>0,
    'Player has no verified current-season appearances');
  const root='https://sports.core.api.espn.com/v2/sports/basketball/leagues/'+league+'/seasons/'+year;
  return {
    $ref:root+'/types/2/athletes/'+athlete+'/statistics/0?lang=en&region=us',
    season:{$ref:root+'?lang=en&region=us'},
    seasonType:{$ref:root+'/types/2?lang=en&region=us'},
    splits:{id:'0',name:'Regular Season',categories:[{name:'averages',
      stats:AVERAGES.map(name=>({name,value:stats[name],displayValue:String(stats[name])}))}]},
    __mcSource:{kind:'verified-espn-site-current-season',fetchedAt:now.toISOString(),maxAgeSeconds:120},
  };
}
