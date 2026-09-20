import test from 'node:test';
import assert from 'node:assert/strict';
import * as exporter from '../src/export.mjs';
import {getDemoResult} from '../src/demo.mjs';
import {helperGuidance} from '../src/helper-guidance.mjs';
import {contentNarrations} from '../src/narration.mjs';
const composition = await import('../src/compose.mjs').catch(() => ({}));

// Canvas is a browser boundary. Capture drawing commands while the real layout runs.
function installCanvas(t) {
 const previous = globalThis.document;
 const canvases=[];
 globalThis.document={createElement(kind){assert.equal(kind,'canvas');const calls=[];const context={font:'',fillStyle:'',fillRect(){},beginPath(){},roundRect(){},fill(){},measureText(text){return {width:[...text].length*Number(this.font.match(/(\d+)px/)?.[1]||54)};},fillText(text,x,y){calls.push({text,x,y,font:this.font});},drawImage(image,...bounds){calls.push({image,bounds});}};const canvas={width:0,height:0,calls,getContext(){return context;},toDataURL(){return 'data:image/png;base64,'+Buffer.from(JSON.stringify({width:this.width,height:this.height,calls})).toString('base64');}};canvases.push(canvas);return canvas;}};
 t.after(()=>{globalThis.document=previous;});return canvases;
}

test('composition preserves the exact family message, local pictures, and honest provenance',()=>{
 assert.equal(typeof composition.createCompositionRecord,'function');
 const record=composition.createCompositionRecord({title:'周日回家',text:'妈，周日回家。\n车票249元，不用转钱。',attachments:[{name:'合照.jpg',dataUrl:'data:image/jpeg;base64,YQ=='}]});
 assert.equal(record.mode,'helper');assert.equal(record.sourceType,'unknown');assert.equal(record.sourceKind,'composition');assert.equal(record.sample,false);
 assert.equal(record.explanation,'妈，周日回家。\n车票249元，不用转钱。');assert.equal(record.items[0].text,record.explanation);
 assert.deepEqual(record.images,[]);assert.equal(record.attachments.length,1);assert.ok(record.id);assert.ok(Date.parse(record.createdAt));
 assert.equal(record.translations.henan.explanation,record.explanation);
 assert.throws(()=>composition.createCompositionRecord({text:'  '}),/文字|内容/);
 assert.throws(()=>composition.createCompositionRecord({text:'合照',attachments:Array(4).fill({dataUrl:'data:image/png;base64,YQ=='})}),/3/);
});

test('export language selects its own saved text or translation without changing the app result',()=>{
 assert.equal(typeof exporter.exportContent,'function');
 const record={title:'普通话标题',explanation:'普通话正文。',translations:{mandarin:{title:'普通话标题',explanation:'普通话正文。'},henan:{title:'河南话标题',explanation:'河南话正文。'}},exportTexts:{henan:'河南话改好啦。'}};
 const selected=exporter.exportContent(record,record.translations.mandarin,'henan');
 assert.equal(selected.title,'河南话标题');assert.equal(selected.text,'河南话改好啦。');assert.equal(record.explanation,'普通话正文。');
 assert.equal(exporter.exportContent(record,record.translations.mandarin,'mandarin').text,'普通话正文。');
 const legacy={title:'旧解读',explanation:'消息正文。',uncertainties:['没写时间。'],exportText:'消息正文。\n还有这些没说清：没写时间。'};
 assert.equal(exporter.exportContent(legacy,legacy).text,'消息正文。');
 assert.equal(exporter.exportContent({...legacy,sourceKind:'composition'},legacy).text,legacy.exportText);
});

test('video pagination measures newlines and preserves all narration within the page',t=>{
 const canvases=installCanvas(t);const input=Array.from({length:20},(_,i)=>`第${i+1}行。`).join('\n');
 const frames=exporter.createFrames({title:'家里有话说'},input);
 assert.equal(frames.map(frame=>frame.text).join(''),input);
 assert.ok(frames.length>=2&&frames.length<=8);
 for(const canvas of canvases.filter(canvas=>canvas.height===1280)){
  const body=canvas.calls.filter(call=>call.font?.startsWith('54px'));
  assert.ok(body.length>0);assert.ok(body.every(call=>call.y<1130));
 }
});

