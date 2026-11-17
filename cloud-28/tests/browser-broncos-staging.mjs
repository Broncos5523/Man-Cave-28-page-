import {chromium} from 'playwright';

const url='https://man-cave-28-page.broncos5523.workers.dev/staging/boards/page4_broncos.html?qa=broncos-browser-20261117-v2';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});
const errors=[],responses=[],requests=[];
page.on('console',msg=>{if(['error','warning'].includes(msg.type()))errors.push({kind:msg.type(),text:msg.text().slice(0,350)});});
page.on('pageerror',e=>errors.push({kind:'pageerror',text:String(e).slice(0,400)}));
page.on('requestfailed',request=>{if(!request.url().includes('cdn-inline'))requests.push({url:request.url().slice(0,260),failure:request.failure()?.errorText});});
page.on('response',r=>{if(/\/proxy\?|\/migration-api\/|espn-fetch-shim|page4_broncos\.html/.test(r.url()))responses.push({status:r.status(),url:r.url().slice(0,250)});});
// Avoid downloading all original picture assets; inspect data flow only.
// Approved artwork still served by static staging in production.
await page.route('**/*',route=>{
  if(route.request().resourceType()==='image')return route.abort();
  return route.continue();
});
try{
  const navigation=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  console.log('BROWSER_NAV',navigation?.status(),url);
  await page.waitForTimeout(33000);
  const state=await page.evaluate(()=>({
    shim:window.__MC_CLOUDFLARE_PUBLIC_FEED_RELAY__||null,
    fresh:document.querySelector('#fresh')?.textContent||null,
    delay:document.querySelector('#dataDelay')?.textContent||null,
    statValues:[0,1,2].map(n=>document.getElementById('statValue'+n)?.textContent),
    ticker:document.querySelector('#track')?.textContent?.trim().slice(0,350)||null,
    leaderCards:[...document.querySelectorAll('.leader-card')].slice(0,6).map(x=>x.textContent?.trim().replace(/\s+/g,' ').slice(0,120)),
    source:document.querySelector('script[src*="espn-fetch-shim"]')?.getAttribute('src')
  }));
  console.log('BROWSER_STATE',JSON.stringify(state));
  console.log('BROWSER_PROXY_REQUESTS',JSON.stringify(responses.slice(0,120)));
  console.log('BROWSER_CONSOLE_ERRORS',JSON.stringify(errors.slice(0,40)));
  console.log('BROWSER_FAILED_REQUESTS',JSON.stringify(requests.slice(0,35)));
  if(!state.shim)throw Error('Staging shim not initialized: see console');
  if(!responses.some(x=>x.status===200 && x.url.includes('/migration-api/nfl/season-stats')))throw Error('No successful ESPN current-season player stats received in actual browser');
  if(state.ticker?.includes('Loading current NFL week'))throw Error('NFL week ticker still stuck loading');
  if(state.leaderCards?.every(card=>!/\d/.test(card)))throw Error('No numeric team leader values rendered');
  console.log('PASS_REAL_BROWSER_BRONCOS_STAGING_DATA');
}finally{await browser.close();}
