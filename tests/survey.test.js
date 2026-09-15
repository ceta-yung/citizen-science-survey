const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {server,parseRange}=require('../server');
const root=path.resolve(__dirname,'../dist');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const experience=fs.readFileSync(path.join(root,'experience.js'),'utf8');

test('大影片 Range：封閉、開放、尾端與無效區間',()=>{
  assert.deepEqual(parseRange('bytes=1000-1099',10000),{start:1000,end:1099});
  assert.deepEqual(parseRange('bytes=9990-',10000),{start:9990,end:9999});
  assert.deepEqual(parseRange('bytes=-10',10000),{start:9990,end:9999});
  for(const s of ['bytes=-0','bytes=-','bytes=10000-','bytes=8-3','bytes=0-2,5-8','garbage'])assert.equal(parseRange(s,10000),null);
});

test('HTTP：首頁、中文目錄照片、影片部分讀取與非公開檔案邊界',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/海上觀察室/);
    const response=await fetch(base+'/videos/265A7010-4k30.mp4',{headers:{Range:'bytes=1000-1099'}});
    assert.equal(response.status,206);const actual=Buffer.from(await response.arrayBuffer());assert.equal(actual.length,100);
    const file=fs.openSync(path.join(root,'videos/265A7010-4k30.mp4'),'r'),expected=Buffer.alloc(100);fs.readSync(file,expected,0,100,1000);fs.closeSync(file);assert.deepEqual(actual,expected);
    const bad=await fetch(base+'/videos/265A7010-4k30.mp4',{headers:{Range:'bytes=999999999999-'}});assert.equal(bad.status,416);
    for(const url of ['/server.js','/MEMORY.md','/%2e%2e%2fserver.js'])assert.ok([403,404].includes((await fetch(base+url)).status));
    const database=vm.runInNewContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8')+';SURVEY_INDIVIDUALS',{});
    let count=0;
    for(const [id,files] of Object.entries(database))for(const name of files){
      assert.ok(fs.existsSync(path.join(root,'crops',id,name)),name);count++;
      const item=await fetch(`${base}/crops/${id}/${encodeURIComponent(name)}`,{method:'HEAD'});assert.equal(item.status,200);assert.equal(item.headers.get('content-type'),'image/jpeg');
    }
    assert.equal(count,34);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('橫向旋轉前後，同一触控點對應相同的拍攝座標',()=>{
  const functionSource=experience.slice(experience.indexOf('function localPoint('),experience.indexOf('function aimAt('));
  const context={shell:{classList:{contains:()=>true}}};vm.createContext(context);vm.runInContext(functionSource,context);
  const el={getBoundingClientRect:()=>({top:20,left:0,right:380})};
  const p=context.localPoint({clientX:230,clientY:340},el);
  assert.equal(p.x,320);assert.equal(p.y,150);
  context.shell.classList.contains=()=>false;
  const q=context.localPoint({clientX:320,clientY:170},el);
  assert.equal(q.x,320);assert.equal(q.y,150);
});

test('PNG 擷取保留原生像素、縮放範圍與 80ms 連拍防抖',()=>{
  const functionSource=app.slice(app.indexOf('function takePhoto(){'),app.indexOf('function updateShootCount(){'));
  let now=1000,drawArgs=null,encoding=null;
  const ctx={fillRect(){},drawImage(...args){drawArgs=args;}};
  const canvas={getContext:()=>ctx,toDataURL:type=>{encoding=type;return 'data:image/png;base64,test';}};
  const nodes={'page-shoot':{classList:{contains:()=>true}},'shootEndOverlay':{style:{}},videoWrap:{clientWidth:1536,clientHeight:864},filmStrip:{appendChild(){}}};
  const context={performance:{now:()=>now},lastShot:0,video:{readyState:4,videoWidth:3840,videoHeight:2160,currentTime:2},vf:{offsetWidth:320,offsetHeight:200},mouseX:768,mouseY:432,panX:0,panY:0,zoom:1,photos:[],document:{createElement:name=>name==='canvas'?canvas:{}},$:id=>nodes[id],playShutter(){},updateShootCount(){}};
  vm.createContext(context);vm.runInContext(functionSource,context);context.takePhoto();
  assert.equal(encoding,'image/png');assert.equal(canvas.width,800);assert.equal(canvas.height,500);assert.equal(drawArgs[1],1520);assert.equal(drawArgs[2],830);
  now=1050;context.takePhoto();assert.equal(context.photos.length,1);
  now=1100;context.zoom=2;context.panX=-768;context.panY=-432;context.takePhoto();assert.equal(canvas.width,400);assert.equal(canvas.height,250);
  for(let i=0;i<25;i++){now+=90;context.takePhoto();}assert.equal(context.photos.length,27);
});

