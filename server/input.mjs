import { inflateSync } from 'node:zlib';

export class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const VOICES = Object.freeze({
  xiaoyi: { name: 'zh-CN-XiaoyiNeural', rate: '+0%', pitch: '-3Hz' },
});
export const HENAN_UNAVAILABLE = '河南话语音尚未接通，当前服务没有可用的河南话声线。';
export function languageInput(value = 'mandarin') {
  if (!['mandarin', 'henan'].includes(value)) throw new InputError('请选择普通话或河南话语言');
  return value;
}

function fields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new InputError('请求字段不正确');
  }
}
function text(value, max, label, preserve = false) {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) {
    throw new InputError(`${label}不能为空且不能超过 ${max} 字`);
  }
  return preserve ? value : value.trim();
}
export function speechInput(input, max = 800) {
  fields(input, ['text', 'voice', 'language']);
  if (!Object.hasOwn(VOICES, input.voice)) throw new InputError('请使用小艺旁白声音');
  return { text: text(input.text, max, '朗读文字'), voice: input.voice, language: languageInput(input.language) };
}

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
export function imageBytes(dataUrl, maxBytes = 6 * 1024 * 1024, pngOnly = false) {
  if (typeof dataUrl !== 'string' || dataUrl.length > Math.ceil(maxBytes / 3) * 4 + 64) throw new InputError('图片过大');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || (pngOnly && match[1] !== 'png') || match[2].length % 4 !== 0) throw new InputError('请使用 PNG、JPEG 或 WebP 图片');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > maxBytes || bytes.toString('base64') !== match[2]) throw new InputError('图片编码不正确或文件过大');
  const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(PNG_SIGNATURE)
    : match[1] === 'jpeg' ? bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw new InputError('图片格式与内容不一致');
  return bytes;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

// Canvas export is non-interlaced 8-bit RGB/RGBA. Check actual compressed rows,
// chunk boundaries and CRCs as well as dimensions before passing anything to ffmpeg.
export function validateFramePNG(dataUrl) {
  const bytes = imageBytes(dataUrl, 4 * 1024 * 1024, true);
  let offset = 8;
  let header;
  let ended = false;
  const compressed = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new InputError('视频图片已损坏');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw new InputError('视频图片校验失败');
    if (offset === 8 && type !== 'IHDR') throw new InputError('视频图片缺少尺寸信息');
    if (type === 'IHDR') {
      if (header || length !== 13) throw new InputError('视频图片头部不正确');
      header = data;
      if (header.readUInt32BE(0) !== 720 || header.readUInt32BE(4) !== 1280 || header[8] !== 8 || ![2, 6].includes(header[9]) || header[10] || header[11] || header[12]) {
        throw new InputError('视频图片必须是 720×1280 的 PNG');
      }
    } else if (type === 'IDAT') compressed.push(data);
    else if (type === 'IEND') {
      if (length !== 0 || end !== bytes.length) throw new InputError('视频图片结尾不正确');
      ended = true; break;
    } else if (['acTL', 'fcTL', 'fdAT'].includes(type) || !/^[A-Za-z]{4}$/.test(type) || (type[0] === type[0].toUpperCase() && type !== 'PLTE')) {
      throw new InputError('请使用静态 PNG 图片');
    }
    offset = end;
  }
  if (!header || !ended || !compressed.length) throw new InputError('视频图片不完整');
  const stride = 720 * (header[9] === 6 ? 4 : 3) + 1;
  let rows;
  try { rows = inflateSync(Buffer.concat(compressed), { maxOutputLength: stride * 1280 }); }
  catch { throw new InputError('视频图片无法读取'); }
  if (rows.length !== stride * 1280) throw new InputError('视频图片像素不完整');
  for (let row = 0; row < 1280; row += 1) if (rows[row * stride] > 4) throw new InputError('视频图片像素格式不正确');
  return bytes;
}

export function analyzeInput(input) {
  fields(input, ['images', 'sourceType', 'correctedItems', 'language']);
  if (!['auto', 'wechat_chat', 'sms', 'moments'].includes(input.sourceType)) throw new InputError('请选择支持的截图类型');
  if (!Array.isArray(input.images) || input.images.length > 4) throw new InputError('每次最多选择 4 张截图');
  const images = input.images.map((image) => {
    fields(image, ['dataUrl', 'name']);
    imageBytes(image.dataUrl);
    if (image.name !== undefined && (typeof image.name !== 'string' || image.name.length > 180 || /[\/\\\u0000-\u001f]/u.test(image.name))) throw new InputError('图片名称不正确');
    return { dataUrl: image.dataUrl, name: image.name || '截图' };
  });
  let correctedItems;
  if (input.correctedItems !== undefined) {
    if (!Array.isArray(input.correctedItems) || !input.correctedItems.length || input.correctedItems.length > 200) throw new InputError('请提供完整的校对原文');
    correctedItems = input.correctedItems.map((item) => {
      fields(item, ['speaker', 'text', 'kind']);
      if (!['message', 'post', 'comment', 'reply'].includes(item.kind)) throw new InputError('原文类型不正确');
      return { speaker: text(item.speaker, 200, '发言人', true), text: text(item.text, 10000, '原文', true), kind: item.kind };
    });
    if (correctedItems.reduce((sum, item) => sum + item.text.length, 0) > 30000) throw new InputError('校对原文过长，请分次解读');
  }
  if (!images.length && !correctedItems) throw new InputError('请先选择截图');
  return { images, sourceType: input.sourceType, language: languageInput(input.language), ...(correctedItems ? { correctedItems } : {}) };
}

export function exportInput(input) {
  fields(input, ['frames', 'voice', 'language']);
  if (!Object.hasOwn(VOICES, input.voice)) throw new InputError('请使用小艺旁白声音');
  if (!Array.isArray(input.frames) || !input.frames.length || input.frames.length > 8) throw new InputError('视频需要 1 至 8 页');
  const frames = input.frames.map((frame) => {
    fields(frame, ['dataUrl', 'text', 'glyphs']);
    const pageText = text(frame.text, 100, '每页文字');
    validateFramePNG(frame.dataUrl);
    const glyphs=frame.glyphs;
    if(glyphs!==undefined&&(!Array.isArray(glyphs)||glyphs.length>200||glyphs.some(g=>!g||!Number.isInteger(g.index)||g.index<0||g.index>=frame.text.length||!Number.isFinite(g.x)||g.x<0||g.x>720||!Number.isFinite(g.y)||g.y<0||g.y>1276||!Number.isFinite(g.width)||g.width<0||g.width>100||g.x+g.width>720)))throw new InputError('朗读标记位置不正确');
    return { dataUrl: frame.dataUrl, text: pageText, ...(glyphs?{glyphs:glyphs.map(({index,x,y,width})=>({index,x,y,width}))}:{}) };
  });
  return { frames, voice: input.voice, language: languageInput(input.language) };
}
