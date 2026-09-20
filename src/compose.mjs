import {id} from './domain.mjs';

export function compositionDraft(record = {}) {
 return {
  title: record.title || '',
  text: record.text ?? record.explanation ?? record.items?.map(item => item.text).join('\n') ?? '',
  attachments: record.attachments || record.composeImages || [],
 };
}

export function createCompositionRecord({title = '', text, attachments = [], exportLanguage = 'mandarin'}) {
 if (typeof text !== 'string' || !text.trim()) throw new Error('先写下要给家人看的文字。');
 if (!Array.isArray(attachments) || attachments.length > 3) throw new Error('一条消息最多放 3 张图片。');
 if (attachments.some(image => !isLocalPicture(image?.dataUrl))) throw new Error('请选择手机里的 PNG、JPG 或 WebP 图片。');
 const body = text.trim();
 const name = title.trim() || [...body.split('\n')[0]].slice(0, 24).join('');
 const result = {title:name, sourceType:'unknown', items:[{speaker:'家人',text:body}], explanation:body, glossary:[], uncertainties:[]};
 return {...result,id:id(),mode:'helper',account:'family-demo',sourceKind:'composition',sample:false,sampleGenerated:false,images:[],attachments:attachments.map(image=>({...image})),language:'mandarin',createdAt:new Date().toISOString(),translations:{mandarin:{...result,language:'mandarin'},henan:{...result,language:'henan'}},exportLanguage:exportLanguage==='henan'?'henan':'mandarin'};
}

export function isLocalPicture(url) {
 return typeof url === 'string' && (/^data:image\/(?:png|jpeg|webp);base64,/i.test(url) || /^\/(?!\/)/.test(url));
}
