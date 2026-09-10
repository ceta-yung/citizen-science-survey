
/* ================= 資料 ================= */
const DB = SURVEY_INDIVIDUALS;
const IND_IDS = Object.keys(DB);
const dbSrc = (ind, file) => "crops/" + ind + "/" + encodeURIComponent(file);
// 拍攝張數與選用張數皆不設限（2026-08-10 用戶要求）

/* ================= 狀態 ================= */
let photos = [];            // {id, dataUrl, time, discarded}
// 「待審」＝還沒被刪除、也還沒放進紀錄表的照片（放大視窗只在這些之間導覽）
const isPending = p => !p.discarded && !keptIds.includes(p.id);
// 拍攝倍率標示（所有倍率共用同一種樣式，不特別highlight）
const zoomOf = p => (p && p.zoom) ? p.zoom : 1;
const zoomLabel = p => zoomOf(p).toFixed(1) + "×";
let keptIds = [];           // 保留進紀錄表的照片（依放入順序，張數不限）
let matches = {};           // photoId -> individual id
let curInd = 0;             // 目前書頁個體索引
let record = {};
let flipping = false;

const $ = id => document.getElementById(id);
const photoById = id => photos.find(p => p.id === id);

/* ================= 音效（WebAudio 合成快門聲） ================= */
let audioCtx = null;
function playShutter(){
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    // 兩段短促 click 模擬快門簾
    [[0,.012,2600],[.045,.018,1400]].forEach(([dt,dur,freq])=>{
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(.28, t+dt);
      g.gain.exponentialRampToValueAtTime(.001, t+dt+dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t+dt); o.stop(t+dt+dur+.01);
    });
  }catch(e){}
}
function playFlip(){
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const len = audioCtx.sampleRate * .35;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 2.2) * .5;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const f = audioCtx.createBiquadFilter(); f.type="bandpass"; f.frequency.value=2600; f.Q.value=.7;
    const g = audioCtx.createGain(); g.gain.value = .5;
    src.connect(f).connect(g).connect(audioCtx.destination); src.start(t);
  }catch(e){}
}

/* ================= 翻頁 ================= */
function flipTo(pageId, after){
  if(flipping) return; flipping = true;
  stopBurst();
  // 安靜的頁面轉場
  const cur = document.querySelector(".page.active");
  const next = $(pageId);
  next.classList.add("active","flip-in");
  cur.classList.add("flip-out");
  setTimeout(()=>{
    cur.classList.remove("active","flip-out");
    next.classList.remove("flip-in");
    flipping = false;
    if(after) after();
  }, 220);
}

/* ================= 第一階段：拍攝 ================= */
const video = $("surveyVideo"), vf = $("viewfinder");



