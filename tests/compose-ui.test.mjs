import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:4174'});
for(const key of ['window','document','HTMLElement','MutationObserver'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLCanvasElement.prototype.getContext=function(){return {font:'',fillRect(){},fillText(){},beginPath(){},roundRect(){},fill(){},drawImage(){},measureText(text){return {width:[...text].length*28};}};};
dom.window.HTMLCanvasElement.prototype.toDataURL=function(){return 'data:image/png;base64,YQ==';};
dom.window.HTMLMediaElement.prototype.pause=function(){};
const React=await import('react');const {render,fireEvent,waitFor,cleanup}=await import('@testing-library/react');
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const {default:ExportPanel}=await server.ssrLoadModule('/src/ExportPanel.jsx');
const {makeDemoRecords}=await import('../src/demo.mjs');
const composeModule=await server.ssrLoadModule('/src/Compose.jsx').catch(()=>({}));
test.afterEach(cleanup);test.after(async()=>{await server.close();dom.window.close();});
const record={id:'family-test',title:'周日回家',explanation:'周日回家，车票249元。',language:'mandarin',translations:{mandarin:{title:'周日回家',explanation:'周日回家，车票249元。'},henan:{title:'周日回家',explanation:'周日回，车票249元哩。'}}};
function renderExport(henanReady=true){return render(React.createElement(ExportPanel,{record,result:record,language:'mandarin',onSave:async()=>{},onWorking:()=>{},rate:1,onRate:()=>{},narrator:{stop(){}},henanReady}));}
test('export changes only output language, restores edited drafts, and blocks unavailable Henan video',async()=>{
 const ui=renderExport(false);
 await waitFor(()=>assert.equal(ui.getByRole('button',{name:'保存完整长图'}).disabled,false));
 assert.equal(ui.queryByRole('checkbox'),null);
 fireEvent.change(ui.getByRole('textbox',{name:'发给家人的文字'}),{target:{value:'妈妈，周日回家。'}});
 fireEvent.click(ui.getByRole('button',{name:/方言/}));fireEvent.click(ui.getByRole('button',{name:'用河南话'}));
 assert.equal(ui.getByRole('textbox',{name:'发给家人的文字'}).value,'周日回，车票249元哩。');
 assert.ok(ui.getByText('导出语言'));assert.ok(ui.getByText('发给家人的文字'));
 fireEvent.click(ui.getByRole('button',{name:/有声视频/}));
 assert.equal(ui.getByRole('button',{name:'制作有声视频'}).disabled,true);
 fireEvent.click(ui.getByRole('button',{name:/纯长图/}));assert.equal(ui.getByRole('button',{name:'保存完整长图'}).disabled,false);
 fireEvent.click(ui.getByRole('button',{name:'普通话'}));assert.equal(ui.getByRole('textbox',{name:'发给家人的文字'}).value,'妈妈，周日回家。');
});
test('compose hands the exact pasted message to local save, accepts a prepared example, and exposes native picture input',async()=>{
 assert.equal(typeof composeModule.default,'function');let created;
 const ui=render(React.createElement(composeModule.default,{language:'mandarin',onCreate:async record=>{created=record;},onCancel:()=>{},examples:[{title:'周日回家',text:'车票249元，不用转钱。'}]}));
 fireEvent.click(ui.getByRole('button',{name:/周日回家/}));
 assert.equal(ui.getByRole('textbox',{name:'要发给家人的话'}).value,'车票249元，不用转钱。');
 fireEvent.change(ui.getByRole('textbox',{name:'要发给家人的话'}),{target:{value:'妈，我周日到家。\n不用给我转钱。'}});
 assert.equal(ui.getByLabelText('选择图片').getAttribute('type'),'file');
 fireEvent.click(ui.getByRole('button',{name:/预览并选择导出/}));
 await waitFor(()=>assert.equal(created?.explanation,'妈，我周日到家。\n不用给我转钱。'));
 assert.equal(created.sourceKind,'composition');assert.equal(created.sample,false);
 assert.equal(ui.queryByRole('button',{name:/读标题|读这一段/}),null);
});

test('video requests selected output language and narrates every page without changing the Mandarin interface',async t=>{
 const previous=globalThis.fetch;let request,saved;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/export');request=JSON.parse(options.body);return new Response(new Blob(['video']),{headers:{'Content-Type':'video/mp4'}});};t.after(()=>{globalThis.fetch=previous;});
 const text='周日回，车票249元哩。'.repeat(12);
 const longRecord={...record,translations:{...record.translations,henan:{title:'回家啦',explanation:text}}};
 const ui=render(React.createElement(ExportPanel,{record:longRecord,result:longRecord,language:'mandarin',onSave:async value=>{saved=value;},onWorking:()=>{},rate:1,onRate:()=>{},narrator:{stop(){}},henanReady:true}));
 await waitFor(()=>assert.ok(ui.getByRole('img',{name:'包含全部文字与配图的完整长图'})));
 fireEvent.click(ui.getByRole('button',{name:'方言'}));fireEvent.click(ui.getByRole('button',{name:'用河南话'}));fireEvent.click(ui.getByRole('button',{name:/有声视频/}));fireEvent.click(ui.getByRole('button',{name:'制作有声视频'}));
 await waitFor(()=>assert.ok(ui.getByText('视频做好了')));
 assert.equal(request.language,'henan');assert.ok(request.frames.length>1);assert.equal(request.frames.map(frame=>frame.text).join(''),text);
 assert.equal(saved.exportLanguage,'henan');assert.equal(saved.exportTexts.henan,text);assert.equal(saved.language,'mandarin');assert.ok(ui.getByRole('button',{name:'保存视频'}));
});

test('unchanged demo opens a prepared Henan video even without a live voice provider; editing switches to live generation',async t=>{
 const previous=globalThis.fetch;const requests=[];let saved;
 globalThis.fetch=async(url)=>{requests.push(url);assert.equal(url,'/demo/exports/W1-henan.mp4');return new Response(new Blob(['video'],{type:'video/mp4'}));};t.after(()=>{globalThis.fetch=previous;});
 const sample=makeDemoRecords().find(item=>item.caseId==='W1'&&item.mode==='helper');
 const ui=render(React.createElement(ExportPanel,{record:sample,result:sample,language:'henan',onSave:async value=>{saved=value;},henanReady:false}));
 await waitFor(()=>assert.equal(ui.getByRole('button',{name:'保存完整长图'}).disabled,false));
 fireEvent.click(ui.getByRole('button',{name:/有声视频/}));
 assert.ok(ui.getByText(/演示视频已提前制作/));
 assert.equal(ui.getByRole('button',{name:'打开演示视频'}).disabled,false);
 fireEvent.click(ui.getByRole('button',{name:'打开演示视频'}));
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:'保存视频'})));
 assert.equal(requests.length,1);assert.equal(saved.exportLanguage,'henan');
 fireEvent.change(ui.getByRole('textbox',{name:'发给家人的文字'}),{target:{value:'妈妈，这条消息已经修改。'}});
 assert.equal(ui.queryByRole('button',{name:'保存视频'}),null);
 assert.equal(ui.queryByText(/演示视频已提前制作/),null);
 assert.ok(ui.getByText(/当前内容需要现场制作/));
 assert.equal(ui.getByRole('button',{name:'制作有声视频'}).disabled,true);
});

