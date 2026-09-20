import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';import 'fake-indexeddb/auto';
import {createServer} from 'vite';import {readFile} from 'node:fs/promises';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:4174/'});
const stylesheet=dom.window.document.createElement('style');stylesheet.textContent=(await Promise.all(['styles.css','mobile.css'].map(file=>readFile(new URL('../src/'+file,import.meta.url),'utf8')))).join('\n');dom.window.document.head.append(stylesheet);
for(const key of ['window','document','HTMLElement','MutationObserver','localStorage','location'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;window.scrollTo=()=>{};
class TestAudio extends EventTarget{static all=[];constructor(){super();this.src='';this.paused=true;this.currentTime=0;this.playbackRate=1;TestAudio.all.push(this);}play(){this.paused=false;this.dispatchEvent(new Event('play'));return Promise.resolve();}pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}removeAttribute(){this.src='';}load(){}}
globalThis.Audio=TestAudio;dom.window.HTMLMediaElement.prototype.pause=function(){};
const calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url,body:opts?.body?JSON.parse(opts.body):null});if(url==='/api/status')return Response.json({ai:true,henan:true,henanDemo:true});if(url==='/api/speech')return new Response(new Blob(['sample']),{headers:{'Content-Type':'audio/mpeg'}});if(String(url).endsWith('.timing.json'))return Response.json({cues:[]});throw new Error('Unexpected test request: '+url);};
const React=await import('react');const {render,fireEvent,waitFor,cleanup,configure}=await import('@testing-library/react');
configure({getElementError:message=>new Error(String(message||'').split('Here are')[0])});
test.afterEach(cleanup);
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const {default:App}=await server.ssrLoadModule('/src/App.jsx');
test.after(async()=>{cleanup();await server.close();dom.window.close();});
function ready(patch={}){return {account:'family-demo',loggedIn:true,languageChosen:true,mode:'self',experience:'used',language:'mandarin',fontLevel:0,rate:1,...patch};}
function mount(patch={}){return render(React.createElement(App,{initialSession:ready(patch)}));}
function enter(ui,role='我是老人'){fireEvent.click(ui.getByRole('button',{name:/开始体验/}));assert.ok(ui.getByRole('heading',{name:'您是哪位家人？'}));fireEvent.click(ui.getByRole('button',{name:new RegExp(role)}));fireEvent.click(ui.getByRole('radio',{name:'中文 · 普通话'}));fireEvent.click(ui.getByRole('button',{name:'就用这个声音'}));fireEvent.click(ui.getByRole('button',{name:/我已经用过/}));}
test('每次刷新重回开屏与三道选择，保留字号并默认正常语速',async()=>{
 localStorage.clear();let ui=render(React.createElement(App));enter(ui);
 fireEvent.click(ui.getByRole('button',{name:/^听功能说明：怎样看视频$/}));await waitFor(()=>assert.equal(calls.findLast(c=>c.url==='/api/speech')?.body.language,'mandarin'));assert.match(calls.findLast(c=>c.url==='/api/speech').body.text,/点播放视频/);
 assert.equal(ui.queryByRole('button',{name:'字和声音'}),null);fireEvent.click(ui.getByRole('button',{name:'调整字号'}));fireEvent.click(ui.getByRole('button',{name:'最大'}));fireEvent.click(ui.getByRole('button',{name:'调整语速'}));fireEvent.click(ui.getByRole('button',{name:'再读慢一点'}));
 assert.equal(document.querySelector('.app-shell').style.getPropertyValue('--copy-size'),'48px');assert.equal(JSON.parse(localStorage.getItem('jlh-demo-session-v1')).rate,.5);
 cleanup();ui=render(React.createElement(App));assert.ok(ui.getByRole('button',{name:/开始体验/}));assert.equal(document.querySelector('.app-shell'),null);enter(ui);assert.equal(document.querySelector('.app-shell').style.getPropertyValue('--copy-size'),'48px');
 fireEvent.click(ui.getByRole('button',{name:/^读标题: 今天/}));await waitFor(()=>assert.ok(TestAudio.all.some(a=>!a.paused)));assert.equal(TestAudio.all.find(a=>!a.paused).playbackRate,1);
});
test('方言先打开单项家乡话滚轮，取消不变更，确认后切换河南话',async()=>{
 const ui=mount();assert.equal(ui.queryByText(/记录留在/),null);assert.equal(ui.queryByRole('button',{name:'方言'}),null);fireEvent.click(ui.getByRole('button',{name:'语言',exact:true}));fireEvent.click(ui.getByRole('button',{name:'方言'}));assert.ok(ui.getByRole('dialog',{name:'选择家乡话'}));assert.equal(ui.getAllByRole('option').length,1);assert.match(ui.getByText(/Demo 版只做河南方言/).textContent,/未来正式版/);
 fireEvent.click(ui.getByRole('button',{name:'取消'}));assert.equal(ui.queryByRole('dialog'),null);assert.ok(ui.getByRole('heading',{name:'今天想看懂哪段话？'}));
 fireEvent.click(ui.getByRole('button',{name:'方言'}));fireEvent.click(ui.getByRole('button',{name:'用河南话'}));assert.ok(ui.getByRole('heading',{name:'今儿想看懂哪段话？'}));
 fireEvent.click(ui.getByRole('button',{name:/念念标题: 今儿/}));await waitFor(()=>assert.equal(TestAudio.all.at(-1).paused,false));assert.equal(calls.findLast(c=>c.url==='/api/speech').body.language,'henan');
 fireEvent.click(ui.getByRole('button',{name:'调整字号'}));fireEvent.click(ui.getByRole('button',{name:'听功能说明：调整字体'}));await waitFor(()=>assert.match(calls.findLast(c=>c.url==='/api/speech').body.text,/点中意的大小/));assert.equal(calls.findLast(c=>c.url==='/api/speech').body.language,'henan');
 fireEvent.click(ui.getByRole('button',{name:'语言',exact:true}));fireEvent.click(ui.getByRole('button',{name:'普通话'}));assert.equal(TestAudio.all.at(-1).paused,true);assert.equal(ui.queryByRole('button',{name:'方言'}),null);
});
test('老人从空白截图入口导入演示图，先加载再出结果，原图可放大且不调用现场 AI',async()=>{
 const ui=mount();const before=calls.filter(c=>c.url==='/api/analyze').length;
 fireEvent.click(ui.getByRole('button',{name:/^选张图，帮我读懂/}));
 assert.ok(ui.getByRole('button',{name:/从相册选截图/}));assert.equal(document.querySelectorAll('.case-card').length,0);
 assert.equal(ui.getByRole('button',{name:'帮我讲明白'}).disabled,true);
 fireEvent.click(ui.getByRole('button',{name:/从相册选截图/}));assert.equal(document.querySelectorAll('.case-card').length,9);
 fireEvent.click(ui.getByRole('button',{name:'朋友圈',exact:true}));assert.equal(document.querySelectorAll('.case-card').length,3);
 const photo=ui.getByRole('button',{name:'导入演示图片：一盒饺子，让孩子破防了'});assert.ok(photo.querySelector('img'));
 fireEvent.click(photo.querySelector('img'));
 fireEvent.click(ui.getByRole('button',{name:'放大查看：已选择的截图 1'}));assert.ok(ui.getByRole('dialog',{name:'放大查看截图'}));
 fireEvent.click(ui.getByRole('button',{name:'放大一点'}));assert.equal(document.querySelector('.picture-tap').style.width,'150%');
 fireEvent.click(ui.getByRole('button',{name:'点击图片还原大小'}));assert.equal(document.querySelector('.picture-tap').style.width,'100%');assert.ok(ui.getByRole('dialog'));
 fireEvent.click(ui.getByRole('button',{name:'点击图片返回'}));assert.equal(ui.queryByRole('dialog'),null);
 assert.equal(ui.getByRole('button',{name:'帮我讲明白'}).disabled,false);assert.equal(document.querySelector('.source-pictures img').getAttribute('src'),'/demo-cases/P3.png');
 assert.equal(document.querySelector('.reading-card'),null);
 fireEvent.click(ui.getByRole('button',{name:'帮我讲明白'}));assert.ok(ui.getByRole('status',{name:'正在准备解读'}));assert.equal(document.querySelector('.reading-card'),null);
 assert.match(ui.getByText(/演示图片 · 正在打开/).textContent,/预先准备/);
 await waitFor(()=>assert.ok(document.querySelector('.reading-card')),{timeout:4000});
 assert.ok(ui.getAllByRole('button',{name:/读这一段/}).length>=1);assert.equal(ui.queryByRole('status',{name:'正在准备解读'}),null);
 const reading=document.querySelector('.reading-content');assert.equal(reading.firstElementChild.classList.contains('source-pictures'),true);
 assert.equal(reading.querySelector('img').getAttribute('src'),'/demo-cases/P3.png');
 assert.equal(ui.queryByRole('button',{name:'识别有误？核对原话'}),null);assert.equal(calls.filter(c=>c.url==='/api/analyze').length,before);
 fireEvent.click(ui.getByRole('button',{name:/听完整解读：/}));await waitFor(()=>assert.equal(TestAudio.all.at(-1).paused,false));
 const whole=calls.findLast(c=>c.url==='/api/speech').body.text;assert.match(whole,/破防/);assert.doesNotMatch(whole,/还有这些没说清/);assert.equal(document.querySelector('.uncertainties'),null);assert.match(whole,/这些词，原来是这个意思/);
 fireEvent.click(ui.getByRole('button',{name:'听完这一部分：这些词，原来是这个意思'}));await waitFor(()=>assert.equal(TestAudio.all.at(-1).paused,false));
 const section=calls.findLast(c=>c.url==='/api/speech').body.text;assert.doesNotMatch(section,/还有这些没说清/);assert.match(section,/这些词，原来是这个意思/);
});

