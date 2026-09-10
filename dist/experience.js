const shell = document.getElementById('appShell');
const mobileDevice = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
let immersive = false;
let fullscreenWasActive = false;
let noticeTimer;
const appleTouchDevice = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let scrollStage = null;
let lastLayout = null;
let layoutFrame = 0;

function needsDocumentScroll(){
  return appleTouchDevice && !document.fullscreenElement &&
    !navigator.standalone && !matchMedia('(display-mode: standalone)').matches;
}
function updateDocumentScroll(height){
  const enabled = needsDocumentScroll();
  if(enabled && !scrollStage){
    scrollStage = document.createElement('div');
    scrollStage.id = 'iosScrollStage';
    shell.before(scrollStage);
    scrollStage.appendChild(shell);
  }
  document.documentElement.classList.toggle('ios-document-scroll', enabled);
  if(scrollStage)scrollStage.style.setProperty('--visible-height', height+'px');
}
function scheduleLayout(){
  if(layoutFrame)return;
  layoutFrame = requestAnimationFrame(()=>{
    layoutFrame = 0;
    // 不把鍵盤或使用者頁面縮放誤判為方向改變。
    if(window.visualViewport?.scale > 1.01)return;
    if(document.activeElement?.matches('input,textarea,select'))return;
    layoutExperience();
  });
}

function tell(message){
  $('notice').textContent=message;
  clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>$('notice').textContent='',5500);
}

// CSS 旋轉後，將螢幕座標還原成元素自己的座標；拍摄及照片縮放共用。
function localPoint(event, element){
  const rect=element.getBoundingClientRect();
  if(shell.classList.contains('virtual-landscape')){
    return {x:event.clientY-rect.top,y:rect.right-event.clientX};
  }
  return {x:event.clientX-rect.left,y:event.clientY-rect.top};
}
function aimAt(x,y){
  const wrap=$('videoWrap');
  mouseX=Math.min(wrap.clientWidth,Math.max(0,x));
  mouseY=Math.min(wrap.clientHeight,Math.max(0,y));
  vf.style.left=mouseX+'px';vf.style.top=mouseY+'px';
}
function layoutExperience(){
  const width=document.documentElement.clientWidth,height=window.innerHeight;
  updateDocumentScroll(height);
  const rotate=immersive && mobileDevice && height>width;
  shell.classList.toggle('virtual-landscape',rotate);
  shell.style.setProperty('--landscape-width',height+'px');
  shell.style.setProperty('--landscape-height',width+'px');
  const w=rotate?height:width,h=rotate?width:height;
  shell.classList.toggle('compact',w>h && h<620);
  $('exitImmersive').hidden=!immersive;
  $('fullscreenButton').hidden=immersive;
  // Safari 工具列收合會改變高度；沿用相對瞄準位置，避免跳回正中央。
  if(!lastLayout || lastLayout.w!==w || lastLayout.h!==h || lastLayout.rotate!==rotate){
    stopBurst();
    const x = lastLayout ? mouseX/lastLayout.w*w : w/2;
    const y = lastLayout ? mouseY/lastLayout.h*h : h/2;
    if(lastLayout){panX*=w/lastLayout.w;panY*=h/lastLayout.h;}
    aimAt(x,y);applyZoom();
    lastLayout={w,h,rotate};
  }
}

