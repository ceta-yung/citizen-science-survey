const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const source=path.resolve(process.argv[2]);
const root=path.resolve(__dirname,'..');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function probe(file){return JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames:format=duration','-of','json',file],{encoding:'utf8'}));}
async function hash(file){const h=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))h.update(chunk);return h.digest('hex');}
(async()=>{
 const originals=files(source).filter(p=>/\.mp4$/i.test(p));
 if(originals.length!==3)throw Error('必須恰好三部來源影片');
 const videos=[];
 for(const original of originals.sort()){
  const file='videos/'+path.basename(original,path.extname(original))+'-1080p.mp4';
  const output=path.join(root,'dist',file),a=probe(original),b=probe(output);
  if(b.streams[0].width!==1920||b.streams[0].height!==1080||b.streams[0].r_frame_rate!=='30/1')throw Error(file+' 必須為1080p 30fps');
  if(Math.abs(Number(a.format.duration)-Number(b.format.duration))>.1)throw Error(file+' 片長不符');
  videos.push({file,bytes:fs.statSync(output).size,sha256:await hash(output),...b.streams[0],duration:Number(b.format.duration),sourceSha256:await hash(original)});
 }
 fs.writeFileSync(path.join(root,'media.json'),JSON.stringify({releaseTag:'survey-media-v3',encoding:'H.264 1080p 30fps CRF22 maxrate 6M, AAC 128k, faststart',videos},null,2)+'\n');
 console.log(JSON.stringify({videos:videos.length,bytes:videos.reduce((n,v)=>n+v.bytes,0),verified:'1080p, 30fps, duration, SHA256'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
