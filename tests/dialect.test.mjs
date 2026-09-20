import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { speechInput, analyzeInput } from '../server/input.mjs';
import { createAIAdapter } from '../server/ai.mjs';
import { createMediaAdapter } from '../server/media.mjs';
import { createApp } from '../server/app.mjs';

const original = [{ speaker: ' 小林 ', text: ' 不是两点，是下午三点。只带20元，不要转账。 ', kind: 'message' }];
// Catches omitted defaults, arbitrary locale acceptance, and unwanted speaker switching.
test('language defaults to Mandarin, validates exact choices, and voice is fixed to Xiaoyi', () => {
  assert.equal(speechInput({ text: '你好', voice: 'xiaoyi' }).language, 'mandarin');
  assert.equal(speechInput({ text: '你好', voice: 'xiaoyi', language: 'henan' }).language, 'henan');
  assert.throws(() => speechInput({ text: '你好', voice: 'xiaoyi', language: 'sichuan' }), /语言/);
  assert.throws(() => speechInput({ text: '你好', voice: 'yunxi' }), /小艺/);
  assert.equal(analyzeInput({ images: [], sourceType: 'auto', correctedItems: original }).language, 'mandarin');
  assert.throws(() => analyzeInput({ images: [], sourceType: 'auto', correctedItems: original, language: null }), /语言/);
  assert.deepEqual(analyzeInput({ images: [], sourceType: 'auto', correctedItems: original, language: 'henan' }).correctedItems, original);
});

// The mock replaces only the external model; the real prompt and result pipeline run.
test('Henan analysis requests colloquial explanation and never rewrites original people, digits or negation', async (t) => {
  let request;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    request = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      title: '见面时间', source_type: 'wechat_chat', items: [{ speaker: '小张', text: '两点带200元转账。', kind: 'message' }],
      plain_explanation: '小林说的是下午三点，带20元，别转账。', glossary: [], uncertainties: [],
    }) } }] }));
  });
  const analyze = createAIAdapter({ JIALIHUA_AI_BASE_URL: 'https://example.invalid/v1', JIALIHUA_AI_API_KEY: 'test-only' });
  const result = await analyze({ images: [], sourceType: 'wechat_chat', correctedItems: original, language: 'henan' });
  assert.equal(result.language, 'henan');
  assert.deepEqual(result.items, original);
  assert.match(request.messages[0].content, /河南/);
  assert.match(request.messages[0].content, /items.*原样/s);
  const defaultResult = await analyze({ images: [], sourceType: 'auto', correctedItems: original });
  assert.equal(defaultResult.language, 'mandarin');
});

test('unavailable Henan speech cannot silently use the Mandarin synthesizer', async () => {
  let calls = 0;
  const media = createMediaAdapter({ env: {}, synthesize: async () => { calls++; return Buffer.from('ID3mandarin'); } });
  assert.equal(media.speech.capabilities.henan, false);
  await assert.rejects(media.speech({ text: '你好', voice: 'xiaoyi', language: 'henan' }), /河南话/);
  assert.equal(calls, 0);
  assert.equal((await media.speech({ text: '你好', voice: 'xiaoyi' })).toString(), 'ID3mandarin');
});

test('status and speech route expose unavailable Henan without exposing service errors', async (t) => {
  const media = createMediaAdapter({ env: {}, synthesize: async () => Buffer.from('ID3test') });
  const server = createServer(createApp(media));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const status = await (await fetch(base + '/api/status')).json();
  assert.equal(status.henan, false);
  assert.equal(status.henanVoice, null);
  assert.match(status.henanStatus, /河南话/);
  const response = await fetch(base + '/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '你好', voice: 'xiaoyi', language: 'henan' }) });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /河南话/);
});

// Catches switching dialect requests to ordinary voices, malformed downloads,
// credential forwarding to signed audio URLs, and fabricated success on API failure.
test('configured CosyVoice uses documented Henan parameters and downloads MP3 without forwarding credentials', async (t) => {
  const requests=[];
  const mp3=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(1000)]);
  t.mock.method(globalThis,'fetch',async (url,options={})=>{
    requests.push({url:String(url),options});
    return requests.length===1 ? new Response(JSON.stringify({output:{finish_reason:'stop',audio:{url:'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/test.mp3?signature=fictional'}}})) : new Response(mp3);
  });
  const media=createMediaAdapter({env:{JIALIHUA_DASHSCOPE_API_KEY:'test-only'}});
  assert.equal(media.speech.capabilities.henan,true);
  assert.equal(media.speech.capabilities.henanVoice,'longanhuan_v3');
  const audio=await media.speech({text:'不是两点，是下午三点。不要转账。',voice:'xiaoyi',language:'henan'});
  assert.deepEqual(audio,mp3);
  assert.equal(requests[0].url,'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer');
  const body=JSON.parse(requests[0].options.body);
  assert.equal(body.model,'cosyvoice-v3-flash');
  assert.equal(body.input.voice,'longanhuan_v3');
  assert.equal(body.input.instruction,'请用河南话表达。');
  assert.equal(body.input.text,'不是两点，是下午三点。不要转账。');
  assert.equal(body.input.format,'mp3');
  assert.equal(body.input.rate,1);
  assert.equal(requests[1].options.headers,undefined);
  assert.match(requests[1].url,/^https:/);
});

test('CosyVoice rejects non-Beijing configuration, failed auth, incomplete output and arbitrary audio URLs', async (t) => {
  const unsupported=createMediaAdapter({env:{JIALIHUA_DASHSCOPE_API_KEY:'test-only',JIALIHUA_DASHSCOPE_REGION:'singapore'}});
  assert.equal(unsupported.speech.capabilities.henan,false);
  const responses=[
    new Response('{"error":"secret-upstream"}',{status:401}),
    new Response(JSON.stringify({output:{finish_reason:null,audio:{url:'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/a.mp3'}}})),
    new Response(JSON.stringify({output:{finish_reason:'stop',audio:{url:'http://127.0.0.1/private'}}})),
  ];
  t.mock.method(globalThis,'fetch',async()=>responses.shift());
  const media=createMediaAdapter({env:{JIALIHUA_DASHSCOPE_API_KEY:'test-only'}});
  for(let i=0;i<3;i++)await assert.rejects(media.speech({text:'你好',voice:'xiaoyi',language:'henan'}),error=>/河南话/.test(error.message)&&!error.message.includes('secret-upstream'));
  assert.equal(responses.length,0);
});

test('Henan demo status is false until all nine audio files and the P3 video exist', async (t) => {
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
  const {join}=await import('node:path');const {tmpdir}=await import('node:os');
  const directory=await mkdtemp(join(tmpdir(),'jialihua-demo-status-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const server=createServer(createApp({demoDir:directory}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const status=async()=>await(await fetch(base+'/api/status')).json();
  assert.equal((await status()).henanDemo,false);
  for(const id of ['W1','W2','W3','P1','P2','P3','S1','S2','S3'])await writeFile(join(directory,`${id}-henan.mp3`),Buffer.alloc(1001));
  assert.equal((await status()).henanDemo,false);
  await writeFile(join(directory,'P3-henan.mp4'),Buffer.alloc(1001));
  assert.equal((await status()).henanDemo,true);
});
