// Fictional demo data only. --verify is offline; normal runs resume verified assets.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify,parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {createFrames} from '../src/export.mjs';
import {DEMO_VIDEO_VERSION,demoVideoSources,videoIdentity} from '../src/demo-video-sources.mjs';
import {createMediaAdapter} from '../server/media.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=join(root,'public/demo/exports'),manifestPath=join(directory,'manifest.json');
const execute=promisify(execFile),digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const ffmpeg=process.env.JIALIHUA_FFMPEG_BIN||fileURLToPath(new URL('../../比赛准备/工具验证/bin/ffmpeg',import.meta.url));
const sources=demoVideoSources();
const assetPath=url=>join(root,'public',url);
async function inspect(url) {
 const file=assetPath(url),bytes=await readFile(file);
 const {stderr}=await execute(ffmpeg,['-hide_banner','-i',file,'-af','volumedetect','-f','null','-']);
 const duration=stderr.match(/Duration: ([\d:.]+)/)?.[1],meanVolumeDb=Number(stderr.match(/mean_volume: ([-\d.]+) dB/)?.[1]);
 assert.ok(bytes.length>1000&&duration&&meanVolumeDb>-55,`Invalid or silent video: ${url}`);
 assert.match(stderr,/Video: h264/);assert.match(stderr,/720x1280/);assert.match(stderr,/Audio: aac/);
 return {bytes:bytes.length,sha256:digest(bytes),duration,meanVolumeDb};
}
async function pictureHashes(source) {
 return Promise.all((source.record.attachments||[]).map(async image=>({url:image.dataUrl,sha256:digest(await readFile(assetPath(image.dataUrl)))})));
}
async function verify(video,source) {
 assert.deepEqual(video.identity,videoIdentity(source.record,source.content,source.language));
 assert.deepEqual(video.pictures,await pictureHashes(source));
 assert.equal(video.frames.map(frame=>frame.text).join(''),source.content.text);
 assert.ok(video.frames.length>0&&video.frames.length<=8);
 for(const frame of video.frames)assert.equal(digest(await readFile(assetPath(frame.dataUrl))),frame.sha256);
 assert.equal((await inspect(video.url)).sha256,video.sha256);
}
await mkdir(directory,{recursive:true});
let manifest={version:DEMO_VIDEO_VERSION,videos:[]};
try{manifest=JSON.parse(await readFile(manifestPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(process.argv.includes('--verify')) {
 assert.equal(manifest.version,DEMO_VIDEO_VERSION);assert.equal(manifest.videos.length,sources.length);
 for(const source of sources){const video=manifest.videos.find(item=>item.id===source.id&&item.identity.language===source.language);assert.ok(video,`Missing ${source.id}-${source.language}`);await verify(video,source);}
 console.log(JSON.stringify({verifiedVideos:sources.length,languages:['mandarin','henan'],resolution:'720x1280',audio:'AAC',offline:true}));
 process.exit(0);
}
// Use the same pagination and drawing code as the export UI. The bundled macOS
// Chinese font is registered under its CSS alias for deterministic preparation.
const font=process.env.JIALIHUA_DEMO_FONT||'/System/Library/Fonts/STHeiti Medium.ttc';
assert.ok(GlobalFonts.registerFromPath(font,'PingFang SC'),'Set JIALIHUA_DEMO_FONT to an installed Chinese font');
globalThis.document={createElement(name){assert.equal(name,'canvas');return createCanvas(1,1);}};
let saved={};
for(const url of ['../../jialihua/.env.local','../.env.local']){try{saved={...saved,...parseEnv(await readFile(new URL(url,import.meta.url),'utf8'))};}catch(error){if(error.code!=='ENOENT')throw error;}}
const media=createMediaAdapter({env:{...saved,...process.env},ffmpegPath:ffmpeg});
for(const source of sources) {
 const name=source.id+'-'+source.language,url='/demo/exports/'+name+'.mp4';
 const existing=manifest.videos.find(video=>video.id===source.id&&video.identity.language===source.language);
 if(existing&&!process.argv.includes('--force')){try{await verify(existing,source);console.log('ready',name);continue;}catch{console.log('rebuilding',name);}}
 const pictures=await Promise.all((source.record.attachments||[]).map(image=>loadImage(assetPath(image.dataUrl))));
 const frames=createFrames({...source.record,title:source.content.title,language:source.language},source.content.text,pictures);
 assert.equal(frames.map(frame=>frame.text).join(''),source.content.text);
 console.log('preparing',name,frames.length+' pages');
 // Cache exact page narration and timings before composing, so retries can be offline.
 const readers=join(root,'public/demo/readers');await mkdir(readers,{recursive:true});
 for(const frame of frames){const hash=digest(Buffer.from(source.language+'|'+frame.text)),audio=await media.speech({text:frame.text,voice:'xiaoyi',language:source.language});await writeFile(join(readers,hash+'.mp3'),audio);await writeFile(join(readers,hash+'.json'),JSON.stringify({text:frame.text,language:source.language,rate:1,timingVersion:2,cues:audio.cues||[]}));}
 const bytes=await media.video({frames,voice:'xiaoyi',language:source.language});
 await writeFile(assetPath(url)+'.tmp',bytes);await rename(assetPath(url)+'.tmp',assetPath(url));
 const previews=[];
 for(const [index,frame] of frames.entries()){const dataUrl='/demo/exports/'+name+'-page'+(index+1)+'.png',png=Buffer.from(frame.dataUrl.split(',')[1],'base64');await writeFile(assetPath(dataUrl),png);previews.push({dataUrl,text:frame.text,sha256:digest(png)});}
 const video={id:source.id,identity:videoIdentity(source.record,source.content,source.language),url,...await inspect(url),pictures:await pictureHashes(source),frames:previews};
 manifest.videos=manifest.videos.filter(item=>!(item.id===source.id&&item.identity.language===source.language));manifest.videos.push(video);
 manifest.version=DEMO_VIDEO_VERSION;manifest.generatedAt=new Date().toISOString();
 await writeFile(manifestPath+'.tmp',JSON.stringify(manifest,null,2)+'\n');await rename(manifestPath+'.tmp',manifestPath);
 console.log('prepared',name,video.duration);
}
console.log('Prepared',manifest.videos.length,'demo export videos. Run with --verify before presenting.');
