// Opt-in online integration check. Uses only these fictional, non-personal sentences.
// Run after `node server/start.mjs`: node scripts/check-media.mjs [output.mp4]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const execute = promisify(execFile);
const ffmpeg = fileURLToPath(new URL('../../比赛准备/工具验证/bin/ffmpeg', import.meta.url));
const base = 'http://127.0.0.1:4174';
const output = resolve(process.argv[2] || join(tmpdir(), 'jialihua-translate-fictional-check.mp4'));
const temporary = await mkdtemp(join(tmpdir(), 'jialihua-check-'));
async function post(path, body) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${path}: ${response.status}: ${await response.text()}`);
  return response;
}
try {
  const status = await (await fetch(base + '/api/status')).json();
  assert.equal(status.speech, true); assert.equal(status.video, true);
  const speechResponse = await post('/api/speech', { text: '这是虚构演示，明天下午三点见。', voice: 'xiaoyi' });
  assert.match(speechResponse.headers.get('content-type'), /^audio\/mpeg/);
  const speech = Buffer.from(await speechResponse.arrayBuffer());
  assert.ok(speech.length > 1000);
  const texts = ['这是虚构演示。\n明天下午三点见。', '请带上水杯。\n到门口后再联系。'];
  const frames = [];
  for (let index = 0; index < texts.length; index += 1) {
    const textPath = join(temporary, `page-${index}.txt`);
    const imagePath = join(temporary, `page-${index}.png`);
    const labelPath = join(temporary, 'label.txt');
    await writeFile(textPath, texts[index]);
    await writeFile(labelPath, '虚构测试 · AI 辅助解释\n小艺普通话合成声音');
    const font = '/System/Library/Fonts/STHeiti Light.ttc';
    await execute(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xf8f3e6:s=720x1280', '-vf',
      `drawtext=fontfile='${font}':textfile='${textPath}':fontcolor=0x274d3c:fontsize=64:line_spacing=30:x=72:y=420,drawtext=fontfile='${font}':textfile='${labelPath}':fontcolor=0x4e685a:fontsize=28:line_spacing=16:x=72:y=1040`,
      '-frames:v', '1', '-pix_fmt', 'rgb24', imagePath]);
    frames.push({ dataUrl: `data:image/png;base64,${(await readFile(imagePath)).toString('base64')}`, text: texts[index].replaceAll('\n', '') });
  }
  const response = await post('/api/export', { frames, voice: 'xiaoyi' });
  assert.match(response.headers.get('content-type'), /^video\/mp4/);
  const video = Buffer.from(await response.arrayBuffer());
  assert.equal(video.toString('ascii', 4, 8), 'ftyp');
  await writeFile(output, video);
  const { stderr } = await execute(ffmpeg, ['-hide_banner', '-i', output, '-f', 'null', '-']);
  assert.match(stderr, /Video: h264/); assert.match(stderr, /720x1280/); assert.match(stderr, /Audio: aac/);
  const duration = stderr.match(/Duration: ([\d:.]+)/)?.[1];
  console.log(JSON.stringify({ status, speechBytes: speech.length, videoBytes: video.length, pages: frames.length, duration, output }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
