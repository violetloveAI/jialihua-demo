import {defineConfig} from 'vite';
export default defineConfig(({mode})=>({
 base:mode==='pages'?(process.env.JIALIHUA_PAGES_BASE||'/jialihua-demo/'):'/',
 publicDir:mode==='pages'?false:'public',
 build:{outDir:mode==='pages'?'dist-pages':'dist'},
 server:{port:5174,...(mode==='pages'?{}:{proxy:{'/api':'http://127.0.0.1:4174'}})},
}));
