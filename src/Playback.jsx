import {assetUrl} from './assets.mjs';
import React,{useEffect,useRef,useState} from 'react';
import {Volume2,Play,Pause,RotateCcw,LoaderCircle} from 'lucide-react';
import {t} from './i18n.mjs';
import {READING_RATES} from './preferences.mjs';
import {request} from './api.mjs';
import {activeRange,localRange} from './reading-progress.mjs';

const retryLabel=language=>language==='henan'?'再试一回':'再试一次';
const playbackError=(language,video=false)=>language==='henan'
 ?`${video?'视频':'声音'}这回没放出来，点“再试一回”就中。`
 :`${video?'视频':'声音'}这次没有播放成功，请点“再试一次”。`;

export function SlowControls({rate,onRate,language}){return <div className="slow-controls" role="group" aria-label={t('settings',language)}>{['normal','slow','slower'].map((key,i)=><button key={key} aria-pressed={rate===READING_RATES[i]} onClick={()=>onRate(READING_RATES[i])}>{t(key,language)}</button>)}</div>;}
export function useNarrator({language,rate}){
 const rateRef=useRef(rate),languageRef=useRef(language);rateRef.current=rate;languageRef.current=language;
 const player=useRef(null),pending=useRef(null),token=useRef(0),owned=useRef(''),currentKey=useRef(''),lastRequest=useRef(null);
 const [state,setState]=useState({status:'idle',label:'',error:''});
 const [progress,setProgress]=useState({text:'',cues:[],time:0});
 useEffect(()=>{if(state.status!=='playing')return;const timer=setInterval(()=>setProgress(p=>({...p,time:player.current?.currentTime||0})),50);return()=>clearInterval(timer);},[state.status]);
 function stop(){setProgress({text:'',cues:[],time:0});token.current++;currentKey.current='';lastRequest.current=null;pending.current?.abort();pending.current=null;player.current?.pause();if(owned.current){URL.revokeObjectURL(owned.current);owned.current='';}if(player.current){player.current.removeAttribute('src');player.current.load();}setState({status:'idle',label:'',error:''});}
 useEffect(()=>{
  const audio=new Audio();audio.preload='auto';player.current=audio;
  const playing=()=>{if(currentKey.current)setState(s=>({...s,status:'playing',error:''}));};
  const paused=()=>setState(s=>s.status==='playing'?{...s,status:'paused'}:s);
  const ended=()=>{if(currentKey.current)setState(s=>({...s,status:'ended'}));};
  const failed=()=>{if(currentKey.current)setState(s=>({...s,status:'error',error:playbackError(languageRef.current)}));};
  const listeners={play:playing,pause:paused,ended,error:failed};
  for(const [event,listener] of Object.entries(listeners))audio.addEventListener(event,listener);
  return()=>{
   token.current++;currentKey.current='';lastRequest.current=null;pending.current?.abort();pending.current=null;
   for(const [event,listener] of Object.entries(listeners))audio.removeEventListener(event,listener);
   audio.pause();audio.removeAttribute('src');audio.load();
   if(owned.current){URL.revokeObjectURL(owned.current);owned.current='';}
   if(player.current===audio)player.current=null;
  };
 },[]);
 useEffect(()=>{stop();},[language]);
 useEffect(()=>{if(player.current){player.current.playbackRate=rate;player.current.defaultPlaybackRate=rate;player.current.preservesPitch=true;}},[rate]);
 async function resume(){
  const audio=player.current,mine=token.current;if(!audio?.src)return;
  setState(s=>({...s,status:'ready',error:''}));
  try{audio.playbackRate=rateRef.current;await audio.play();}
  catch(error){if(mine!==token.current||error.name==='AbortError')return;setState(s=>({...s,status:'error',error:playbackError(languageRef.current)}));}
 }
 async function speak(text,label=text,src){
  document.querySelectorAll('video').forEach(video=>video.pause());const key=language+'|'+text+'|'+(src||'');
  if(currentKey.current===key&&player.current?.src&&state.status!=='error'){if(!player.current.paused)player.current.pause();else await resume();return;}
  stop();const mine=++token.current;currentKey.current=key;lastRequest.current={text,label,src};setState({status:'loading',label,error:''});
  const controller=new AbortController();pending.current=controller;
  try{
   let url=assetUrl(src),cues=[];
   if(!url){const value=await request('/speech',{text,voice:'xiaoyi',language},{responseType:'narration',signal:controller.signal});if(mine!==token.current)return;const blob=value.blob||new Blob([Uint8Array.from(atob(value.audio),c=>c.charCodeAt(0))],{type:'audio/mpeg'});cues=value.cues||[];url=URL.createObjectURL(blob);owned.current=url;}
   else{try{const response=await fetch(assetUrl(src).replace(/\.mp3$/,'.timing.json'),{signal:controller.signal});if(response.ok)cues=(await response.json()).cues||[];}catch{}}
   if(mine===token.current)setProgress({text,cues,time:0});
   if(mine!==token.current)return;
   player.current.src=url;player.current.playbackRate=rateRef.current;player.current.defaultPlaybackRate=rateRef.current;
   setState({status:'ready',label,error:''});await resume();
  }catch(error){if(mine!==token.current||error.name==='AbortError')return;setState({status:'error',label,error:error.message});}
  finally{if(pending.current===controller)pending.current=null;}
 }
 function retry(){const request=lastRequest.current;if(request){currentKey.current='';return speak(request.text,request.label,request.src);}}
 function pause(){player.current?.pause();}
 async function again(){if(player.current?.src){player.current.currentTime=0;setProgress(p=>({...p,time:0}));await resume();}}
 return {...state,spokenText:progress.text,activeCue:['playing','paused'].includes(state.status)?activeRange(progress.cues,progress.time):null,speak,stop,pause,resume,again,retry};
}
export function NarratedText({text,narrator,context}){
 const range=localRange(text,narrator?.spokenText,narrator?.activeCue,context);let offset=0;
 return <span className="narrated-copy">{Array.from(text).map((char,i)=>{const index=offset;offset+=char.length;return <span key={i} className={range&&index>=range.from&&index<range.to?'spoken-word':''}>{char}</span>;})}</span>;
}
export function ContentHeading({title,text,narrator,language,whole=false,level=2}){
 const Heading=`h${level}`;
 const label=language==='henan'?(whole?'听完整讲解':'听完这一块'):(whole?'听完整解读':'听完这一部分');
 if(!narrator)return <Heading>{title}</Heading>;
 const active=narrator.spokenText===text&&narrator.status==='playing';
 return <div className="content-reading-heading"><Heading><button className={'content-title-button'+(active?' is-reading':'')} aria-label={label+'：'+title} aria-pressed={active} onClick={()=>narrator.speak(text,label)}><NarratedText text={title} narrator={narrator}/><Volume2 aria-hidden="true"/></button></Heading><p>{language==='henan'?'点标题，':'点标题，'}{label}</p></div>;
}
export function ReadButton({text,language,narrator,title=false}){
 const active=narrator.spokenText===text&&narrator.status==='playing';
 return <button className={'read-button speaker-button'+(active?' is-reading':'')} onClick={()=>narrator.speak(text,title?t('readTitle',language):t('readParagraph',language))} aria-label={t(title?'readTitle':'readParagraph',language)+': '+text} aria-pressed={active}><Volume2 aria-hidden="true"/></button>;
}
export function NarratorPanel({narrator,language,rate,onRate}){if(narrator.status==='idle')return null;const active=narrator.status==='playing';return <section className="narrator-panel" aria-label={t('voiceInfo',language)}><div className="narrator-status" aria-live="polite"><Volume2/><strong>{t(narrator.status==='error'?'errorPrefix':narrator.status==='loading'?'preparing':active?'playing':narrator.status==='ended'?'ended':'ready',language)}</strong></div><p className="narrator-label">{narrator.label}</p>{narrator.error?<><p role="alert" className="notice error">{narrator.error}</p><button className="primary" onClick={narrator.retry}><RotateCcw/>{retryLabel(language)}</button></>:<div className="play-buttons"><button className="primary" disabled={narrator.status==='loading'} onClick={active?narrator.pause:narrator.resume}>{narrator.status==='loading'?<LoaderCircle/>:active?<Pause/>:<Play/>}{t(active?'pause':'play',language)}</button><button className="secondary" disabled={narrator.status==='loading'} onClick={narrator.again}><RotateCcw/>{t('again',language)}</button></div>}<SlowControls rate={rate} onRate={onRate} language={language}/></section>;}
export function GentleVideo({src,poster,language,rate,onRate,onPlay,compact=false}){
 const ref=useRef(null),attempt=useRef(0);const [playing,setPlaying]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{if(ref.current){ref.current.playbackRate=rate;ref.current.defaultPlaybackRate=rate;ref.current.preservesPitch=true;}},[rate,src]);
 useEffect(()=>{const video=ref.current;setPlaying(false);setError(false);return()=>{attempt.current++;video?.pause();};},[src]);
 async function toggle(){
  const video=ref.current;if(!video)return;
  if(playing){attempt.current++;video.pause();return;}
  const mine=++attempt.current;onPlay?.();setError(false);
  try{if(error||video.error)video.load();video.playbackRate=rate;await video.play();}
  catch(failure){if(mine===attempt.current&&failure.name!=='AbortError'){setPlaying(false);setError(true);}}
 }
 return <div className="gentle-video"><video ref={ref} src={assetUrl(src)} poster={assetUrl(poster)} playsInline controls={compact} preload="metadata" onPlay={()=>{onPlay?.();setPlaying(true);setError(false);}} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>{setPlaying(false);setError(true);}}/>{(!compact||error)&&<button className="primary" onClick={toggle}>{playing?<Pause/>:<Play/>}{error?retryLabel(language):playing?t('pause',language):language==='henan'?'放这个视频':'播放视频'}</button>}{error&&<p role="alert" className="notice error">{playbackError(language,true)}</p>}</div>;
}
