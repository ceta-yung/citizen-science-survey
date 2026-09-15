// 完整下載後才交給播放器，播放期間不再讀取遠端影片。
async function downloadSurveyVideo(url, signal, onProgress){
  const response=await fetch(url,{signal});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const total=Number(response.headers.get('content-length'))||0;
  const reader=response.body.getReader(),chunks=[];
  let loaded=0;
  onProgress(0,total);
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      chunks.push(value);loaded+=value.byteLength;onProgress(loaded,total);
    }
    if(!loaded || (total && loaded!==total))throw new Error('影片下載不完整');
    return new Blob(chunks,{type:'video/mp4'});
  }finally{reader.releaseLock();}
}