test('子女版是手机宽度、有文字配图入口、不出现读标题和读段落',async()=>{
 const ui=mount({mode:'helper'});assert.ok(ui.getByRole('heading',{name:/有些关心/}));assert.equal(document.querySelector('.app-shell').style.getPropertyValue('--copy-size'),'17px');assert.equal(window.getComputedStyle(document.querySelector('.helper')).maxWidth,'480px');assert.equal(window.getComputedStyle(document.querySelector('.primary-nav')).bottom,'0px');assert.equal(document.querySelector('.read-button'),null);
 fireEvent.click(ui.getByRole('button',{name:/写给家人的话/}));assert.ok(ui.getByRole('textbox',{name:'要发给家人的话'}));assert.equal(ui.getByRole('button',{name:'预览并选择导出'}).disabled,true);fireEvent.click(ui.getByRole('button',{name:'导入演示文案'}));assert.match(ui.getByRole('textbox',{name:'要发给家人的话'}).value,/不用给我转钱/);assert.equal(ui.getByRole('button',{name:'预览并选择导出'}).disabled,false);assert.equal(document.querySelector('.read-button'),null);
});
test('子女从已发消息入口上传或导入截图，提醒和沟通建议只给子女看',async()=>{
 const ui=mount({mode:'helper'});
 fireEvent.click(ui.getByRole('button',{name:/解释发过的消息/}));
 assert.ok(ui.getByRole('button',{name:/从相册选截图/}));
 fireEvent.click(ui.getByRole('button',{name:/从相册选截图/}));
 fireEvent.click(ui.getByRole('button',{name:'导入演示图片：姥姥，我答辩通过啦',exact:true}));
 fireEvent.click(ui.getByRole('button',{name:'放大查看：已选择的截图 1'}));
 fireEvent.click(ui.getByRole('button',{name:'放大一点'}));fireEvent.click(ui.getByRole('button',{name:'点击图片还原大小'}));
 fireEvent.click(ui.getByRole('button',{name:'点击图片返回'}));assert.equal(ui.queryByRole('dialog'),null);
 fireEvent.click(ui.getByRole('button',{name:'整理给爸妈看'}));
 await waitFor(()=>assert.ok(ui.getByRole('heading',{name:'还没说清的地方'})),{timeout:4000});
 assert.ok(ui.getByText('截图没有写周六的具体日期。'));
 assert.ok(ui.getByRole('heading',{name:'沟通建议'}));
 assert.ok(ui.getByText(/只给你看，不会放进给家人的长图或视频/));
 assert.equal(document.querySelector('.read-button'),null);
 assert.ok(ui.getByRole('button',{name:'大字长图与有声视频'}));
 fireEvent.click(ui.getByRole('button',{name:'切换身份'}));fireEvent.click(ui.getByRole('button',{name:'我是老人',exact:true}));
 fireEvent.click(ui.getAllByRole('button',{name:'以前看过的'})[0]);
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:/微信.*姥姥，我答辩通过啦/})));
 fireEvent.click(ui.getByRole('button',{name:/微信.*姥姥，我答辩通过啦/}));
 assert.equal(ui.queryByRole('heading',{name:'还没说清的地方'}),null);
 assert.equal(ui.queryByRole('heading',{name:'沟通建议'}),null);
});
test('老人四档字号保留；右上切身份停止声音且子女不继承最大字号',async()=>{
 for(const [fontLevel,size] of [[0,28],[1,34],[2,40],[3,48]]){const ui=mount({fontLevel});assert.equal(document.querySelector('.app-shell').style.getPropertyValue('--copy-size'),size+'px');cleanup();}
 const ui=mount({fontLevel:3,rate:.75});fireEvent.click(ui.getByRole('button',{name:/^读标题: 今天/}));await waitFor(()=>assert.equal(TestAudio.all.at(-1).paused,false));
 fireEvent.click(ui.getByRole('button',{name:'切换身份'}));fireEvent.click(ui.getByRole('button',{name:'我是子女',exact:true}));assert.ok(ui.getByRole('heading',{name:/有些关心/}));assert.equal(TestAudio.all.at(-1).paused,true);assert.equal(document.querySelector('.app-shell').style.getPropertyValue('--copy-size'),'17px');assert.equal(ui.queryByRole('heading',{name:'以前用过家里话吗？'}),null);
 fireEvent.click(ui.getByRole('button',{name:'切换身份'}));fireEvent.click(ui.getByRole('button',{name:'我是老人',exact:true}));assert.equal(document.querySelector('.app-shell').style.getPropertyValue('--copy-size'),'48px');fireEvent.click(ui.getAllByRole('button',{name:'以前看过的'})[0]);await waitFor(()=>assert.equal(document.querySelectorAll('.history-row').length,9));assert.equal(document.querySelectorAll('.history-row .source-pictures img').length,9);
});
test('老人朗读顶部可暂停、继续和结束',async()=>{
 const ui=mount({fontLevel:3,rate:.75});fireEvent.click(ui.getByRole('button',{name:/^读标题: 今天/}));await waitFor(()=>assert.equal(TestAudio.all.at(-1).paused,false));const dock=document.querySelector('.narrator-dock');assert.equal(window.getComputedStyle(dock).position,'sticky');fireEvent.click(dock.querySelector('button'));assert.equal(TestAudio.all.at(-1).paused,true);fireEvent.click(dock.querySelector('button'));await waitFor(()=>assert.equal(TestAudio.all.at(-1).paused,false));fireEvent.click(dock.querySelector('.reader-close'));assert.equal(TestAudio.all.at(-1).paused,true);assert.equal(document.querySelector('.narrator-dock'),null);
});

