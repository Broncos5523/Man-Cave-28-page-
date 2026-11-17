/* Run each approved priority board independently so one failed page does
 * not mask the other two. Existing renderer assertions remain unchanged. */
import {spawnSync} from 'node:child_process';
const boards=['page1_cbb','page2_nba','page3_broncos'];
const results=[];
for(const board of boards){
  const r=spawnSync(process.execPath,['cloud-28/tests/browser-priority-migrations.mjs'],{
    env:{...process.env,MIGRATION_BOARDS:board},
    encoding:'utf8',timeout:125000,maxBuffer:8*1024*1024
  });
  if(r.stdout)process.stdout.write(r.stdout);
  if(r.stderr)process.stderr.write(r.stderr);
  const pass=r.status===0&&!r.error;
  const item={board,pass,error:r.error?.message||(!pass?'Original renderer assertion failed (exit '+r.status+')':null)};
  results.push(item);
  console.log('BATCH_PRIORITY_RESULT',JSON.stringify(item));
}
console.log('BATCH_PRIORITY_SUMMARY',JSON.stringify({
  checked:results.length,passed:results.filter(x=>x.pass).length,results}));
if(results.some(x=>!x.pass))process.exitCode=1;