async function enterImmersive(){
  immersive=true;$('mobilePrompt').hidden=true;
  layoutExperience();
  // 必須在按鈕的使用者手勢中呼叫，失敗時繼續使用頁面內橫向布局。
  try{
    if(!document.fullscreenElement && document.documentElement.requestFullscreen){
      await document.documentElement.requestFullscreen({navigationUI:'hide'});
    }
    if(mobileDevice && screen.orientation?.lock){await screen.orientation.lock('landscape');}
  }catch{ /* 平台限制由可操作的替代布局承接。 */ }
  layoutExperience();
  if(!document.fullscreenElement)tell('已切換操作畫面；此瀏覽器的網址列可能仍會顯示。');
}
async function exitImmersive(){
  immersive=false;stopBurst();
  try{screen.orientation?.unlock?.();}catch{}
  try{if(document.fullscreenElement)await document.exitFullscreen();}catch{}
  layoutExperience();$('fullscreenButton').focus();
}
$('enterMobile').onclick=enterImmersive;
$('fullscreenButton').onclick=enterImmersive;
$('exitImmersive').onclick=exitImmersive;
function dismissPrompt(){ $('mobilePrompt').hidden=true;$('btnStart').focus(); }
$('dismissMobile').onclick=dismissPrompt;$('stayPortrait').onclick=dismissPrompt;
document.addEventListener('fullscreenchange',()=>{
  const active=!!document.fullscreenElement;
  if(fullscreenWasActive && !active){immersive=false;try{screen.orientation?.unlock?.();}catch{}}
  fullscreenWasActive=active;layoutExperience();
});
window.addEventListener('resize',scheduleLayout);
window.visualViewport?.addEventListener('resize',scheduleLayout);
screen.orientation?.addEventListener('change',scheduleLayout);
document.addEventListener('focusout',scheduleLayout);
window.addEventListener('blur',stopBurst);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopBurst();video.pause();}});

$('btnStart').onclick=()=>{
  // 在手勢當下啟動播放，避免轉場計時器讓 iOS 丟失播放授權。
  video.play().catch(()=>{$('videoStatus').textContent='點「播放」開始觀察。';});
  flipTo('page-shoot',()=>{lastLayout=null;layoutExperience();});
};
function changeZoom(f,x=mouseX,y=mouseY){
  const nz=Math.min(ZOOM_MAX,Math.max(ZOOM_MIN,zoom*f));
  panX=x-(x-panX)*nz/zoom;panY=y-(y-panY)*nz/zoom;zoom=nz;applyZoom();
}
$('zoomIn').onclick=()=>changeZoom(1.25);
$('zoomOut').onclick=()=>changeZoom(1/1.25);
$('btnPause').onclick=()=>{
  if(video.paused){video.play().catch(()=>tell('影片尚未就緒，請稍候再試。'));}
  else{stopBurst();video.pause();}
};
function updatePlayback(){ $('btnPause').textContent=video.paused?'播放':'暫停'; }
video.addEventListener('play',updatePlayback);video.addEventListener('pause',updatePlayback);
video.addEventListener('waiting',()=>{$('videoStatus').textContent='影片緩衝中…';});
video.addEventListener('loadstart',()=>{$('videoStatus').textContent='正在載入調查影片…';});
video.addEventListener('canplay',()=>{$('videoStatus').textContent='';updatePlayback();});
video.addEventListener('playing',()=>{$('videoStatus').textContent='';});
let compatibleSource=false;
video.addEventListener('error',()=>{
  stopBurst();
  if(!compatibleSource){
    compatibleSource=true;video.src='survey_video.mp4';video.load();
    $('videoStatus').textContent='正在改用相容格式，載入後按播放。';
  }else{$('videoStatus').textContent='影片無法載入。請確認伺服器與影片檔案，重新整理後再試。';}
});

