import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const { createApp } = await import('../server/app.mjs').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, crc]);
}
function png(width = 720, height = 1280) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 3 + 1) * height))), chunk('IEND', Buffer.alloc(0))]);
}
const frame = { dataUrl: `data:image/png;base64,${png().toString('base64')}`, text: '明天下午三点见。' };
const image = { dataUrl: frame.dataUrl, name: '虚构测试.png' };
async function serve(t, options = {}) {
  assert.equal(typeof createApp, 'function', 'local HTTP service must be implemented');
  const server = createServer(createApp(options));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, value, headers = {}) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, ...headers }, body: JSON.stringify(value),
  });
  return { base, post };
}

// These tests catch private legacy routes, unsafe input acceptance, false media success,
// cross-site use, secret leakage, and concurrent expensive exports.
test('status reports supplied capabilities and legacy family/session routes do not exist', async (t) => {
  const { base } = await serve(t, { analyze: async () => ({}), speech: async () => Buffer.from('mp3'), video: async () => Buffer.from('mp4'), demoDir: '/not-configured/jialihua-demo' });
  const response = await fetch(base + '/api/status');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ai: true, speech: true, video: true, voiceProvider: 'edge-tts', dialect: '普通话', henan: false, henanDemo: false, henanVoice: null, henanStatus: '河南话语音尚未接通，当前服务没有可用的河南话声线。' });
  for (const route of ['/api/families', '/api/session', '/api/history', '/api/messages']) {
    assert.equal((await fetch(base + route)).status, 404);
  }
});

test('analyze sends only explicit screenshot inputs and wraps its result', async (t) => {
  const { post } = await serve(t, { analyze: async (input) => ({ title: '已解读', sourceType: input.sourceType, images: input.images.length }) });
  const response = await post('/api/analyze', { images: [image], sourceType: 'wechat_chat' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { result: { title: '已解读', sourceType: 'wechat_chat', images: 1 } });
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('corrected text can be reinterpreted without uploading the image again', async (t) => {
  const { post } = await serve(t, { analyze: async ({ correctedItems }) => ({ items: correctedItems }) });
  const correctedItems = [{ speaker: '小林', text: '不是下午两点，是三点。', kind: 'message' }];
  const response = await post('/api/analyze', { images: [], sourceType: 'wechat_chat', correctedItems });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result.items, correctedItems);
});

test('analyze rejects remote URLs, invalid MIME, missing content and unsafe input shapes', async (t) => {
  const { post } = await serve(t, { analyze: async () => { throw new Error('must not reach upstream'); } });
  for (const input of [
    { images: [{ dataUrl: 'http://127.0.0.1/secret' }], sourceType: 'auto' },
    { images: [{ dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }], sourceType: 'auto' },
    { images: [], sourceType: 'auto' },
    { images: [image], sourceType: 'arbitrary' },
    { images: [{ ...image, name: '../secret.png' }], sourceType: 'auto' },
    { images: [image], sourceType: 'auto', family: { members: [] } },
  ]) assert.equal((await post('/api/analyze', input)).status, 400);
});

test('cross-origin and DNS rebinding hosts cannot invoke local APIs', async (t) => {
  const { base, post } = await serve(t);
  assert.equal((await post('/api/speech', { text: '你好', voice: 'xiaoyi' }, { Origin: 'https://attacker.example' })).status, 403);
  // Node fetch rewrites Host. Use the HTTP client to exercise an actual hostile Host header.
  const hostileHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(base + '/api/status', { headers: { Host: 'attacker.example' } }, (response) => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end();
  });
  assert.equal(hostileHostStatus, 403);
  assert.equal((await post('/api/speech', { text: '你好', voice: 'xiaoyi' }, { Origin: 'null' })).status, 403);
});

test('upstream failure details never become public error messages', async (t) => {
  const failure = async () => { throw new Error('secret-key-123 provider body'); };
  const { post } = await serve(t, { analyze: failure, speech: failure, video: failure });
  for (const [path, input] of [
    ['/api/analyze', { images: [image], sourceType: 'auto' }],
    ['/api/speech', { text: '你好', voice: 'xiaoyi' }],
    ['/api/export', { frames: [frame], voice: 'xiaoyi' }],
  ]) {
    const response = await post(path, input);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /secret|provider/);
  }
});

