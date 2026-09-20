import {readFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
export const publicDirectories=['demo-cases','illustrations/selected','tutorial','demo/readers','demo/exports'];
export async function publicEntries(){
 const manifest=JSON.parse(await readFile(new URL('../public/demo/manifest.json',import.meta.url),'utf8'));
 return [...publicDirectories,'demo/manifest.json','demo/P3-poster.png',...manifest.audio.flatMap(a=>['demo/'+a.file,'demo/'+a.file.replace('.mp3','.timing.json')]),...manifest.video.map(a=>'demo/'+a.file)];
}
export async function filesUnder(root){const out=[];for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isSymbolicLink())throw new Error('发布包不接受符号链接：'+path);if(entry.isDirectory())out.push(...await filesUnder(path));else if(entry.isFile())out.push({path,size:(await stat(path)).size});}return out;}
