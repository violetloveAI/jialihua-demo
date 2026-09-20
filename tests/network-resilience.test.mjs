import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../src/api.mjs';
import {postBinary} from '../src/export.mjs';

// Network and media decoding are external boundaries; all request handling stays real.
test('offline analysis and video generation offer a readable retry in the selected language',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('Failed to fetch');});
 for(const [language,operation] of [
  ['mandarin',()=>api('/analyze',{language:'mandarin'})],
  ['henan',()=>postBinary('/export',{language:'henan'})],
 ]){
  await assert.rejects(operation(),error=>{
   assert.match(error.message,/网络/);assert.match(error.message,language==='henan'?/再试一回/:/再试一次/);
   assert.doesNotMatch(error.message,/fetch|TypeError/i);return true;
  });
 }
});

for(const [route,limit] of [['/analyze',90000],['/speech',45000],['/export',240000]]){
 test(`${route} stops waiting at its deadline and aborts the underlying request`,async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});let signal,settled=false;
  t.mock.method(globalThis,'fetch',(_url,options)=>{signal=options.signal;return new Promise(()=>{});});
  const operation=route==='/analyze'?api(route,{language:'henan'}):postBinary(route,{language:'henan'});
  const outcome=operation.then(value=>{settled=true;return value;},error=>{settled=true;throw error;});
  const rejection=assert.rejects(outcome,error=>{assert.match(error.message,/等得有点久/);assert.match(error.message,/再试一回/);return true;});
  t.mock.timers.tick(limit-1);await Promise.resolve();assert.equal(settled,false);
  t.mock.timers.tick(1);await rejection;assert.equal(signal.aborted,true);
 });
}

test('a stalled speech download is covered by the deadline after headers arrive',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});
 t.mock.method(globalThis,'fetch',async()=>({ok:true,blob:()=>new Promise(()=>{})}));
 const pending=postBinary('/speech',{language:'mandarin'});
 const rejection=assert.rejects(pending,/等待时间有点长.*再试一次/);
 await Promise.resolve();t.mock.timers.tick(45000);await rejection;
});

test('explicit cancellation stays AbortError and never becomes a retry warning',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});let signal;
 t.mock.method(globalThis,'fetch',(_url,options)=>{signal=options.signal;return new Promise(()=>{});});
 const controller=new AbortController();
 const pending=postBinary('/speech',{language:'henan'},{signal:controller.signal});
 const rejection=assert.rejects(pending,error=>error.name==='AbortError');
 controller.abort();await rejection;assert.equal(signal.aborted,true);
 t.mock.timers.tick(45000);
});

test('completed requests release their timeout without aborting successful work',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});let signal;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{signal=options.signal;return Response.json({result:{title:'家里来信'}});});
 assert.deepEqual(await api('/analyze',{language:'mandarin'}),{result:{title:'家里来信'}});
 t.mock.timers.tick(90000);assert.equal(signal.aborted,false);
});
