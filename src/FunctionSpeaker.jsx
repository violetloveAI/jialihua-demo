import React,{createContext,useContext} from 'react';
import {Volume2} from 'lucide-react';
import {functionVoice} from './function-voice.mjs';
export const FunctionVoiceContext=createContext(null);
export default function FunctionSpeaker({id}){
 const voice=useContext(FunctionVoiceContext);if(!voice)return null;
 const {narrator,language}=voice,item=functionVoice(id,language);if(!item)return null;
 const active=narrator.spokenText===item.text&&narrator.status==='playing';
 return <button type="button" className={'read-button speaker-button function-speaker'+(active?' is-reading':'')} aria-label={'听功能说明：'+item.label} aria-pressed={active} onClick={()=>narrator.speak(item.text,item.label)}><Volume2 aria-hidden="true"/></button>;
}
