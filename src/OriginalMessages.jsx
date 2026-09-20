import React,{useRef} from 'react';
import {Volume2} from 'lucide-react';
import {t} from './i18n.mjs';
import {originalNarrations} from './narration.mjs';
import {NarratedText,ReadButton} from './Playback';

export default function OriginalMessages({items,language,narrator}){
 const details=useRef(null),original=originalNarrations(items);
 const active=narrator?.spokenText===original.all&&narrator?.status==='playing';
 function readAll(event){
  event.preventDefault();event.stopPropagation();
  details.current.open=true;
  narrator.speak(original.all,language==='henan'?'念完全部原话':'读完全部原话');
 }
 return <details ref={details} className="original"><summary><span>{t('original',language)}</span>{narrator&&<button type="button" className={'read-button speaker-button'+(active?' is-reading':'')} aria-label={language==='henan'?'念完全部原话':'读完全部原话'} aria-pressed={active} onClick={readAll}><Volume2 aria-hidden="true"/></button>}</summary><p className="fine">{t('originalNote',language)}</p>{original.rows.map((item,index)=><div className="original-message" key={index}><div className="original-person"><strong><NarratedText text={item.speaker} narrator={narrator} context={item.speech}/></strong>{item.kindLabel&&<span>{item.kindLabel}</span>}</div><p><NarratedText text={item.text} narrator={narrator} context={item.speech}/></p>{narrator&&<ReadButton text={item.speech} language={language} narrator={narrator}/>}</div>)}</details>;
}
