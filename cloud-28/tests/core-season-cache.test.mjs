import test from 'node:test';import assert from 'node:assert/strict';
import {coreKey,validatedCoreEntry} from '../core-season-cache.mjs';
const now=Date.parse('2026-11-17T17:00:00Z');
const url='https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2027/types/2/teams/2/statistics';
const key=coreKey(url);
function fixture(){const data={
  $ref:url+'?lang=en&region=us',season:{$ref:'http://sports.core.api.espn.pvt/v2/sports/basketball/leagues/nba/seasons/2027?lang=en'},
  seasonType:{$ref:'http://sports.core.api.espn.pvt/v2/sports/basketball/leagues/nba/seasons/2027/types/2?lang=en'},
  splits:{categories:[{name:'offensive',stats:[{name:'paceFactor',value:95.1,displayValue:'95.1'}]}]}};
  return {schema:1,entries:{[key]:{sourceUrl:url,fetchedAt:'2026-11-17T16:55:00Z',data}}};}
test('Verified fallback preserves exact source numbers, season and check time',()=>{
  const result=validatedCoreEntry(fixture(),key,now);
  assert.equal(result.splits.categories[0].stats[0].value,95.1);
  assert.equal(result.__mcSource.fetchedAt,'2026-11-17T16:55:00Z');
  assert.equal(coreKey(url+'/0?lang=en'),key);
  assert.equal(coreKey(url.replace('types/2','types/3')),null);
  assert.equal(coreKey(url.replace('sports.core.api.espn.com','evil.invalid')),null);
});
test('Expired, future, wrong-year, wrong-subject or unverified cache entries fail closed',()=>{
  for(const mutate of [
    d=>d.entries[key].fetchedAt='2026-11-17T16:44:00Z',
    d=>d.entries[key].fetchedAt='2026-11-17T17:02:00Z',
    d=>d.entries[key].data.seasonType.$ref=d.entries[key].data.seasonType.$ref.replace('2027','2026'),
    d=>d.entries[key].data.$ref=d.entries[key].data.$ref.replace('/teams/2/','/teams/3/'),
    d=>d.schema=2
  ]){const f=fixture();mutate(f);assert.throws(()=>validatedCoreEntry(f,key,now));}
});
test('Arizona Core leaders and athlete identity keep their original season-specific contracts',()=>{
  const root='https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/2026';
  const sourceUrl=root+'/types/2/teams/12/leaders',idUrl=root+'/athletes/4801717';
  const data={$ref:sourceUrl+'?lang=en',categories:['passingLeader','rushingLeader','receivingLeader','totalTackles','sacks','interceptions'].map(name=>
    ({name,leaders:[{value:3150,athlete:{$ref:idUrl+'?lang=en'}}]}))};
  const dataset={schema:1,entries:{[coreKey(sourceUrl)]:{sourceUrl,fetchedAt:'2026-11-17T16:55:00Z',data}}};
  assert.equal(validatedCoreEntry(dataset,coreKey(sourceUrl),now).categories[0].leaders[0].value,3150);
  assert.equal(coreKey(sourceUrl.replace('/teams/12/','/teams/1/')),null);
  const athlete={$ref:idUrl+'?lang=en',id:'4801717',displayName:'Noah Fifita',team:{$ref:root+'/teams/12?lang=en'}};
  dataset.entries[coreKey(idUrl)]={sourceUrl:idUrl,fetchedAt:'2026-11-17T16:55:00Z',data:athlete};
  assert.equal(validatedCoreEntry(dataset,coreKey(idUrl),now).displayName,'Noah Fifita');
  athlete.team.$ref=root+'/teams/1?lang=en';assert.throws(()=>validatedCoreEntry(dataset,coreKey(idUrl),now));
});
