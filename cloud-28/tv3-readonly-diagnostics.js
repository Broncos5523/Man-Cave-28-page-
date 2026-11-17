/* Onn diagnostic overlay, only with ?debug=1. Intentionally read-only.
   No Firebase SDK calls, command writes, telemetry, or modifications to the
   approved 28 v8l board designs or player rotation. */
(function(){
'use strict';
if(new URLSearchParams(location.search).get('debug')!=='1')return;
var panel=document.createElement('aside');
panel.id='mc-tv3-readonly-diagnostics';
panel.setAttribute('role','status');
panel.setAttribute('aria-label','Man Cave 32 inch Onn receiver diagnostics');
panel.style.cssText='position:fixed;left:12px;top:12px;z-index:2147483647;'+
 'max-width:min(420px,calc(100vw - 24px));width:420px;background:rgba(7,19,33,.94);'+
 'border:2px solid #44b8de;border-radius:12px;box-shadow:0 7px 22px #0009;'+
 'color:#eff9ff;padding:12px 14px;font:13px/1.42 Arial,sans-serif;'+
 'pointer-events:none;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;';
(document.body||document.documentElement).appendChild(panel);
var lastSignature='';
function text(events,name){
 var row;
 for(var i=events.length-1;i>=0;i--)if(events[i].event===name){row=events[i];break}
 return row||null;
}
function update(){
 var state=window.__MC_TV3_REMOTE__?.getState?.()||{};
 var events=window.__MC_TV3_STAGING_EVENTS__||[];
 var authOK=text(events,'auth-ok'),authBad=text(events,'auth-failed');
 var readBad=text(events,'read-failed');
 var sdkBad=text(events,'sdk-load-failed');
 var receiverBad=text(events,'receiver-error');
 var mode=state.desired||'awaiting command';
 var held=state.held||'28-board rotation';
 var lastCommand=text(events,'command-received');
 var status=state.connected?'Connected · assignment read received':
  readBad?'Firebase assignment read failed':
  authBad?'Firebase anonymous sign-in failed':
  sdkBad?'Firebase SDK failed to load':
  receiverBad?'Firebase receiver error':'Connecting to Firebase…';
 var event=events[events.length-1];
 var rows=[
  'MAN CAVE · ONN RECEIVER STATUS',
  'Firebase: '+status,
  'Assigned: '+mode,
  'On screen: '+held,
  'Rotation: '+(window.__MC_ONN_FIT_REPORT__?.mode||new URLSearchParams(location.search).get('rotate')||'off'),
  'Recent event: '+(event?event.event+(event.detail?' · '+event.detail:''):'not available')
 ];
 var err=readBad||authBad||sdkBad||receiverBad;
 if(err)rows.push('Last error: '+err.event+(err.detail?' · '+err.detail:''));
 if(lastCommand)rows.push('Last assignment update: '+new Date(lastCommand.at).toLocaleTimeString());
 rows.push('Diagnostic only · no commands sent');
 var str=rows.join('\n');
 if(str!==lastSignature){panel.textContent=str;lastSignature=str;}
}
update();
setInterval(update,1000);
})();
