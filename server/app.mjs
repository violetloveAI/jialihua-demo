import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HENAN_UNAVAILABLE, InputError, analyzeInput, speechInput, exportInput } from './input.mjs';

const DEFAULT_DEMO = fileURLToPath(new URL('../public/demo/', import.meta.url));
const HENAN_DEMO_FILES = [...['W1', 'W2', 'W3', 'P1', 'P2', 'P3', 'S1', 'S2', 'S3'].map(id => `${id}-henan.mp3`), 'P3-henan.mp4'];
async function hasHenanDemo(directory) {
  try {
    const files = await Promise.all(HENAN_DEMO_FILES.map(name => stat(resolve(directory, name))));
    return files.every(file => file.isFile() && file.size > 1000);
  } catch { return false; }
}
const DEFAULT_STATIC = fileURLToPath(new URL('../dist/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const SAFE_ERRORS = { analyze: 'AI 解读暂时失败，请稍后重试', speech: '语音生成失败，请检查网络后重试', export: '视频生成失败，请检查语音服务和本机视频工具后重试' };

function json(response, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
  response.end(body);
}
function readJSON(request, limit) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) throw new InputError('请使用 JSON 请求', 415);
  if (Number(request.headers['content-length']) > limit) { request.resume(); throw new InputError('请求内容过大', 413); }
  return new Promise((resolveBody, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        chunks.length = 0;
        if (!tooLarge) reject(new InputError('请求内容过大', 413));
        tooLarge = true;
      } else if (!tooLarge) chunks.push(chunk);
    });
    request.on('end', () => {
      if (tooLarge) return;
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new InputError('请求内容不是有效 JSON')); }
    });
    request.on('aborted', () => reject(new InputError('请求已中断')));
    request.on('error', () => reject(new InputError('请求读取失败')));
  });
}
function verifyOrigin(request) {
  const host = request.headers.host || '';
  if (!/^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(host)) throw new InputError('只允许本机访问', 403);
  if (request.headers.origin && request.headers.origin !== `http://${host}`) throw new InputError('只允许从当前页面发起请求', 403);
  if (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site'])) throw new InputError('只允许同源请求', 403);
}
// Range applies only to GET. Unsupported multi-ranges are ignored; without
// validators an If-Range request conservatively receives the whole resource.
function singleByteRange(request, length) {
  const header = request.headers.range;
  if (request.method !== 'GET' || typeof header !== 'string' || request.headers['if-range'] || !header.startsWith('bytes=') || header.includes(',')) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || !length) return false;
  const first = match[1] ? Number(match[1]) : undefined;
  const last = match[2] ? Number(match[2]) : undefined;
  if ((first !== undefined && !Number.isSafeInteger(first)) || (last !== undefined && !Number.isSafeInteger(last))) return false;
  if (first === undefined) return last > 0 ? { start: Math.max(0, length - last), end: length - 1 } : false;
  if (first >= length || (last !== undefined && first > last)) return false;
  return { start: first, end: Math.min(last ?? length - 1, length - 1) };
}

