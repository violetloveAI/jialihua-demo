import React,{useEffect,useRef,useState} from 'react';
import {Check,History,LoaderCircle} from 'lucide-react';
import {t} from './i18n.mjs';
import FunctionSpeaker from './FunctionSpeaker';

export default function SaveRecordAction({onSave,language}){
 const [state,setState]=useState('idle'),busy=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function save(){
  if(busy.current)return;busy.current=true;setState('saving');
  try{await onSave();if(alive.current)setState('saved');}
  catch{if(alive.current)setState('error');}
  finally{busy.current=false;}
 }
 const label=state==='saved'?'已保存':state==='saving'?(language==='henan'?'正存着哩…':'正在保存…'):t('saveRecord',language);
 return <div className="save-record-action"><div className="function-action"><button type="button" className={'secondary save-record-button'+(state==='saved'?' is-saved':'')} disabled={state==='saving'} aria-label={label} aria-busy={state==='saving'} onClick={save}>{state==='saved'?<Check aria-hidden="true"/>:state==='saving'?<LoaderCircle aria-hidden="true"/>:<History aria-hidden="true"/>}<span role="status" aria-live="polite" aria-atomic="true">{label}</span></button><FunctionSpeaker id="save"/></div>{state==='error'&&<p className="save-record-error" role="alert">{language==='henan'?'这回没存上，再点一回。':'这次没有保存成功，请再点一次。'}</p>}</div>;
}
