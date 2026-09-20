// Keep text offsets tied to provider word boundaries, never to a wall-clock timer.
export function alignWords(text, words = []) {
  const cues = []; let cursor = 0;
  for (const word of words) {
    const value = String(word.text || '').trim();
    const start = Number(word.start), end = Number(word.end);
    // TTS may replace a newline with an extra full stop. Matching that added
    // punctuation against the next sentence would incorrectly skip real words.
    if (!value || /^[\p{P}\p{Z}\s]+$/u.test(value) || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) continue;
    const from = text.indexOf(value, cursor);
    if (from < 0) continue;
    cues.push({ from, to: from + value.length, start, end });
    cursor = from + value.length;
  }
  return cues;
}

export function parseCosyStream(source) {
  const audio = [], sentences = new Map(); let finished = false;
  for (const line of source.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const packet = JSON.parse(line.slice(5));
    if (packet.code) throw new Error('Speech stream failed');
    const output = packet.output;
    if (!output) continue;
    if (output.audio?.data) audio.push(Buffer.from(output.audio.data, 'base64'));
    if (output.sentence?.words?.length) sentences.set(output.sentence.index ?? 0, output.sentence.words);
    if (output.finish_reason === 'stop') finished = true;
  }
  if (!finished || !audio.length) throw new Error('Incomplete speech stream');
  const words = [...sentences.values()].flat().map(word => ({text:word.text,start:word.begin_time / 1000,end:word.end_time / 1000}));
  return {bytes:Buffer.concat(audio), words};
}

export function highlightFilters(glyphs = [], cues = []) {
  const filters = [];
  for (const cue of cues) for (const glyph of glyphs) {
    if (glyph.index < cue.from || glyph.index >= cue.to) continue;
    for (let dash = 0; dash < 3; dash++) {
      const width = Math.max(2, Math.round(glyph.width / 5));
      const x = Math.round(glyph.x + dash * glyph.width / 3);
      filters.push(`drawbox=x=${x}:y=${Math.round(glyph.y)}:w=${width}:h=4:color=0xB23E36:t=fill:enable='between(t,${cue.start.toFixed(3)},${cue.end.toFixed(3)})'`);
    }
  }
  return filters.join(',');
}
