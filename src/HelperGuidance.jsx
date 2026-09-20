import React from 'react';
import {MessageCircleHeart} from 'lucide-react';
import {helperGuidance} from './helper-guidance.mjs';
import './helper-guidance.css';

export default function HelperGuidance({result,record}){
 const {uncertainties,suggestions}=helperGuidance(result,record);
 return <aside className="helper-guidance" aria-label="给子女的沟通提示">
  <div className="guidance-label"><MessageCircleHeart aria-hidden="true"/><span>给你的小提醒</span></div>
  <p className="guidance-note">只给你看，不会放进给家人的长图或视频。</p>
  {uncertainties.length>0&&<section className="uncertainties"><h2>还没说清的地方</h2><ul>{uncertainties.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
  <section className="communication-suggestions"><h2>沟通建议</h2><ul>{suggestions.map((item,index)=><li key={index}>{item}</li>)}</ul></section>
 </aside>;
}
