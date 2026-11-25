import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { renderCover } from '../server/cover.ts';
import { VkClient } from '../server/vk.ts';
import { BotEngine, runBot } from '../server/bot.ts';
import { DraftStore } from '../server/store.ts';
import { createGenerator } from '../server/generator.ts';

test('all cover styles render Cyrillic copy as a 1600 by 1000 PNG', async () => {
  for (const style of ['brand', 'dark', 'paper'] as const) {
    const image = await renderCover({ coverTitle: 'Математика. Технологии. Будущее.', coverSubtitle: 'ФМиИТ СФ УУНиТ', category: 'science', coverStyle: style });
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.width, 1600);
    assert.equal(metadata.height, 1000);
    assert.equal(metadata.format, 'png');
    assert.ok(image.length > 10000);
  }
});

test('an optional empty cover subtitle still produces a valid PNG', async () => {
  const image = await renderCover({ coverTitle: 'Новости факультета', coverSubtitle: '', category: 'news', coverStyle: 'brand' });
  assert.equal((await sharp(image).metadata()).format, 'png');
});

test('VK method sends form parameters and handles API errors safely', async () => {
  let body = '';
  const vk = new VkClient({ groupToken: 'private-vk-test-token', publishToken: '', groupId: 157438856, version: '5.199' }, async (_url, init) => {
    body = String(init?.body);
    return new Response(JSON.stringify({ response: { key: 'k', server: 'https://lp.vk.com', ts: '1' } }));
  });
  await vk.call('groups.getLongPollServer', { group_id: 157438856 });
  const params = new URLSearchParams(body);
  assert.equal(params.get('v'), '5.199');
  assert.equal(params.get('access_token'), 'private-vk-test-token');
});

test('VK bot rejects outsiders and persists an authorized draft', async () => {
  const store = new DraftStore(':memory:');
  const bot = new BotEngine({ store, generator: createGenerator({ mode: 'demo' }), adminIds: [42], publicUrl: 'http://localhost:3001' });
  try {
    assert.match((await bot.handle(17, 'пост Новость факультета')).text, /доступ/i);
    assert.equal(store.list().length, 0);
    const greeting = await bot.handle(42, 'начать');
    assert.match(greeting.text, /ФМиИТ/);
    const reply = await bot.handle(42, 'пост Встреча клуба завтра в 15:00, аудитория 204');
    assert.ok(reply.draft);
    assert.equal(store.list().length, 1);
    assert.ok(reply.draft.body.includes('аудитория 204'));
    const editing = await bot.handle(42, 'текст Новый проверенный текст встречи');
    assert.ok(editing.draft?.body.includes('Новый проверенный текст'));
    assert.match((await bot.handle(42, 'публиковать')).text, /подключ/);
  } finally { store.close(); }
});

test('Long Poll duplicate IDs are recorded once and sessions survive engine recreation', async () => {
  const store = new DraftStore(':memory:');
  try {
    assert.equal(store.recordEvent('event-1'), true);
    assert.equal(store.recordEvent('event-1'), false);
    const options = { store, generator: createGenerator({ mode: 'demo' }), adminIds: [42], publicUrl: 'http://localhost:3001' };
    await new BotEngine(options).handle(42, 'пост Новость факультета: студенты создали проект');
    const reply = await new BotEngine(options).handle(42, 'обложка');
    assert.ok(reply.draft);
    assert.equal(reply.attachCover, true);
  } finally { store.close(); }
});

test('pending new-post input does not turn a menu action into a generated post', async () => {
  const store = new DraftStore(':memory:');
  const bot = new BotEngine({ store, generator: createGenerator({ mode: 'demo' }), adminIds: [42], publicUrl: 'http://localhost:3001' });
  try {
    await bot.handle(42, 'пост Встреча студентов в аудитории 204');
    await bot.handle(42, 'Новый пост');
    const reply = await bot.handle(42, 'Публиковать');
    assert.equal(store.list().length, 1);
    assert.match(reply.text, /подключ/);
  } finally { store.close(); }
});

test('VK publication uploads PNG with the user token, a negative owner ID and stable guid', async () => {
  const store = new DraftStore(':memory:');
  const requests: { method: string; params: URLSearchParams }[] = [];
  const vk = new VkClient({ groupToken: 'group-test-token', publishToken: 'user-test-token', groupId: 157438856, version: '5.199' }, async (url, init) => {
    const method = String(url).split('/').pop()!;
    if (method === 'photo-upload') {
      assert.ok(init?.body instanceof FormData);
      const photo = init.body.get('photo') as File;
      assert.equal(photo.type, 'image/png');
      assert.equal((await sharp(Buffer.from(await photo.arrayBuffer())).metadata()).width, 1600);
      return new Response(JSON.stringify({ photo: 'uploaded-photo-data', server: 10, hash: 'upload-hash' }));
    }
    const params = new URLSearchParams(String(init?.body));
    requests.push({ method, params });
    assert.equal(params.get('access_token'), 'user-test-token');
    if (method === 'photos.getWallUploadServer') return new Response(JSON.stringify({ response: { upload_url: 'https://pu.vk.com/photo-upload' } }));
    if (method === 'photos.saveWallPhoto') return new Response(JSON.stringify({ response: [{ id: 99, owner_id: -157438856 }] }));
    if (method === 'wall.post') return new Response(JSON.stringify({ response: { post_id: 42 } }));
    throw new Error('Unexpected VK method');
  });
  try {
    const brief = { topic: 'Проверенная новость', facts: 'Встреча 28 ноября в аудитории 204.', category: 'event' as const, tone: 'friendly' as const, length: 'short' as const, coverStyle: 'brand' as const };
    const draft = store.create(brief, await createGenerator({ mode: 'demo' }).generate(brief));
    const result = await vk.publish(draft);
    assert.equal(result.url, 'https://vk.ru/wall-157438856_42');
    const post = requests.find(request => request.method === 'wall.post')!.params;
    assert.equal(post.get('owner_id'), '-157438856');
    assert.equal(post.get('from_group'), '1');
    assert.equal(post.get('guid'), draft.id);
    assert.equal(post.get('attachments'), 'photo-157438856_99');
    assert.ok(post.get('message')?.includes(brief.facts));
  } finally { store.close(); }
});

test('Long Poll does not disclose protected drafts in a group conversation', async () => {
  const store = new DraftStore(':memory:');
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  const replies: number[] = [];
  const vk = new VkClient({ groupToken: 'test-group-token', publishToken: '', groupId: 157438856, version: '5.199' }, async () => new Response(JSON.stringify({ response: { key: 'test-key', server: 'https://lp.vk.com/test', ts: '1' } })));
  vk.send = async peerId => { replies.push(peerId); };
  const bot = new BotEngine({ store, generator: createGenerator({ mode: 'demo' }), adminIds: [42], publicUrl: 'http://localhost:3001' });
  try {
    const draftReply = await bot.handle(42, 'пост Private editorial draft');
    globalThis.fetch = async () => {
      controller.abort();
      return new Response(JSON.stringify({ ts: '2', updates: [{ type: 'message_new', event_id: 'private-group-event', object: { message: { from_id: 42, peer_id: 2000000001, text: `открыть ${draftReply.draft!.id}` } } }] }));
    };
    await runBot(vk, bot, store, 157438856, controller.signal, { state: 'starting' });
    assert.deepEqual(replies, []);
  } finally { globalThis.fetch = originalFetch; store.close(); }
});