test('missing prepared video reports the problem without silently generating a replacement',async t=>{
 const previous=globalThis.fetch;const requests=[];
 globalThis.fetch=async(url)=>{requests.push(url);return new Response('missing',{status:404});};t.after(()=>{globalThis.fetch=previous;});
 const sample=makeDemoRecords().find(item=>item.caseId==='S3'&&item.mode==='helper');
 const ui=render(React.createElement(ExportPanel,{record:sample,result:sample,language:'mandarin',henanReady:true}));
 await waitFor(()=>assert.equal(ui.getByRole('button',{name:'保存完整长图'}).disabled,false));
 fireEvent.click(ui.getByRole('button',{name:/有声视频/}));fireEvent.click(ui.getByRole('button',{name:'打开演示视频'}));
 await waitFor(()=>assert.match(ui.getByRole('alert').textContent,/演示视频未能打开/));
 assert.deepEqual(requests,['/demo/exports/S3-mandarin.mp4']);
 assert.equal(ui.queryByRole('button',{name:'保存视频'}),null);
});

test('new compositions carry the selected onboarding voice into export; saved output choices take precedence',async()=>{
 let created;let ui=render(React.createElement(composeModule.default,{language:'henan',onCreate:async value=>{created=value;}}));
 fireEvent.change(ui.getByRole('textbox',{name:'要发给家人的话'}),{target:{value:'妈，周日回家。'}});fireEvent.click(ui.getByRole('button',{name:'预览并选择导出'}));await waitFor(()=>assert.ok(created));assert.equal(created.exportLanguage,'henan');cleanup();
 ui=render(React.createElement(ExportPanel,{record:{...record,exportLanguage:'mandarin'},result:record,language:'henan',onSave:async()=>{},onWorking:()=>{},rate:1,onRate:()=>{},narrator:{stop(){}},henanReady:true}));
 assert.equal(ui.getByRole('button',{name:'普通话',exact:true}).getAttribute('aria-pressed'),'true');
});
