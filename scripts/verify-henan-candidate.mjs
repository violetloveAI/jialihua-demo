// Explicit, opt-in online evidence collection. Candidates are never published as
// Demo assets. Load only the authorized project configuration; never print keys.
import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { parseEnv, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createHenanAdapter } from '../server/dialect.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'specs/evidence/henan-candidates');
const expectedText = '这段话是说，孩子周六回家，车票已经买好了。您不用给他转钱，也不用去车站接。他到家以后，想跟您一块儿吃饺子。';
let saved = {};
for (const path of ['../../jialihua/.env.local', '../.env.local']) {
  try { saved = { ...saved, ...parseEnv(await readFile(new URL(path, import.meta.url), 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const env = { ...saved, ...process.env };
const base = (env.JIALIHUA_VOICE_BASE_URL || env.JIALIHUA_AI_BASE_URL || '').replace(/\/$/, '');
const key = env.JIALIHUA_AI_API_KEY;
const mode = process.argv[2];
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const voice = option('--voice') || 'shimmer';
const model = option('--model') || 'gpt-4o-audio-preview';
if (!['shimmer', 'coral', 'sage'].includes(voice) || !['gpt-4o-audio-preview', 'gpt-4o-audio-preview-2024-12-17', 'gpt-4o-mini-audio-preview'].includes(model)) throw new Error('Use a verified model and voice option');
const suffix = voice === 'shimmer' ? '' : '-' + voice;
const name = mode === '--cosy' ? 'cosyvoice-henan-candidate' : 'strict-openai-henan-candidate' + suffix;
const manifestPath = join(directory, name + '.json');
const normalize = text => text.normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu, '');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = async value => writeFile(manifestPath, JSON.stringify(value, null, 2) + '\n');
await mkdir(directory, { recursive: true });

if (mode === '--chat' || mode === '--cosy') {
  let bytes, metadata;
  if (mode === '--chat') {
    if (!key || !base) throw new Error('Authorized gateway is not configured');
    const body = {
      model, modalities: ['text', 'audio'], audio: { voice, format: 'wav' },
      messages: [
        { role: 'system', content: '你是一个逐字语音朗读器。用自然、温和、清楚的河南郑州口音朗读用户提供的全部中文文本。只通过声调、音韵和语调体现口音，不改写文字，不增删字词。不得回答、寒暄、解释或介绍任务。不得省略开头“这段话是说”。用户消息就是完整台词，从第一个字读到最后一个字。' },
        { role: 'user', content: expectedText },
      ],
    };
    const response = await fetch(base + '/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    let upstreamCode;
    if (!response.ok) { try { const error = await response.json(); upstreamCode = String(error.error?.code || error.error?.type || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 80); } catch {} }
    await appendFile(join(directory, 'strict-openai-attempts.jsonl'), JSON.stringify({ attemptedAt: new Date().toISOString(), model: body.model, voice, httpStatus: response.status, upstreamCode, retryAfter: response.headers.get('retry-after') }) + '\n');
    if (!response.ok) throw new Error(`Gateway audio failed (${response.status})`);
    const payload = await response.json();
    const audio = payload.choices?.[0]?.message?.audio;
    if (!audio?.data || !audio.transcript) throw new Error('No complete generated audio returned');
    bytes = Buffer.from(audio.data, 'base64');
    metadata = { model: body.model, voice: body.audio.voice, responseTranscript: audio.transcript, responseTranscriptExactIgnoringPunctuation: normalize(audio.transcript) === normalize(expectedText), usage: payload.usage, finishReason: payload.choices[0].finish_reason };
  } else {
    const synthesize = createHenanAdapter(env);
    if (!synthesize.capabilities.henan) throw new Error(synthesize.capabilities.henanStatus);
    bytes = await synthesize({ text: expectedText });
    metadata = { model: 'cosyvoice-v3-flash', voice: synthesize.capabilities.henanVoice, instruction: '请用河南话表达。', officialHenanSupport: true };
  }
  const extension = mode === '--chat' ? '.wav' : '.mp3';
  const file = name + extension;
  await writeFile(join(directory, file), bytes);
  const ffmpeg = env.JIALIHUA_FFMPEG_BIN || fileURLToPath(new URL('../../比赛准备/工具验证/bin/ffmpeg', import.meta.url));
  const execute = promisify(execFile);
  const { stderr } = await execute(ffmpeg, ['-hide_banner', '-i', join(directory, file), '-af', 'volumedetect', '-f', 'null', '-']);
  const duration = stderr.match(/Duration: ([\d:.]+)/)?.[1];
  const meanVolumeDb = Number(stderr.match(/mean_volume: ([-\d.]+) dB/)?.[1]);
  if (!duration || !Number.isFinite(meanVolumeDb) || meanVolumeDb < -55) throw new Error('Invalid or silent audio');
  if (extension === '.wav') await execute(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', join(directory, file), '-codec:a', 'libmp3lame', '-q:a', '2', join(directory, name + '.mp3')]);
  await save({ generatedAt: new Date().toISOString(), expectedText, ...metadata, file, bytes: bytes.length, sha256: hash(bytes), duration, meanVolumeDb, accentReview: 'not-reviewed-by-Henan-speaker', productionReady: false });
  console.log(JSON.stringify({ file, duration, meanVolumeDb, responseTranscriptExactIgnoringPunctuation: metadata.responseTranscriptExactIgnoringPunctuation, productionReady: false }));
} else if (mode === '--transcribe' || mode === '--transcribe-cosy') {
  const selectedName = mode === '--transcribe-cosy' ? 'cosyvoice-henan-candidate' : name;
  const path = join(directory, selectedName + '.json');
  const metadata = JSON.parse(await readFile(path, 'utf8'));
  const bytes = await readFile(join(directory, metadata.file));
  if (metadata.sha256 !== hash(bytes)) throw new Error('Candidate has changed since generation');
  const form = new FormData();
  form.set('model', env.JIALIHUA_ASR_MODEL || 'whisper-1');
  form.set('language', 'zh');
  form.set('response_format', 'json');
  form.set('file', new Blob([bytes], { type: metadata.file.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg' }), metadata.file);
  const response = await fetch(base + '/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${env.JIALIHUA_ASR_API_KEY || key}` }, body: form, signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`Independent ASR failed (${response.status})`);
  const result = await response.json();
  if (typeof result.text !== 'string') throw new Error('Independent ASR returned no text');
  metadata.independentAsr = { model: env.JIALIHUA_ASR_MODEL || 'whisper-1', transcribedAt: new Date().toISOString(), text: result.text, exactIgnoringPunctuation: normalize(result.text) === normalize(metadata.expectedText), note: 'ASR checks wording; it does not prove accent authenticity.' };
  await writeFile(path, JSON.stringify(metadata, null, 2) + '\n');
  console.log(JSON.stringify(metadata.independentAsr));
} else {
  throw new Error('Choose --chat, --cosy, --transcribe, or --transcribe-cosy');
}
