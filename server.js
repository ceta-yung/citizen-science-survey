const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, 'dist');
const port = Number(process.env.PORT || 8766);
const host = process.env.HOST || '127.0.0.1';
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4','.webmanifest':'application/manifest+json'};

function parseRange(header,size){
  const m=/^bytes=(\d*)-(\d*)$/.exec(header||'');
  if(!m || (!m[1]&&!m[2]))return null;
  let start,end;
  if(!m[1]){const n=Number(m[2]);if(!Number.isSafeInteger(n)||n<=0)return null;start=Math.max(0,size-n);end=size-1;}
  else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return null;
  return {start,end};
}

const server = http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  let decoded;
  try{decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(decoded.includes('\0')||decoded.includes('\\')){res.writeHead(400);res.end();return;}
  const file=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    const headers={'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':/\.(mp4|jpg|png)$/i.test(file)?'private, max-age=3600':'no-cache','Referrer-Policy':'same-origin'};
    let range=null;
    if(req.headers.range){
      range=parseRange(req.headers.range,stat.size);
      if(!range){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`,'Content-Length':0});res.end();return;}
      headers['Content-Range']=`bytes ${range.start}-${range.end}/${stat.size}`;
    }
    headers['Content-Length']=range?range.end-range.start+1:stat.size;
    res.writeHead(range?206:200,headers);
    if(req.method==='HEAD'){res.end();return;}
    const stream=fs.createReadStream(file,range||{});
    stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  });
});
if(require.main===module){
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`連接埠 ${port} 已被使用，請關閉舊伺服器或設定 PORT。`:error.message);process.exitCode=1;});
  server.listen(port,host,()=>{
    console.log(`海上觀察室 Local: http://localhost:${port}`);
    if(host==='0.0.0.0')for(const values of Object.values(os.networkInterfaces()))for(const item of values||[])if(item.family==='IPv4'&&!item.internal)console.log(`手機（相同 Wi-Fi）: http://${item.address}:${port}`);
    console.log('按 Ctrl+C 停止。僅提供 dist 內的網站與素材。');
  });
}
module.exports={server,parseRange};
