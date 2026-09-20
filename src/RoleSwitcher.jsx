import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeftRight,Check,ChevronDown} from 'lucide-react';
import {t} from './i18n.mjs';
export default function RoleSwitcher({mode,language,disabled,onChange}){
 const [open,setOpen]=useState(false),root=useRef(null),trigger=useRef(null);
 useEffect(()=>{
  if(!open)return;
  const outside=event=>{if(!root.current?.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 function choose(value){setOpen(false);if(value!==mode)onChange(value);trigger.current?.focus();}
 return <div className="role-switcher" ref={root} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}}}>
  <button ref={trigger} className="role-trigger" disabled={disabled} aria-expanded={open} aria-controls="role-options" onClick={()=>setOpen(!open)}><ArrowLeftRight aria-hidden="true"/><span>{t('switchRole',language)}</span><ChevronDown aria-hidden="true"/></button>
  {open&&<div className="role-options" id="role-options" aria-label={t('switchRole',language)}>
   <p>{t('currentRole',language)} · {t(mode==='self'?'elderMode':'helperMode',language)}</p>
   {[['self','roleSelf'],['helper','roleHelper']].map(([value,key])=><button key={value} aria-pressed={mode===value} onClick={()=>choose(value)}><span>{t(key,language)}</span>{mode===value&&<Check aria-hidden="true"/>}</button>)}
  </div>}
 </div>;
}
