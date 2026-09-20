import { InputError, HENAN_UNAVAILABLE } from './input.mjs';
import {alignWords,parseCosyStream} from './timing.mjs';

// Official CosyVoice voice list explicitly supports Henan with this exact instruction.
// https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list
// https://help.aliyun.com/zh/model-studio/cosyvoice-tts-http-api
export const HENAN_VOICE = 'longanhuan_v3';
export const HENAN_MODEL = 'cosyvoice-v3-flash';
const ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer';
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const failure = (message = '河南话语音生成失败，请检查百炼服务后重试。') => new InputError(message, 503);

async function boundedBytes(response, limit) {
  if (!response.body || Number(response.headers.get('content-length')) > limit) throw failure();
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw failure();
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); }
}

export function createHenanAdapter(env = process.env) {
  const key = env.JIALIHUA_DASHSCOPE_API_KEY?.trim();
  const region = env.JIALIHUA_DASHSCOPE_REGION || 'cn-beijing';
  const regionSupported = ['cn-beijing', 'beijing'].includes(region);
  const available = Boolean(key && regionSupported);
  const status = !key ? HENAN_UNAVAILABLE : !regionSupported
    ? '河南话语音需要百炼北京地域 API Key。'
    : '河南话声线已配置，使用百炼龙安欢河南话合成。';
  const synthesize = async ({ text, signal }) => {
    if (!available) throw failure(status);
    const deadline = AbortSignal.timeout(90_000);
    const taskSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST', redirect: 'error', signal: taskSignal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-DashScope-SSE':'enable' },
        body: JSON.stringify({ model: HENAN_MODEL, input: {
          text, voice: HENAN_VOICE, instruction: '请用河南话表达。',
          format: 'mp3', sample_rate: 24000, rate: 1, enable_ssml: false, word_timestamp_enabled:true,
        } }),
      });
      if (!response.ok) {
        const detail=(await boundedBytes(response,64*1024)).toString('utf8');
        if(detail.includes('Arrearage'))throw failure('河南话语音账户余额不足，请在阿里云百炼补充额度后再试。');
        throw failure(response.status === 401 || response.status === 403
          ? '河南话语音鉴权失败，请检查百炼北京地域 API Key 和模型权限。'
          : '河南话语音服务暂时不可用，请检查百炼额度或稍后重试。');
      }
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const {bytes,words}=parseCosyStream((await boundedBytes(response, MAX_AUDIO_BYTES*2)).toString('utf8'));
        if(bytes.length<1000)throw failure();
        bytes.cues=alignWords(text,words);return bytes;
      }
      const payload = JSON.parse((await boundedBytes(response, 64 * 1024)).toString('utf8'));
      if (payload.output?.finish_reason !== 'stop') throw failure();
      const url = new URL(payload.output?.audio?.url);
      // Audio arrives as a signed OSS URL. Never forward the API key, follow a
      // redirect, or allow the upstream to make us fetch a private/local address.
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || !/^dashscope-result-[a-z0-9-]+\.oss-[a-z0-9-]+\.aliyuncs\.com$/.test(url.hostname)) throw failure();
      url.protocol = 'https:';
      const download = await fetch(url.href, { redirect: 'error', signal: taskSignal });
      if (!download.ok) throw failure();
      const bytes = await boundedBytes(download, MAX_AUDIO_BYTES);
      const mp3 = bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
      if (bytes.length < 1000 || !mp3) throw failure('河南话语音返回的音频格式不正确，请重试。');
      return bytes;
    } catch (error) {
      if (error instanceof InputError) throw error;
      throw failure();
    }
  };
  synthesize.capabilities = { henan: available, henanVoice: available ? HENAN_VOICE : null, henanStatus: status };
  return synthesize;
}
