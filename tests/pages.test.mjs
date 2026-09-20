import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assetUrl,publicPath} from '../src/assets.mjs';
import {staticDemoRequest} from '../src/static-demo.mjs';
import {allFunctionVoices} from '../src/function-voice.mjs';

test('repository assets are prefixed once while stored identities and user images remain portable',()=>{
 const base='/family-demo/';
 assert.equal(assetUrl('/demo-cases/W1.png',base),'/family-demo/demo-cases/W1.png');
 assert.equal(assetUrl('/family-demo/demo-cases/W1.png',base),'/family-demo/demo-cases/W1.png');
 assert.equal(publicPath('/family-demo/demo-cases/W1.png',base),'/demo-cases/W1.png');
 for(const value of ['data:image/png;base64,YQ==','blob:http://localhost/abc','https://example.com/a.png','//example.com/a.png'])assert.equal(assetUrl(value,base),value);
 assert.equal(assetUrl('/demo/a.mp3','/'),'/demo/a.mp3');
 assert.equal(publicPath('/another/demo/a.mp3',base),'/another/demo/a.mp3');
});

test('static status never claims to offer live AI or video synthesis',async(t)=>{
 const fetch=t.mock.method(globalThis,'fetch',()=>{throw new Error('Unexpected request');});
 const status=await staticDemoRequest('/status');
 assert.equal(status.ai,false);assert.equal(status.video,false);assert.equal(status.henan,true);
 assert.equal(fetch.mock.callCount(),0);
});

test('both static voices load real prepared files and their timing cues without API calls',async(t)=>{
 const paths=[];
 t.mock.method(globalThis,'fetch',async(path,options)=>{
  paths.push(path);assert.equal(options.signal.aborted,false);
  assert.match(path,/^\/demo\/readers\/[a-f0-9]{64}\.(json|mp3)$/);
  return new Response(await readFile(new URL('../public'+path,import.meta.url)));
 });
 for(const language of ['mandarin','henan']){
  const text=allFunctionVoices(language)[0].text;
  const result=await staticDemoRequest('/speech',{text,language},{signal:new AbortController().signal,responseType:'narration'});
  assert.ok(result.blob.size>1000);assert.ok(result.cues.length>0);
  const blob=await staticDemoRequest('/speech',{text,language},{signal:new AbortController().signal,responseType:'blob'});
  assert.equal(blob.size,result.blob.size);
 }
 assert.equal(paths.length,8);assert.ok(paths.every(path=>!path.includes('/api/')));
});

test('missing static audio fails explicitly without online synthesis fallback',async(t)=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>new Response('',{status:404}));
 await assert.rejects(staticDemoRequest('/speech',{text:'未录制的新句子',language:'henan'}),/声音还没有准备好/);
 assert.equal(fetch.mock.callCount(),2);
});

test('static audio cannot narrate mismatched cached text',async(t)=>{
 t.mock.method(globalThis,'fetch',async path=>path.endsWith('.json')?Response.json({text:'别的内容',language:'mandarin'}):new Response('audio'));
 await assert.rejects(staticDemoRequest('/speech',{text:'标题',language:'mandarin'}),/声音与文字不一致/);
});

test('static-only unsupported operations and cancelled speech do not make network requests',async(t)=>{
 const fetch=t.mock.method(globalThis,'fetch',()=>{throw new Error('Unexpected request');});
 await assert.rejects(staticDemoRequest('/analyze',{}),/演示相册/);
 await assert.rejects(staticDemoRequest('/export',{}),/保存当前长图/);
 await assert.rejects(staticDemoRequest('/speech',{text:'标题'},{signal:AbortSignal.abort()}),{name:'AbortError'});
 assert.equal(fetch.mock.callCount(),0);
});
