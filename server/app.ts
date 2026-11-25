import express from 'express';
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { briefSchema, draftPatchSchema } from '../shared/contracts.ts';
import type { AppStatus } from '../shared/contracts.ts';
import type { Config } from './config.ts';
import { AppError } from './errors.ts';
import { createGenerator } from './generator.ts';
import type { Generator } from './generator.ts';
import type { DraftStore } from './store.ts';
import { renderCover } from './cover.ts';
import { VkClient } from './vk.ts';
import { Publisher } from './publisher.ts';
import { BotEngine } from './bot.ts';
import type { BotState } from './bot.ts';

type AppOptions = { config: Config; store: DraftStore; generator?: Generator; publisher?: Publisher; botState?: BotState };

export function createApp(options: AppOptions) {
  const { config, store } = options;
  const generator = options.generator ?? createGenerator({ mode: config.generationMode, apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model });
  const publisher = options.publisher ?? (config.publishToken ? new Publisher(store, new VkClient({ groupToken: config.groupToken, publishToken: config.publishToken, groupId: config.groupId, version: config.vkVersion })) : undefined);
  const chatDemo = new BotEngine({ store, generator, adminIds: [-1], publicUrl: config.publicUrl });
  const app = express();
  app.disable('x-powered-by');
  const passwordHash = scryptSync(config.adminPassword, config.sessionSecret, 64);
  const sign = (text: string) => createHmac('sha256', config.sessionSecret).update(text).digest('base64url');
  const secureCookie = new URL(config.publicUrl).protocol === 'https:';
  const cookieOptions = { httpOnly: true, sameSite: 'strict' as const, secure: secureCookie, maxAge: 8 * 60 * 60 * 1000, path: '/' };

  function authenticated(request: express.Request) {
    if (!config.adminPassword) return true;
    const cookie = (request.headers.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith('fmit_session='))?.slice('fmit_session='.length);
    if (!cookie) return false;
    const [payload, signature] = cookie.split('.');
    if (!payload || !signature) return false;
    const expected = sign(payload);
    const first = Buffer.from(signature), second = Buffer.from(expected);
    if (first.length !== second.length || !timingSafeEqual(first, second)) return false;
    const expires = Number(Buffer.from(payload, 'base64url').toString());
    return Number.isSafeInteger(expires) && expires > Date.now();
  }

  const counters = new Map<string, { count: number; until: number }>();
  function limit(request: express.Request, bucket: string, maximum: number, period: number) {
    const now = Date.now();
    const key = `${request.ip}:${bucket}`;
    const record = counters.get(key);
    if (!record || record.until <= now) counters.set(key, { count: 1, until: now + period });
    else {
      record.count++;
      if (record.count > maximum) throw new AppError('Слишком много запросов. Подождите немного и попробуйте снова.', 429, 'rate_limit');
    }
    if (counters.size > 1000) for (const [id, value] of counters) if (value.until <= now) counters.delete(id);
  }

  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (!['127.0.0.1', 'localhost', '::1'].includes(req.hostname) && !config.adminPassword) return next(new AppError('Этот адрес сервера не разрешён.', 403, 'host_not_allowed'));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      const allowed = [config.publicUrl, `http://${req.get('host')}`, `https://${req.get('host')}`, 'http://localhost:5173', 'http://127.0.0.1:5173'];
      if (origin && !allowed.includes(origin)) return next(new AppError('Запрос с другого сайта не разрешён.', 403, 'origin_not_allowed'));
      if (req.get('sec-fetch-site') === 'cross-site') return next(new AppError('Запрос с другого сайта не разрешён.', 403, 'origin_not_allowed'));
    }
    next();
  });
  app.use(express.json({ limit: '40kb' }));

  app.get('/api/status', (req, res) => {
    const status: AppStatus = {
      authenticated: authenticated(req), passwordRequired: !!config.adminPassword,
      generationMode: config.generationMode, model: config.model,
      aiConfigured: !!config.apiKey, botConfigured: !!config.groupToken && config.adminIds.length > 0,
      botEnabled: config.botEnabled, botState: options.botState?.state ?? 'disabled',
      canPublish: !!publisher, groupId: config.groupId, communityUrl: `https://vk.ru/club${config.groupId}`,
    };
    res.json(status);
  });

  app.post('/api/auth/login', (req, res) => {
    limit(req, 'login', 10, 15 * 60 * 1000);
    const candidate = z.object({ password: z.string().max(256) }).parse(req.body).password;
    const hash = scryptSync(candidate, config.sessionSecret, 64);
    if (config.adminPassword && !timingSafeEqual(hash, passwordHash)) throw new AppError('Неверный пароль редактора.', 401, 'invalid_password');
    const payload = Buffer.from(String(Date.now() + cookieOptions.maxAge)).toString('base64url');
    res.cookie('fmit_session', `${payload}.${sign(payload)}`, cookieOptions).json({ authenticated: true });
  });

  app.use('/api', (req, _res, next) => authenticated(req) ? next() : next(new AppError('Войдите в редактор.', 401, 'authentication_required')));

  app.post('/api/auth/logout', (_req, res) => res.clearCookie('fmit_session', cookieOptions).json({ authenticated: false }));
  app.get('/api/drafts', (_req, res) => res.json(store.list()));
  app.get('/api/drafts/:id', (req, res) => res.json(store.require(req.params.id)));

  app.post('/api/drafts', async (req, res) => {
    const brief = briefSchema.parse(req.body);
    limit(req, 'generation', 8, 60000);
    const draft = store.create(brief, await generator.generate(brief));
    res.status(201).json(draft);
  });

  app.patch('/api/drafts/:id', (req, res) => {
    limit(req, 'edit', 120, 60000);
    res.json(store.update(req.params.id, draftPatchSchema.parse(req.body)));
  });

  app.post('/api/drafts/:id/regenerate', async (req, res) => {
    const previous = store.require(req.params.id);
    limit(req, 'generation', 8, 60000);
    const brief = { ...previous.brief, coverStyle: previous.coverStyle };
    res.status(201).json(store.create(brief, await generator.generate(brief)));
  });

  app.get('/api/drafts/:id/cover.png', async (req, res) => {
    limit(req, 'cover', 90, 60000);
    const draft = store.require(req.params.id);
    const buffer = await renderCover({ ...draft, category: draft.brief.category });
    if (req.query.download === '1') res.attachment(`fmit-${draft.id.slice(0, 8)}.png`);
    res.type('png').send(buffer);
  });

  app.post('/api/drafts/:id/confirm', (req, res) => {
    if (!publisher) throw new AppError('Для публикации подключите VK_PUBLISH_TOKEN с правами wall и photos.', 503, 'publishing_not_configured');
    const { revision } = z.object({ revision: z.number().int().positive() }).parse(req.body);
    res.json(publisher.confirm(req.params.id, revision));
  });

  app.post('/api/drafts/:id/publish', async (req, res) => {
    if (!publisher) throw new AppError('Для публикации подключите токен ВК.', 503, 'publishing_not_configured');
    limit(req, 'publish', 10, 60000);
    const { token } = z.object({ token: z.string().length(64) }).parse(req.body);
    res.json(await publisher.publish(req.params.id, token));
  });

  app.post('/api/chat-demo', async (req, res) => {
    limit(req, 'chat', 12, 60000);
    const { text } = z.object({ text: z.string().trim().min(1).max(8500) }).parse(req.body);
    res.json(await chatDemo.handle(-1, text));
  });

  app.use('/api', (_req, _res, next) => next(new AppError('Метод не найден.', 404, 'not_found')));
  const clientDirectory = resolve('dist/client');
  if (existsSync(resolve(clientDirectory, 'index.html'))) {
    app.use(express.static(clientDirectory, { index: false }));
    app.get(/.*/, (_req, res) => res.sendFile(resolve(clientDirectory, 'index.html')));
  }
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof AppError) return res.status(error.status).json({ error: error.message, code: error.code });
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message ?? 'Проверьте данные формы.', code: 'validation_error' });
    if (error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректные данные запроса.', code: 'invalid_json' });
    if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') return res.status(413).json({ error: 'Слишком большой запрос.', code: 'request_too_large' });
    console.error('Request failed:', error instanceof Error ? error.name : 'Unknown error');
    res.status(500).json({ error: 'Не удалось выполнить действие. Попробуйте ещё раз.', code: 'internal_error' });
  });
  return app;
}
