import {assetUrl} from './assets.mjs';
// GitHub Pages cannot run the local Node adapters. Demo speech is served as files.
export async function staticDemoRequest(path,body,{signal,responseType='json'}={}){
 if(signal?.aborted)throw new DOMException('', 'AbortError');
 if(path==='/status')return {ai:false,speech:true,video:false,henan:true,henanDemo:true,staticDemo:true,voiceProvider:'prepared-files'};
 if(path==='/speech'){
  const language=body?.language==='henan'?'henan':'mandarin';
  if(typeof body?.text!=='string'||!body.text.trim())throw new Error('请先选择要听的内容。');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(language+'|'+body.text)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const base=assetUrl('/demo/readers/'+hash);
  const [metadata,audio]=await Promise.all([fetch(base+'.json',{signal}),fetch(base+'.mp3',{signal})]);
  if(!metadata.ok||!audio.ok)throw new Error('这段声音还没有准备好，请先体验演示案例。');
  const record=await metadata.json();
  if(record.text!==body.text||record.language!==language)throw new Error('演示声音与文字不一致，请刷新后重试。');
  const blob=await audio.blob();if(!blob.size)throw new Error('声音没有下载完整，请再试一次。');
  return responseType==='blob'?blob:{blob,cues:record.cues||[]};
 }
 if(path==='/analyze')throw new Error('网页版演示使用预先准备的截图，请从演示相册选一张。');
 if(path==='/export')throw new Error('网页版暂不现场合成新视频。请打开未修改的演示视频，或保存当前长图。');
 throw new Error('网页版演示暂不支持此操作。');
}