test('待審循環跳過保留與刪除照片，全部完成後關閉',()=>{
  const source=app.slice(app.indexOf('function lbAdvance(){'),app.indexOf('function lbStep('));
  let closed=false,rendered=null;
  const context={photos:[{id:'P1'},{id:'P2'},{id:'P3'},{id:'P4'}],lbCurrentId:'P1',pendingIds:()=>['P3','P4'],closeLightbox(){closed=true;},renderLbSingle(){rendered=context.lbCurrentId;}};
  vm.createContext(context);vm.runInContext(source,context);context.lbAdvance();assert.equal(rendered,'P3');
  context.lbCurrentId='P4';context.lbAdvance();assert.equal(rendered,'P3');
  context.pendingIds=()=>[];context.lbAdvance();assert.equal(closed,true);
});

test('HTML ID 不重複，外部本機資產與程式語法完整',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
  for(const [,asset] of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!asset.includes('://'))assert.ok(fs.existsSync(path.join(root,asset)),asset);
  new vm.Script(app);new vm.Script(experience);new vm.Script(fs.readFileSync(path.join(root,'catalog.js'),'utf8'));
});

test('手機全螢幕遭平台拒絕時保留替代布局，關閉後還原',async()=>{
  const code=experience.slice(experience.indexOf('async function enterImmersive('),experience.indexOf("$('enterMobile').onclick"));
  let layouts=0,notices=0,unlocks=0,focused=false;
  const prompt={hidden:false};
  const context={immersive:false,mobileDevice:true,stopBurst(){},layoutExperience(){layouts++;},tell(){notices++;},screen:{orientation:{unlock(){unlocks++;}}},document:{fullscreenElement:null,documentElement:{requestFullscreen:()=>Promise.reject(new Error('unsupported'))}},$:id=>id==='mobilePrompt'?prompt:{focus(){focused=true;}}};
  vm.createContext(context);vm.runInContext(code,context);
  await context.enterImmersive();assert.equal(context.immersive,true);assert.equal(prompt.hidden,true);assert.equal(notices,1);assert.ok(layouts>=2);
  await context.exitImmersive();assert.equal(context.immersive,false);assert.equal(unlocks,1);assert.equal(focused,true);
});

test('整頁捲動僅用於Apple瀏覽器，原生全螢幕與主畫面App不啟用',()=>{
  const code=experience.slice(experience.indexOf('function needsDocumentScroll('),experience.indexOf('function updateDocumentScroll('));
  const context={appleTouchDevice:true,document:{fullscreenElement:null},navigator:{standalone:false},matchMedia:()=>({matches:false})};
  vm.createContext(context);vm.runInContext(code,context);
  assert.equal(context.needsDocumentScroll(),true);
  context.document.fullscreenElement={};assert.equal(context.needsDocumentScroll(),false);
  context.document.fullscreenElement=null;context.navigator.standalone=true;assert.equal(context.needsDocumentScroll(),false);
  context.navigator.standalone=false;context.appleTouchDevice=false;assert.equal(context.needsDocumentScroll(),false);
});

test('網址列收合後維持相對瞄準位置，重複同尺寸事件不重設拍攝',()=>{
  const code=experience.slice(experience.indexOf('function layoutExperience('),experience.indexOf('async function enterImmersive('));
  let stops=0;
  const context={document:{documentElement:{clientWidth:390}},window:{innerHeight:650},immersive:true,mobileDevice:true,lastLayout:null,
    shell:{classList:{toggle(){}},style:{setProperty(){}}},updateDocumentScroll(){},$:()=>({hidden:false}),
    mouseX:0,mouseY:0,panX:0,panY:0,stopBurst(){stops++;},applyZoom(){},aimAt(x,y){context.mouseX=x;context.mouseY=y;}};
  vm.createContext(context);vm.runInContext(code,context);
  context.layoutExperience();assert.equal(context.mouseX,325);assert.equal(context.mouseY,195);
  context.mouseX=130;context.mouseY=100;context.panX=-65;
  context.window.innerHeight=750;context.layoutExperience();
  assert.ok(Math.abs(context.mouseX-150)<1e-8);assert.ok(Math.abs(context.mouseY-100)<1e-8);assert.ok(Math.abs(context.panX+75)<1e-8);
  context.layoutExperience();assert.equal(stops,2);
});

test('隨機選片涵蓋全部三部且不引用舊測試影片',()=>{
 const source=fs.readFileSync(path.join(root,'videos.js'),'utf8');
 const context={};vm.createContext(context);vm.runInContext(source,context);
 const selected=Array.from({length:3},(_,i)=>context.selectSurveyVideo(()=>i/3));
 assert.equal(new Set(selected).size,3);
 for(const file of selected)assert.ok(fs.existsSync(path.join(root,file)));
 assert.ok(!experience.includes('survey_video.mp4'));
});
