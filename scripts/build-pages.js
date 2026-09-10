const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const src=path.join(root,'dist');
const dest=path.join(root,'.pages');
const media=require('../media.json');
async function main(){
  const file=path.join(src,media.file);
  if(!fs.existsSync(file))throw new Error('缺少部署影片。請先下載 survey-media-v1 Release 的 survey_video.mp4 到 dist。');
  const hash=crypto.createHash('sha256');
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  if(hash.digest('hex')!==media.sha256)throw new Error('影片校驗值不符，請確認素材版本。');
  fs.mkdirSync(dest,{recursive:true});
  for(const name of ['index.html','base.css','style.css','catalog.js','app.js','experience.js','icon.svg','manifest.webmanifest','cover.jpg',media.file])fs.copyFileSync(path.join(src,name),path.join(dest,name));
  const catalogText=fs.readFileSync(path.join(src,'catalog.js'),'utf8');
  const catalog=JSON.parse(catalogText.slice(catalogText.indexOf('{'),catalogText.lastIndexOf('}')+1));
  for(const [individual,files] of Object.entries(catalog)){
    const directory=path.join(dest,'crops',individual);fs.mkdirSync(directory,{recursive:true});
    for(const name of files)fs.copyFileSync(path.join(src,'crops',individual,name),path.join(directory,name));
  }
  let html=fs.readFileSync(path.join(dest,'index.html'),'utf8');
  html=html.replace(/\s*<source src="survey_video_hevc\.mp4"[^>]*>/,'');
  html=html.replace(/<!-- 依序嘗試：[\s\S]*?-->/,'<!-- GitHub Pages 使用同來源 4K H.264 影片；本機保留 HEVC 原始版本。 -->');
  fs.writeFileSync(path.join(dest,'index.html'),html);fs.writeFileSync(path.join(dest,'.nojekyll'),'');
  let total=0;
  function check(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())check(p);else total+=fs.statSync(p).size;}}
  check(dest);if(total>=1e9)throw new Error('超過 GitHub Pages 1 GB 大小限制。');
  if(fs.existsSync(path.join(dest,'survey_video_hevc.mp4')))throw new Error('部署資料夾含不應發布的 HEVC，請移走後重新建置。');
  console.log(`GitHub Pages 靜態內容完成：${(total/1024/1024).toFixed(1)} MiB，影片 SHA256 已核對。`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
