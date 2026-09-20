import { createHenanAdapter } from './dialect.mjs';
import {createHash} from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants, accessSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {alignWords,highlightFilters} from './timing.mjs';
import { fileURLToPath } from 'node:url';
import { HENAN_UNAVAILABLE, InputError, VOICES, speechInput, exportInput, validateFramePNG } from './input.mjs';

function executable(path) {
  if (!path) return false;
  try { accessSync(path, constants.X_OK); return true; } catch { return false; }
}
function onPath(name) {
  return (process.env.PATH || '').split(':').map((directory) => join(directory, name)).find(executable);
}
function edgeCommand(env) {
  if (env.JIALIHUA_EDGE_TTS_BIN) return executable(env.JIALIHUA_EDGE_TTS_BIN) ? { bin: env.JIALIHUA_EDGE_TTS_BIN, args: [] } : null;
  const direct = onPath('edge-tts');
  if (direct) return { bin: direct, args: [] };
  // Reuse the MBTI project's existing uv environment without installing dependencies.
  const cache = join(env.UV_CACHE_DIR || join(homedir(), '.cache/uv'), 'archive-v0');
  try {
    for (const directory of readdirSync(cache)) {
      const candidate = join(cache, directory, 'bin/edge-tts');
      if (executable(candidate)) return { bin: candidate, args: [] };
    }
  } catch { /* The optional cache may not exist on another machine. */ }
  const uvx = onPath('uvx') || join(homedir(), '.local/bin/uvx');
  return executable(uvx) ? { bin: uvx, args: ['--from', 'edge-tts', 'edge-tts'] } : null;
}
function childEnvironment(env) {
  // AI credentials are only needed by the server-side HTTP adapter, never children.
  const names = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy', 'UV_CACHE_DIR'];
  return Object.fromEntries(names.filter((key) => env[key] !== undefined).map((key) => [key, env[key]]));
}
function run(bin, args, { signal, timeout = 120000, env } = {}) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const child = spawn(bin, args, { shell: false, stdio: ['ignore', 'ignore', 'ignore'], env });
    let timeoutHit = false;
    const kill = () => { child.kill('SIGKILL'); };
    const timer = setTimeout(() => { timeoutHit = true; kill(); }, timeout);
    timer.unref();
    signal?.addEventListener('abort', kill, { once: true });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', kill); };
    child.once('error', () => { cleanup(); reject(new Error('Media tool could not start')); });
    child.once('close', (code) => {
      cleanup();
      if (code === 0 && !signal?.aborted && !timeoutHit) resolve();
      else reject(new Error(signal?.aborted ? 'Media request cancelled' : timeoutHit ? 'Media tool timed out' : 'Media generation failed'));
    });
  });
}
async function readMedia(path, maxBytes) {
  const file = await stat(path);
  if (!file.isFile() || file.size < 16 || file.size > maxBytes) throw new Error('Invalid media output');
  return readFile(path);
}

