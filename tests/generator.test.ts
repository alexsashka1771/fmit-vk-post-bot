import assert from 'node:assert/strict';
import { test } from 'node:test';
import { briefSchema, composePost } from '../shared/contracts.ts';
import { createGenerator, parseGeneratedPost, buildPrompt } from '../server/generator.ts';

const brief = {
  topic: 'Научный семинар: музыка и мозг',
  facts: 'Семинар 28 ноября в 15:00, аудитория 301. Регистрация: https://example.com/seminar',
  category: 'science' as const,
  tone: 'friendly' as const,
  length: 'medium' as const,
  coverStyle: 'brand' as const,
};

test('brief validation rejects blank topics and unknown categories', () => {
  assert.equal(briefSchema.safeParse({ ...brief, topic: '   ' }).success, false);
  assert.equal(briefSchema.safeParse({ ...brief, category: 'unknown' }).success, false);
});

test('demo generator preserves the supplied dates, room and link', async () => {
  const post = await createGenerator({ mode: 'demo' }).generate(brief);
  assert.equal(post.source, 'demo');
  assert.ok(post.body.includes(brief.facts));
  assert.ok(post.hashtags.includes('#СФУУНиТ_ФМиИТ'));
  assert.ok(composePost(post).includes(post.title));
});

test('prompt uses the actual faculty and requires facts without inventions', () => {
  const prompt = buildPrompt(brief);
  assert.match(prompt.system, /ФМиИТ СФ УУНиТ/);
  assert.match(prompt.system, /Не выдумывай/);
  assert.ok(prompt.user.includes(brief.facts));
});

test('AI parser accepts fenced JSON and normalizes hashtags', () => {
  const post = parseGeneratedPost('```json\n' + JSON.stringify({
    title: 'Научный семинар', body: brief.facts,
    hashtags: ['Наука', '#СФУУНиТ', '#Наука'],
    coverTitle: 'Музыка и мозг', coverSubtitle: 'Научный семинар',
  }) + '\n```');
  assert.deepEqual(post.hashtags, ['#Наука', '#СФУУНиТ', '#СФУУНиТ_ФМиИТ']);
});

test('AI parser rejects empty or oversized output', () => {
  assert.throws(() => parseGeneratedPost('{"title":"x","body":""}'));
  assert.throws(() => parseGeneratedPost(JSON.stringify({ title: 'title', body: 'x'.repeat(17000), hashtags: [], coverTitle: 'title', coverSubtitle: '' })));
});

test('AI provider sends credentials only to the server endpoint', async () => {
  let sentUrl = '';
  let sentAuth = '';
  const generator = createGenerator({ mode: 'ai', apiKey: 'test-provider-key', baseUrl: 'https://provider.example/v1/', model: 'test-model' }, async (url, init) => {
    sentUrl = String(url);
    sentAuth = new Headers(init?.headers).get('authorization') ?? '';
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 'Наука', body: brief.facts, hashtags: [], coverTitle: 'Наука', coverSubtitle: 'ФМиИТ' }) } }] }), { status: 200 });
  });
  const post = await generator.generate(brief);
  assert.equal(sentUrl, 'https://provider.example/v1/chat/completions');
  assert.equal(sentAuth, 'Bearer test-provider-key');
  assert.equal(post.source, 'ai');
  assert.equal(JSON.stringify(post).includes('test-provider-key'), false);
});

test('provider failure is reported without leaking its response or key', async () => {
  const generator = createGenerator({ mode: 'ai', apiKey: 'sensitive-test-key', baseUrl: 'https://provider.example/v1', model: 'test-model' }, async () => new Response('sensitive-test-key upstream details', { status: 401 }));
  await assert.rejects(generator.generate(brief), error => error instanceof Error && !error.message.includes('sensitive-test-key') && error.message.includes('ключ'));
});

export { brief };
