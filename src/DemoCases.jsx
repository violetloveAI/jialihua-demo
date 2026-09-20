import React,{useState} from 'react';
import {ChevronRight} from 'lucide-react';
import {cases} from './data.mjs';
import {makeDemoRecords,getDemoResult} from './demo.mjs';
import {ReadButton} from './Playback';
import {caseImage} from './demo-assets.mjs';
import ScreenshotPreview,{ScreenshotImage} from './ScreenshotPreview';
import {sourceName} from './i18n.mjs';
export default function DemoCases({mode,language,onSelect,importing=false,narrator}){
 const [source,setSource]=useState('all');const rows=makeDemoRecords().filter(row=>row.mode===mode);
 return <div className="demo-case-gallery"><p className="case-intro">{importing?'点一张截图，选好后就能解读。':'有些话，换个说法就懂了。'}{!importing&&<><br/>图片点开可以放大看。</>}</p><div className="case-tabs" role="group" aria-label="消息来源">{[['all','全部'],['wechat_chat','微信'],['moments','朋友圈'],['sms','短信']].map(([id,name])=><button key={id} aria-pressed={source===id} onClick={()=>setSource(id)}>{name}</button>)}</div><div className="case-grid">{cases.filter(row=>source==='all'||row.sourceType===source).map(sample=><article className="case-card" key={sample.id}>{!importing&&<ScreenshotPreview className="case-thumbnail" src={caseImage(sample.id)} alt={sample.title} compact/>}<button className={'case-select'+(importing?' case-photo-select':'')} aria-label={(importing?'导入演示图片：':'查看解读：')+sample.title} onClick={()=>onSelect(rows.find(row=>row.caseId===sample.id))}>{importing&&<ScreenshotImage src={caseImage(sample.id)} alt={sample.title}/>}<span className="case-caption"><small>{sourceName(sample.sourceType,language)}</small><strong>{sample.title}</strong><span>{importing?'导入这张图':sample.theme}</span></span><ChevronRight aria-hidden="true"/></button>{narrator&&<ReadButton title text={getDemoResult(sample.id,language).title} language={language} narrator={narrator}/>}</article>)}</div><p className="case-disclosure">9 个虚构演示案例，图片和解释均已提前准备。</p></div>;
}