async function staticFile(request, response, staticDir, pathname) {
  if (pathname.split('/').some((part) => part.startsWith('.'))) { json(response, 404, { error: '页面不存在' }); return; }
  let root;
  try { root = await realpath(staticDir); }
  catch { json(response, 404, { error: '请先构建前端页面' }); return; }
  let file = resolve(root, `.${pathname}`);
  try {
    if (!(await stat(file)).isFile()) file = resolve(root, 'index.html');
  } catch {
    if (extname(pathname)) { json(response, 404, { error: '文件不存在' }); return; }
    file = resolve(root, 'index.html');
  }
  try {
    file = await realpath(file);
    if (!file.startsWith(root + sep)) { json(response, 404, { error: '文件不存在' }); return; }
    const contents = await readFile(file);
    const headers = { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Content-Length': contents.length, 'Accept-Ranges': 'bytes' };
    const range = singleByteRange(request, contents.length);
    if (range === false) {
      response.writeHead(416, { ...headers, 'Content-Range': `bytes */${contents.length}`, 'Content-Length': 0 });
      response.end();
    } else if (range) {
      const body = contents.subarray(range.start, range.end + 1);
      response.writeHead(206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${contents.length}`, 'Content-Length': body.length });
      response.end(body);
    } else {
      response.writeHead(200, headers);
      response.end(request.method === 'HEAD' ? undefined : contents);
    }
  } catch { json(response, 404, { error: '文件不存在' }); }
}

/** Create a stateless local request handler. Adapters receive validated input and an AbortSignal. */
export function createApp({ analyze, speech, video, staticDir = DEFAULT_STATIC, demoDir = DEFAULT_DEMO, bodyLimit = 40 * 1024 * 1024 } = {}) {
  let exportBusy = false;
  let speechCount = 0;
  let analyzeCount = 0;
  const enabled = (adapter, capability) => typeof adapter === 'function' && adapter.capabilities?.[capability] !== false;
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    let route = '';
    let locked = false;
    const controller = new AbortController();
    response.once('close', () => { if (!response.writableFinished) controller.abort(); });
    try {
      verifyOrigin(request);
      let pathname;
      try { pathname = decodeURIComponent((request.url || '/').split('?')[0]); }
      catch { throw new InputError('请求地址不正确'); }
      if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some((part) => part === '.' || part === '..')) throw new InputError('请求地址不正确');
      if (pathname === '/api/status' && request.method === 'GET') {
        json(response, 200, { ai: enabled(analyze, 'ai'), speech: enabled(speech, 'speech'), video: enabled(video, 'video'), voiceProvider: 'edge-tts', dialect: '普通话', henan: speech?.capabilities?.henan === true, henanDemo: await hasHenanDemo(demoDir), henanVoice: speech?.capabilities?.henanVoice || null, henanStatus: speech?.capabilities?.henanStatus || HENAN_UNAVAILABLE });
        return;
      }
      route = ({ '/api/analyze': 'analyze', '/api/speech': 'speech', '/api/export': 'export' })[pathname];
      if (!route) {
        if (pathname.startsWith('/api/')) { json(response, 404, { error: '接口不存在' }); return; }
        if (!['GET', 'HEAD'].includes(request.method)) throw new InputError('请求方式不支持', 405);
        await staticFile(request, response, staticDir, pathname);
        return;
      }
      if (request.method !== 'POST') throw new InputError('请使用 POST 请求', 405);
      if ((route === 'export' && exportBusy) || (route === 'speech' && speechCount >= 2) || (route === 'analyze' && analyzeCount >= 2)) {
        response.setHeader('Retry-After', '5');
        throw new InputError('正在处理其他请求，请稍后重试', 429);
      }
      if (route === 'export') exportBusy = true;
      if (route === 'speech') speechCount += 1;
      if (route === 'analyze') analyzeCount += 1;
      locked = true;
      const input = await readJSON(request, Math.min(bodyLimit, route === 'speech' ? 12000 : bodyLimit));
      const validated = route === 'analyze' ? analyzeInput(input) : route === 'speech' ? speechInput(input) : exportInput(input);
      const adapter = route === 'analyze' ? analyze : route === 'speech' ? speech : video;
      if (!enabled(adapter, route === 'export' ? 'video' : route === 'analyze' ? 'ai' : 'speech')) throw new InputError(route === 'analyze' ? 'AI 解读尚未配置' : route === 'speech' ? '普通话语音工具不可用' : '本机视频或语音工具不可用', 503);
      if (route !== 'analyze' && validated.language === 'henan' && adapter.capabilities?.henan !== true) throw new InputError(speech?.capabilities?.henanStatus || HENAN_UNAVAILABLE, 503);
      const result = await adapter({ ...validated, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (route === 'analyze') {
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid AI result');
        json(response, 200, { result });
      } else {
        if (!Buffer.isBuffer(result) || !result.length) throw new Error('Empty media');
        if(route==='speech'&&request.headers.accept?.includes('application/json')){
          json(response,200,{audio:result.toString('base64'),cues:result.cues||[]});return;
        }
        response.writeHead(200, {
          'Content-Type': route === 'speech' ? 'audio/mpeg' : 'video/mp4',
          'Content-Length': result.length,
          'Content-Disposition': `${route === 'export' ? 'attachment' : 'inline'}; filename="jialihua.${route === 'speech' ? 'mp3' : 'mp4'}"`,
        });
        response.end(result);
      }
    } catch (error) {
      if (!response.destroyed && !response.headersSent) json(response, error instanceof InputError ? error.status : 502, { error: error instanceof InputError ? error.message : SAFE_ERRORS[route] || '服务暂时不可用' });
    } finally {
      if (locked && route === 'export') exportBusy = false;
      if (locked && route === 'speech') speechCount -= 1;
      if (locked && route === 'analyze') analyzeCount -= 1;
    }
  };
}
