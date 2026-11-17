/* TV 3 Onn receiver, standalone classic JavaScript for older Android TV browsers.
   The approved 28-board player and original Render URL remain unchanged.
   Failure of remote control never interrupts normal 28-board rotation. */
(function(){
'use strict';
var base='/production/api/tv3-report';
var config={
 apiKey:'AIzaSyCRgqYP8xB0Ftgd3TDCZE6yFBQiKzqWubg',
 authDomain:'man-cave-left-right.firebaseapp.com',
 databaseURL:'https://man-cave-left-right-default-rtdb.firebaseio.com',
 projectId:'man-cave-left-right',
 appId:'1:841015373865:web:8967640063e0af3f332c38'
};
var valid={};
var groups=[
 ['page1_nfl','page2_nfl','page3_broncos','page4_broncos'],
 ['page1_nba','page2_nba','page3_celtics','page4_celtics'],
 ['page1_nhl','page2_nhl','page3_bruins','page4_bruins'],
 ['page1_mlb','page2_mlb','page3_redsox','page4_redsox'],
 ['page1_wnba','page2_wnba','page3_fever','page4_fever'],
 ['page1_cfb','page2_cfb','page3_arizona_cfb','page4_arizona_cfb'],
 ['page1_cbb','page2_cbb','page3_arizona_cbb','page4_arizona_cbb']
];
for(var i=0;i<groups.length;i++)for(var j=0;j<groups[i].length;j++)valid[groups[i][j]]=true;
var desired=null,held='',frame=null,missingLogged=false,hasFirstCommand=false,geometryReported='';
// The approved wrestling player is already portrait 9:16 and has its own
// rotation. Keep its inner rotation OFF; the existing Onn outer stage handles it.
var externalUrls={
 wrestling:'https://broncos5523.github.io/Inside-the-squared-circle/staging/?view=tv&mode=active&rotate=none',
 upcoming:'https://caveup.pages.dev/',
 live:'https://testcave.pages.dev/'
};
function report(event,detail){
 try{
  var xhr=new XMLHttpRequest();
  xhr.open('POST',base,true);
  xhr.setRequestHeader('Content-Type','application/json');
  xhr.send(JSON.stringify({event:event,detail:String(detail||'').slice(0,90)}));
 }catch(e){}
}
window.__MC_TV3_REMOTE__={getState:function(){return {desired:desired,held:held,connected:hasFirstCommand};}};
report('boot','classic-receiver');
function getStage(){
 return window.__MC_ONN_STAGE_ELEMENT__||
   document.getElementById('stage')||
   document.querySelector('.stage');
}
function reconcile(){
 if(!desired||desired==='rotation'){
  if(frame&&frame.parentNode)frame.parentNode.removeChild(frame);
  frame=null;held='';geometryReported='';return;
 }
 if(!externalUrls[desired]&&!valid[desired])return;
 var stage=getStage();
 if(!stage){
  if(!missingLogged){report('stage-not-ready',desired);missingLogged=true;}
  return;
 }
 if(missingLogged){report('stage-recovered',desired);missingLogged=false;}
 if(!frame){
  frame=document.createElement('iframe');
  frame.id='mc-tv3-single-board';
  frame.title='Selected Man Cave sports or wrestling board';
  frame.setAttribute('allowfullscreen','');
  frame.style.cssText='position:fixed;display:block;margin:0;padding:0;border:0;background:#05090f;z-index:2147483600;visibility:visible;opacity:1';
  frame.onload=function(){
    report('board-loaded',held);
    var box=frame.getBoundingClientRect();
    report('frame-bounds',Math.round(box.width)+'x'+Math.round(box.height)+' at '+Math.round(box.left)+','+Math.round(box.top));
  };
  frame.onerror=function(){report('board-error',held);};
 }
 // Do not nest inside the original player stage. Its swap routine controls
 // all stage children and may remove or cover a nested remote iframe.
 // Use a top-level sibling and mirror its EXACT CSS size/rotation/scale.
 // This preserves the approved artwork without zooming/cropping.
 if(frame.parentNode!==document.body)document.body.appendChild(frame);
 var css=stage.style;
 frame.style.width=css.width||'100%';
 frame.style.height=css.height||'100%';
 frame.style.left=css.left||'0';
 frame.style.top=css.top||'0';
 frame.style.transformOrigin=css.transformOrigin||'center center';
 frame.style.transform=css.transform||'none';
 var signature=[frame.style.width,frame.style.height,frame.style.left,frame.style.top,frame.style.transform].join('|');
 if(signature!==geometryReported){
  geometryReported=signature;
  report('top-layer-ready',Math.round(frame.getBoundingClientRect().width)+'x'+Math.round(frame.getBoundingClientRect().height));
 }
 if(held!==desired){
  held=desired;
  frame.src=externalUrls[desired]||'/production/board/'+encodeURIComponent(desired)+'?tv3=hold';
  report('board-command-applied',desired);
 }
}
function receive(value){
 var type=value&&value.type;
 var newMode=(type==='wrestling'||type==='upcoming'||type==='live')?type:
  (type==='board'&&valid[value.board])?value.board:'rotation';
 if(desired===newMode)return;
 desired=newMode;
 report('command-received',newMode);
 reconcile();
}
function loadScripts(list,index){
 if(index===list.length){connect();return;}
 var script=document.createElement('script');
 script.src=list[index];script.async=false;
 script.onload=function(){loadScripts(list,index+1);};
 script.onerror=function(){report('sdk-load-failed',String(index));};
 document.head.appendChild(script);
}
function connect(){
 try{
  if(!window.firebase)throw new Error('Firebase compat unavailable');
  var app;
  try{app=firebase.app('man-cave-tv3');}
  catch(e){app=firebase.initializeApp(config,'man-cave-tv3');}
  app.auth().signInAnonymously().then(function(){
   report('auth-ok','anonymous');
   app.database().ref('screens/third').on('value',function(snapshot){
    hasFirstCommand=true;receive(snapshot.val());
   },function(error){report('read-failed',error.code||error.message);});
  }).catch(function(error){report('auth-failed',error.code||error.message);});
 }catch(e){report('receiver-error',e.message||String(e));}
}
setInterval(reconcile,2000);
loadScripts([
 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js'
],0);
})();