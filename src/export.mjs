import {assetUrl} from './assets.mjs';
import {request} from './api.mjs';
import {narratedText} from './preferences.mjs';
import {isLocalPicture} from './compose.mjs';

const WIDTH=720, BODY_WIDTH=604, BODY_FONT='54px "PingFang SC", sans-serif', LINE_HEIGHT=76;
export const MAX_LONG_IMAGE_HEIGHT=16384;
const FONT='"PingFang SC", sans-serif';

export function exportContent(record,result,language='mandarin') {
 const translated=record.translations?.[language] || ((record.language||'mandarin')===language?record:null) || (record.sourceKind==='composition'?record:result) || record;
 const saved=record.exportTexts?.[language] ?? (record.exportLanguage===language?record.exportText:undefined) ?? (language==='mandarin'&&!record.exportLanguage?record.exportText:undefined);
 let text=saved??(record.sourceKind==='composition'?translated.explanation:narratedText(translated,language));
 // Remove only the exact automatic footer in older screenshot export drafts.
 const legacyFooter=translated.uncertainties?.length?'\n还有这些没说清：'+translated.uncertainties.join('；'):null;
 if(record.sourceKind!=='composition'&&legacyFooter&&text.endsWith(legacyFooter))text=text.slice(0,-legacyFooter.length).trimEnd();
 return {title:translated.title||record.title,text};
}