test('all prepared cases keep child guidance out of elder narration, long images and video frames in both languages',t=>{
 installCanvas(t);
 for(const caseId of ['W1','W2','W3','P1','P2','P3','S1','S2','S3'])for(const language of ['mandarin','henan']){
  const result=getDemoResult(caseId,language);
  const record={...result,caseId,sample:true,mode:'helper',translations:{[language]:result}};
  const guidance=helperGuidance(result,record);
  assert.ok(guidance.uncertainties.length);assert.ok(guidance.suggestions.length);
  const content=exporter.exportContent(record,result,language);
  const long=exporter.createLongImage(record,content.text);
  const frames=exporter.createFrames(record,content.text);
  assert.equal(long.text,result.explanation);assert.equal(frames.map(frame=>frame.text).join(''),result.explanation);
  const rendered=[long.dataUrl,...frames.map(frame=>frame.dataUrl)].map(url=>JSON.parse(Buffer.from(url.split(',')[1],'base64').toString()).calls.filter(call=>call.text).map(call=>call.text).join('')).join('\n');
  const elderOutput=contentNarrations(result,language).all+'\n'+rendered;
  for(const internal of [...guidance.uncertainties,...guidance.suggestions])assert.equal(elderOutput.includes(internal),false,caseId+' '+language+' leaked: '+internal);
 }
});

test('long image keeps the full body beyond one video page and reports the canvas height limit',t=>{
 installCanvas(t);assert.equal(typeof exporter.createLongImage,'function');
 const body='周日回来，249元的车票已经买好，不用转钱。'.repeat(35);
 const result=exporter.createLongImage({title:'给爸妈的消息',sourceKind:'composition'},body);
 assert.equal(result.width,720);assert.ok(result.height>1280);assert.equal(result.text,body);
 const rendered=JSON.parse(Buffer.from(result.dataUrl.split(',')[1],'base64').toString());
 assert.equal(rendered.calls.filter(call=>call.font?.startsWith('54px')).map(call=>call.text).join(''),body);
 assert.throws(()=>exporter.createLongImage({title:'很长的消息'},'字'.repeat(5000)),/长图.*上限|长图.*太长/);
});

test('user attachment pictures appear in video and long image; source screenshots do not',t=>{
 installCanvas(t);assert.equal(typeof exporter.createLongImage,'function');
 const image={width:800,height:600,tag:'用户合照'};
 const record={title:'合照',sourceKind:'composition',attachments:[{name:'合照.jpg',dataUrl:'data:image/jpeg;base64,YQ=='}]};
 const long=exporter.createLongImage(record,'周日一起吃饭。',[image]);
 const frame=exporter.createFrames(record,'周日一起吃饭。',[image])[0];
 for(const dataUrl of [long.dataUrl,frame.dataUrl]){const rendered=JSON.parse(Buffer.from(dataUrl.split(',')[1],'base64').toString());assert.ok(rendered.calls.some(call=>call.image?.tag==='用户合照'));}
 const explanation=exporter.createFrames({title:'截图解读',images:[{dataUrl:'data:image/png;base64,YQ=='}]},'正文。');
 assert.equal(JSON.parse(Buffer.from(explanation[0].dataUrl.split(',')[1],'base64').toString()).calls.some(call=>call.image),false);
});

test('composition exports refuse to silently lose pictures before asynchronous preload',async t=>{
 installCanvas(t);
 const record={title:'合照',sourceKind:'composition',attachments:[{name:'合照.jpg',dataUrl:'data:image/jpeg;base64,YQ=='}]};
 assert.throws(()=>exporter.createFrames(record,'一起吃饭。'),/配图.*加载|异步/);
 assert.throws(()=>exporter.createLongImage(record,'一起吃饭。'),/配图.*加载|异步/);
 const previous=globalThis.Image;globalThis.Image=class {width=800;height=600;set src(value){this.tag=value;queueMicrotask(()=>this.onload());}};t.after(()=>{globalThis.Image=previous;});
 const frames=await exporter.createFramesAsync(record,'一起吃饭。');
 const drawing=JSON.parse(Buffer.from(frames[0].dataUrl.split(',')[1],'base64').toString());
 assert.equal(drawing.calls.filter(call=>call.image).length,1);
 const long=await exporter.createLongImageAsync(record,'一起吃饭。');
 assert.equal(JSON.parse(Buffer.from(long.dataUrl.split(',')[1],'base64').toString()).calls.filter(call=>call.image).length,1);
});
