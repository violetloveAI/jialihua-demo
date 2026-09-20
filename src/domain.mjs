export const sourceLabels={auto:'自动判断',wechat_chat:'微信聊天',sms:'短信',moments:'朋友圈',unknown:'截图'};
export function findRecords(records,{mode,query='',source='all'}={}){
 const q=query.trim().toLocaleLowerCase();
 return records.filter(r=>(!mode||r.mode===mode)&&(source==='all'||r.sourceType===source)&&(!q||[r.title,r.explanation,...(r.items||[]).flatMap(i=>[i.speaker,i.text]),...(r.uncertainties||[]),...Object.values(r.translations||{}).flatMap(v=>[v.title,v.explanation,...(v.uncertainties||[])])].join('\n').toLocaleLowerCase().includes(q))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export function makePages(text){
 if(typeof text!=='string'||!text.trim())throw new Error('先写好要给长辈看的内容。');
 const chars=Array.from(text);if(chars.length>720)throw new Error('内容太长，请分成两段视频，每段不超过720字。');
 const pages=[];let cursor=0;
 while(cursor<chars.length){let end=Math.min(cursor+90,chars.length);
  if(end<chars.length){for(let i=end-1;i>cursor+35;i--){if(/[。！？；\n]/.test(chars[i])){end=i+1;break;}}}
  pages.push(chars.slice(cursor,end).join(''));cursor=end;
 }
 if(pages.length>8)throw new Error('内容太长，请再精简一些，最多8页。');
 return pages;
}
export function validateFiles(files){
 if(!files.length||files.length>3)throw new Error('请选择1到3张截图。');
 for(const file of files){if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('请选择PNG、JPG或WebP截图。');if(file.size>15*1024*1024)throw new Error('有张图超过15MB，请先裁剪。');}
}
export function id(){return globalThis.crypto?.randomUUID?.()||'local-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