// Keep each raw chunk, including paragraph breaks, so pagination cannot drop narration.
function lines(context,text,width) {
 const result=[];let visible='',raw='';
 for(const char of Array.from(text)) {
  if(char==='\n'){result.push({text:visible,raw:raw+char});visible='';raw='';continue;}
  if(visible&&context.measureText(visible+char).width>width){result.push({text:visible,raw});visible='';raw='';}
  visible+=char;raw+=char;
 }
 if(raw||!result.length)result.push({text:visible,raw});
 return result;
}
function canvasFor(height) {
 const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=height;
 const context=canvas.getContext('2d');if(!context)throw new Error('这台设备暂时无法制作图片，请换个浏览器再试。');
 return {canvas,context};
}
function bodyText(text) {
 if(typeof text!=='string'||!text.trim())throw new Error('先写好要给长辈看的内容。');
 return text.trim().replace(/\r\n?/g,'\n');
}
function encode(canvas) {
 const dataUrl=canvas.toDataURL('image/png');
 if(!dataUrl.startsWith('data:image/png'))throw new Error('图片太大，这台设备没有保存成功，请把消息分成两条。');
 return dataUrl;
}
function footer(record,video) {
 const origin=record.sourceKind==='composition'?'家人写的消息':record.sample?(record.sampleGenerated?'虚构案例 · AI 辅助解释':'虚构演示 · 预先编写的解释'):'AI 辅助解释 · 请对照原文';
 return video?origin+' · AI '+(record.language==='henan'?'河南话':'普通话')+'配音':origin;
}
function heading(context,title) {
 context.font='bold 40px '+FONT;
 const wrapped=lines(context,title||'给家人的消息',616);
 if(wrapped.length>3)throw new Error('标题太长，请缩短到 40 字以内再导出。');
 return wrapped;
}
function background(context,height) {
 context.fillStyle='#f8f5e9';context.fillRect(0,0,WIDTH,height);
 context.fillStyle='#356450';context.fillRect(0,0,WIDTH,100);
 context.fillStyle='#fffdf3';context.font='bold 28px '+FONT;context.fillText('家里话   /   把心意慢慢说',48,64);
}
function writeHeading(context,titleLines) {
 context.fillStyle='#263d32';context.font='bold 40px '+FONT;
 titleLines.forEach((line,index)=>context.fillText(line.text,52,166+index*54));
}
function fittedImage(context,image,x,y,width,height) {
 const originalWidth=image.naturalWidth||image.width,originalHeight=image.naturalHeight||image.height;
 if(!originalWidth||!originalHeight)throw new Error('配图没有加载完整，请重新选择。');
 const scale=Math.min(width/originalWidth,height/originalHeight);
 const w=originalWidth*scale,h=originalHeight*scale;
 context.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);
}
function videoLayout(context,title,pictures) {
 const titleLines=heading(context,title);
 const panelTop=188+(titleLines.length-1)*54;
 const picturesHeight=pictures.length?330:0;
 const bodyTop=panelTop+62+picturesHeight;
 return {titleLines,panelTop,bodyTop,maxLines:Math.floor((1100-bodyTop)/LINE_HEIGHT)+1};
}
function drawPage(record,text,index,total,pictures=[]) {
 const {canvas,context:c}=canvasFor(1280),layout=videoLayout(c,record.title,pictures);
 background(c,1280);writeHeading(c,layout.titleLines);
 c.fillStyle='#fffef8';c.beginPath();c.roundRect(30,layout.panelTop,660,1120-layout.panelTop,24);c.fill();
 if(pictures.length){const gap=14,w=(BODY_WIDTH-gap*(pictures.length-1))/pictures.length;pictures.forEach((picture,i)=>fittedImage(c,picture,58+i*(w+gap),layout.panelTop+24,w,288));}
 c.fillStyle='#263d32';c.font=BODY_FONT;
 const wrapped=lines(c,text,BODY_WIDTH);
 if(wrapped.length>layout.maxLines)throw new Error('这页放不下完整文字，请重新分页。');
 const glyphs=[];let offset=0;
 wrapped.forEach((line,i)=>{
  c.fillText(line.text,58,layout.bodyTop+i*LINE_HEIGHT);let prefix='';
  for(const char of line.text){const x=58+c.measureText(prefix).width,width=c.measureText(char).width;glyphs.push({index:offset+prefix.length,x,y:layout.bodyTop+i*LINE_HEIGHT+10,width});prefix+=char;}
  offset+=line.raw.length;
 });
 c.fillStyle='#526459';c.font='26px '+FONT;c.fillText(`第 ${index+1} 页 / 共 ${total} 页`,52,1174);
 c.font='20px '+FONT;c.fillText(footer(record,true),52,1221);
 return {dataUrl:encode(canvas),text,glyphs};
}
function checkedPictures(record,pictures) {
 if(record.sourceKind!=='composition')return [];
 const expected=(record.attachments||record.composeImages||[]).length;
 if(expected>3)throw new Error('一条消息最多放 3 张图片。');
 if(pictures.length!==expected)throw new Error('配图还没有加载完整，请先异步加载图片再导出。');
 return pictures;
}
// Legacy synchronous entry points remain available for existing scripts.
export function drawFrame(title,text,index,total,sample=false,sampleGenerated=false,language='mandarin') {
 return drawPage({title,sample,sampleGenerated,language},bodyText(text),index,total);
}
export function createFrames(record,text,pictures=[]) {
 pictures=checkedPictures(record,pictures);
 const body=bodyText(text),{context}=canvasFor(1);
 const layout=videoLayout(context,record.title,pictures);context.font=BODY_FONT;
 const wrapped=lines(context,body,BODY_WIDTH),pages=[];let page='',count=0;
 for(const line of wrapped) {
  // The backend accepts 100 Unicode characters per narrated frame.
  const chunks=[];let chunk='';for(const char of Array.from(line.raw)){if(Array.from(chunk).length===100){chunks.push(chunk);chunk='';}chunk+=char;}if(chunk)chunks.push(chunk);
  for(const part of chunks){if(page&&(count>=layout.maxLines||Array.from(page+part).length>100)){pages.push(page);page='';count=0;}page+=part;count++;}
 }
 if(page)pages.push(page);
 if(pages.length>8)throw new Error('这段内容需要超过 8 页视频，请分成两条消息；也可以保存完整长图。');
 if(pages.some(value=>!value.trim()))throw new Error('空行太多，视频里会出现空白页。请减少空行，或保存长图。');
 return pages.map((value,index)=>drawPage(record,value,index,pages.length,pictures));
}
export function createLongImage(record,text,pictures=[]) {
 pictures=checkedPictures(record,pictures);
 const body=bodyText(text),{canvas,context:c}=canvasFor(1),titleLines=heading(c,record.title);
 const top=224+(titleLines.length-1)*54;
 c.font=BODY_FONT;const wrapped=lines(c,body,BODY_WIDTH);
 const sizes=pictures.map(image=>{const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;if(!w||!h)throw new Error('配图没有加载完整，请重新选择。');return Math.min(1200,BODY_WIDTH*h/w);});
 const height=Math.ceil(top+wrapped.length*LINE_HEIGHT+sizes.reduce((sum,size)=>sum+size+32,0)+140);
 if(height>MAX_LONG_IMAGE_HEIGHT)throw new Error(`长图高度超过 ${MAX_LONG_IMAGE_HEIGHT} 像素上限，请把内容分成两条消息后保存。`);
 canvas.height=height;background(c,height);writeHeading(c,titleLines);
 c.fillStyle='#263d32';c.font=BODY_FONT;wrapped.forEach((line,i)=>c.fillText(line.text,58,top+i*LINE_HEIGHT));
 let y=top+wrapped.length*LINE_HEIGHT+12;
 pictures.forEach((picture,index)=>{fittedImage(c,picture,58,y,BODY_WIDTH,sizes[index]);y+=sizes[index]+32;});
 c.fillStyle='#526459';c.font='22px '+FONT;c.fillText(footer(record,false),52,height-46);
 return {dataUrl:encode(canvas),text:body,width:WIDTH,height};
}
export async function loadExportImages(record) {
 const attachments=record.sourceKind==='composition'?(record.attachments||record.composeImages||[]):[];
 if(attachments.length>3)throw new Error('一条消息最多放 3 张图片。');
 return Promise.all(attachments.map(attachment=>new Promise((resolve,reject)=>{
  if(!isLocalPicture(attachment.dataUrl)){reject(new Error('配图地址无效，请重新选择手机里的图片。'));return;}
  const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('配图没有打开，请返回重新选择。'));image.src=assetUrl(attachment.dataUrl);
 })));
}
export async function createFramesAsync(record,text){return createFrames(record,text,await loadExportImages(record));}
export async function createLongImageAsync(record,text){return createLongImage(record,text,await loadExportImages(record));}
export function download(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export function postBinary(route,body,options){return request(route,body,{...options,method:'POST',responseType:'blob'});}
