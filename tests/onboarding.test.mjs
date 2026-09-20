import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';import 'fake-indexeddb/auto';import {createServer} from 'vite';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:4174/'});
for(const key of ['window','document','HTMLElement','MutationObserver','localStorage','location'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;window.scrollTo=()=>{};
class AudioFixture extends EventTarget{static all=[];static rejectNext=false;constructor(){super();this.src='';this.paused=true;this.currentTime=0;AudioFixture.all.push(this);}play(){if(AudioFixture.rejectNext){AudioFixture.rejectNext=false;return Promise.reject(new Error('autoplay blocked'));}this.paused=false;this.dispatchEvent(new Event('play'));return Promise.resolve();}pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}removeAttribute(){this.src='';}load(){this.currentTime=0;}}
globalThis.Audio=AudioFixture;dom.window.HTMLMediaElement.prototype.pause=function(){};
dom.window.HTMLCanvasElement.prototype.getContext=function(){return {font:'',fillRect(){},fillText(){},beginPath(){},roundRect(){},fill(){},drawImage(){},measureText(text){return {width:[...text].length*28};}};};dom.window.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,YQ==';
globalThis.Image=class{constructor(){this.naturalWidth=720;this.naturalHeight=720;}set src(value){this._src=value;queueMicrotask(()=>this.onload?.());}get src(){return this._src;}};
globalThis.fetch=async(url)=>{if(url==='/api/status')return Response.json({ai:true,henan:true});if(String(url).endsWith('.timing.json'))return Response.json({cues:[]});if(url==='/api/speech')return new Response(new Blob(['voice']),{headers:{'Content-Type':'audio/mpeg'}});throw new Error('Unexpected request: '+url);};
const React=await import('react');const {render,fireEvent,waitFor,cleanup,configure,act}=await import('@testing-library/react');configure({getElementError:m=>new Error(String(m||'').split('Here are')[0])});
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});const {default:App}=await vite.ssrLoadModule('/src/App.jsx');
test.afterEach(()=>{cleanup();localStorage.clear();AudioFixture.all=[];AudioFixture.rejectNext=false;});test.after(async()=>{await vite.close();dom.window.close();});
const ready=(patch={})=>({account:'family-demo',loggedIn:true,mode:'self',language:'mandarin',languageChosen:true,experience:'used',fontLevel:0,rate:1,...patch});
// Catch skipping language confirmation, ignoring selected speech, or retaining old audio after a step change.
test('入口试听不跳题；确认河南话后第三题与老人教程沿用河南话，切步与退出停止旧声',async()=>{
 const ui=render(React.createElement(App));await act(async()=>{fireEvent.click(ui.getByRole('button',{name:/开始体验/}));});await act(async()=>{fireEvent.click(ui.getByRole('button',{name:/我是老人/}));});
 assert.ok(ui.getByRole('heading',{name:'更想听的语言'}));assert.equal(ui.getByRole('button',{name:'就用这个声音'}).disabled,true);
 await act(async()=>{fireEvent.click(ui.getByRole('button',{name:'试听河南话'}));});await waitFor(()=>assert.ok(AudioFixture.all.some(a=>a.src.includes('entry-sample-henan.mp3')&&!a.paused)));
 assert.ok(ui.getByRole('heading',{name:'更想听的语言'}));assert.equal(ui.getByRole('button',{name:'就用这个声音'}).disabled,true);
 await act(async()=>{fireEvent.click(ui.getByRole('radio',{name:'方言 · 河南话'}));});await act(async()=>{fireEvent.click(ui.getByRole('button',{name:'就用这个声音'}));});
 assert.ok(ui.getByRole('heading',{name:/以前用过家里话/}));await waitFor(()=>assert.ok(AudioFixture.all.some(a=>a.src.includes('entry-experience-henan.mp3')&&!a.paused)));
 await act(async()=>{fireEvent.click(ui.getByRole('button',{name:/头一回用|第一次用/}));});assert.ok(ui.getByRole('dialog',{name:'老人使用教程'}));assert.equal(document.querySelector('.app-shell').hasAttribute('inert'),true);
 await waitFor(()=>assert.ok(AudioFixture.all.some(a=>a.src.includes('self-role-henan.mp3')&&!a.paused)));
 const audio=AudioFixture.all.find(a=>a.src.includes('self-role-henan.mp3'));await act(async()=>{fireEvent.click(ui.getByRole('button',{name:'下一步'}));});await waitFor(()=>assert.ok(audio.src.includes('self-language-henan.mp3')));
 audio.currentTime=4;await act(async()=>{fireEvent.click(ui.getByRole('button',{name:'再听一遍教程'}));});await waitFor(()=>assert.equal(audio.currentTime,0));
 await act(async()=>{fireEvent.click(ui.getByRole('button',{name:'先不学了'}));});assert.ok(!ui.queryByRole('dialog'));assert.equal(document.querySelector('.app-shell').hasAttribute('inert'),false);assert.equal(audio.paused,true);assert.equal(JSON.parse(localStorage.getItem('jlh-demo-session-v1')).language,'henan');
});
// Catch a role-blind tutorial, missing focus containment, or a tutorial that cannot be reopened.
test('熟悉用户直接进入；子女可重开自己的教程、键盘焦点受控并完成返回',async()=>{
 const ui=render(React.createElement(App,{initialSession:ready({mode:'helper'})}));assert.ok(!ui.queryByRole('dialog'));
 await act(async()=>{fireEvent.click(ui.getByRole('button',{name:'再看使用教程'}));});const dialog=ui.getByRole('dialog',{name:'子女使用教程'});assert.match(dialog.textContent,/切换身份/);
 const buttons=dialog.querySelectorAll('button:not(:disabled)');buttons[buttons.length-1].focus();fireEvent.keyDown(dialog,{key:'Tab'});assert.equal(document.activeElement,buttons[0]);
 await toInvite(ui);await click(ui,'暂时不用，开始使用');assert.ok(!ui.queryByRole('dialog'));
 await act(async()=>{fireEvent.click(ui.getByRole('button',{name:'再看使用教程'}));});assert.ok(ui.getByRole('dialog',{name:'子女使用教程'}));fireEvent.keyDown(document,{key:'Escape'});assert.ok(!ui.queryByRole('dialog'));
});
// Catch autoplay rejection leaving the user with neither sound nor a recovery control.
test('老人教程自动播放被拦截时可重听恢复，仍可退出',async()=>{
 const ui=render(React.createElement(App,{initialSession:ready()}));AudioFixture.rejectNext=true;await act(async()=>{fireEvent.click(ui.getByRole('button',{name:'再看使用教程'}));});await waitFor(()=>assert.ok(ui.getByRole('alert')));
 await act(async()=>{fireEvent.click(ui.getByRole('button',{name:'再听一遍教程'}));});await waitFor(()=>assert.ok(!ui.queryByRole('alert')));assert.ok(AudioFixture.all.some(a=>!a.paused));
 fireEvent.keyDown(document,{key:'Escape'});assert.ok(!ui.queryByRole('dialog'));assert.ok(AudioFixture.all.every(a=>a.paused));
});

