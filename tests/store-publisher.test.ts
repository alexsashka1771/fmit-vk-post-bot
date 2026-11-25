import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DraftStore } from '../server/store.ts';
import { Publisher } from '../server/publisher.ts';
import { createGenerator } from '../server/generator.ts';
import { AppError } from '../server/errors.ts';
import type { Draft } from '../shared/contracts.ts';

const brief = { topic: 'Встреча студенческого клуба', facts: 'Встреча в аудитории 204.', category: 'students' as const, tone: 'friendly' as const, length: 'short' as const, coverStyle: 'brand' as const };

async function draftIn(store: DraftStore) {
  return store.create(brief, await createGenerator({ mode: 'demo' }).generate(brief));
}

test('drafts persist with newest first and update revisions', async () => {
  const store = new DraftStore(':memory:');
  try {
    const draft = await draftIn(store);
    const updated = store.update(draft.id, { body: 'Проверенный новый текст', coverStyle: 'dark' });
    assert.equal(updated.revision, 2);
    assert.equal(store.get(draft.id)?.body, 'Проверенный новый текст');
    assert.equal(store.list()[0].id, draft.id);
  } finally { store.close(); }
});

test('publication requires explicit confirmation for the draft revision', async () => {
  const store = new DraftStore(':memory:');
  let calls = 0;
  const publisher = new Publisher(store, { publish: async () => { calls++; return { postId: 42, url: 'https://vk.ru/wall-157438856_42' }; } });
  try {
    const draft = await draftIn(store);
    await assert.rejects(publisher.publish(draft.id, ''), /подтвержден/);
    const ticket = publisher.confirm(draft.id);
    store.update(draft.id, { body: 'Changed after preview' });
    await assert.rejects(publisher.publish(draft.id, ticket.token), /измен/);
    assert.equal(calls, 0);
  } finally { store.close(); }
});

test('duplicate or concurrent publish cannot create a second wall post', async () => {
  const store = new DraftStore(':memory:');
  let calls = 0;
  let resolvePublish!: (result: { postId: number; url: string }) => void;
  const publisher = new Publisher(store, { publish: async (draft: Draft) => {
    assert.equal(draft.status, 'publishing'); calls++;
    return new Promise(resolve => { resolvePublish = resolve; });
  } });
  try {
    const draft = await draftIn(store);
    const ticket = publisher.confirm(draft.id);
    const first = publisher.publish(draft.id, ticket.token);
    await assert.rejects(publisher.publish(draft.id, ticket.token), /публикуется|опубликован/);
    resolvePublish({ postId: 42, url: 'https://vk.ru/wall-157438856_42' });
    assert.equal((await first).status, 'published');
    await assert.rejects(publisher.publish(draft.id, ticket.token), /опубликован/);
    assert.equal(calls, 1);
  } finally { store.close(); }
});

test('failed publication restores the draft and supports a reviewed retry', async () => {
  const store = new DraftStore(':memory:');
  let calls = 0;
  const publisher = new Publisher(store, { publish: async () => {
    calls++;
    if (calls === 1) throw new AppError('VK rejected the operation', 502, 'vk_api_error');
    return { postId: 43, url: 'https://vk.ru/wall-157438856_43' };
  } });
  try {
    const draft = await draftIn(store);
    await assert.rejects(publisher.publish(draft.id, publisher.confirm(draft.id).token));
    assert.equal(store.get(draft.id)?.status, 'draft');
    assert.equal((await publisher.publish(draft.id, publisher.confirm(draft.id).token)).status, 'published');
  } finally { store.close(); }
});

test('confirmation tokens expire and published drafts are immutable', async () => {
  const store = new DraftStore(':memory:');
  let now = 1000;
  const publisher = new Publisher(store, { publish: async () => ({ postId: 42, url: 'https://vk.ru/wall-157438856_42' }) }, () => now);
  try {
    const draft = await draftIn(store);
    const token = publisher.confirm(draft.id).token;
    now += 11 * 60 * 1000;
    await assert.rejects(publisher.publish(draft.id, token), /истек/);
    await publisher.publish(draft.id, publisher.confirm(draft.id).token);
    assert.throws(() => store.update(draft.id, { body: 'Cannot edit published content' }), /опубликован/);
  } finally { store.close(); }
});

test('confirmation rejects a different revision than the editor reviewed', async () => {
  const store = new DraftStore(':memory:');
  const publisher = new Publisher(store, { publish: async () => ({ postId: 42, url: 'https://vk.ru/wall-157438856_42' }) });
  try {
    const draft = await draftIn(store);
    store.update(draft.id, { body: 'Text changed by another editor' });
    assert.throws(() => publisher.confirm(draft.id, draft.revision), /измен/);
  } finally { store.close(); }
});

test('an ambiguous publication freezes the original copy for an idempotent retry', async () => {
  const store = new DraftStore(':memory:');
  let attempts = 0;
  let originalBody = '';
  let originalId = '';
  const publisher = new Publisher(store, { publish: async draft => {
    attempts++;
    if (attempts === 1) { originalBody = draft.body; originalId = draft.id; throw new Error('Wall accepted the post but response was lost'); }
    assert.equal(draft.body, originalBody);
    assert.equal(draft.id, originalId);
    return { postId: 42, url: 'https://vk.ru/wall-157438856_42' };
  } });
  try {
    const draft = await draftIn(store);
    await assert.rejects(publisher.publish(draft.id, publisher.confirm(draft.id).token));
    assert.equal(store.get(draft.id)?.status, 'uncertain');
    assert.throws(() => store.update(draft.id, { body: 'An unreviewed edited copy' }));
    assert.equal((await publisher.publish(draft.id, publisher.confirm(draft.id).token)).status, 'published');
    assert.equal(store.get(draft.id)?.body, originalBody);
  } finally { store.close(); }
});

test('a persisted interrupted publication can be reviewed and retried after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fmit-publication-test-'));
  const filename = join(directory, 'studio.sqlite');
  const first = new DraftStore(filename);
  const draft = await draftIn(first);
  first.save({ ...draft, status: 'publishing' });
  first.close();
  const reopened = new DraftStore(filename);
  try {
    const publisher = new Publisher(reopened, { publish: async retry => {
      assert.equal(retry.body, draft.body);
      assert.equal(retry.id, draft.id);
      return { postId: 42, url: 'https://vk.ru/wall-157438856_42' };
    } });
    assert.equal(reopened.get(draft.id)?.status, 'uncertain');
    const ticket = publisher.confirm(draft.id, draft.revision);
    assert.equal((await publisher.publish(draft.id, ticket.token)).status, 'published');
  } finally { reopened.close(); }
});
