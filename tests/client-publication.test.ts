import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Draft } from '../shared/contracts.ts';
import { submitPublication } from '../src/publication.ts';

const draft: Draft = {
  id: 'test-draft', title: 'Проверенная новость', body: 'Исходные факты.', hashtags: ['#СФУУНиТ'],
  coverTitle: 'Новости', coverSubtitle: '', source: 'demo', coverStyle: 'brand', status: 'draft', revision: 1,
  createdAt: '2026-11-25T00:00:00Z', updatedAt: '2026-11-25T00:00:00Z',
  brief: { topic: 'Проверенная новость', facts: 'Исходные факты.', category: 'news', tone: 'friendly', length: 'short', coverStyle: 'brand' },
};

test('a lost publication response updates the editor to the frozen server snapshot', async () => {
  const snapshots: Draft[] = [];
  await assert.rejects(submitPublication(draft, 'test-confirmation', {
    publish: async () => { throw new Error('Publication result is unknown'); },
    read: async () => ({ ...draft, status: 'uncertain' }),
  }, snapshot => snapshots.push(snapshot)), /unknown/);
  assert.equal(snapshots.at(-1)?.status, 'uncertain');
  assert.equal(snapshots.at(-1)?.body, draft.body);
});

test('the editor stays frozen when both publication and status refresh lose the connection', async () => {
  const snapshots: Draft[] = [];
  await assert.rejects(submitPublication(draft, 'test-confirmation', {
    publish: async () => { throw new Error('Publication result is unknown'); },
    read: async () => { throw new Error('Offline'); },
  }, snapshot => snapshots.push(snapshot)), /unknown/);
  assert.equal(snapshots.at(-1)?.status, 'uncertain');
});

test('confirmed publication updates the editor without a redundant snapshot fetch', async () => {
  let reads = 0;
  const snapshots: Draft[] = [];
  const result = await submitPublication(draft, 'test-confirmation', {
    publish: async () => ({ ...draft, status: 'published', publishedUrl: 'https://vk.ru/wall-157438856_42' }),
    read: async () => { reads++; return draft; },
  }, snapshot => snapshots.push(snapshot));
  assert.equal(result.status, 'published');
  assert.equal(snapshots[0].status, 'published');
  assert.equal(reads, 0);
});
