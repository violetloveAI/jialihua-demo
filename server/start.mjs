import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { createAIAdapter } from './ai.mjs';
import { createMediaAdapter } from './media.mjs';

// Local settings override legacy settings. Keep credentials outside Vite and never log them.
const legacyEnvPath = fileURLToPath(new URL('../../jialihua/.env.local', import.meta.url));
let saved = {};
try { saved = parseEnv(await readFile(legacyEnvPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') console.error('现有服务配置无法读取，将使用环境变量。'); }
try { saved = { ...saved, ...parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8')) }; }
catch (error) { if (error.code !== 'ENOENT') console.error('本机服务配置无法读取，将使用环境变量。'); }
const env = { ...saved, ...process.env };
const analyze = createAIAdapter(env);
const { speech, video } = createMediaAdapter({ env });
const server = createServer(createApp({ analyze, speech, video }));
server.requestTimeout = 600000;
server.headersTimeout = 20000;
server.keepAliveTimeout = 5000;
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? '端口 4174 已被占用。' : '本机服务无法启动。');
  process.exitCode = 1;
});
server.listen(4174, '127.0.0.1', () => console.log('家里话翻译版：http://127.0.0.1:4174'));
for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => server.close(() => process.exit(0)));
