/* TV 3 receiver: adds Firebase control to the EXISTING Render 28-page URL.
   Never alters the approved player, board source, rotation order, or timing.
   An unassigned/unauthenticated TV always keeps rotating normally. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getDatabase,ref,onValue} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import {getAuth,signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const app=initializeApp({
  apiKey:'AIzaSyCRgqYP8xB0Ftgd3TDCZE6yFBQiKzqWubg',
  authDomain:'man-cave-left-right.firebaseapp.com',
  databaseURL:'https://man-cave-left-right-default-rtdb.firebaseio.com',
  projectId:'man-cave-left-right',
  appId:'1:841015373865:web:8967640063e0af3f332c38'
},'man-cave-tv3');
const db=getDatabase(app);
const auth=getAuth(app);
const valid=new Set([
  'page1_nfl','page2_nfl','page3_broncos','page4_broncos',
  'page1_nba','page2_nba','page3_celtics','page4_celtics',
  'page1_nhl','page2_nhl','page3_bruins','page4_bruins',
  'page1_mlb','page2_mlb','page3_redsox','page4_redsox',
  'page1_wnba','page2_wnba','page3_fever','page4_fever',
  'page1_cfb','page2_cfb','page3_arizona_cfb','page4_arizona_cfb',
  'page1_cbb','page2_cbb','page3_arizona_cbb','page4_arizona_cbb'
]);

let overlay=null,held='';
function findStage(){return document.getElementById('stage')||document.querySelector('.stage');}
function resume(){
  if(overlay){overlay.remove();overlay=null;}
  held='';
  document.documentElement.dataset.mcTv3Mode='rotation';
}
async function hold(id){
  if(!valid.has(id))return;
  let stage=findStage();
  // The original player builds its stage via deferred JS. Never interrupt it.
  for(let i=0;!stage&&i<30;i++){
    await new Promise(resolve=>setTimeout(resolve,250));
    stage=findStage();
  }
  if(!stage){console.warn('TV 3: approved player stage not found; retaining rotation');return;}
  if(overlay&&held===id)return;
  if(!overlay){
    overlay=document.createElement('iframe');
    overlay.id='mc-tv3-single-board';
    overlay.title='TV 3 selected approved board';
    overlay.setAttribute('allowfullscreen','');
    overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;background:#05090f;z-index:2147483600;display:block';
    stage.appendChild(overlay);
  }
  held=id;
  overlay.src='/production/board/'+encodeURIComponent(id)+'?tv3=hold';
  document.documentElement.dataset.mcTv3Mode='held';
}
try{
  await signInAnonymously(auth);
  onValue(ref(db,'screens/third'),snapshot=>{
    const v=snapshot.val();
    if(!v||v.type==='rotation'){resume();return;}
    if(v.type==='board'&&typeof v.board==='string'&&valid.has(v.board)){
      hold(v.board).catch(e=>console.warn('TV 3 hold failed:',e));
    }
  },error=>console.warn('TV 3 Firebase receiver unavailable; rotation continues:',error.code||error.message));
}catch(error){
  // Fail open: existing 28-board automatic rotation is never blocked.
  console.warn('TV 3 remote sign-in unavailable; original rotation continues:',error.code||error.message);
}