test('保存后在原按钮显示大字已保存，重复保存不增加记录',async()=>{
 const {allRecords}=await server.ssrLoadModule('/src/history.mjs');
 const ui=mount();fireEvent.click(ui.getAllByRole('button',{name:'以前看过的'})[0]);
 await waitFor(()=>assert.ok(document.querySelector('.history-open')));fireEvent.click(document.querySelector('.history-open'));
 const before=(await allRecords()).length,button=ui.getByRole('button',{name:'保存到我的记录',exact:true});
 fireEvent.click(button);await waitFor(()=>assert.match(button.textContent,/已保存/));
 assert.ok(button.querySelector('[role="status"]'));assert.equal(button.isConnected,true);
 fireEvent.click(button);await waitFor(()=>assert.match(button.textContent,/已保存/));
 assert.equal((await allRecords()).length,before);
});

test('原话能按所选语言整段或逐条朗读，金额和否定原样保留',async()=>{
 for(const language of ['mandarin','henan']){
  const ui=mount({language});fireEvent.click(ui.getAllByRole('button',{name:'以前看过的'})[0]);
  await waitFor(()=>assert.ok([...document.querySelectorAll('.history-open')].some(b=>b.textContent.includes('周五'))));
  fireEvent.click([...document.querySelectorAll('.history-open')].find(b=>b.textContent.includes('周五')));
  fireEvent.click(ui.getByRole('button',{name:language==='henan'?'念完全部原话':'读完全部原话',exact:true}));
  await waitFor(()=>assert.equal(TestAudio.all.at(-1).paused,false));
  const body=calls.findLast(c=>c.url==='/api/speech').body;
  assert.equal(body.language,language);assert.match(body.text,/妈，我周五不回去了，改成周日。/);assert.match(body.text,/车票249元，已经买好了，不用给我转钱。/);assert.match(body.text,/您别去车站接。/);
  assert.equal(document.querySelector('.original').open,true);
  const rowButtons=document.querySelectorAll('.original-message .read-button');assert.equal(rowButtons.length,3);
  fireEvent.click(rowButtons[1]);await waitFor(()=>assert.equal(calls.findLast(c=>c.url==='/api/speech').body.text,'儿子小军。车票249元，已经买好了，不用给我转钱。'));
  assert.equal(calls.findLast(c=>c.url==='/api/speech').body.language,language);cleanup();
 }
});