const click=async(ui,name)=>act(async()=>{fireEvent.click(ui.getByRole('button',{name,exact:true}));});
async function next(ui){await act(async()=>{fireEvent.click(document.querySelector('.tutorial-next'));});}
async function toInvite(ui){for(let i=0;i<12&&!ui.queryByRole('button',{name:'是，继续学主功能'});i++)await next(ui);assert.ok(ui.getByRole('button',{name:'是，继续学主功能'}));}
// A role leak must not start audio or display voice controls anywhere in the helper onboarding/tutorial.
test('子女入口和两段教程都不自动配音，也没有教程喇叭',async()=>{
 const ui=render(React.createElement(App));await click(ui,'开始体验');await act(async()=>{fireEvent.click(ui.getByRole('button',{name:/我是子女/}));});
 assert.ok(!ui.queryByRole('button',{name:'试听河南话'}));assert.ok(AudioFixture.all.every(a=>a.paused&&!a.src));
 await act(async()=>{fireEvent.click(ui.getByRole('radio',{name:'方言 · 河南话'}));});await click(ui,'就用这个声音');
 assert.ok(!ui.queryByRole('button',{name:'再听一遍这道题'}));assert.ok(AudioFixture.all.every(a=>a.paused&&!a.src));
 await act(async()=>{fireEvent.click(ui.getByRole('button',{name:/头一回用|第一次用/}));});
 assert.ok(!ui.queryByRole('button',{name:'再听一遍教程'}));await toInvite(ui);await click(ui,'是，继续学主功能');
 assert.ok(document.querySelector('.compose-panel'));assert.ok(AudioFixture.all.every(a=>a.paused&&!a.src));await click(ui,'先不学了');assert.ok(!document.querySelector('.compose-panel'));
});
// Wrong ordering, skipping opt-in or keeping the sample page after exit changes the user-visible journey.
test('老人先顶部再喇叭和历史，确认后用案例走完选图、解读并返回首页',async()=>{
 const {allRecords}=await vite.ssrLoadModule('/src/history.mjs');
 const ui=render(React.createElement(App,{initialSession:ready({experience:'first',language:'henan'})}));
 const expected=['role','language','font','rate','speaker','history','upload'];
 for(const id of expected){assert.equal(document.querySelector('.tutorial-layer').dataset.tourStep,id);await next(ui);}
 assert.ok(!document.querySelector('.tutorial-practice'));const before=(await allRecords()).length;
 await click(ui,'是，继续学主功能');assert.ok(document.querySelector('.tutorial-practice .upload-area'));await click(ui,'上一步');assert.ok(ui.getByRole('button',{name:'是，继续学主功能'}));assert.ok(!document.querySelector('.tutorial-practice'));await click(ui,'是，继续学主功能');
 await next(ui);assert.ok(document.querySelector('.case-grid'));await next(ui);assert.ok(document.querySelector('.source-pictures img'));await next(ui);
 assert.ok(document.querySelector('[data-tour="practice-analyze"]'));await next(ui);assert.ok(document.querySelector('.reading-card'));assert.match(document.querySelector('.reading-card').textContent,/答辩/);
 await click(ui,'上一步');assert.ok(document.querySelector('[data-tour="practice-analyze"]'));await next(ui);
 for(let i=0;i<12&&ui.queryByRole('dialog');i++){if(ui.queryByRole('button',{name:'听听这段解释'})){await click(ui,'听听这段解释');await waitFor(()=>assert.ok(AudioFixture.all.some(a=>a.src==='/demo/W1-henan.mp3'&&!a.paused)));}await next(ui);}
 assert.ok(!ui.queryByRole('dialog'));assert.ok(!document.querySelector('.tutorial-practice'));assert.equal(document.querySelector('.app-shell').hasAttribute('inert'),false);assert.equal((await allRecords()).length,before);assert.ok(AudioFixture.all.every(a=>a.paused));
});
// A shallow home-only guide would miss either compose/export or screenshot explanation screens.
test('子女案例教程覆盖写话配图、长图视频和截图解释，全程静音且不写入作品',async()=>{
 const {allRecords}=await vite.ssrLoadModule('/src/history.mjs');const ui=render(React.createElement(App,{initialSession:ready({mode:'helper',experience:'first'})}));await toInvite(ui);const before=(await allRecords()).length;await click(ui,'是，继续学主功能');
 assert.ok(ui.getByLabelText('第 1 步，共 10 步'));let count=0;const screens=new Set();for(let i=0;i<10&&ui.queryByRole('dialog');i++){count++;const scene=document.querySelector('.tutorial-practice');screens.add(scene?.dataset.scene);if(scene?.dataset.scene==='compose-filled')assert.match(ui.getByRole('textbox',{name:'要发给家人的话'}).value,/周日回家/);assert.ok(!ui.queryByRole('button',{name:'再听一遍教程'}));await next(ui);}
 for(const scene of ['compose-blank','compose-filled','export-image','export-video','export-ready','upload','album','preview','read','screenshot-export'])assert.ok(screens.has(scene),`Missing guided screen ${scene}`);assert.equal(count,10);
 assert.ok(!ui.queryByRole('dialog'));assert.equal((await allRecords()).length,before);assert.ok(AudioFixture.all.every(a=>a.paused&&!a.src));
});

// The overlay must live in the phone screen, outside the inert app, at all desktop sizes.
test('两端引导留在手机屏幕容器内，背景锁定不锁住教程',async()=>{
 const {default:DeviceFrame}=await vite.ssrLoadModule('/src/DeviceFrame.jsx');
 for(const mode of ['self','helper']){
  const ui=render(React.createElement(DeviceFrame,null,React.createElement(App,{initialSession:ready({mode,experience:'first'})})));
  assert.ok(document.querySelector('.device-viewport > .tutorial-layer'),'tutorial should be a child of the phone screen');
  assert.equal(document.querySelector('.app-shell').hasAttribute('inert'),true);assert.equal(ui.getByRole('button',{name:'下一步'}).disabled,false);
  await click(ui,'先不学了');assert.ok(!document.querySelector('.tutorial-layer'));assert.equal(document.querySelector('.app-shell').hasAttribute('inert'),false);cleanup();
 }
});
