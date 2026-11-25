import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app.ts';
import { loadConfig } from '../server/config.ts';
import { DraftStore } from '../server/store.ts';
import { Publisher } from '../server/publisher.ts';
import type { PublishTransport } from '../server/publisher.ts';

async function fixture(password = '', sessionSecret?: string, transport?: PublishTransport) {
  const config = loadConfig({ GENERATION_MODE: 'demo', ADMIN_PASSWORD: password, SESSION_SECRET: sessionSecret, DATA_DIR: './data/test' });
  const store = new DraftStore(':memory:');
  const app = createApp({ config, store, publisher: transport ? new Publisher(store, transport) : undefined });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, store, close: async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); store.close(); } };
}

test('HTTP demo generates, edits, lists and exports a real draft', async () => {
  const f = await fixture();
  try {
    const created = await fetch(`${f.url}/api/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: 'Научный семинар', facts: '28 ноября, аудитория 301.', category: 'science' }) });
    assert.equal(created.status, 201);
    const draft = await created.json() as { id: string; body: string; revision: number };
    assert.match(draft.body, /аудитория 301/);
    const updated = await fetch(`${f.url}/api/drafts/${draft.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Исправленный текст.' }) });
    assert.equal((await updated.json() as { revision: number }).revision, 2);
    const list = await fetch(`${f.url}/api/drafts`).then(response => response.json()) as unknown[];
    assert.equal(list.length, 1);
    const image = await fetch(`${f.url}/api/drafts/${draft.id}/cover.png`);
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.ok((await image.arrayBuffer()).byteLength > 10000);
    assert.equal((await fetch(`${f.url}/api/drafts/${draft.id}/confirm`, { method: 'POST' })).status, 503);
  } finally { await f.close(); }
});

test('password sessions protect drafts without exposing secrets', async () => {
  const password = 'private-test-password';
  const f = await fixture(password);
  try {
    assert.equal((await fetch(`${f.url}/api/drafts`)).status, 401);
    const status = await fetch(`${f.url}/api/status`).then(response => response.text());
    assert.equal(status.includes(password), false);
    const wrong = await fetch(`${f.url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) });
    assert.equal(wrong.status, 401);
    const login = await fetch(`${f.url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal((await fetch(`${f.url}/api/drafts`, { headers: { Cookie: cookie.split(';')[0] } })).status, 200);
  } finally { await f.close(); }
});

test('cross-origin writes and invalid brief inputs are rejected', async () => {
  const f = await fixture();
  try {
    const body = JSON.stringify({ topic: 'Проверка' });
    const headers = { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' };
    assert.equal((await fetch(`${f.url}/api/drafts`, { method: 'POST', headers, body })).status, 403);
    assert.equal((await fetch(`${f.url}/api/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"topic":""}' })).status, 400);
    assert.equal(f.store.list().length, 0);
  } finally { await f.close(); }
});

test('non-loopback configuration requires a strong admin password', () => {
  assert.throws(() => loadConfig({ HOST: '0.0.0.0', GENERATION_MODE: 'demo' }), /ADMIN_PASSWORD/);
  assert.throws(() => loadConfig({ ADMIN_PASSWORD: 'short', GENERATION_MODE: 'demo' }), /12/);
});

test('an empty environment session secret cannot forge an admin session', async () => {
  const f = await fixture('private-test-password', '');
  try {
    const payload = Buffer.from(String(Date.now() + 60000)).toString('base64url');
    const signature = createHmac('sha256', '').update(payload).digest('base64url');
    const response = await fetch(`${f.url}/api/drafts`, { headers: { Cookie: `fmit_session=${payload}.${signature}` } });
    assert.equal(response.status, 401);
  } finally { await f.close(); }
});

test('configured session secrets must contain at least 32 characters', () => {
  assert.throws(() => loadConfig({ GENERATION_MODE: 'demo', SESSION_SECRET: 'short' }), /32/);
});

test('HTTP confirmation does not authorize text changed since the browser preview', async () => {
  let calls = 0;
  const f = await fixture('', undefined, { publish: async () => { calls++; return { postId: 42, url: 'https://vk.ru/wall-157438856_42' }; } });
  try {
    const draft = await fetch(`${f.url}/api/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: 'Новость ФМиИТ' }) }).then(response => response.json()) as { id: string; revision: number };
    f.store.update(draft.id, { body: 'Changed by another editor' });
    const response = await fetch(`${f.url}/api/drafts/${draft.id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: draft.revision }) });
    assert.equal(response.status, 409);
    assert.equal(calls, 0);
  } finally { await f.close(); }
});
