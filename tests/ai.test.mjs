import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIAdapter } from '../server/ai.mjs';

const env = { JIALIHUA_AI_BASE_URL: 'https://example.invalid/v1', JIALIHUA_AI_API_KEY: 'test-only-key', JIALIHUA_AI_MODEL: 'test-model' };
const correctedItems = [
  { speaker: '小林', text: '不是两点，是下午三点。只需带 20 元。', kind: 'message' },
  { speaker: '小陈', text: '我没答应代交，也不会转账。', kind: 'reply' },
];
function mockResponse(t, modelItems) {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      title: '核对时间', source_type: 'wechat_chat', items: modelItems,
      plain_explanation: '约定时间是下午三点。小陈没有答应代交。', glossary: [], uncertainties: [],
    }) } }], usage: { prompt_tokens: 100, completion_tokens: 50 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

// Catches returning the model's rewritten people, order, numbers or negations as
// original text after the user has explicitly corrected that original text.
test('human correctedItems remain authoritative even when the model rewrites or adds items', async (t) => {
  mockResponse(t, [
    { speaker: '小陈', text: '我答应代交 200 元。', kind: 'message' },
    { speaker: '小林', text: '下午两点见。', kind: 'message' },
    { speaker: '模型增补', text: '我也来。', kind: 'message' },
  ]);
  const result = await createAIAdapter(env)({ images: [], sourceType: 'wechat_chat', correctedItems });
  assert.deepEqual(result.items, [
    { speaker: '小林', text: '不是两点，是下午三点。只需带 20 元。', kind: 'message' },
    { speaker: '小陈', text: '我没答应代交，也不会转账。', kind: 'reply' },
  ]);
  assert.equal(result.explanation, '约定时间是下午三点。小陈没有答应代交。');
});

test('missing model item echoes do not discard a valid explanation of human corrected text', async (t) => {
  mockResponse(t, null);
  const result = await createAIAdapter(env)({ images: [], sourceType: 'wechat_chat', correctedItems });
  assert.deepEqual(result.items, [
    { speaker: '小林', text: '不是两点，是下午三点。只需带 20 元。', kind: 'message' },
    { speaker: '小陈', text: '我没答应代交，也不会转账。', kind: 'reply' },
  ]);
});

test('initial screenshot analysis still uses extracted model items when no correction is supplied', async (t) => {
  mockResponse(t, [{ speaker: '小林', text: '下午三点见。', kind: 'message' }]);
  const result = await createAIAdapter(env)({ images: [], sourceType: 'auto' });
  assert.deepEqual(result.items, [{ speaker: '小林', text: '下午三点见。', kind: 'message' }]);
});