function startBurst(){
  if(flipping || !$('page-shoot').classList.contains('active') || $('shootEndOverlay').style.display==='flex')return;
  stopBurst();takePhoto();burstTimer=setInterval(takePhoto,90);
}
const surface=$('videoWrap'),touches=new Map();
surface.addEventListener('pointerdown',e=>{
  if(e.button!==0 || $('shootEndOverlay').style.display==='flex')return;
  e.preventDefault();surface.setPointerCapture(e.pointerId);
  const p=localPoint(e,surface);touches.set(e.pointerId,p);aimAt(p.x,p.y);
  if(e.pointerType==='mouse')startBurst();
});
surface.addEventListener('pointermove',e=>{
  const p=localPoint(e,surface);
  if(e.pointerType==='mouse'){aimAt(p.x,p.y);return;}
  if(!touches.has(e.pointerId))return;
  if(touches.size===2){
    const old=touches.get(e.pointerId),other=[...touches.entries()].find(([id])=>id!==e.pointerId)[1];
    const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(p.x-other.x,p.y-other.y);
    if(before>4)changeZoom(after/before,(p.x+other.x)/2,(p.y+other.y)/2);
  }else{aimAt(p.x,p.y);}
  touches.set(e.pointerId,p);
});
['pointerup','pointercancel','lostpointercapture'].forEach(type=>surface.addEventListener(type,e=>{touches.delete(e.pointerId);stopBurst();}));
surface.addEventListener('wheel',e=>{
  if($('shootEndOverlay').style.display==='flex')return;
  e.preventDefault();const p=localPoint(e,surface);aimAt(p.x,p.y);changeZoom(e.deltaY<0?1.18:1/1.18,p.x,p.y);
},{passive:false});
$('shutterButton').addEventListener('pointerdown',e=>{
  if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);startBurst();
});
['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('shutterButton').addEventListener(type,stopBurst));
// 鍵盤與輔助科技觸發 click 時仍可拍攝，滑鼠及觸控由 pointerdown 接手。
$('shutterButton').addEventListener('click',e=>{if(e.detail===0)takePhoto();});
document.addEventListener('pointerup',stopBurst);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(!$('mobilePrompt').hidden)dismissPrompt();
    else if(!$('lightbox').classList.contains('open') && immersive)exitImmersive();
  }
  if(e.code==='Space' && e.target===document.body && $('page-shoot').classList.contains('active')){
    e.preventDefault();if(!e.repeat)startBurst();
  }
  const modal=!$('mobilePrompt').hidden?$('mobilePrompt'):$('lightbox').classList.contains('open')?$('lightbox'):null;
  if(modal && e.key==='Tab'){
    const items=[...modal.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
  }
});
document.addEventListener('keyup',e=>{if(e.code==='Space')stopBurst();});
$('btnPrint').onclick=()=>window.print();
document.querySelectorAll('.form-row>label').forEach(label=>{
  const input=label.parentElement.querySelector('input,select');if(input)label.htmlFor=input.id;
});
document.querySelectorAll('#fBehavior input').forEach((input,i)=>{input.id='behavior-'+i;});
$('fRecorder').maxLength=80;
$('btnPrevInd').setAttribute('aria-label','上一個個體');$('btnNextInd').setAttribute('aria-label','下一個個體');
$('lbDbPrev').setAttribute('aria-label','上一張待審照片');$('lbDbNext').setAttribute('aria-label','下一張待審照片');
if(mobileDevice){
  $('shootTopbar').querySelector('.hint').textContent='拖動瞄準 · ＋ / − 變焦 · 按快門拍攝';
  $('mobilePrompt').hidden=false;setTimeout(()=>$('enterMobile').focus(),0);
}
layoutExperience();updatePlayback();

// 支援 WebMCP 的瀏覽器可读取同一份現場進度；一般瀏覽器不受影響。
if(document.modelContext?.registerTool){
  const lifetime=new AbortController();
  try{
    Promise.resolve(document.modelContext.registerTool({
      name:'read_survey_progress',title:'讀取調查練習進度',
      description:'讀取目前畫面、拍攝、保留及練習配對數量，不修改資料。',
      inputSchema:{type:'object',properties:{},additionalProperties:false},
      annotations:{readOnlyHint:true,untrustedContentHint:false},
      execute(input){
        if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).length)throw new Error('此工具不接受參數');
        return {stage:document.querySelector('.page.active')?.id,photos:photos.length,kept:keptIds.length,matches:Object.keys(matches).length,educationalOnly:true};
      }
    },{signal:lifetime.signal})).catch(()=>{});
  }catch{}
  window.addEventListener('pagehide',()=>lifetime.abort(),{once:true});
}
