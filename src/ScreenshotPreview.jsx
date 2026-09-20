import {assetUrl} from './assets.mjs';
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Maximize2,Minus,Plus,X} from 'lucide-react';
import {caseImage} from './demo-assets.mjs';
import {screenshotCrop} from './screenshot-crops.mjs';
import FunctionSpeaker from './FunctionSpeaker';
import './screenshot-crops.css';

export function ScreenshotImage({src,alt,zoom=1}){
 const crop=screenshotCrop(src);
 return <div className={'screenshot-image'+(crop?' is-cropped':'')} style={{width:`${zoom*100}%`,...(crop?{aspectRatio:`${crop.width} / ${crop.height}`}:{})}}>
  <img className="demo-source-image" src={assetUrl(src)} alt={alt} loading="eager" draggable="false" style={crop?{transform:`translateY(-${crop.top/crop.sourceHeight*100}%)`}:undefined}/>
 </div>;
}

export function recordPictures(record){
 const prepared=record?.sample&&caseImage(record.caseId);
 return prepared?[{src:prepared,alt:'原消息截图：'+record.title}]:
  (record?.images||[]).map((image,index)=>({src:image.dataUrl,alt:'原消息截图 '+(index+1)}));
}

function PictureViewer({src,alt,onClose}){
 const ref=useRef(null),scroll=useRef(null),pointer=useRef(null),[zoom,setZoom]=useState(1);
 function tapPicture(event){if(event.detail!==0&&pointer.current&&Math.hypot(event.clientX-pointer.current.x,event.clientY-pointer.current.y)>8)return;if(zoom>1){setZoom(1);if(scroll.current){scroll.current.scrollLeft=0;scroll.current.scrollTop=0;}}else onClose();}
 useEffect(()=>{
  const previous=document.activeElement;
  ref.current?.querySelector('button')?.focus({preventScroll:true});
  const keydown=event=>{
   if(event.key==='Escape'){event.preventDefault();onClose();}
   if(event.key==='Tab'){
    const buttons=[...ref.current.querySelectorAll('button:not(:disabled)')];
    const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus({preventScroll:true});}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus({preventScroll:true});}
   }
  };
  document.addEventListener('keydown',keydown);
  return()=>{document.removeEventListener('keydown',keydown);previous?.focus?.({preventScroll:true});};
 },[]);
 return createPortal(<div className="picture-viewer" role="dialog" aria-modal="true" aria-label="放大查看截图" ref={ref}>
  <header><strong>原来的截图</strong><FunctionSpeaker id="viewer"/><button onClick={onClose} aria-label="关闭大图"><X/>关闭</button></header>
  <p>{zoom>1?'点图片，还原大小':'点图片返回 · 滑动看全图'}</p>
  <div className="picture-viewer-scroll" ref={scroll}><button className="picture-tap" style={{width:`${zoom*100}%`}} aria-label={zoom>1?'点击图片还原大小':'点击图片返回'} onPointerDown={event=>{pointer.current={x:event.clientX,y:event.clientY};}} onClick={tapPicture}><ScreenshotImage src={src} alt={alt}/></button></div>
  <footer><button onClick={()=>setZoom(Math.max(1,zoom-.5))} disabled={zoom===1}><Minus/>缩小一点</button><button onClick={()=>setZoom(Math.min(2.5,zoom+.5))} disabled={zoom===2.5}><Plus/>放大一点</button></footer>
 </div>,document.querySelector('.device-viewport')||document.body);
}

export default function ScreenshotPreview({src,alt='原消息截图',className='',compact=false}){
 const [open,setOpen]=useState(false);
 return <div className={'screenshot-preview '+className+(compact?' is-compact':'')}>
  <button className="screenshot-open" onClick={()=>setOpen(true)} aria-label={'放大查看：'+alt} type="button"><ScreenshotImage src={src} alt={alt}/><span><Maximize2/>{compact?'点开看原图':'点开，看完整截图'}</span></button>
  {open&&<PictureViewer src={src} alt={alt} onClose={()=>setOpen(false)}/>}
 </div>;
}

export function SourcePictures({record,images,language='mandarin',compact=false}){
 const pictures=images||recordPictures(record);
 if(!pictures.length)return null;
 return <section className={'source-pictures'+(compact?' compact-pictures':'')} aria-label="原消息截图">
  {!compact&&<div className="source-pictures-heading"><strong>{language==='henan'?'先瞧瞧原来的话':'先看看原来的话'}</strong><FunctionSpeaker id="picture"/><span>{pictures.length>1?`${pictures.length} 张截图`:'原消息截图'}</span></div>}
  {pictures.map((picture,index)=><ScreenshotPreview key={picture.src+index} {...picture} compact={compact}/>)}
 </section>;
}