let mouseX = 0, mouseY = 0;
let burstTimer = null;
function stopBurst(){ if(burstTimer){ clearInterval(burstTimer); burstTimer = null; } }
const ZOOM_MIN = 1, ZOOM_MAX = 6;
let zoom = 1, panX = 0, panY = 0;
function applyZoom(){
  const W = $('videoWrap').clientWidth, H = $('videoWrap').clientHeight;
  panX = Math.min(0, Math.max(W - W*zoom, panX));
  panY = Math.min(0, Math.max(H - H*zoom, panY));
  video.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`;
  $('vfZoom').textContent = zoom.toFixed(1) + '×';
  $('zoomReadout').textContent = zoom.toFixed(1) + '×';
}
function resetZoom(){ zoom = 1; panX = 0; panY = 0; applyZoom(); }
let lastShot = 0;
function takePhoto(){
  if(!$('page-shoot').classList.contains('active') || $('shootEndOverlay').style.display === 'flex') return;
  const now = performance.now();
  if(now - lastShot < 80) return;    // 防手抖連拍（放寬至 80ms，可連拍挑最銳利的一格）
  lastShot = now;
  if(video.readyState < 2) return;
  // 只擷取觀景窗框住的範圍：把觀景窗的螢幕矩形映射回影片原始像素座標
  const VF_W = vf.offsetWidth, VF_H = vf.offsetHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  const W = $("videoWrap").clientWidth, H = $("videoWrap").clientHeight;
  const s0 = Math.min(W/vw, H/vh), ox = (W - vw*s0)/2, oy = (H - vh*s0)/2;
  const sx = ((mouseX - VF_W/2 - panX)/zoom - ox)/s0;
  const sy = ((mouseY - VF_H/2 - panY)/zoom - oy)/s0;
  const sw = VF_W/zoom/s0, sh = VF_H/zoom/s0;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw)); c.height = Math.max(1, Math.round(sh));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height);
  // 與影片範圍取交集，框到畫面外的部分留黑（如同拍到鏡頭外）
  const ix0 = Math.max(0, sx), iy0 = Math.max(0, sy);
  const ix1 = Math.min(vw, sx + sw), iy1 = Math.min(vh, sy + sh);
  if(ix1 > ix0 && iy1 > iy0){
    ctx.drawImage(video, ix0, iy0, ix1-ix0, iy1-iy0, ix0-sx, iy0-sy, ix1-ix0, iy1-iy0);
  }
  // 無損保存：擷取範圍本來就不大（1× 約 800×500、變焦後更小），
  // 用 PNG 免掉 JPEG 壓縮與色度取樣的損失，讓後續放大檢視盡可能清晰
  const dataUrl = c.toDataURL("image/png");
  // 一併記下拍攝倍率與實際擷取像素，供審查時標示（變焦越大，裁下來的像素越少）
  photos.push({ id: "P" + (photos.length+1), dataUrl, time: video.currentTime,
                zoom: zoom, px: c.width + "×" + c.height, discarded: false });
  playShutter();
  const img = document.createElement("img");
  img.src = dataUrl;
  // 縮圖是 data URL，appendChild 當下寬度還是 0，要等載入後才捲得到底
  img.onload = () => { const fs = $("filmStrip"); fs.scrollLeft = fs.scrollWidth; };
  $("filmStrip").appendChild(img);
  updateShootCount();
}
function updateShootCount(){
  const fs = $("filmStrip");
  fs.classList.toggle("dense", photos.length > 10);
  $("filmCount").textContent = photos.length + " 張";
  $("vfCount").textContent = "已拍 " + photos.length + " 張";
  fs.scrollLeft = fs.scrollWidth;   // 張數不限，永遠把最新一張捲進視野
}

$("btnMute").onclick = e => {
  video.muted = !video.muted;
  e.currentTarget.textContent = video.muted ? "開啟音訊" : "關閉音訊";
};

/* 慢速切換：擊浪瞬間很短，降速讓每一格停留更久好瞄準（只改播放速率，不動影片檔） */
const SPEEDS = [1, .5, .25];
let speedIdx = 0;
function applySpeed(){
  video.playbackRate = SPEEDS[speedIdx];
  const b = $("btnSpeed");
  b.textContent = " " + SPEEDS[speedIdx].toFixed(2).replace(/0$/,"").replace(/\.$/,"") + "×";
  b.classList.toggle("slow", speedIdx > 0);
}
$("btnSpeed").onclick = () => { speedIdx = (speedIdx + 1) % SPEEDS.length; applySpeed(); };
video.addEventListener("ended", showShootEnd);
$("btnEndShoot").onclick = showShootEnd;

function showShootEnd(){
  stopBurst();
  video.pause();
  const ov = $("shootEndOverlay");
  ov.style.display = "flex";
  if(photos.length === 0){
    $("endTitle").textContent = "沒有拍到照片";
    $("endDesc").textContent = "海況不佳嗎？重新播放影片，按左鍵試著拍下鯨豚吧。";
    $("btnToReview").style.display = "none";
  }else{
    $("endTitle").textContent = "調查航次結束";
    $("endDesc").textContent = "本航次共拍攝 " + photos.length + " 張照片，回研究室整理吧！";
    $("btnToReview").style.display = "";
  }
}
$("btnReplay").onclick = () => {
  photos = []; keptIds = [];
  $("filmStrip").querySelectorAll("img").forEach(i=>i.remove());
  updateShootCount();
  resetZoom();
  speedIdx = 0; applySpeed();
  $("shootEndOverlay").style.display = "none";
  video.currentTime = 0; video.play().catch(()=>{});
};
$("btnToReview").onclick = () => {
  buildReviewPage();
  flipTo("page-review");
};

/* ================= 第二階段：篩選 + 紀錄表 ================= */
function buildReviewPage(){
  $("fDate").value = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  const grid = $("reviewGrid");
  grid.innerHTML = "";
  photos.forEach(p => {
    const card = document.createElement("div");
    card.className = "photo-card";
    card.dataset.pid = p.id;
    card.draggable = true; card.tabIndex = 0; card.setAttribute("role", "button"); card.setAttribute("aria-label", `檢視照片 ${p.id}`); card.onkeydown = e => { if(e.target === card && (e.key === "Enter" || e.key === " ")){e.preventDefault(); openLightboxSingle(p.id);} };
    card.innerHTML = `
      <img src="${p.dataUrl}" alt="${p.id}">
      <span class="badge">${p.id}</span>
      <span class="zbadge">${zoomLabel(p)}</span>
      <div class="card-tools">
        <button class="zoom" title="放大檢視">🔍</button>
        <button class="del" title="丟棄 / 復原">✕</button>
      </div>`;
    card.onclick = () => openLightboxSingle(p.id);
    card.querySelector(".zoom").onclick = ev => { ev.stopPropagation(); openLightboxSingle(p.id); };
    card.querySelector(".del").onclick = ev => {
      ev.stopPropagation();
      p.discarded = !p.discarded;
      if(p.discarded) unkeepPhoto(p.id);
      refreshReviewCards();
    };
    card.addEventListener("dragstart", ev => {
      if(p.discarded){ ev.preventDefault(); return; }
      ev.dataTransfer.setData("text/plain", p.id);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    grid.appendChild(card);
  });
  renderDropZone();
  refreshReviewCards();
}
function keepPhoto(pid){
  const p = photoById(pid);
  if(!p || p.discarded || keptIds.includes(pid)) return;
  keptIds.push(pid);
  renderDropZone(); refreshReviewCards();
}
function unkeepPhoto(pid){
  keptIds = keptIds.filter(x => x !== pid);
  renderDropZone(); refreshReviewCards();
}
function renderDropZone(){
  const z = $("dropZone");
  if(!keptIds.length){
    z.innerHTML = '<div class="dz-hint"> 將要用的照片拖曳到這裡<br>（或點照片放大後按「保留」）</div>';
  }else{
    z.innerHTML = '<div class="dz-grid">' + keptIds.map(pid => `
      <div class="dz-item"><img src="${photoById(pid).dataUrl}" title="${pid}"><button data-pid="${pid}">✕</button></div>`).join("") + '</div>';
    z.querySelectorAll("button").forEach(b => b.onclick = () => unkeepPhoto(b.dataset.pid));
  }
}
{
  const dz = $("dropZone");
  dz.addEventListener("dragover", ev => { ev.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
  dz.addEventListener("drop", ev => {
    ev.preventDefault(); dz.classList.remove("drag-over");
    keepPhoto(ev.dataTransfer.getData("text/plain"));
  });
}
function refreshReviewCards(){
  document.querySelectorAll("#reviewGrid .photo-card").forEach(card => {
    const p = photoById(card.dataset.pid);
    card.classList.toggle("discarded", p.discarded);
    const used = keptIds.includes(p.id);
    card.classList.toggle("used", used);
    card.querySelector(".badge").textContent = used ? p.id + " ✓ 已選用" : p.id;
  });
  const dropped = photos.filter(p => p.discarded).length;
  const pend = photos.filter(isPending).length;
  $("reviewCount").textContent =
    `（共 ${photos.length} 張 · 已保留 ${keptIds.length} · 已刪除 ${dropped} · 待審 ${pend}）`;
}

$("btnConfirmRecord").onclick = () => {
  const err = [];
  if(keptIds.length === 0) err.push("請至少保留 1 張照片");
  if(!$("fDate").value) err.push("請填調查日期");
  if(!$("fRecorder").value.trim()) err.push("請填紀錄者");
  if(!$("fSpecies").value) err.push("請選物種");
  if(!Number.isSafeInteger(+$("fCount").value) || +$("fCount").value < 1) err.push("請填大於零的整數族群數量");
  if(err.length){
    $("formErr").textContent = "⚠ " + err.join("、");
    const sheet = $("recordSheet");
    sheet.classList.remove("shake"); void sheet.offsetWidth; sheet.classList.add("shake");
    return;
  }
  $("formErr").textContent = "";
  record = {
    date: $("fDate").value,
    recorder: $("fRecorder").value.trim(),
    species: $("fSpecies").value,
    count: $("fCount").value,
    behaviors: [...document.querySelectorAll("#fBehavior input:checked")].map(c=>c.value)
  };
  buildMatchPage();
  flipTo("page-match");
};

/* ================= 第三階段：個體比對 ================= */
const selectedIds = () => [...keptIds];
let selectedMyPid = null;   // 中欄目前檢視的我的照片
let bzIdx = 0, bzOpen = false;

/* 可縮放檢視器：滾輪縮放（以游標為中心）、拖曳平移、雙擊重置 */
function makeZoomView(box, indEl){
  const stage = box.querySelector('.zoom-stage');
  let z = 1, tx = 0, ty = 0;
  const pointers = new Map();
  function apply(){
    stage.style.transform = `translate(${tx}px,${ty}px) scale(${z})`;
    if(indEl) indEl.textContent = z.toFixed(1) + '×';
  }
  function reset(){z=1;tx=0;ty=0;apply();}
  function scaleBy(f, x=box.clientWidth/2, y=box.clientHeight/2){
    const nz = Math.min(8,Math.max(1,z*f));
    tx = x-(x-tx)*nz/z; ty=y-(y-ty)*nz/z; z=nz;
    if(z===1){tx=0;ty=0;} apply();
  }
  const toolbar = document.createElement('div'); toolbar.className='zoom-toolbar';
  toolbar.innerHTML='<button type="button" aria-label="縮小照片">−</button><button type="button" aria-label="重置照片縮放">重置</button><button type="button" aria-label="放大照片">＋</button>';
  box.appendChild(toolbar);
  const buttons=toolbar.querySelectorAll('button');
  buttons[0].onclick=()=>scaleBy(1/1.3); buttons[1].onclick=reset; buttons[2].onclick=()=>scaleBy(1.3);
  box.addEventListener('wheel',e=>{e.preventDefault();const p=localPoint(e,box);scaleBy(e.deltaY<0?1.2:1/1.2,p.x,p.y);},{passive:false});
  box.addEventListener('pointerdown',e=>{
    if(e.target.closest('button'))return;
    e.preventDefault();box.setPointerCapture(e.pointerId);pointers.set(e.pointerId,localPoint(e,box));
  });
  box.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    const old=pointers.get(e.pointerId), next=localPoint(e,box);
    if(pointers.size===2){
      const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];
      const before=Math.hypot(old.x-other.x,old.y-other.y), after=Math.hypot(next.x-other.x,next.y-other.y);
      if(before>4)scaleBy(after/before,(next.x+other.x)/2,(next.y+other.y)/2);
    }else if(z>1){tx+=next.x-old.x;ty+=next.y-old.y;apply();}
    pointers.set(e.pointerId,next);
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>box.addEventListener(type,e=>pointers.delete(e.pointerId)));
  box.addEventListener('dblclick',e=>{if(!e.target.closest('button'))reset();});
  apply();return {reset};
}

const myView = makeZoomView($("myViewerBox"), $("myZoomInd"));
const bzView = makeZoomView($("bzBox"), $("bzZoomInd"));

function buildMatchPage(){
  matches = {}; curInd = 0; selectedMyPid = null;
  bzOpen = false; $("bhZoom").style.display = "none";
  renderMyPhotos();
  selectMyPhoto(selectedIds()[0] || null);
  renderBookHalf();
}
function renderMyPhotos(){
  const list = $("myPhotoList");
  list.innerHTML = "";
  selectedIds().forEach(pid => {
    const p = photoById(pid);
    const d = document.createElement("div");
    d.tabIndex = 0; d.setAttribute("role", "button"); d.setAttribute("aria-label", `比對照片 ${pid}`); d.onkeydown = e => {if(e.target===d && (e.key==="Enter" || e.key===" ")){e.preventDefault(); selectMyPhoto(pid);}}; d.className = "my-photo"; d.dataset.pid = pid;
    d.innerHTML = `
      <img src="${p.dataUrl}" alt="${pid}">
      <div class="match-tag"><span>→ <b class="mt-id"></b></span><button>解除</button></div>`;
    d.onclick = () => selectMyPhoto(pid);
    d.querySelector(".match-tag button").onclick = ev => {
      ev.stopPropagation();
      delete matches[pid];
      refreshMatchUI();
    };
    list.appendChild(d);
  });
}
function selectMyPhoto(pid){
  selectedMyPid = pid;
  const img = $("myViewerImg");
  if(pid){
    img.style.display = "";
    img.src = photoById(pid).dataUrl;
    $("viewerEmpty").style.display = "none";
    myView.reset();
  }else{
    img.style.display = "none";
    $("viewerEmpty").style.display = "";
  }
  refreshMatchUI();
}
function renderBookHalf(){
  const ind = IND_IDS[curInd], files = DB[ind];
  $("bhPage").innerHTML = `
    <h4> ${ind}</h4>
    <div class="id-sub">個體目錄 · 歷年背鰭照片 ${files.length} 張 · 點縮圖放大</div>
    <div class="db-grid">${files.map((f,i)=>`
      <div class="db-thumb" data-idx="${i}">
        <img src="${dbSrc(ind,f)}" loading="lazy" alt="${ind}">
        <div class="cap">${f.slice(0,8)}</div>
      </div>`).join("")}
    </div>
    <div class="bh-matched" id="bhMatched"></div>`;
  $("bhPage").querySelectorAll(".db-thumb").forEach(t => {
    t.tabIndex = 0; t.setAttribute("role", "button"); t.setAttribute("aria-label", `放大目錄照片 ${+t.dataset.idx+1}`); t.onclick = () => openBhZoom(+t.dataset.idx); t.onkeydown = e => {if(e.key==="Enter" || e.key===" "){e.preventDefault();t.click();}};
  });
  refreshMatchUI();
}
function openBhZoom(i){
  bzOpen = true; bzIdx = i;
  $("bhZoom").style.display = "flex";
  renderBhZoom();
}
function renderBhZoom(){
  const ind = IND_IDS[curInd], files = DB[ind];
  bzIdx = (bzIdx + files.length) % files.length;
  $("bzImg").src = dbSrc(ind, files[bzIdx]);
  $("bzTag").textContent = `${ind}（${bzIdx+1}/${files.length}）`;
  bzView.reset();
}
$("bzBack").onclick = () => { bzOpen = false; $("bhZoom").style.display = "none"; };
$("bzPrev").onclick = () => { bzIdx--; renderBhZoom(); };
$("bzNext").onclick = () => { bzIdx++; renderBhZoom(); };

$("btnPair").onclick = () => {
  if(!selectedMyPid) return;
  const ind = IND_IDS[curInd];
  if(matches[selectedMyPid] === ind) delete matches[selectedMyPid];   // 再按一次 = 解除
  else matches[selectedMyPid] = ind;
  refreshMatchUI();
};

function refreshMatchUI(){
  const ind = IND_IDS[curInd];
  document.querySelectorAll(".my-photo").forEach(d => {
    const pid = d.dataset.pid, m = matches[pid];
    d.classList.toggle("matched", !!m);
    d.classList.toggle("selected", pid === selectedMyPid);
    if(m) d.querySelector(".mt-id").textContent = m;
  });
  $("viewerTitle").textContent = selectedMyPid
    ? selectedMyPid + (matches[selectedMyPid] ? " · 已配對 " + matches[selectedMyPid] : "")
    : "尚未選擇照片";
  const btn = $("btnPair");
  const paired = selectedMyPid && matches[selectedMyPid] === ind;
  btn.disabled = turning || !selectedMyPid;
  btn.classList.toggle("paired", !!paired);
  btn.innerHTML = paired ? "解除<br>配對" : "練習<br>配對";
  $("pairHint").innerHTML = !selectedMyPid ? "先點選左欄照片"
    : paired ? `${selectedMyPid} ⇄ ${ind}<br>已配對 ✓`
    : `${selectedMyPid} 是<br>${ind} 嗎？`;
  const bm = $("bhMatched");
  if(bm){
    const mine = Object.entries(matches).filter(([,v]) => v === ind).map(([k]) => k);
    bm.innerHTML = mine.length ? `
      <div class="bm-title">✓ 已配對到 ${ind} 的照片</div>
      <div class="matched-strip">${mine.map(pid=>`
        <div class="m-item"><img src="${photoById(pid).dataUrl}" title="${pid}"><button data-pid="${pid}">✕</button></div>`).join("")}
      </div>` : "";
    bm.querySelectorAll("button").forEach(b => b.onclick = () => { delete matches[b.dataset.pid]; refreshMatchUI(); });
  }
  $("pageIndicator").textContent = `個體 ${curInd+1} / ${IND_IDS.length}`;
  $("btnPrevInd").disabled = turning || curInd === 0;
  $("btnNextInd").disabled = turning || curInd === IND_IDS.length-1;
  renderDots();
}
function renderDots(){
  const dots = $("pageDots");
  dots.innerHTML = "";
  IND_IDS.forEach((ind,i) => {
    const d = document.createElement("button"); d.setAttribute("aria-label", "翻到個體 " + ind);
    d.className = "dot" + (i===curInd?" on":"") + (Object.values(matches).includes(ind)?" has-match":"");
    d.title = ind;
    d.onclick = () => turnTo(i);
    dots.appendChild(d);
  });
}
let turning = false;
function turnTo(idx){
  if(turning || idx === curInd || idx < 0 || idx >= IND_IDS.length) return;
  turning = true;
  const pg = $("bhPage"), container = pg.parentElement;
  const outgoing = bzOpen ? $("bhZoom") : pg;
  const direction = idx > curInd ? "catalog-exit-right" : "catalog-exit-left";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  container.classList.add("catalog-busy");
  container.setAttribute("aria-busy", "true");
  outgoing.classList.add(direction);
  refreshMatchUI();
  setTimeout(() => {
    outgoing.classList.remove(direction);
    bzOpen = false; $("bhZoom").style.display = "none";
    curInd = idx; renderBookHalf(); pg.scrollTop = 0;
    pg.classList.add("catalog-enter");
    setTimeout(() => {
      pg.classList.remove("catalog-enter");
      container.classList.remove("catalog-busy");
      container.setAttribute("aria-busy", "false");
      turning = false; refreshMatchUI();
    }, reduced ? 0 : 280);
  }, reduced ? 0 : 230);
}
$("btnPrevInd").onclick = () => turnTo(curInd-1);
$("btnNextInd").onclick = () => turnTo(curInd+1);

$("btnFinishMatch").onclick = () => {
  const unmatched = selectedIds().filter(pid => !matches[pid]);
  if(unmatched.length){
    if(!confirm(`還有 ${unmatched.length} 張照片未配對，將列為「未辨識個體」。\n確定完成比對嗎？`)) return;
  }
  buildResultPage();
  flipTo("page-result");
};

/* ================= 照片放大篩選視窗（第二階段） ================= */
/* 導覽只在「還沒決定」的照片之間跑：一旦按了保留或刪除，那張就退出上/下一張的循環。
   若使用者從卡片直接點進一張已決定的照片，仍要看得到（才能復原），故把它暫時併入清單。 */
let lbCurrentId = null;
const pendingIds = () => photos.filter(isPending).map(p => p.id);
const lbList = () => photos.filter(p => isPending(p) || p.id === lbCurrentId).map(p => p.id);

function openLightboxSingle(pid){
  lbCurrentId = pid;
  $("lightbox").classList.add("open");
  setTimeout(()=>$("lbClose").focus(),0);
  renderLbSingle();
}
function renderLbSingle(){
  const p = photoById(lbCurrentId);
  if(!p){ closeLightbox(); return; }
  const kept = keptIds.includes(lbCurrentId);
  const list = lbList(), idx = list.indexOf(lbCurrentId), pend = pendingIds().length;
  $("lbDbImg").style.display = "";
  $("lbDbImg").src = p.dataUrl;
  $("lbDbImg").style.filter = p.discarded ? "grayscale(1) brightness(.55)" : "";
  const zb = $("lbZoomBadge");
  zb.innerHTML = " " + zoomLabel(p) + " 拍攝"
               + (p.px ? `<span class="px">${p.px} px</span>` : "");
  zb.title = "拍攝時的變焦倍率與實際擷取像素；倍率越大擷取像素越少";
  const state = p.discarded ? " ·  已刪除" : kept ? " · ✓ 已保留" : `（待審 ${idx+1}/${pend}）`;
  $("lbDbTag").textContent = lbCurrentId + state;
  $("lbDel").textContent = p.discarded ? "↺ 復原" : " 刪除";
  $("lbKeep").textContent = kept ? "移出紀錄表" : "✓ 保留";
  $("lbKeep").disabled = p.discarded;
  // 只剩自己一張可看時，左右鍵沒有意義
  const only = list.length <= 1;
  $("lbDbPrev").disabled = only; $("lbDbNext").disabled = only;
}
/* 決定完一張後，跳到「原本位置之後」的第一張待審；沒有待審的就收工關閉 */
function lbAdvance(){
  const pend = pendingIds();
  if(!pend.length){ closeLightbox(); return; }
  const order = photos.map(p => p.id);
  const from = order.indexOf(lbCurrentId);
  lbCurrentId = pend.find(id => order.indexOf(id) > from) || pend[0];
  renderLbSingle();
}
function lbStep(dir){
  const list = lbList();
  if(list.length <= 1) return;
  const i = list.indexOf(lbCurrentId);
  lbCurrentId = list[(i + dir + list.length) % list.length];
  renderLbSingle();
}
$("lbDel").onclick = () => {
  const p = photoById(lbCurrentId);
  p.discarded = !p.discarded;
  refreshReviewCards();
  if(p.discarded){ unkeepPhoto(lbCurrentId); lbAdvance(); }   // 刪除後自動跳下一張待審
  else renderLbSingle();                                       // 復原則停留原張
};
$("lbKeep").onclick = () => {
  if(keptIds.includes(lbCurrentId)){ unkeepPhoto(lbCurrentId); renderLbSingle(); }
  else{ keepPhoto(lbCurrentId); lbAdvance(); }                 // 保留後自動跳下一張待審
};
$("lbDbPrev").onclick = () => lbStep(-1);
$("lbDbNext").onclick = () => lbStep(1);
$("lbClose").onclick = closeLightbox;
$("lightbox").addEventListener("click", e => { if(e.target === $("lightbox")) closeLightbox(); });
document.addEventListener("keydown", e => {
  if(!$("lightbox").classList.contains("open")) return;
  if(e.key === "Escape"){ closeLightbox(); return; }
  if(e.key === "Delete"){ e.preventDefault(); $("lbDel").click(); return; }          // Del＝刪除
  if(e.key === "Enter"){                                                            // Enter＝保留
    e.preventDefault();
    if(!$("lbKeep").disabled) $("lbKeep").click();
    return;
  }
  if(e.key === "ArrowLeft"){ e.preventDefault(); lbStep(-1); return; }
  if(e.key === "ArrowRight"){ e.preventDefault(); lbStep(1); return; }
});
function closeLightbox(){ $("lightbox").classList.remove("open"); document.querySelector(`[data-pid="${lbCurrentId}"]`)?.focus(); }

/* ================= 結果頁 ================= */
function buildResultPage(){
  $("resultSummary").innerHTML = `
    <tr><td>調查日期</td><td>${record.date}</td></tr>
    <tr><td>紀錄者</td><td>${escapeHtml(record.recorder)}</td></tr>
    <tr><td>物種</td><td>${record.species}</td></tr>
    <tr><td>族群數量</td><td>約 ${record.count} 隻</td></tr>
    <tr><td>行為</td><td>${record.behaviors.length ? record.behaviors.join("、") : "—"}</td></tr>
    <tr><td>使用照片</td><td>${selectedIds().length} 張（拍攝 ${photos.length} 張）</td></tr>`;

  const box = $("resultMatches");
  box.innerHTML = "";
  const grouped = {};
  Object.entries(matches).forEach(([pid, ind]) => (grouped[ind] = grouped[ind] || []).push(pid));
  IND_IDS.forEach(ind => {
    if(!grouped[ind]) return;
    const row = document.createElement("div");
    row.className = "result-ind";
    row.innerHTML = `
      <div class="ind-id"> ${ind}</div>
      <div class="imgs">${grouped[ind].map(pid=>`<img src="${photoById(pid).dataUrl}" title="${pid}">`).join("")}</div>
      <span class="vs">↔ 資料庫</span>
      <div class="imgs"><img class="db-ref" src="${dbSrc(ind, DB[ind][0])}" title="${ind} 代表照"></div>`;
    box.appendChild(row);
  });
  const unmatched = selectedIds().filter(pid => !matches[pid]);
  if(unmatched.length){
    const row = document.createElement("div");
    row.className = "result-ind";
    row.innerHTML = `
      <div class="ind-id" style="color:#9fb3c1;"> 未辨識</div>
      <div class="imgs">${unmatched.map(pid=>`<img src="${photoById(pid).dataUrl}" title="${pid}">`).join("")}</div>
      <span class="vs">本次未確認，不能據此判定為新個體</span>`;
    box.appendChild(row);
  }
  if(!Object.keys(grouped).length && !unmatched.length){
    box.innerHTML = '<div class="empty-hint">無比對資料</div>';
  }
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

$("btnRestart").onclick = () => location.reload();
