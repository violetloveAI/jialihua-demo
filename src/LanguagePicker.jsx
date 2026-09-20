import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown} from 'lucide-react';
import FunctionSpeaker from './FunctionSpeaker';

export default function LanguagePicker({value='mandarin',onChange,disabled=false,label='用熟悉的话',variant='compact'}){
 const [open,setOpen]=useState(false),trigger=useRef(null),dialog=useRef(null);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.querySelector('button')?.focus();return()=>{document.body.style.overflow=previous;trigger.current?.focus();};},[open]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 function keys(event){if(event.key==='Escape'){event.preventDefault();setOpen(false);}if(event.key==='Tab'){const nodes=dialog.current?.querySelectorAll('button:not(:disabled),[tabindex="0"]');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}
 return <div className={'language-picker '+variant}>
  {label&&<span className="language-picker-label">{label}</span>}
  <div className="language-switch" role="group" aria-label={label||'语言'}>
   <button disabled={disabled} aria-pressed={value==='mandarin'} onClick={()=>onChange('mandarin')}>普通话</button>
   <button ref={trigger} disabled={disabled} aria-pressed={value==='henan'} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>方言<ChevronDown aria-hidden="true"/></button>
  </div>
  {value==='henan'&&<span className="chosen-dialect">河南话</span>}
  {open&&createPortal(<div className="sheet-scrim" onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section className={'language-sheet '+variant} role="dialog" aria-modal="true" aria-labelledby="dialect-heading" aria-describedby="dialect-note" ref={dialog} onKeyDown={keys}>
   <div className="sheet-handle" aria-hidden="true"/><header><button onClick={()=>setOpen(false)}>取消</button><h2 id="dialect-heading">选择家乡话</h2><FunctionSpeaker id="language"/></header>
   <p className="dialect-invitation">让熟悉的乡音，把话讲到心里。</p>
   <div className="dialect-wheel" role="listbox" aria-label="家乡话"><div className="wheel-selection" role="option" aria-selected="true" tabIndex={0}>河南话<Check aria-hidden="true"/></div></div>
   <p id="dialect-note">Demo 版只做河南方言，<br/>未来正式版会补齐其他方言。</p>
   <button className="primary dialect-confirm" onClick={()=>{onChange('henan');setOpen(false);}}>用河南话</button>
  </section></div>,document.querySelector('.device-viewport')||document.body)}
 </div>;
}
