import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {demoVideoSources} from '../src/demo-video-sources.mjs';
import {exportContent} from '../src/export.mjs';

const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const {preparedVideo}=await server.ssrLoadModule('/src/demo-videos.mjs');
test.after(()=>server.close());

test('all nine screenshots and three writing examples have both prepared voices with exact complete narration',async()=>{
 const sources=demoVideoSources();assert.equal(sources.length,24);
 for(const source of sources){
  const video=preparedVideo(source.record,source.content,source.language);
  assert.ok(video,source.id+'-'+source.language);
  assert.equal(video.frames.map(frame=>frame.text).join(''),source.content.text);
  assert.equal((await readFile(new URL('../public'+video.url,import.meta.url))).byteLength,video.bytes);
  assert.ok(video.meanVolumeDb>-55);
 }
});

test('prepared videos cannot substitute different wording, titles, images, or AI-generated explanations',()=>{
 for(const source of demoVideoSources()){
  const {record,content,language}=source;
  assert.equal(preparedVideo(record,{...content,text:content.text+' 已修改。'},language),null);
  assert.equal(preparedVideo(record,{...content,title:'新的标题'},language),null);
  if(record.sourceKind==='composition'){
   assert.equal(preparedVideo({...record,attachments:[{dataUrl:'data:image/png;base64,YQ=='}]},content,language),null);
   if(record.attachments?.length)assert.equal(preparedVideo({...record,attachments:[]},content,language),null);
  }else{
   assert.equal(preparedVideo({...record,sampleGenerated:true},content,language),null);
   assert.equal(preparedVideo({...record,sample:false},content,language),null);
  }
  const edited={...record,exportTexts:{[language]:'保存过的自定义修改'}};
  assert.equal(preparedVideo(edited,exportContent(edited,record,language),language),null);
 }
});
