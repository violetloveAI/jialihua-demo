import {STATIC_DEMO} from './assets.mjs';
function requestCopy(language) {
  return language === 'henan' ? {
    network:'网络没连上，看看网络连好没，再试一回。',
    timeout:'等得有点久，这回先停下了，请再试一回。',
    response:'服务这会儿没回话，请过会儿再试一回。',
    failed:'这回没弄成，请再试一回。',
  } : {
    network:'网络没有连上，请检查网络后再试一次。',
    timeout:'等待时间有点长，这次已停止，请再试一次。',
    response:'服务暂时没有响应，请稍后再试一次。',
    failed:'这次没有完成，请再试一次。',
  };
}

// Keep the deadline active through body download, not just until headers arrive.
export async function request(path, body, {method,signal,responseType='json'} = {}) {
  const copy=requestCopy(body?.language);
  const controller=new AbortController();
  const cancel=()=>controller.abort();
  if(signal?.aborted)throw new DOMException('', 'AbortError');
  signal?.addEventListener('abort',cancel,{once:true});
  let timedOut=false;
  const cancelled=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new DOMException('', 'AbortError')),{once:true}));
  const timeout={'/analyze':90000,'/speech':45000,'/export':240000}[path]??30000;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeout);
  try {
    return await Promise.race([cancelled,(async()=>{
      if(STATIC_DEMO){const {staticDemoRequest}=await import('./static-demo.mjs');return staticDemoRequest(path,body,{signal:controller.signal,responseType});}
      const response=await fetch(`/api${path}`, {
        method:method || (body === undefined ? 'GET' : 'POST'),
        headers:body === undefined ? {} : {'Content-Type':'application/json',...(responseType==='narration'?{Accept:'application/json'}:{})},
        body:body === undefined ? undefined : JSON.stringify(body),
        credentials:'same-origin',signal:controller.signal,
      });
      if(response.ok&&responseType==='blob')return response.blob();
      if(response.ok&&responseType==='narration'&&!response.headers.get('content-type')?.includes('application/json'))return {blob:await response.blob(),cues:[]};
      let result;
      try { result=await response.json(); } catch(error) {
        if(controller.signal.aborted||error instanceof TypeError)throw error;
        throw new Error(copy.response);
      }
      if(!response.ok)throw new Error(result?.error||copy.failed);
      return result;
    })()]);
  } catch(error) {
    if(signal?.aborted)throw new DOMException('', 'AbortError');
    if(timedOut)throw new Error(copy.timeout);
    if(error?.name==='AbortError')throw error;
    if(error instanceof TypeError)throw new Error(copy.network);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort',cancel);
  }
}

export function api(path, body, method, options) {
  return request(path,body,{...options,method});
}
export function readDataUrl(blob) { return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('这份文件没有读取成功，请重选。')); reader.readAsDataURL(blob); }); }

// Decode then resample before transfer; originals remain on the user's device.
export async function prepareImage(file) {
  const dataUrl=await readDataUrl(file);
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('这张图片无法打开，请换成手机截图。'));image.src=dataUrl;});
  const scale=Math.min(1,2400/Math.max(image.width,image.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  return {name:file.name,dataUrl:canvas.toDataURL('image/jpeg',.9)};
}
