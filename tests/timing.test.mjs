import test from 'node:test';
import assert from 'node:assert/strict';
import {alignWords,parseCosyStream,highlightFilters} from '../server/timing.mjs';
import {activeRange,localRange} from '../src/reading-progress.mjs';
import {createApp} from '../server/app.mjs';
import {createServer} from 'node:http';

test('provider timestamps retain negation and repeated words without distributing time over missing text',()=>{
 const text='不要转钱。车票，车票买好了。';
 const cues=alignWords(text,[{text:'不要',start:.1,end:.6},{text:'转钱',start:.7,end:1},{text:'车票',start:1.5,end:2},{text:'车票',start:2.2,end:2.6},{text:'missing',start:3,end:4}]);
 assert.deepEqual(cues.map(c=>text.slice(c.from,c.to)),['不要','转钱','车票','车票']);
 assert.equal(cues[3].from,8);assert.equal(activeRange(cues,1.2),null);
 assert.deepEqual(localRange('车票买好了。',text,cues[3]),{from:0,to:2});
 assert.equal(activeRange(cues,.3),cues[0]);assert.equal(activeRange(cues,.8),cues[1]);
 assert.equal(localRange('标题',text,cues[0]),null);
});
test('CosyVoice streaming consumes each audio chunk once and replaces partial word lists',()=>{
 const word={text:'妈',begin_index:0,end_index:1,begin_time:100,end_time:450};
 const event=output=>'data:'+JSON.stringify({output})+'\n\n';
 const sse=event({type:'sentence-begin',sentence:{index:0,words:[word]}})+event({audio:{data:Buffer.from('ID3').toString('base64')},sentence:{index:0,words:[word]}})+event({audio:{data:Buffer.from('audio').toString('base64')}})+event({finish_reason:'stop'});
 const parsed=parseCosyStream(sse);assert.equal(parsed.bytes.toString(),'ID3audio');assert.deepEqual(parsed.words,[{text:'妈',start:.1,end:.45}]);
 assert.throws(()=>parseCosyStream(event({audio:{data:'SUQz'}})),/Incomplete/);
 assert.throws(()=>parseCosyStream('data:{"code":"Arrearage"}\n'),/failed/);
});
test('extra provider punctuation must not jump ahead to the end of a later sentence',()=>{
 const text='她答辩过了。\n她周六回家。';
 const spoken='她答辩过了。。她周六回家。';
 const cues=alignWords(text,[...spoken].map((word,i)=>({text:word,start:i/5,end:(i+1)/5})));
 assert.equal(cues.map(c=>text.slice(c.from,c.to)).join(''),'她答辩过了她周六回家');
 assert.equal(cues.find(c=>c.from===7).start,1.4);
});
test('whole-reading highlights a repeated glossary word only inside the spoken section',()=>{
 const context='流量。这儿说的是上网额度。',spoken='流量提醒。\n'+context;
 assert.equal(localRange('流量',spoken,{from:0,to:2},context),null);
 assert.deepEqual(localRange('流量',spoken,{from:6,to:8},context),{from:0,to:2});
 assert.deepEqual(localRange('流量','流量',{from:0,to:2},context),{from:0,to:2});
});
test('export marking uses only validated glyph positions and provider time windows',()=>{
 const filter=highlightFilters([{index:0,x:58,y:300,width:54},{index:1,x:112,y:300,width:54}],[{from:0,to:1,start:.1,end:.45}]);
 assert.equal((filter.match(/drawbox/g)||[]).length,3);assert.match(filter,/between\(t,0.100,0.450\)/);assert.ok(!filter.includes('x=112'));
});
test('speech clients can request timing JSON while MP3 consumers retain their original response',async t=>{
 const speech=async()=>{const buffer=Buffer.from('ID3sample');buffer.cues=[{from:0,to:1,start:.1,end:.4}];return buffer;};
 const server=createServer(createApp({speech}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const url=`http://127.0.0.1:${server.address().port}/api/speech`,body=JSON.stringify({text:'妈',voice:'xiaoyi'});
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body});
 const result=await response.json();assert.equal(Buffer.from(result.audio,'base64').toString(),'ID3sample');assert.equal(result.cues[0].from,0);
 const legacy=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(legacy.headers.get('content-type'),'audio/mpeg');assert.equal(await legacy.text(),'ID3sample');
});
