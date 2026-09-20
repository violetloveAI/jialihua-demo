import {assetUrl} from './assets.mjs';
import React,{useState} from 'react';
import {ArrowRight,ImagePlus,LoaderCircle,Sparkles,X} from 'lucide-react';
import {prepareImage} from './api.mjs';
import {validateFiles} from './domain.mjs';
import {compositionDraft,createCompositionRecord} from './compose.mjs';
import HelperGuidance from './HelperGuidance';

export default function Compose({language,onCreate,onCancel,defaultRecord,examples=[]}) {
 const [draft,setDraft]=useState(()=>compositionDraft(defaultRecord));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const set=(key,value)=>setDraft(current=>({...current,[key]:value}));
 async function chooseImages(event) {
  const files=Array.from(event.target.files||[]);event.target.value='';if(!files.length)return;
  setError('');
  try {
   if(draft.attachments.length+files.length>3)throw new Error('一条消息最多放 3 张图片，先删一张再添加吧。');
   validateFiles(files);setBusy(true);
   const pictures=await Promise.all(files.map(prepareImage));
   setDraft(current=>({...current,attachments:[...current.attachments,...pictures]}));
  }catch(failure){setError(failure.message);}finally{setBusy(false);}
 }
 async function create(event) {
  event.preventDefault();setError('');setBusy(true);
  try{await onCreate(createCompositionRecord({...draft,exportLanguage:defaultRecord?.exportLanguage||language}));}catch(failure){setError(failure.message);}finally{setBusy(false);}
 }
 return <form className="compose-panel" onSubmit={create}>
  <div className="compose-intro"><span className="compose-kicker">写一条家里话</span><p>一段近况，几张照片。让爸妈慢慢看，也能听。</p></div>
  {examples[0]&&<section className="demo-import-card"><div><Sparkles aria-hidden="true"/><strong>先给爸妈带一份好消息</strong></div><p>已准备好「周日回家吃饺子」的文字和配图。导入后，试着做成长图或有声视频。</p><button className="secondary" type="button" disabled={busy} onClick={()=>{setDraft(compositionDraft(examples[0]));setError('');}}>导入演示文案</button></section>}
  {examples.length>0&&<div className="compose-examples"><span><Sparkles aria-hidden="true"/>先试一条</span><div>{examples.map((example,index)=><button type="button" key={example.id||index} disabled={busy} onClick={()=>{setDraft(compositionDraft(example));setError('');}}>{example.title||'示例 '+(index+1)}</button>)}</div></div>}
  <label className="compose-field">消息标题 <span>选填</span><input value={draft.title} maxLength={40} disabled={busy} placeholder="比如：这周日回家吃饭" onChange={event=>set('title',event.target.value)}/></label>
  <label className="compose-field">要发给家人的话<textarea value={draft.text} disabled={busy} rows={7} placeholder={'粘贴聊天文字，或直接写下来。\n妈，我这周日回家，想吃您包的饺子。'} onChange={event=>set('text',event.target.value)}/></label>
  <div className="compose-text-note"><span>按你写的原文制作，时间和金额都保留。</span><span>{Array.from(draft.text).length} 字</span></div>
  <div className="compose-picture-heading"><strong>加几张照片</strong><span>{draft.attachments.length} / 3</span></div>
  <div className="compose-pictures">
   {draft.attachments.map((picture,index)=><figure key={index}><img src={assetUrl(picture.dataUrl)} alt={picture.name||'配图 '+(index+1)}/><button type="button" disabled={busy} aria-label={'删除图片 '+(index+1)} onClick={()=>set('attachments',draft.attachments.filter((_,i)=>i!==index))}><X aria-hidden="true"/></button></figure>)}
   {draft.attachments.length<3&&<label className={'compose-add-picture'+(busy?' is-busy':'')}><ImagePlus aria-hidden="true"/><span>选择图片</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy} aria-label="选择图片" onChange={chooseImages}/></label>}
  </div>
  <p className="compose-note">PNG、JPG、WebP，每张不超过 15 MB。图片直接用于排版。</p>
  {draft.text.trim()&&<HelperGuidance result={{}} record={{sourceKind:'composition'}}/>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  <button className="primary compose-next" type="submit" disabled={busy||!draft.text.trim()}>{busy?<LoaderCircle className="spin"/>:<ArrowRight/>}{busy?'正在准备':'预览并选择导出'}</button>
  {onCancel&&<button className="quiet compose-cancel" type="button" disabled={busy} onClick={onCancel}>先不制作</button>}
 </form>;
}
