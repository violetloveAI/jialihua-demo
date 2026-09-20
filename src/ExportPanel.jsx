import {STATIC_DEMO} from './assets.mjs';
import React,{useEffect,useMemo,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Download,Film,Image as ImageIcon,LoaderCircle} from 'lucide-react';
import {createFrames,createLongImage,download,exportContent,loadExportImages,postBinary} from './export.mjs';
import {GentleVideo} from './Playback';
import LanguagePicker from './LanguagePicker';
import {preparedVideo,loadPreparedVideo} from './demo-videos.mjs';

export default function ExportPanel({record,result,language,onSave,onWorking,rate,onRate,narrator,henanReady,initialFormat='image'}) {
 const [outputLanguage,setOutputLanguage]=useState(record.exportLanguage||language||'mandarin');
 const [drafts,setDrafts]=useState({}),[format,setFormat]=useState(initialFormat),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(null),[pictures,setPictures]=useState(null),[pictureError,setPictureError]=useState(''),[notice,setNotice]=useState('');
 const content=exportContent({...record,exportTexts:{...record.exportTexts,...drafts}},result,outputLanguage),text=content.text,title=content.title;
 const prepared=preparedVideo(record,content,outputLanguage);
 useEffect(()=>()=>{if(ready?.url)URL.revokeObjectURL(ready.url);},[ready]);
 useEffect(()=>{
  let active=true;setPictures(null);setPictureError('');
  loadExportImages(record).then(value=>{if(active)setPictures(value);}).catch(failure=>{if(active)setPictureError(failure.message);});
  return()=>{active=false;};
 },[record.id,record.attachments,record.composeImages]);
 const output=useMemo(()=>{
  if(!pictures)return {};
  const source={...record,title,language:outputLanguage};const value={};
  try{value.longImage=createLongImage(source,text,pictures);}catch(failure){value.imageError=failure.message;}
  try{value.frames=createFrames(source,text,pictures);}catch(failure){value.videoError=failure.message;}
  return value;
 },[text,title,outputLanguage,pictures,record.sourceKind,record.sample,record.sampleGenerated]);
 const frames=prepared?.frames||output.frames||[],index=Math.min(page,Math.max(0,frames.length-1));
 const layoutError=pictureError||(format==='image'?output.imageError:prepared?null:output.videoError);
 const unavailable=format==='video'&&!prepared&&(STATIC_DEMO||(outputLanguage==='henan'&&!henanReady));
 const disabled=busy||!pictures||Boolean(layoutError)||unavailable;
 function changeLanguage(value){if(value===outputLanguage)return;narrator?.stop?.();setOutputLanguage(value);setPage(0);setReady(null);setError('');setNotice('');}
 function changeText(value){setDrafts(current=>({...current,[outputLanguage]:value}));setPage(0);setReady(null);setError('');setNotice('');}
 async function persist(){await onSave?.({...record,exportTexts:{...record.exportTexts,...drafts,[outputLanguage]:text},exportText:text,exportLanguage:outputLanguage,lastExportAt:new Date().toISOString()});}
 async function makeExport() {
  if(disabled)return;setBusy(true);onWorking?.(true);setError('');setNotice('');narrator?.stop?.();
  try{
   if(format==='video'){
    const blob=prepared?await loadPreparedVideo(prepared):await postBinary('/export',{frames,voice:'xiaoyi',language:outputLanguage});
    setReady({blob,url:URL.createObjectURL(blob)});await persist();
   }else{
    const blob=await(await fetch(output.longImage.dataUrl)).blob();
    await persist();download(blob,'家里话-'+title+'-完整长图.png');setNotice('完整长图已保存，可以从微信发给家人。');
   }
  }catch(failure){setError(failure.message);}finally{setBusy(false);onWorking?.(false);}
 }
 return <div className="export-layout family-export">
  <p className="export-intro">选一种方式，把这条消息发给家人。</p>
  <div className="export-format-tabs" role="group" aria-label="导出格式">
   <button aria-pressed={format==='image'} disabled={busy} onClick={()=>{setFormat('image');setError('');}}><ImageIcon aria-hidden="true"/><span><strong>纯长图</strong><small>完整文字 + 配图</small></span></button>
   <button aria-pressed={format==='video'} disabled={busy} onClick={()=>{setFormat('video');setError('');}}><Film aria-hidden="true"/><span><strong>有声视频</strong><small>大字画面 + 旁白</small></span></button>
  </div>
  <LanguagePicker value={outputLanguage} onChange={changeLanguage} disabled={busy} label="导出语言" variant="export"/>
  {record.sourceKind==='composition'&&<p className="export-language-note">{outputLanguage==='henan'?'保留你写的原文；有声视频用河南话读出来。':'保留你写的原文；有声视频用普通话读出来。'}</p>}
  {record.sample&&<p className="sample-tag">虚构演示 · {record.sampleGenerated?'AI 辅助解释':'预先编写的解释'}</p>}
  {format==='video'&&<p className="notice" role="status">{prepared?'演示视频已提前制作。点击即可打开，无需现场生成；修改文字或配图后，需要重新制作。':STATIC_DEMO?'网页版使用预制视频；修改内容后可以保存长图。':'当前内容需要现场制作，配音和合成需要等待。演示时可选用未修改的示例，直接打开预制视频。'}</p>}
  <section className="export-preview-card" aria-label={format==='image'?'完整长图预览':'视频画面预览'}>
   <div className="export-preview-heading"><strong>{format==='image'?'长图预览':'视频画面'}</strong><span>{format==='image'?'向下滑动看全文':`${frames.length?index+1:0} / ${frames.length} 页`}</span></div>
   <div className={'export-preview '+(format==='image'?'long-image-preview':'video-image-preview')}>
    {pictures===null&&!pictureError?<p className="export-loading"><LoaderCircle/>正在准备配图</p>:format==='image'?output.longImage&&<img alt="包含全部文字与配图的完整长图" src={output.longImage.dataUrl}/>:frames[index]&&<img alt={'视频第 '+(index+1)+' 页'} src={frames[index].dataUrl}/>}
   </div>
   {format==='video'&&frames.length>1&&<div className="page-controls"><button aria-label="上一页" disabled={index===0||busy} onClick={()=>setPage(index-1)}><ChevronLeft/></button><span>{index+1} / {frames.length}</span><button aria-label="下一页" disabled={index>=frames.length-1||busy} onClick={()=>setPage(index+1)}><ChevronRight/></button></div>}
  </section>
  <label className="compose-field export-text-field">发给家人的文字<textarea rows={5} value={text} disabled={busy} onChange={event=>changeText(event.target.value)}/></label>
  <p className="export-language-note">{format==='image'?'全部内容保存为一张 PNG 长图。':'每页按正文配音，视频最多 8 页。'} 共 {Array.from(text).length} 字{pictures?.length?` · ${pictures.length} 张配图`:''}</p>
  {(layoutError||error)&&<p className="notice error" role="alert">{layoutError||error}</p>}
  {unavailable&&<p className="notice">{STATIC_DEMO?'此内容没有预制视频，可以保存长图，或选用未修改的演示案例。':'河南话语音暂时不可用。可以先保存长图，或选择普通话制作视频。'}</p>}
  <button className="primary" disabled={disabled} onClick={makeExport}>{busy?<LoaderCircle className="spin"/>:format==='image'?<Download/>:<Film/>}{busy?(format==='video'&&prepared?'正在打开演示视频':'正在制作，请稍等'):format==='image'?'保存完整长图':prepared?'打开演示视频':'制作有声视频'}</button>
  {notice&&<p className="export-saved" role="status"><Check/>{notice}</p>}
  {ready&&format==='video'&&<div className="download-ready"><strong><Check/>{prepared?'演示视频已就绪':'视频做好了'}</strong><GentleVideo src={ready.url} language="mandarin" rate={1} onRate={onRate} onPlay={()=>narrator?.stop?.()} compact/><button className="primary" onClick={()=>download(ready.blob,'家里话-'+title+'.mp4')}><Download/>保存视频</button><p>保存后，打开微信发给家人。</p></div>}
 </div>;
}
