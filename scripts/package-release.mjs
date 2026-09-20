import {cp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicEntries} from './release-assets.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.release/repository');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of ['README.md','src','server','scripts','tests','docs','.github','index.html','package.json','package-lock.json','vite.config.js','.gitignore','.env.example'])await cp(resolve(root,name),resolve(out,name),{recursive:true});
for(const name of await publicEntries())await cp(resolve(root,'public',name),resolve(out,'public',name),{recursive:true,filter:path=>!path.endsWith('/HANDOFF.md')&&!path.includes('/revisions')});
// Source provenance must not publish the author's local home directory.
for(const name of ['demo-cases/manifest.json','illustrations/selected/manifest.json']){
 const path=resolve(out,'public',name);
 const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clean(item)])):typeof value==='string'&&value.startsWith(root)?value.slice(root.length):typeof value==='string'&&value.startsWith('/Users/')?'Project illustration style reference':value;
 await writeFile(path,JSON.stringify(clean(JSON.parse(await readFile(path,'utf8'))),null,2)+'\n');
}
await writeFile(resolve(out,'RELEASE-NOTE.txt'),'家里话独立发布包。打包命令不执行上传或部署。部署步骤见 docs/github-pages.md。\n');
console.log('仓库候选包：'+out+'\n未包含 .env.local、个人临时文件或同目录下的其他项目。');
