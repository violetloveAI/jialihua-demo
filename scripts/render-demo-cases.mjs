import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { cases } from '../src/data.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const outputDir = path.join(projectRoot, 'public', 'demo-cases');
const assetDir = path.join(outputDir, 'assets');
const renderDir = path.join(outputDir, '.render');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const requestedIds = process.argv.slice(2).map((id) => id.toUpperCase());
const selected = requestedIds.length
  ? requestedIds.map((id) => cases.find((item) => item.id === id)).filter(Boolean)
  : cases;

const avatarBySpeaker = {
  '外孙女晓晓': 'avatar-xiaoxiao.png',
  晓晓: 'avatar-xiaoxiao.png',
  妈妈: 'avatar-mom.png',
  '儿子小军': 'avatar-xiaojun.png',
  '外孙小满': 'avatar-xiaoman.png',
  阿圆: 'avatar-ayuan.png',
};

const momentImageByCase = {
  P1: 'moment-p1-work.png',
  P2: 'moment-p2-race.png',
  P3: 'moment-p3-dumplings.png',
};

const serviceIconByCase = {
  S1: 'parcel',
  S2: 'calendar',
  S3: 'signal',
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

async function dataUri(filename) {
  const filePath = path.join(assetDir, filename);
  await access(filePath);
  const ext = path.extname(filename).slice(1);
  const bytes = await readFile(filePath);
  return `data:image/${ext};base64,${bytes.toString('base64')}`;
}

function statusBar() {
  return `
    <div class="status-bar">
      <span class="status-time">9:41</span>
      <div class="status-icons" aria-hidden="true">
        <span class="signal-bars"><i></i><i></i><i></i><i></i></span>
        <span class="wifi">◒</span>
        <span class="battery"><i></i></span>
      </div>
    </div>`;
}

function commonChrome() {
  return `
    <div class="demo-mark">虚构演示案例</div>
    <div class="home-indicator"></div>`;
}

function navBar(title, subtitle = '') {
  return `
    <div class="nav-bar">
      <div class="nav-side nav-back" aria-hidden="true"><span>‹</span></div>
      <div class="nav-title"><strong>${escapeHtml(title)}</strong>${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}</div>
      <div class="nav-side nav-more" aria-hidden="true">•••</div>
    </div>`;
}

function inputBar(kind) {
  if (kind === 'sms') {
    return `<div class="input-bar sms-input"><div class="round-tool">＋</div><div class="input-field">短信</div><div class="round-tool voice-dot">●</div></div>`;
  }
  return `<div class="input-bar"><div class="round-tool mic">◉</div><div class="input-field"></div><div class="round-tool">☺</div><div class="round-tool">＋</div></div>`;
}

function serviceIcon(kind) {
  if (kind === 'parcel') return '<div class="service-glyph parcel"><i></i></div>';
  if (kind === 'calendar') return '<div class="service-glyph calendar"><i></i><b></b></div>';
  return '<div class="service-glyph signal-glyph"><i></i><i></i><i></i></div>';
}

async function renderWechat(item) {
  const avatarFile = avatarBySpeaker[item.items[0].speaker];
  const avatar = await dataUri(avatarFile);
  const messages = item.items.map((message, index) => `
    <div class="chat-row ${index ? 'continued' : ''}">
      <img class="chat-avatar" src="${avatar}" alt="" />
      <div class="chat-message-wrap">
        <div class="speaker-label">${escapeHtml(message.speaker)}</div>
        <div class="chat-bubble">${escapeHtml(message.text)}</div>
      </div>
    </div>`).join('');

  return pageShell('wechat-page', `
    ${statusBar()}
    ${navBar(item.items[0].speaker)}
    <main class="chat-stage">
      <div class="day-chip">今天</div>
      ${messages}
    </main>
    ${inputBar('wechat')}
    ${commonChrome()}`);
}

async function renderMoments(item) {
  const post = item.items.find((entry) => entry.kind === 'post');
  const comments = item.items.filter((entry) => entry.kind !== 'post');
  const avatar = await dataUri(avatarBySpeaker[post.speaker]);
  const scene = await dataUri(momentImageByCase[item.id]);
  const commentHtml = comments.map((entry) => `
    <div class="moment-comment ${entry.kind === 'reply' ? 'is-reply' : ''}">
      <strong>${escapeHtml(entry.speaker)}：</strong><span>${escapeHtml(entry.text)}</span>
    </div>`).join('');

  return pageShell('moments-page', `
    ${statusBar()}
    ${navBar('朋友圈')}
    <div class="moments-cover">
      <div class="cover-orb orb-one"></div><div class="cover-orb orb-two"></div>
      <img src="${avatar}" alt="" class="cover-avatar" />
    </div>
    <main class="moments-feed">
      <article class="moment-post">
        <img class="moment-avatar" src="${avatar}" alt="" />
        <div class="moment-content">
          <div class="moment-name">${escapeHtml(post.speaker)}</div>
          <div class="moment-body">${escapeHtml(post.text)}</div>
          <img class="moment-photo" src="${scene}" alt="" />
          <div class="moment-meta"><span>刚刚</span><span class="moment-action">••</span></div>
          <div class="moment-comments">${commentHtml}</div>
        </div>
      </article>
    </main>
    ${commonChrome()}`);
}

async function renderSms(item) {
  const icon = serviceIcon(serviceIconByCase[item.id]);
  const messages = item.items.map((message) => `
    <div class="sms-row">
      <div class="sms-bubble">${escapeHtml(message.text)}</div>
    </div>`).join('');

  return pageShell('sms-page', `
    ${statusBar()}
    <div class="sms-contact">
      <div class="sms-back">‹ <span>信息</span></div>
      <div class="sms-contact-center">
        <div class="service-avatar">${icon}</div>
        <strong>${escapeHtml(item.items[0].speaker)}</strong>
        <small>›</small>
      </div>
      <div class="sms-info">ⓘ</div>
    </div>
    <main class="sms-stage">
      <div class="sms-date">今天 09:41</div>
      ${messages}
    </main>
    ${inputBar('sms')}
    ${commonChrome()}`);
}

function pageShell(type, content) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1080, initial-scale=1" />
  <style>${styles}</style>
</head>
<body class="${type}"><div class="phone">${content}</div></body>
</html>`;
}

const styles = String.raw`
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:2340px;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;color:#181818;background:#111}.phone{position:relative;width:1080px;height:2340px;overflow:hidden;background:#ededed}.status-bar{height:90px;padding:24px 48px 0;display:flex;align-items:center;justify-content:space-between;font-size:34px;font-weight:650;letter-spacing:.3px;position:relative;z-index:10}.status-icons{display:flex;align-items:center;gap:22px}.signal-bars{height:28px;display:flex;align-items:flex-end;gap:5px}.signal-bars i{display:block;width:7px;background:#111;border-radius:4px}.signal-bars i:nth-child(1){height:10px}.signal-bars i:nth-child(2){height:16px}.signal-bars i:nth-child(3){height:22px}.signal-bars i:nth-child(4){height:28px}.wifi{font-size:38px;transform:rotate(90deg);line-height:1}.battery{width:50px;height:25px;border:3px solid #111;border-radius:7px;padding:3px;position:relative}.battery:after{content:"";position:absolute;right:-8px;top:6px;width:5px;height:10px;background:#111;border-radius:0 4px 4px 0}.battery i{display:block;width:85%;height:100%;background:#111;border-radius:3px}.nav-bar{height:126px;display:grid;grid-template-columns:170px 1fr 170px;align-items:center;border-bottom:1px solid rgba(0,0,0,.08);padding:0 30px;position:relative;z-index:8}.nav-side{height:100%;display:flex;align-items:center}.nav-back span{font-size:78px;font-weight:300;line-height:1}.nav-more{justify-content:flex-end;font-size:38px;letter-spacing:5px}.nav-title{text-align:center;display:flex;flex-direction:column;line-height:1.2}.nav-title strong{font-size:40px;font-weight:650}.nav-title small{font-size:24px;color:#7d7d7d;margin-top:5px}.demo-mark{position:absolute;left:50%;bottom:174px;transform:translateX(-50%);z-index:30;border:2px solid rgba(89,96,89,.34);background:rgba(255,255,255,.94);color:#636a63;border-radius:999px;padding:12px 26px;font-size:26px;letter-spacing:3px;box-shadow:0 5px 18px rgba(0,0,0,.08);white-space:nowrap}.home-indicator{position:absolute;z-index:30;width:330px;height:14px;border-radius:999px;background:#111;left:50%;bottom:22px;transform:translateX(-50%)}
.chat-stage{height:1976px;padding:24px 36px 220px;overflow:hidden}.day-chip{width:max-content;margin:10px auto 40px;padding:8px 18px;color:#898989;background:rgba(0,0,0,.05);border-radius:8px;font-size:26px}.chat-row{display:flex;align-items:flex-start;gap:22px;margin:0 0 34px}.chat-row.continued{margin-top:10px}.chat-avatar{width:92px;height:92px;object-fit:cover;border-radius:12px;background:#fff;border:1px solid rgba(0,0,0,.06);flex:none}.chat-message-wrap{max-width:800px}.speaker-label{font-size:25px;color:#808080;margin:0 0 8px 4px}.chat-bubble{position:relative;background:#fff;border-radius:12px;padding:23px 27px;font-size:39px;line-height:1.5;letter-spacing:.2px;box-shadow:0 1px 1px rgba(0,0,0,.04);white-space:pre-wrap}.chat-bubble:before{content:"";position:absolute;left:-14px;top:23px;border-width:12px 15px 12px 0;border-style:solid;border-color:transparent #fff transparent transparent}.input-bar{position:absolute;left:0;right:0;bottom:0;height:154px;background:#f7f7f7;border-top:1px solid #d5d5d5;padding:18px 24px 48px;display:flex;align-items:center;gap:18px;z-index:20}.round-tool{width:58px;height:58px;border:3px solid #333;border-radius:50%;display:grid;place-items:center;font-size:34px;line-height:1}.input-field{height:72px;background:#fff;border-radius:12px;flex:1;border:1px solid #e1e1e1}.mic{font-size:24px}
.moments-page .phone{background:#fff}.moments-page .status-bar,.moments-page .nav-bar{background:#fff}.moments-cover{height:360px;position:relative;overflow:visible;background:linear-gradient(135deg,#667a6b 0%,#c89b78 48%,#e6c87e 100%)}.cover-orb{position:absolute;border-radius:50%;filter:blur(2px);opacity:.5}.orb-one{width:290px;height:290px;background:#f5e8cf;right:160px;top:-80px}.orb-two{width:220px;height:220px;background:#8fa087;left:100px;bottom:-120px}.cover-avatar{position:absolute;width:150px;height:150px;right:54px;bottom:-64px;border-radius:16px;border:7px solid #fff;object-fit:cover;background:#fff}.moments-feed{padding:105px 48px 210px}.moment-post{display:flex;gap:26px;padding:34px 0 46px;border-bottom:1px solid #e7e7e7}.moment-avatar{width:104px;height:104px;border-radius:13px;object-fit:cover;background:#f5eee2;flex:none}.moment-content{min-width:0;flex:1}.moment-name{font-size:36px;font-weight:650;color:#576b95;margin:0 0 15px}.moment-body{font-size:39px;line-height:1.48;letter-spacing:.1px;margin-bottom:24px;white-space:pre-wrap}.moment-photo{display:block;width:720px;height:480px;object-fit:cover;border-radius:4px;background:#eee}.moment-meta{display:flex;justify-content:space-between;align-items:center;color:#8b8b8b;font-size:27px;margin:18px 0 16px}.moment-action{background:#f0f2f5;color:#576b95;border-radius:5px;padding:0 18px 8px;font-size:35px;line-height:1}.moment-comments{position:relative;background:#f3f3f5;padding:12px 18px;border-radius:4px}.moment-comments:before{content:"";position:absolute;top:-18px;left:26px;border:10px solid transparent;border-bottom-color:#f3f3f5}.moment-comment{font-size:31px;line-height:1.52;padding:3px 0}.moment-comment strong{color:#576b95;font-weight:650}.moment-comment.is-reply{padding-left:28px;border-left:5px solid #d7dce6;margin-left:2px}
.sms-page .phone{background:#fff}.sms-page .status-bar{background:rgba(249,249,249,.95)}.sms-contact{height:210px;background:rgba(249,249,249,.95);border-bottom:1px solid #d7d7d7;position:relative;display:grid;grid-template-columns:230px 1fr 230px;align-items:center;padding:0 34px}.sms-back{color:#2379ed;font-size:62px;font-weight:300;display:flex;align-items:center}.sms-back span{font-size:32px;margin-left:8px}.sms-contact-center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px}.sms-contact-center strong{font-size:29px;font-weight:550}.sms-contact-center small{font-size:25px;color:#aaa}.sms-info{text-align:right;color:#2379ed;font-size:44px}.service-avatar{width:86px;height:86px;border-radius:50%;background:linear-gradient(145deg,#f2dfba,#b8c6a8);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}.service-glyph{position:relative;width:48px;height:48px}.parcel:before{content:"";position:absolute;left:6px;top:11px;width:36px;height:29px;border:4px solid #596d55;border-radius:4px}.parcel:after{content:"";position:absolute;left:9px;top:12px;width:30px;height:12px;border-bottom:4px solid #596d55;transform:skewY(-18deg)}.calendar:before{content:"";position:absolute;left:5px;top:9px;width:38px;height:34px;border:4px solid #596d55;border-radius:5px}.calendar:after{content:"";position:absolute;left:7px;top:18px;width:34px;border-top:4px solid #596d55}.calendar i,.calendar b{position:absolute;top:4px;width:4px;height:12px;background:#596d55;border-radius:3px}.calendar i{left:15px}.calendar b{right:15px}.signal-glyph{display:flex;align-items:flex-end;justify-content:center;gap:5px}.signal-glyph i{display:block;width:8px;background:#596d55;border-radius:5px}.signal-glyph i:nth-child(1){height:16px}.signal-glyph i:nth-child(2){height:28px}.signal-glyph i:nth-child(3){height:40px}.sms-stage{height:1886px;padding:28px 34px 230px}.sms-date{text-align:center;color:#8e8e93;font-size:25px;margin:12px 0 34px}.sms-row{display:flex;justify-content:flex-start;margin:0 0 24px}.sms-bubble{max-width:850px;background:#e9e9eb;border-radius:38px 38px 38px 10px;padding:22px 30px;font-size:39px;line-height:1.48;letter-spacing:.1px;white-space:pre-wrap}.sms-input{background:rgba(249,249,249,.98)}.sms-input .input-field{border:2px solid #d0d0d0;border-radius:36px;padding:14px 24px;color:#a0a0a0;font-size:30px}.voice-dot{font-size:18px;color:#fff;background:#a2a2a6;border-color:#a2a2a6}
`;

async function main() {
  await mkdir(renderDir, { recursive: true });
  if (!selected.length || selected.length !== (requestedIds.length || cases.length)) {
    throw new Error(`Unknown case id. Requested: ${requestedIds.join(', ')}`);
  }
  await access(chrome);

  for (const item of selected) {
    let html;
    if (item.sourceType === 'wechat_chat') html = await renderWechat(item);
    else if (item.sourceType === 'moments') html = await renderMoments(item);
    else html = await renderSms(item);

    const htmlPath = path.join(renderDir, `${item.id}.html`);
    const pngPath = path.join(outputDir, `${item.id}.png`);
    await writeFile(htmlPath, html, 'utf8');
    const result = spawnSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=1600',
      '--window-size=1080,2340',
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href,
    ], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`Chrome failed for ${item.id}: ${result.stderr || result.stdout}`);
    }
    console.log(`${item.id}\t${pngPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
