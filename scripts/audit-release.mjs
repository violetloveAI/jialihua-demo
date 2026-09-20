import {readFile,stat,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,relative,extname} from 'node:path';
import {filesUnder,publicEntries} from './release-assets.mjs';
import {allFunctionVoices} from '../src/function-voice.mjs';
import {contentNarrations,originalNarrations} from '../src/narration.mjs';
import {cases} from '../src/data.mjs';
import {getDemoResult} from '../src/demo.mjs';
import {allTutorialNarrations} from '../src/tutorial-content.mjs';
import {demoVideoSources,videoIdentity} from '../src/demo-video-sources.mjs';
import {t} from '../src/i18n.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),failures=[];
const exists=async path=>{try{return (await stat(resolve(root,path))).size>0;}catch{return false;}};
const need=async path=>{if(!await exists(path))failures.push('缺少素材：'+path);};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function checkHash(path,expected){try{if(!expected||digest(await readFile(resolve(root,path)))!==expected)failures.push('素材校验不一致：'+path);}catch{failures.push('无法读取素材：'+path);}}
for(const path of await publicEntries())await need('public/'+path);
let speechCount=0;
for(const language of ['mandarin','henan']){
 const lines=new Set(allFunctionVoices(language).map(item=>item.text));
 for(const key of ['elderTitle','selectPicture','history','font','examples','readPage','videoTitle'])lines.add(t(key,language));
 for(const sample of cases){const r=getDemoResult(sample.id,language);lines.add(r.title);r.explanation.split('\n').filter(Boolean).forEach(line=>lines.add(line));r.glossary.forEach(term=>lines.add(term.term+'。'+term.explanation));Object.values(contentNarrations(r,language)).filter(Boolean).forEach(line=>lines.add(line));const original=originalNarrations(r.items);lines.add(original.all);original.rows.forEach(item=>lines.add(item.speech));}
 for(const text of lines){const stem='public/demo/readers/'+createHash('sha256').update(language+'|'+text).digest('hex');await need(stem+'.mp3');try{const meta=JSON.parse(await readFile(resolve(root,stem+'.json'),'utf8'));if(meta.text!==text||meta.language!==language||!meta.cues?.length)failures.push('配音文本或时间轴不一致：'+stem);}catch{failures.push('缺少配音时间轴：'+stem);}speechCount++;}
}
for(const item of allTutorialNarrations()){
 const path='public'+item.file;await need(path);
 try{const meta=JSON.parse(await readFile(resolve(root,path.replace('.mp3','.timing.json')),'utf8'));if(meta.text!==item.text||meta.language!==item.language||!meta.cues?.length)failures.push('教程声音或时间轴已过期：'+path);await checkHash(path,meta.sha256);}catch{failures.push('缺少教程时间轴：'+path);}
}
const videos=JSON.parse(await readFile(resolve(root,'public/demo/exports/manifest.json'),'utf8'));
for(const source of demoVideoSources()){
 const identity=JSON.stringify(videoIdentity(source.record,source.content,source.language));
 const video=videos.videos.find(item=>JSON.stringify(item.identity)===identity);
 if(!video){failures.push('缺少预制视频：'+source.id+' '+source.language);continue;}
 await checkHash('public'+video.url,video.sha256);for(const frame of video.frames||[])await checkHash('public'+frame.dataUrl,frame.sha256);
}
const target=process.argv.find(arg=>arg.startsWith('--artifact='))?.slice(11);
let totalBytes=0,files=0;
if(target){
 const dir=resolve(root,target);
 // Validate the copied artifact, not only the media still present in the source tree.
 for(const entry of await publicEntries()){
  const source=resolve(root,'public',entry);
  const sources=(await stat(source)).isDirectory()?(await filesUnder(source)).map(file=>file.path):[source];
  for(const file of sources){const name=relative(resolve(root,'public'),file);try{if(digest(await readFile(resolve(dir,name)))!==digest(await readFile(file)))failures.push('发布包素材缺失或过期：'+name);}catch{failures.push('发布包素材缺失：'+name);}}
 }
 for(const file of await filesUnder(dir)){
  const name=relative(dir,file.path);files++;totalBytes+=file.size;
  if(file.size>100*1024*1024)failures.push('单文件超过 GitHub 限制：'+name);
  if(/(^|\/)(\.env[^/]*|\.git|node_modules|server|private|\.data|data)(\/|$)/.test(name))failures.push('发布包包含非公开内容：'+name);
  if(['.js','.json','.html','.css','.txt','.map'].includes(extname(name))){const text=await readFile(file.path,'utf8');if(/sk-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))failures.push('疑似密钥，未展示内容：'+name);}
 }
 if(totalBytes>1024**3)failures.push('发布包超过 GitHub Pages 的 1 GB 限制');
}
const report={checkedAt:new Date().toISOString(),ready:failures.length===0,preparedSpeech:speechCount,tutorialSpeech:allTutorialNarrations().length,preparedVideos:videos.videos.length,artifact:target||null,files,totalBytes,failures};
await mkdir(resolve(root,'.release'),{recursive:true});await writeFile(resolve(root,'.release/readiness.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