test('speech returns binary audio for an allowed voice and rejects empty or excessive text', async (t) => {
  const { post } = await serve(t, { speech: async ({ text, voice }) => Buffer.from(`ID3:${voice}:${text}`) });
  const response = await post('/api/speech', { text: '你好', voice: 'xiaoyi' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^audio\/mpeg/);
  assert.equal(await response.text(), 'ID3:xiaoyi:你好');
  for (const input of [{ text: '', voice: 'xiaoyi' }, { text: '好'.repeat(801), voice: 'xiaoyi' }, { text: '你好', voice: '--voice=other' }]) {
    assert.equal((await post('/api/speech', input)).status, 400);
  }
});

test('export returns a binary attachment and only accepts decodable 720×1280 PNG pages', async (t) => {
  const { post } = await serve(t, { video: async () => Buffer.from('MP4-binary') });
  const response = await post('/api/export', { frames: [frame], voice: 'xiaoyi' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^video\/mp4/);
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.equal(await response.text(), 'MP4-binary');
  const corrupt = png(); corrupt[50] ^= 0xff;
  for (const invalidFrame of [
    { ...frame, dataUrl: 'data:image/png;base64,YmFk' },
    { ...frame, dataUrl: `data:image/png;base64,${png(1, 1).toString('base64')}` },
    { ...frame, dataUrl: `data:image/png;base64,${corrupt.toString('base64')}` },
    { ...frame, text: '字'.repeat(101) },
  ]) assert.equal((await post('/api/export', { frames: [invalidFrame], voice: 'xiaoyi' })).status, 400);
  assert.equal((await post('/api/export', { frames: Array(9).fill(frame), voice: 'xiaoyi' })).status, 400);
});

test('empty media output is a failure, never a successful silent or unrelated video', async (t) => {
  const { post } = await serve(t, { speech: async () => Buffer.alloc(0), video: async () => Buffer.alloc(0) });
  assert.equal((await post('/api/speech', { text: '你好', voice: 'xiaoyi' })).status, 502);
  assert.equal((await post('/api/export', { frames: [frame], voice: 'xiaoyi' })).status, 502);
});

test('only one expensive export can run at a time and the slot releases after failure', async (t) => {
  let release;
  let start;
  const begun = new Promise((resolve) => { start = resolve; });
  const blocked = new Promise((resolve) => { release = resolve; });
  const { post } = await serve(t, { video: async () => { start(); await blocked; throw new Error('failed'); } });
  const first = post('/api/export', { frames: [frame], voice: 'xiaoyi' });
  await begun;
  assert.equal((await post('/api/export', { frames: [frame], voice: 'xiaoyi' })).status, 429);
  release();
  assert.equal((await first).status, 502);
  assert.equal((await post('/api/export', { frames: [frame], voice: 'xiaoyi' })).status, 502);
});

test('JSON request limits apply before expensive input decoding', async (t) => {
  const { base } = await serve(t, { bodyLimit: 100 });
  const response = await fetch(base + '/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(101) }) });
  assert.equal(response.status, 413);
  const textResponse = await fetch(base + '/api/speech', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(textResponse.status, 415);
});

test('static server blocks traversal and dotfiles but supports client side routes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'jialihua-static-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'index.html'), '<main>家里话</main>');
  await writeFile(join(root, '.env'), 'secret-key');
  const { base } = await serve(t, { staticDir: root });
  assert.match(await (await fetch(base + '/history')).text(), /家里话/);
  assert.equal((await fetch(base + '/.env')).status, 404);
  const status = await new Promise((resolve, reject) => {
    const request = httpRequest(base + '/', { path: '/%2e%2e/%2eenv' }, (response) => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end();
  });
  assert.equal(status, 400);
});

const { createMediaAdapter } = await import('../server/media.mjs').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const ffmpegPath = fileURLToPath(new URL('../../比赛准备/工具验证/bin/ffmpeg', import.meta.url));
const ffmpegAvailable = await access(ffmpegPath).then(() => true, () => false);
const execute = promisify(execFile);

test('a failed page narration leaves no private temporary image or text behind', async (t) => {
  assert.equal(typeof createMediaAdapter, 'function', 'media export must be implemented');
  const root = await mkdtemp(join(tmpdir(), 'jialihua-media-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const media = createMediaAdapter({ tempRoot: root, ffmpegPath, synthesize: async () => { throw new Error('voice offline'); } });
  await assert.rejects(media.video({ frames: [frame], voice: 'xiaoyi' }));
  assert.deepEqual(await readdir(root), []);
});

test('real ffmpeg produces a decodable MP4 and removes all temporary source files', { skip: !ffmpegAvailable }, async (t) => {
  assert.equal(typeof createMediaAdapter, 'function', 'media export must be implemented');
  const root = await mkdtemp(join(tmpdir(), 'jialihua-media-test-'));
  const fixtures = await mkdtemp(join(tmpdir(), 'jialihua-fixture-test-'));
  t.after(async () => { await rm(root, { recursive: true, force: true }); await rm(fixtures, { recursive: true, force: true }); });
  // TTS is an external online service. This test substitutes its MP3 result, while
  // exercising real image validation, file lifetimes, encoding and MP4 decoding.
  const { stdout: audio } = await execute(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.25', '-f', 'mp3', 'pipe:1'], { encoding: 'buffer' });
  const media = createMediaAdapter({ tempRoot: root, ffmpegPath, synthesize: async () => audio });
  const result = await media.video({ frames: [frame, { ...frame, text: '请带上水杯。' }], voice: 'xiaoyi' });
  assert.equal(result.toString('ascii', 4, 8), 'ftyp');
  assert.ok(result.length > 1000);
  assert.deepEqual(await readdir(root), []);
  const output = join(fixtures, 'result.mp4');
  await writeFile(output, result);
  const { stderr } = await execute(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', output, '-f', 'null', '-']);
  assert.equal(stderr, '');
});

// Safari/iPhone video loading and seeking request initial and later byte ranges.
test('static media supports one byte range, suffix ranges, open ends and unsatisfiable ranges', async (t) => {
  const root=await mkdtemp(join(tmpdir(),'jialihua-range-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const bytes=Buffer.from('0123456789');
  await writeFile(join(root,'clip.mp4'),bytes);
  const {base}=await serve(t,{staticDir:root});
  for(const [range,contentRange,body] of [
    ['bytes=0-1','bytes 0-1/10','01'],
    ['bytes=3-','bytes 3-9/10','3456789'],
    ['bytes=-3','bytes 7-9/10','789'],
    ['bytes=7-999','bytes 7-9/10','789'],
    ['bytes=-999','bytes 0-9/10','0123456789'],
  ]){
    const response=await fetch(base+'/clip.mp4',{headers:{Range:range}});
    assert.equal(response.status,206);
    assert.equal(response.headers.get('content-type'),'video/mp4');
    assert.equal(response.headers.get('accept-ranges'),'bytes');
    assert.equal(response.headers.get('content-range'),contentRange);
    assert.equal(response.headers.get('content-length'),String(body.length));
    assert.equal(await response.text(),body);
  }
  for(const range of ['bytes=10-','bytes=7-3','bytes=-0','bytes=abc']){
    const response=await fetch(base+'/clip.mp4',{headers:{Range:range}});
    assert.equal(response.status,416);
    assert.equal(response.headers.get('content-range'),'bytes */10');
    assert.equal(await response.text(),'');
  }
  // HEAD and unsupported multi-range / units / unvalidated If-Range requests
  // use the ordinary complete representation, never a malformed 206 response.
  for(const options of [
    {method:'HEAD',headers:{Range:'bytes=0-1'}},
    {headers:{Range:'bytes=0-1,5-6'}},
    {headers:{Range:'items=0-1'}},
    {headers:{Range:'bytes=0-1','If-Range':'"stale-etag"'}},
  ]){
    const response=await fetch(base+'/clip.mp4',options);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-length'),'10');
    assert.equal(response.headers.get('content-range'),null);
    assert.equal(await response.text(),options.method==='HEAD'?'':'0123456789');
  }
});
