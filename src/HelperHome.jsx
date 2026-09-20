import React from 'react';
import {ArrowUpRight,ChevronRight,PenLine,Play,Heart} from 'lucide-react';
import Illustration from './Illustration';
import {localResult} from './demo.mjs';
export default function HelperHome({language,records,onUpload,onHistory,onVideo,onRecord,onCases}){
 const works=records.filter(row=>row.sourceKind==='composition').slice(0,2);
 return <div className="family-home">
  <section className="family-welcome">
   <span className="family-kicker"><Heart aria-hidden="true"/>把惦记，变成他们听得懂的话</span>
   <h1>有些关心，<br/>慢慢说给爸妈听。</h1>
   <p>字大一些，话亲一些，<br/>隔着屏幕，也像坐在一起。</p>
   <div className="family-art"><Illustration kind="helperHome" eager/></div>
  </section>
  <button data-tour="create" className="family-create" onClick={onUpload}>
   <span className="family-create-icon"><PenLine aria-hidden="true"/></span>
   <span><strong>写给家人的话</strong><small>文字和照片，做成好读的图文或视频</small></span><ArrowUpRight aria-hidden="true"/>
  </button>
  <div className="family-shortcuts">
   <button data-tour="cases" onClick={onCases}><span className="shortcut-art"><Illustration kind="screenshot"/></span><strong>解释发过的消息</strong><small>微信、朋友圈，讲给爸妈听</small><ChevronRight aria-hidden="true"/></button>
   <button data-tour="video" onClick={onVideo}><span className="shortcut-art"><Illustration kind="video"/></span><strong>先看一个成片</strong><small>一盒饺子，一份想念</small><Play aria-hidden="true"/></button>
  </div>
  <section className="family-bottom-section">
   <div className="section-heading"><h2>{works.length?'留给家人的心意':'从一句日常开始'}</h2><button onClick={onHistory}>我的作品<ChevronRight/></button></div>
   {works.length?works.map(row=><button className="family-work" key={row.id} onClick={()=>onRecord(row)}><span><PenLine/></span><strong>{localResult(row,language)?.title||row.title}</strong><ChevronRight/></button>):<button className="family-example" onClick={onUpload}><span>周日回家，一起吃饺子</span><small>“妈，车票买好了，您别来车站接我。”</small><ArrowUpRight/></button>}
   <p className="family-footnote">做成大字长图，或一段会说家乡话的视频。</p>
  </section>
 </div>;
}
