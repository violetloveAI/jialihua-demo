import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,Languages,Type,Volume2} from 'lucide-react';
import {SlowControls} from './Playback';
import LanguagePicker from './LanguagePicker';
import FunctionSpeaker from './FunctionSpeaker';
import {t} from './i18n.mjs';
export default function ElderControls({fontLevel,onFont,rate,onRate,language,onLanguage,disabled=false}){
 const [open,setOpen]=useState(null),ref=useRef(null);
 useEffect(()=>{if(!open)return;const outside=event=>{if(!ref.current?.contains(event.target)&&!event.target.closest?.('.language-sheet'))setOpen(null);},escape=event=>{if(event.key==='Escape'&&!event.defaultPrevented){ref.current?.querySelector('.quick-trigger[aria-expanded="true"]')?.focus();setOpen(null);}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[open]);
 return <section ref={ref} className="elder-quick-controls" aria-label="语言、字体和声音">
  <div className="quick-menu"><button className="quick-trigger" data-tour="language" aria-label="语言" aria-expanded={open==='language'} disabled={disabled} onClick={()=>setOpen(open==='language'?null:'language')}><Languages aria-hidden="true"/><span>语言</span><ChevronDown aria-hidden="true"/></button>{open==='language'&&<div className="quick-popover language-popover"><div className="function-label"><strong>选择语言</strong><FunctionSpeaker id="language"/></div><LanguagePicker value={language} onChange={value=>{onLanguage(value);setOpen(null);}} disabled={disabled} label="" variant="elder"/></div>}</div>
  <div className="quick-menu"><button className="quick-trigger" data-tour="font" aria-label="调整字号" aria-expanded={open==='font'} onClick={()=>setOpen(open==='font'?null:'font')}><Type aria-hidden="true"/><span>字体</span><ChevronDown aria-hidden="true"/></button>{open==='font'&&<div className="quick-popover"><div className="function-label"><strong>{t('font',language)}</strong><FunctionSpeaker id="font"/></div><div className="quick-font-options" role="group" aria-label={t('font',language)}>{['font1','font2','font3','font4'].map((key,i)=><button key={key} aria-pressed={fontLevel===i} onClick={()=>{onFont(i);setOpen(null);}}>{t(key,language)}</button>)}</div></div>}</div>
  <div className="quick-menu"><button className="quick-trigger" data-tour="rate" aria-label="调整语速" aria-expanded={open==='rate'} onClick={()=>setOpen(open==='rate'?null:'rate')}><Volume2 aria-hidden="true"/><span>声音</span><ChevronDown aria-hidden="true"/></button>{open==='rate'&&<div className="quick-popover rate-popover"><div className="function-label"><strong>{language==='henan'?'念的快慢':'朗读速度'}</strong><FunctionSpeaker id="rate"/></div><SlowControls rate={rate} onRate={value=>{onRate(value);setOpen(null);}} language={language}/></div>}</div>
 </section>;
}
