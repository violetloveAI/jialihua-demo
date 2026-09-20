// Generate only the public fictional examples. --verify never calls online services.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify, parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { cases } from '../src/data.mjs';
import { getDemoResult } from '../src/demo.mjs';
import { createMediaAdapter } from '../server/media.mjs';
import {t} from '../src/i18n.mjs';
import {contentNarrations,originalNarrations} from '../src/narration.mjs';
import {allFunctionVoices} from '../src/function-voice.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=join(root,'public/demo');
const ffmpeg=process.env.JIALIHUA_FFMPEG_BIN||fileURLToPath(new URL('../../比赛准备/工具验证/bin/ffmpeg',import.meta.url));
const execute=promisify(execFile);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const narration=result=>result.explanation;
async function info(name){
 const bytes=await readFile(join(directory,name));
 const {stderr}=await execute(ffmpeg,['-hide_banner','-i',join(directory,name),'-af','volumedetect','-f','null','-']);
 const duration=stderr.match(/Duration: ([\d:.]+)/)?.[1];
 const meanVolume=Number(stderr.match(/mean_volume: ([-\d.]+) dB/)?.[1]);
 assert.ok(bytes.length>1000 && duration && meanVolume>-55,`Invalid or silent media: ${name}`);
 if(name.endsWith('.mp4')){assert.match(stderr,/Video: h264/);assert.match(stderr,/720x1280/);assert.match(stderr,/Audio: aac/);}
 else assert.match(stderr,/Audio: mp3/);
 return {file:name,bytes:bytes.length,sha256:digest(bytes),duration,meanVolumeDb:meanVolume};
}
const manifestPath=join(directory,'manifest.json');
if(process.argv.includes('--verify')){
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 for(const asset of manifest.audio){
  assert.equal(asset.text,narration(getDemoResult(asset.caseId,asset.language)));
  const actual=await info(asset.file);assert.equal(actual.sha256,asset.sha256);
 }
 for(const asset of manifest.video){const actual=await info(asset.file);assert.equal(actual.sha256,asset.sha256);}
 console.log(JSON.stringify({verifiedAudio:manifest.audio.length,verifiedVideo:manifest.video.length,henan:manifest.henan}));
 process.exit(0);
}
await mkdir(directory,{recursive:true});
await rm(join(directory,'henan-validation.mp3'),{force:true});
let saved={};
for(const url of ['../../jialihua/.env.local','../.env.local']){try{saved={...saved,...parseEnv(await readFile(new URL(url,import.meta.url),'utf8'))};}catch(e){if(e.code!=='ENOENT')throw e;}}
const env={...saved,...process.env};
if(process.argv.includes('--transcribe')){
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 const base=(env.JIALIHUA_VOICE_BASE_URL||env.JIALIHUA_AI_BASE_URL||'').replace(/\/$/,'');
 const key=env.JIALIHUA_ASR_API_KEY||env.JIALIHUA_AI_API_KEY;
 if(!base||!key)throw new Error('ASR gateway unavailable');
 let transcripts=[];
 try{transcripts=JSON.parse(await readFile(join(directory,'transcripts.json'),'utf8')).transcripts||[];}catch{}
 const selectedCase=process.argv.find(arg=>arg.startsWith('--case='))?.slice(7);
 for(const asset of [...manifest.audio,...manifest.video].filter(asset=>(!process.argv.includes('--henan')||asset.language==='henan')&&(!selectedCase||asset.caseId===selectedCase))){
  if(transcripts.some(item=>item.file===asset.file&&item.sha256===asset.sha256))continue;
  transcripts=transcripts.filter(item=>item.file!==asset.file);
  const form=new FormData();
  form.set('model',env.JIALIHUA_ASR_MODEL||'whisper-1');form.set('language','zh');form.set('response_format','json');
  form.set('file',new Blob([await readFile(join(directory,asset.file))],{type:asset.file.endsWith('.mp4')?'video/mp4':'audio/mpeg'}),asset.file);
  let response;
  for(let attempt=0;attempt<3;attempt++){
   response=await fetch(base+'/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(90000)});
   if(response.status!==429||attempt===2)break;
   const delay=Math.max(5,Math.min(60,Number(response.headers.get('retry-after'))||30));
   await new Promise(resolve=>setTimeout(resolve,delay*1000));
  }
  if(!response.ok)throw new Error(`ASR unavailable (${response.status})`);
  const result=await response.json();
  if(typeof result.text!=='string')throw new Error('ASR returned no text');
  transcripts.push({file:asset.file,language:asset.language,sha256:asset.sha256,expectedText:asset.text||asset.pages.join(''),transcript:result.text});
  await writeFile(join(directory,'transcripts.json'),JSON.stringify({model:env.JIALIHUA_ASR_MODEL||'whisper-1',verifiedAt:new Date().toISOString(),transcripts},null,2)+'\n');
  console.log('transcribed',asset.file);
 }
 process.exit(0);
}
const media=createMediaAdapter({env,ffmpegPath:ffmpeg});
if(process.argv.includes('--readers')){
 const out=join(directory,'readers');await mkdir(out,{recursive:true});
 for(const language of process.argv.includes('--mandarin')?['mandarin']:process.argv.includes('--henan')?['henan']:['mandarin','henan']){
  const lines=new Set(['elderTitle','selectPicture','history','font','examples','readPage','videoTitle'].map(key=>t(key,language)));
  lines.add(language==='henan'?'念的快慢，能选正常念、慢一点，再慢一点。':'朗读速度，可以选择正常读、读慢一点、再读慢一点。');
  for(const sample of cases){const r=getDemoResult(sample.id,language);lines.add(r.title);r.explanation.split('\n').filter(Boolean).forEach(line=>lines.add(line));r.glossary.forEach(term=>lines.add(term.term+'。'+term.explanation));Object.values(contentNarrations(r,language)).filter(Boolean).forEach(line=>lines.add(line));const original=originalNarrations(r.items);lines.add(original.all);original.rows.forEach(item=>lines.add(item.speech));}
  allFunctionVoices(language).forEach(item=>lines.add(item.text));
  const jobs=[...lines];let done=0;
  async function worker(){while(jobs.length){const text=jobs.shift();const hash=digest(Buffer.from(language+'|'+text));const audio=await media.speech({text,voice:'xiaoyi',language});await writeFile(join(out,hash+'.mp3'),audio);await writeFile(join(out,hash+'.json'),JSON.stringify({text,language,rate:1,timingVersion:2,cues:audio.cues||[]}));done++;if(done%10===0||!jobs.length)console.log('prepared reader',language,done);}}
  await Promise.all([worker(),worker()]);
 }
 process.exit(0);
}
const requested=process.argv.includes('--henan')?['henan']:process.argv.includes('--mandarin')?['mandarin']:['mandarin',...(media.speech.capabilities.henan?['henan']:[])];
let manifest={version:1,generatedAt:new Date().toISOString(),audio:[],video:[],henan:false};
try{manifest=JSON.parse(await readFile(manifestPath,'utf8'));}catch{}
for(const language of requested){
 if(language==='henan'&&!media.speech.capabilities.henan)throw new Error(media.speech.capabilities.henanStatus);
 if(!process.argv.includes('--video-only'))manifest.audio=manifest.audio.filter(asset=>asset.language!==language);
 manifest.video=manifest.video.filter(asset=>asset.language!==language);
 for(const sample of process.argv.includes('--video-only')?[]:cases){
  const text=narration(getDemoResult(sample.id,language));
  const file=`${sample.id}-${language}.mp3`;
  const audio=await media.speech({text,voice:'xiaoyi',language});
  await writeFile(join(directory,file),audio);
  await writeFile(join(directory,file.replace('.mp3','.timing.json')),JSON.stringify({text,cues:audio.cues||[]}));
  manifest.audio.push({caseId:sample.id,language,text,voice:language==='mandarin'?'zh-CN-XiaoyiNeural':media.speech.capabilities.henanVoice,...await info(file)});
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log('audio',file);
 }
 const sample=getDemoResult('P3',language);
 const pages=sample.explanation.split('\n').filter(Boolean);
 await new Promise((resolve,reject)=>{
  const child=spawn(env.JIALIHUA_PYTHON_BIN||'python3',[join(root,'scripts/prepare-demo-media.py')],{stdio:['pipe','inherit','inherit']});
  child.once('error',reject);child.once('close',code=>code===0?resolve():reject(new Error('Card render failed')));
  child.stdin.end(JSON.stringify({directory,title:sample.title,pages,language}));
 });
 const frames=[];
 for(let i=0;i<pages.length;i++)frames.push({text:pages[i],glyphs:JSON.parse(await readFile(join(directory,`P3-${language}-page${i+1}.json`),'utf8')),dataUrl:'data:image/png;base64,'+(await readFile(join(directory,`P3-${language}-page${i+1}.png`))).toString('base64')});
 const file=`P3-${language}.mp4`;
 await writeFile(join(directory,file),await media.video({frames,voice:'xiaoyi',language}));
 manifest.video.push({caseId:'P3',language,pages,voice:language==='mandarin'?'zh-CN-XiaoyiNeural':media.speech.capabilities.henanVoice,...await info(file)});
 manifest.henan=manifest.audio.some(asset=>asset.language==='henan');
 manifest.generatedAt=new Date().toISOString();
 await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 console.log('video',file);
}
