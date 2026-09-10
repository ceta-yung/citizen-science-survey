const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const videoPath=path.resolve(process.argv[3]||path.join(root,'mobile-test','mobile-video.mp4'));
const output=path.resolve(process.argv[4]||path.join(root,'mobile-test','海上觀察室_手機離線測試.html'));
const dist=path.join(root,'dist');
const read=name=>fs.readFileSync(path.join(dist,name),'utf8');
const data=(name,type)=>`data:${type};base64,${fs.readFileSync(path.join(dist,name)).toString('base64')}`;
const safeScript=text=>text.replace(/<\/script/gi,'<\\/script');
const catalogSource=read('catalog.js');
const catalog=vm.runInNewContext(catalogSource+';SURVEY_INDIVIDUALS',{});
const assets={};
for(const [id,files] of Object.entries(catalog))for(const file of files)assets[id+'/'+file]=data(path.join('crops',id,file),'image/jpeg');
let html=read('index.html');
html=html.replace('<title>海上觀察室｜公民科學・鯨豚調查</title>','<title>海上觀察室｜手機離線測試版</title>');
html=html.replace(/<link rel="manifest"[^>]+>/,'');
html=html.replace('href="icon.svg"',`href="${data('icon.svg','image/svg+xml')}"`);
html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,name)=>'<style>'+read(name)+'</style>');
html=html.replaceAll('src="cover.jpg"',`src="${data('cover.jpg','image/jpeg')}"`).replaceAll('poster="cover.jpg"',`poster="${data('cover.jpg','image/jpeg')}"`);
html=html.replace(/\s*<source\b[^>]*>/g,'');
html=html.replace('教學體驗 · 照片與紀錄僅留在本次頁面，重新整理即清除','手機離線測試 · 1080p / 30fps 輕量影片，非原始畫質。重新整理會清除紀錄。');
html=html.replace('公民科學・鯨豚調查</span>','手機離線測試版</span>');
html=html.replace('<body>','<body><noscript><div style="position:fixed;inset:0;z-index:9999;background:#fff;padding:30px;color:#15323b">此檔案需要執行 JavaScript。請使用支援本機 HTML 的瀏覽器開啟，不要使用檔案或通訊軟體的預覽模式。</div></noscript>');
let app=read('app.js').replace('const dbSrc = (ind, file) => "crops/" + ind + "/" + encodeURIComponent(file);','const dbSrc = (ind, file) => OFFLINE_PHOTOS[ind + "/" + file];');
let experience=read('experience.js').replace("video.src='survey_video.mp4'","video.src=window.offlineVideoURL");
const videoBase64=fs.readFileSync(videoPath).toString('base64');
const boot=`
const OFFLINE_PHOTOS=${JSON.stringify(assets)};
{
  const media=document.getElementById('offlineVideoData');
  const encoded=media.textContent.trim();
  const chunks=[];
  for(let offset=0;offset<encoded.length;offset+=1048576){
    const decoded=atob(encoded.slice(offset,offset+1048576));
    const bytes=new Uint8Array(decoded.length);
    for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
    chunks.push(bytes);
  }
  window.offlineVideoURL=URL.createObjectURL(new Blob(chunks,{type:'video/mp4'}));
  document.getElementById('surveyVideo').src=window.offlineVideoURL;
  media.remove();
}
`;
const guard=`
const captureOfflineFrame=takePhoto;
takePhoto=function(){
  try{captureOfflineFrame();}
  catch(error){stopBurst();tell('此開啟方式不允許擷取影片。請改用可執行本機 HTML 的瀏覽器，或日後的線上版本。');}
};
`;
html=html.replace('<script src="catalog.js"></script>',`<script id="offlineVideoData" type="application/octet-stream">${videoBase64}</script><script>${safeScript(boot)}</script><script>${safeScript(catalogSource)}</script>`);
html=html.replace('<script src="app.js"></script>',`<script>${safeScript(app)}</script>`);
html=html.replace('<script src="experience.js"></script>',`<script>${safeScript(experience)}</script><script>${safeScript(guard)}</script>`);
// 語法與資產驗證不依賴網路或瀏覽器。
for(const source of [boot,catalogSource,app,experience,guard])new vm.Script(source);
const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const links=[...markup.matchAll(/\b(?:src|href|poster)="([^"]+)"/g)].map(x=>x[1]);
for(const url of links)if(!url.startsWith('data:')&&!url.startsWith('#'))throw new Error('仍有外部資產：'+url);
if(Object.keys(assets).length!==28)throw new Error('個體圖片數量不符');
if(!Buffer.from(videoBase64,'base64').equals(fs.readFileSync(videoPath)))throw new Error('影片內嵌資料不符');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);
console.log(JSON.stringify({file:output,sizeMiB:+(fs.statSync(output).size/1048576).toFixed(1),photos:Object.keys(assets).length,scripts:'syntax passed',externalAssets:0}));