/** Generate fresh speech and per-page MP4s. Nothing is retained after completion/failure. */
export function createMediaAdapter({ env = process.env, tempRoot = tmpdir(), ffmpegPath, synthesize } = {}) {
  const tts = edgeCommand(env);
  const henanSpeech = createHenanAdapter(env);
  const ffmpeg = ffmpegPath || env.JIALIHUA_FFMPEG_BIN || onPath('ffmpeg') || fileURLToPath(new URL('../../比赛准备/工具验证/bin/ffmpeg', import.meta.url));
  const processEnv = childEnvironment(env);

  async function freshSpeech({ text, voice, signal }) {
    if (!tts) throw new Error('Speech tool unavailable');
    const directory = await mkdtemp(join(tempRoot, 'jialihua-speech-'));
    try {
      const preset = VOICES[voice];
      const input = join(directory, 'text.txt');
      const output = join(directory, 'speech.mp3');
      const timings = join(directory,'words.json');
      await writeFile(input, text, { mode: 0o600 });
      const python=join(dirname(tts.bin),'python3');
      const helper=fileURLToPath(new URL('../scripts/edge-word-speech.py',import.meta.url));
      const canTime=executable(python)||tts.args.length>0;
      if(canTime)await run(executable(python)?python:tts.bin,[...(executable(python)?[]:['--from','edge-tts','python']),helper,input,output,timings,preset.name,preset.rate,preset.pitch],{signal,timeout:90000,env:processEnv});
      else await run(tts.bin, [...tts.args, '--voice', preset.name, `--rate=${preset.rate}`, `--pitch=${preset.pitch}`, '--file', input, '--write-media', output], { signal, timeout: 90000, env: processEnv });
      const audio = await readMedia(output, 12 * 1024 * 1024);
      if (!(audio.toString('ascii', 0, 3) === 'ID3' || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0))) throw new Error('Invalid MP3 output');
      if(canTime)audio.cues=alignWords(text,JSON.parse(await readFile(timings,'utf8')));
      return audio;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  const produceSpeech = synthesize || freshSpeech;
  const speech = async ({ signal, ...input }) => {
    const validated = speechInput(input);
    const hash=createHash('sha256').update(validated.language+'|'+validated.text).digest('hex');
    const prepared=fileURLToPath(new URL('../public/demo/readers/'+hash,import.meta.url));
    try{const audio=await readFile(prepared+'.mp3');const metadata=JSON.parse(await readFile(prepared+'.json','utf8'));if(metadata.text===validated.text&&metadata.language===validated.language&&metadata.rate===1&&(validated.language!=='henan'||metadata.timingVersion===2)){audio.cues=metadata.cues;return audio;}}catch{}
    if (validated.language === 'henan') return henanSpeech({ ...validated, signal });
    return produceSpeech({ ...validated, signal });
  };
  speech.capabilities = { speech: Boolean(synthesize || tts), ...henanSpeech.capabilities };

  const video = async ({ signal, ...input }) => {
    const { frames, voice, language } = exportInput(input);
    if (language === 'henan' && !speech.capabilities.henan) throw new InputError(HENAN_UNAVAILABLE, 503);
    if (!executable(ffmpeg) || !speech.capabilities.speech) throw new Error('Video tools unavailable');
    const deadline = AbortSignal.timeout(8 * 60 * 1000);
    const taskSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const directory = await mkdtemp(join(tempRoot, 'jialihua-video-'));
    try {
      const segments = [];
      for (let index = 0; index < frames.length; index += 1) {
        taskSignal.throwIfAborted();
        const page = frames[index];
        const imagePath = join(directory, `page-${index}.png`);
        const audioPath = join(directory, `page-${index}.mp3`);
        const segmentName = `page-${index}.mp4`;
        const segmentPath = join(directory, segmentName);
        await writeFile(imagePath, validateFramePNG(page.dataUrl), { mode: 0o600 });
        const audio = await speech({ text: page.text, voice, language, signal: taskSignal });
        if (!Buffer.isBuffer(audio) || audio.length < 16) throw new Error('Narration unavailable');
        await writeFile(audioPath, audio, { mode: 0o600 });
        const filters=highlightFilters(page.glyphs,audio.cues);
        const filterPath=join(directory,`highlight-${index}.txt`);
        if(filters)await writeFile(filterPath,filters,{mode:0o600});
        await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', imagePath, '-i', audioPath,
          ...(filters?['-filter_script:v',filterPath]:[]),
          '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-crf', '23', '-threads', '2',
          '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '24000', '-ac', '1', '-af', 'apad=pad_dur=0.5',
          '-shortest', '-movflags', '+faststart', segmentPath], { signal: taskSignal, timeout: 120000, env: processEnv });
        segments.push(`file '${segmentName}'`);
      }
      const listPath = join(directory, 'pages.txt');
      const output = join(directory, 'jialihua.mp4');
      await writeFile(listPath, segments.join('\n') + '\n', { mode: 0o600 });
      await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '1', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', output], { signal: taskSignal, env: processEnv });
      const result = await readMedia(output, 100 * 1024 * 1024);
      if (result.toString('ascii', 4, 8) !== 'ftyp') throw new Error('Invalid MP4 output');
      return result;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };
  video.capabilities = { video: executable(ffmpeg) && speech.capabilities.speech, henan: speech.capabilities.henan };
  return { speech, video };
}
