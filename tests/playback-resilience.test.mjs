import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:4174/'});
for(const key of ['window','document','HTMLElement','MutationObserver'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const media=new WeakMap();let latestAudio,playFailure;
const prototype=dom.window.HTMLMediaElement.prototype;
Object.defineProperty(prototype,'paused',{get(){return media.get(this)?.paused??true;},configurable:true});
prototype.play=function(){if(playFailure){const failure=playFailure;playFailure=null;return typeof failure==='function'?failure():Promise.reject(failure);}media.set(this,{paused:false});this.dispatchEvent(new dom.window.Event('play'));return Promise.resolve();};
prototype.pause=function(){media.set(this,{paused:true});this.dispatchEvent(new dom.window.Event('pause'));};
prototype.load=function(){media.set(this,{paused:true});};
globalThis.Audio=function(){latestAudio=new dom.window.Audio();return latestAudio;};
const React=await import('react');
const {render,fireEvent,waitFor,cleanup,act,configure}=await import('@testing-library/react');
configure({getElementError:message=>new Error(String(message||'').split('Here are')[0])});
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const {useNarrator,NarratorPanel,GentleVideo,NarratedText}=await vite.ssrLoadModule('/src/Playback.jsx');
test.afterEach(()=>{cleanup();playFailure=null;});
test.after(async()=>{await vite.close();dom.window.close();});

test('spoken-word updates never move the reader away from their chosen scroll position',()=>{
 const line='这条短信没有说您欠费，也没有要求您付款。';
 const view=cue=>React.createElement('main',null,React.createElement(NarratedText,{text:line,narrator:{spokenText:line,activeCue:cue}}));
 const ui=render(view(null)),main=ui.container.querySelector('main');
 main.scrollTop=420;main.getBoundingClientRect=()=>({top:100,bottom:500});
 ui.rerender(view({from:0,to:1}));assert.equal(main.scrollTop,420);
 ui.rerender(view({from:1,to:2}));assert.equal(main.scrollTop,420);
 assert.equal(ui.container.querySelector('.spoken-word').textContent,'条');
});

function Harness({language='mandarin',src}){
 const narrator=useNarrator({language,rate:.75});
 return React.createElement(React.Fragment,null,
  React.createElement('button',{onClick:()=>narrator.speak('家里来信','家里来信',src)},'开始朗读'),
  React.createElement('button',{onClick:narrator.stop},'停止朗读'),
  React.createElement(NarratorPanel,{narrator,language,rate:.75,onRate:()=>{}}));
}

test('speech download failure offers one-click retry and clears the old warning once playing',async(t)=>{
 let attempts=0,payload;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{payload=JSON.parse(options.body);if(++attempts===1)throw new TypeError('Failed to fetch');return new Response(new Blob(['audio']));});
 const ui=render(React.createElement(Harness,{language:'henan'}));
 fireEvent.click(ui.getByText('开始朗读'));
 await waitFor(()=>assert.match(ui.getByRole('alert').textContent,/网络.*再试一回/));
 fireEvent.click(ui.getByRole('button',{name:'再试一回'}));
 await waitFor(()=>assert.ok(ui.getByText('正念给您听哩')));
 assert.ok(!ui.queryByRole('alert'));assert.equal(latestAudio.paused,false);
 assert.equal(latestAudio.playbackRate,.75);assert.deepEqual(payload,{text:'家里来信',voice:'xiaoyi',language:'henan'});
});

test('a media error can be retried from the narrator panel without leaving the error visible',async()=>{
 const ui=render(React.createElement(Harness,{src:'/demo/P3-mandarin.mp3'}));
 fireEvent.click(ui.getByText('开始朗读'));await waitFor(()=>assert.equal(latestAudio.paused,false));
 act(()=>latestAudio.dispatchEvent(new dom.window.Event('error')));
 assert.ok(ui.getByRole('alert'));
 fireEvent.click(ui.getByRole('button',{name:'再试一次'}));
 await waitFor(()=>assert.ok(ui.getByText('正在读给您听')));assert.ok(!ui.queryByRole('alert'));
});

test('stopping a pending speech request ignores its later response and leaves no error',async(t)=>{
 let finish,signal;
 t.mock.method(globalThis,'fetch',(_url,options)=>{signal=options.signal;return new Promise(resolve=>{finish=resolve;});});
 const ui=render(React.createElement(Harness));fireEvent.click(ui.getByText('开始朗读'));
 assert.ok(ui.getByText('正在准备声音…'));fireEvent.click(ui.getByText('停止朗读'));
 assert.equal(signal.aborted,true);
 await act(async()=>finish(new Response(new Blob(['late audio']))));
 assert.ok(!ui.queryByRole('alert'));assert.ok(!document.querySelector('.narrator-panel'));assert.equal(latestAudio.getAttribute('src'),null);assert.equal(latestAudio.paused,true);
});

test('a rejected play promise after stop cannot restore the narrator panel',async()=>{
 let rejectPlay;playFailure=()=>new Promise((_resolve,reject)=>{rejectPlay=reject;});
 const ui=render(React.createElement(Harness,{src:'/demo/P3-mandarin.mp3'}));
 fireEvent.click(ui.getByText('开始朗读'));await waitFor(()=>assert.equal(typeof rejectPlay,'function'));fireEvent.click(ui.getByText('停止朗读'));
 await act(async()=>rejectPlay(new Error('interrupted')));
 assert.ok(!document.querySelector('.narrator-panel'));assert.equal(latestAudio.paused,true);
});

test('video retry clears the warning; changing the video and leaving the page both pause playback',async()=>{
 playFailure=new Error('media decode failed');
 const props={src:'/demo/P3-mandarin.mp4',language:'mandarin',rate:.5,onRate:()=>{}};
 const ui=render(React.createElement(GentleVideo,props));const video=ui.container.querySelector('video');
 fireEvent.click(ui.getByRole('button',{name:'播放视频'}));await waitFor(()=>assert.ok(ui.getByRole('alert')));
 fireEvent.click(ui.getByRole('button',{name:'再试一次'}));
 await waitFor(()=>assert.equal(video.paused,false));assert.ok(!ui.queryByRole('alert'));assert.equal(video.playbackRate,.5);assert.equal(video.hasAttribute('controls'),false);
 ui.rerender(React.createElement(GentleVideo,{...props,src:'/demo/P3-henan.mp4'}));assert.equal(video.paused,true);
 fireEvent.click(ui.getByRole('button',{name:'播放视频'}));await waitFor(()=>assert.equal(video.paused,false));
 ui.unmount();assert.equal(video.paused,true);
});

test('a late video play rejection from the previous source does not mark the new source failed',async()=>{
 let rejectPlay;playFailure=()=>new Promise((_resolve,reject)=>{rejectPlay=reject;});
 const props={src:'/demo/P3-mandarin.mp4',language:'mandarin',rate:1,onRate:()=>{}};
 const ui=render(React.createElement(GentleVideo,props));fireEvent.click(ui.getByRole('button',{name:'播放视频'}));
 ui.rerender(React.createElement(GentleVideo,{...props,src:'/demo/P3-henan.mp4'}));
 await act(async()=>rejectPlay(new Error('old source interrupted')));
 assert.ok(!ui.queryByRole('alert'));
});
