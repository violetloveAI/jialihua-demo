import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,Check,Volume2,Pause,LoaderCircle} from 'lucide-react';import {useNarrator} from './Playback';
import {getDemoResult} from './demo.mjs';
import {tutorialSteps,tutorialPracticeSteps,tutorialCopy,tutorialAudio} from './tutorial-content.mjs';import {tutorialPlacement} from './tutorial-layout.mjs';
export default function TutorialOverlay({mode,language,rate=1,fontLevel=0,backgroundRef,onClose,onStepChange}){
 const role=mode==='self'?'self':'helper',elder=role==='self';const [practice,setPractice]=useState(false),[index,setIndex]=useState(0),[geometry,setGeometry]=useState(null);const steps=practice?tutorialPracticeSteps[role]:tutorialSteps[role],item=steps[index],copy=tutorialCopy(item,elder?language:'mandarin');
 const [portal,setPortal]=useState(document.body);
 useLayoutEffect(()=>{setPortal(backgroundRef.current?.closest('.device-viewport')||document.body);},[backgroundRef]);
 const panel=useRef(null),next=useRef(null),close=useRef(onClose),narrator=useNarrator({language,rate}),voice=useRef(narrator);voice.current=narrator;close.current=onClose;
 useEffect(()=>{
  const background=backgroundRef.current,previous=document.activeElement,bodyOverflow=document.body.style.overflow,main=background?.querySelector('.phone>main'),scrollTop=main?.scrollTop||0,mainOverflow=main?.style.overflow;
  background?.setAttribute('inert','');document.body.style.overflow='hidden';if(main)main.style.overflow='hidden';
  const focusable=()=>[...(panel.current?.querySelectorAll('button:not(:disabled)')||[])];
  function keys(e){if(e.key==='Escape'){e.preventDefault();close.current();}if(e.key==='Tab'){const nodes=focusable(),first=nodes[0],last=nodes.at(-1);if(!first)return;if(e.shiftKey&&(document.activeElement===first||!panel.current.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!panel.current.contains(document.activeElement))){e.preventDefault();first.focus();}}}
  function containFocus(e){if(panel.current&&!panel.current.contains(e.target))next.current?.focus({preventScroll:true});}
  document.addEventListener('keydown',keys);document.addEventListener('focusin',containFocus);next.current?.focus({preventScroll:true});
  return()=>{voice.current.stop();document.removeEventListener('keydown',keys);document.removeEventListener('focusin',containFocus);background?.removeAttribute('inert');document.body.style.overflow=bodyOverflow;if(main){main.style.overflow=mainOverflow;main.scrollTop=scrollTop;}if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{const v=voice.current;v.stop();if(elder)v.speak(copy.title+'。'+copy.body,'教程 · '+copy.title,tutorialAudio(role,(practice?'practice-':'')+item.id,language));return()=>v.stop();},[index,practice,language,role]);
 useLayoutEffect(()=>{
  const target=backgroundRef.current?.querySelector(item.target);target?.scrollIntoView?.({block:'start',inline:'nearest',behavior:'instant'});
  function measure(){
   const bounds=portal===document.body?{left:0,top:0,width:window.innerWidth,height:window.innerHeight}:portal.getBoundingClientRect();
   const width=bounds.width||window.innerWidth,height=bounds.height||window.innerHeight,rect=target?.getBoundingClientRect();let r=rect?{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}:null;
   if(r){for(let parent=target.parentElement;parent&&parent!==document.body;parent=parent.parentElement){const css=window.getComputedStyle(parent);if(/auto|scroll|hidden|clip/.test(css.overflow+css.overflowY+css.overflowX)){const box=parent.getBoundingClientRect();r.left=Math.max(r.left,box.left);r.top=Math.max(r.top,box.top);r.right=Math.min(r.right,box.right);r.bottom=Math.min(r.bottom,box.bottom);}}r.left=Math.max(8,r.left-bounds.left);r.top=Math.max(8,r.top-bounds.top);r.right=Math.min(width-8,r.right-bounds.left);r.bottom=Math.min(height-8,r.bottom-bounds.top);r.width=r.right-r.left;r.height=r.bottom-r.top;}
   const valid=r&&r.width>0&&r.height>0;const card=panel.current?.getBoundingClientRect()||{};const anchor=valid?r:{left:width/2,top:30,right:width/2,bottom:30,width:0,height:0};
   const place=tutorialPlacement({target:anchor,card:{width:Math.min(elder?390:360,width-24),height:card.height},viewport:{width,height}});
   const value={target:valid?r:null,...place};setGeometry(old=>JSON.stringify(old)===JSON.stringify(value)?old:value);
  }
  function alignTarget(){const main=backgroundRef.current?.querySelector('.phone>main');if(target&&main?.contains(target)){const a=target.getBoundingClientRect(),b=main.getBoundingClientRect();main.scrollTop+=a.top-b.top-12;}measure();}
  measure();const frame=window.requestAnimationFrame?.(alignTarget);if(!window.requestAnimationFrame)alignTarget();const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;if(target)observer?.observe(target);if(panel.current)observer?.observe(panel.current);if(portal!==document.body)observer?.observe(portal);
  window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);document.addEventListener('scroll',measure,true);next.current?.focus({preventScroll:true});
  return()=>{if(frame)window.cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);document.removeEventListener('scroll',measure,true);};
 },[index,practice,elder,portal]);
 function replay(){narrator.stop();narrator.speak(copy.title+'。'+copy.body,'教程 · '+copy.title,tutorialAudio(role,(practice?'practice-':'')+item.id,language));}
 function select(at,inPractice=practice){narrator.stop();const list=inPractice?tutorialPracticeSteps[role]:tutorialSteps[role];onStepChange?.(list[at]);setPractice(inPractice);setIndex(at);}
 function advance(){if(item.invite)select(0,true);else if(index===steps.length-1)onClose();else select(index+1);}
 function previous(){if(index>0)select(index-1);else if(practice)select(tutorialSteps[role].length-1,false);}
 function hearExample(){const sample=getDemoResult('W1',language);narrator.stop();narrator.speak(sample.explanation,'案例讲解',`/demo/W1-${language}.mp3`);}
 const last=index===steps.length-1,active=narrator.status==='playing';const hole=geometry?.target;const nextLabel=item.invite?'是，继续学主功能':last?'学会了，开始用':(item.next?(language==='henan'&&elder?item.next.replace('帮我','帮俺'):item.next):'下一步');
 return createPortal(<div data-tour-step={item.id} data-tour-phase={practice?'practice':'overview'} className={'tutorial-layer tutorial-contained '+(elder?'tutorial-elder':'tutorial-helper')} style={{'--tutorial-copy':(elder?[28,30,32,34][fontLevel]:19)+'px'}}>
  <div className={'tutorial-blocker'+(!hole?' no-spotlight':'')} aria-hidden="true"/>{hole&&<div className="tutorial-spotlight" aria-hidden="true" style={{left:hole.left-5,top:hole.top-5,width:hole.width+10,height:hole.height+10}}/>}
  {practice&&hole&&(item.next||item.example)&&<button className="tutorial-target-action" tabIndex={-1} aria-hidden="true" onPointerDown={e=>e.preventDefault()} onClick={item.example?hearExample:advance} style={{left:hole.left,top:hole.top,width:hole.width,height:hole.height}}/>}
  <section ref={panel} className={'tutorial-card'+(elder&&geometry?.maxHeight<360?' tutorial-tight':'')} role="dialog" aria-modal="true" aria-label={elder?'老人使用教程':'子女使用教程'} aria-describedby="tutorial-copy" style={{left:geometry?.left??16,top:geometry?.top??16,width:geometry?.width??'min(390px, calc(100vw - 32px))',maxHeight:geometry?.maxHeight}}>
   <div className="tutorial-topline"><span>{practice?'预览案例 · 操作练习':elder?'慢慢学，一步就好':'家里话 · 使用指南'}</span><button className="tutorial-exit" onClick={onClose}>先不学了</button></div>
   <div className="tutorial-progress" aria-label={`第 ${index+1} 步，共 ${steps.length} 步`}><strong>{String(index+1).padStart(2,'0')}<small> / {String(steps.length).padStart(2,'0')}</small></strong><span className={steps.length>10?'tutorial-chapter':''}>{steps.length>10?(item.chapter||'跟着案例操作'):steps.map((s,i)=><i key={s.id} className={i===index?'active':i<index?'done':''}/>)}</span></div>
   <div className="tutorial-copy-scroll" key={item.id}><h2>{copy.title}</h2><p id="tutorial-copy">{copy.body}</p>{elder&&item.example&&<button className="tutorial-example-listen" onClick={hearExample}><Volume2 aria-hidden="true"/>听听这段解释</button>}</div>
   {elder&&<div className="tutorial-voice-row"><button onClick={replay} className="tutorial-replay" aria-label="再听一遍教程"><Volume2 aria-hidden="true"/>再听一遍</button>{active?<button className="tutorial-pause" onClick={narrator.pause} aria-label="暂停教程配音"><Pause aria-hidden="true"/>暂停</button>:<span className="tutorial-voice-state" aria-live="polite">{narrator.status==='loading'?<LoaderCircle aria-hidden="true"/>:null}{narrator.status==='loading'?'准备声音':language==='henan'?'河南话':'普通话'}</span>}</div>}
   {elder&&narrator.error&&<p className="tutorial-error" role="alert">声音没放出来，请点“再听一遍”。</p>}
   <div className={"tutorial-actions"+(item.invite?" tutorial-invite-actions":"")}><button disabled={index===0&&!practice} onClick={previous}><ArrowLeft aria-hidden="true"/>上一步</button>{item.invite&&<button className="tutorial-decline" onClick={onClose}>暂时不用，开始使用</button>}<button className="tutorial-next" ref={next} onClick={advance}>{last&&!item.invite?<Check aria-hidden="true"/>:null}{nextLabel}{(!last||item.invite)&&<ArrowRight aria-hidden="true"/>}</button></div>
  </section>
 </div>,portal);
}
