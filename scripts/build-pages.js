const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const src=path.join(root,'dist');
const dest=path.join(root,'.pages');
const media=require('../media.json');
async function main(){
  if(fs.existsSync(dest)&&fs.readdirSync(dest).length)throw new Error('.pages 非空，請先將既有部署包移出再建置。');
  fs.mkdirSync(dest,{recursive:true});
  for(const item of media.videos){
    const file=path.join(src,item.file);
    const hash=crypto.createHash('sha256');
    for await(const chunk of fs.createReadStream(file))hash.update(chunk);
    if(hash.digest('hex')!==item.sha256)throw new Error('影片校驗值不符：'+item.file);
    const target=path.join(dest,item.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);
  }
  for(const name of ['index.html','base.css','style.css','catalog.js','videos.js','app.js','experience.js','preload.js','icon.svg','manifest.webmanifest','cover.jpg'])fs.copyFileSync(path.join(src,name),path.join(dest,name));
  const catalogText=fs.readFileSync(path.join(src,'catalog.js'),'utf8');
  const catalog=JSON.parse(catalogText.slice(catalogText.indexOf('{'),catalogText.lastIndexOf('}')+1));
  for(const [individual,files] of Object.entries(catalog)){
    const directory=path.join(dest,'crops',individual);fs.mkdirSync(directory,{recursive:true});
    for(const name of files)fs.copyFileSync(path.join(src,'crops',individual,name),path.join(directory,name));
  }
  fs.writeFileSync(path.join(dest,'.nojekyll'),'');
  let total=0;
  function check(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())check(p);else total+=fs.statSync(p).size;}}
  check(dest);if(total>=1e9)throw new Error('超過 GitHub Pages 1 GB 大小限制。');
  console.log(`GitHub Pages 靜態內容完成：${(total/1024/1024).toFixed(1)} MiB，影片 SHA256 已核對。`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
