import React,{useEffect,useRef,useState} from 'react';
import {Check,FileImage,Heart,MessageCircle} from 'lucide-react';

export function CaptureSteps({step=0}){return <ol className="capture-steps" aria-label="解读步骤">{['选截图','读图','看解释'].map((label,index)=><li key={label} className={index<=step?'is-current':''} aria-current={step===index?'step':undefined}><span>{index<step?<Check/>:index+1}</span>{label}</li>)}</ol>;}

export default function ReadingPreparation({demo=false,image,language,onReady}){
 const [stage,setStage]=useState(0),ready=useRef(onReady);ready.current=onReady;
 useEffect(()=>{
  const timers=[setTimeout(()=>setStage(1),700),setTimeout(()=>setStage(2),1500)];
  if(demo)timers.push(setTimeout(()=>ready.current?.(),2400));
  return()=>timers.forEach(clearTimeout);
 },[demo]);
 const steps=language==='henan'?['看看图里说了啥','换成好懂的话','把要留意的事说清楚']:['看看图里说了什么','换成好懂的话','把要留意的事说清楚'];
 return <section className="reading-preparation" role="status" aria-live="polite" aria-label="正在准备解读">
  <div className="preparation-art" aria-hidden="true"><div className="preparation-picture">{image?<img src={image} alt=""/>:<FileImage/>}<span/></div><div className="preparation-heart"><Heart/></div></div>
  <h2>{language==='henan'?'别急，咱慢慢讲':'别着急，慢慢讲给您听'}</h2>
  <p className="preparation-stage">{steps[stage]}</p>
  <p className="preparation-note">{demo?'演示图片 · 正在打开预先准备的解读':'正在解读您选择的截图，请稍等片刻。'}</p>
  <ol>{steps.map((step,index)=><li key={step} className={stage>=index?'is-ready':''}>{stage>index?<Check/>:<MessageCircle/>}<span>{step}</span></li>)}</ol>
 </section>;
}
