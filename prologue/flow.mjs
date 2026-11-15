const $=id=>document.getElementById(id),film=$('film'),tutorial=$('tutorial'),veil=$('veil');
let config={},ready=false,activated=false,stage='intro',busy=false,finished=false,lastRecord=null,pendingExit=null;
let readyResolve,activeResolve;
const readyPromise=new Promise(r=>readyResolve=r),activePromise=new Promise(r=>activeResolve=r);
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const status=text=>$('status').textContent=text;
function fade(value,ms){return new Promise(resolve=>{veil.style.transitionDuration=(reduced?0:ms)+'ms';veil.style.opacity=String(value);setTimeout(resolve,reduced?0:ms+80);});}
function setStage(s){stage=s;document.body.dataset.stage=s;document.title='Lodestar · '+s;}
async function enterTraining(){
 if(busy||stage!=='intro')return;busy=true;
 setStage('warming tutorial');await fade(1,700);film.pause();
 if(!ready){status('Preparing training…');$('status').hidden=false;}
 await readyPromise;$('status').hidden=true;
 film.hidden=true;tutorial.style.opacity='1';tutorial.setAttribute('aria-hidden','false');
 tutorial.contentWindow.postMessage({type:'lodestar:tutorial-activate'},location.origin);
 await activePromise;setStage('training');$('skip').hidden=true;$('sound').hidden=true;
 await fade(0,1100);tutorial.style.pointerEvents='auto';tutorial.contentWindow.focus();busy=false;
 if(pendingExit){const record=pendingExit;pendingExit=null;exitTraining(record);}
}
async function exitTraining(record){
 if(stage!=='training')return;if(busy){pendingExit=record;return;}busy=true;lastRecord=record;
 tutorial.contentWindow.postMessage({type:'lodestar:tutorial-suspend'},location.origin);
 await fade(1,400);tutorial.style.pointerEvents='none';tutorial.style.opacity='0';tutorial.setAttribute('aria-hidden','true');
 setStage('tutorial exit');film.hidden=false;film.src=config.transitionVideo;film.muted=false;
 $('skip').textContent='Skip transition ↗';$('skip').hidden=false;$('sound').hidden=false;$('sound').textContent='Mute';
 film.onended=finish;film.onerror=()=>{status('Transition unavailable. Continue to the mission.');$('status').hidden=false;$('continue').hidden=false;};
 await fade(0,400);if(finished)return;film.play().catch(()=>{status('Press Play transition, or skip.');$('status').hidden=false;$('continue').textContent='Play transition';$('continue').hidden=false;});
 busy=false;
}
async function finish(){
 if(finished||stage!=='tutorial exit')return;finished=true;busy=true;await fade(1,450);film.pause();film.hidden=true;
 $('skip').hidden=true;$('sound').hidden=true;$('continue').hidden=true;$('status').hidden=true;
 const detail={type:'lodestar:prologue-complete',version:1,training:lastRecord,reason:'tutorial-exit-complete'};
 window.dispatchEvent(new CustomEvent('lodestar:prologue-complete',{detail}));
 if(parent!==window)parent.postMessage(detail,location.origin);
 if(config.storyUrl){const url=new URL(config.storyUrl,location.href);url.searchParams.set('from','training');url.searchParams.set('status',lastRecord?.status||'skipped');location.assign(url.href);return;}
 setStage('integration checkpoint');$('checkpoint').hidden=false;await fade(0,400);busy=false;
}
addEventListener('message',e=>{
 if(e.source!==tutorial.contentWindow||e.origin!==location.origin)return;
 if(e.data?.type==='lodestar:tutorial-ready'){ready=true;document.body.dataset.tutorialReady='true';readyResolve();}
 if(e.data?.type==='lodestar:tutorial-active'){activated=true;activeResolve();}
 if(e.data?.type==='lodestar:tutorial-error'){status('Training assets could not load. Reload to retry.');$('status').hidden=false;}
 if(e.data?.type==='lodestar:training-complete')exitTraining(e.data.record);
});
$('skip').onclick=()=>stage==='intro'?enterTraining():finish();
$('sound').onclick=()=>{film.muted=!film.muted;$('sound').textContent=film.muted?'Enable sound':'Mute';film.play().catch(()=>{});};
$('continue').onclick=()=>{if(film.error){finish();return;}film.play().then(()=>{$('continue').hidden=true;$('status').hidden=true;}).catch(()=>{});};
film.onended=enterTraining;film.onerror=()=>{status('Opening unavailable. Use Skip intro to enter training.');$('status').hidden=false;};
film.ontimeupdate=()=>{if(stage==='intro'&&Number.isFinite(film.duration)&&film.duration-film.currentTime<.75&&!busy)enterTraining();};
fetch('flow-config.json').then(r=>{if(!r.ok)throw Error('Flow configuration unavailable');return r.json();}).then(c=>{config=c;film.src=config.introVideo;film.play().catch(()=>{status('Enable sound to play, or skip intro.');$('status').hidden=false;});tutorial.src='training.html?v=8';}).catch(e=>{status(e.message);$('status').hidden=false;});
