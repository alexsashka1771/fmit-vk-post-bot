import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { briefSchema, composePost } from '../shared/contracts.ts';
import type { BotReply } from '../shared/contracts.ts';
import type { Generator } from './generator.ts';
import { AppError, safeMessage } from './errors.ts';
import type { DraftStore } from './store.ts';
import type { Publisher } from './publisher.ts';
import type { VkClient } from './vk.ts';

type BotOptions = { store: DraftStore; generator: Generator; adminIds: number[]; publicUrl: string; publisher?: Publisher };
const mainKeyboard = [['Новый пост', 'Черновики'], ['Обложка', 'Ещё вариант'], ['Публиковать', 'Помощь']];

export class BotEngine {
  constructor(private readonly options: BotOptions) {}

  async handle(userId: number, input: string): Promise<BotReply> {
    if (!this.options.adminIds.includes(userId)) return { text: 'Доступ к редактору закрыт. Обратитесь к администратору ФМиИТ.' };
    const text = input.trim();
    if (!text || text.length > 8500) throw new AppError('Сообщение должно содержать от 1 до 8500 символов.');
    const command = text.toLocaleLowerCase('ru');
    const session = this.options.store.session(userId);
    const reply = (message: string): BotReply => ({ text: message, keyboard: mainKeyboard });

    if (['начать', 'старт', 'start', '/start', 'помощь', 'help'].includes(command)) {
      return reply('Привет! Я редактор постов ФМиИТ СФ УУНиТ.\n\nПришлите «пост» и факты: тема, дата, место, условия, ссылка. Я подготовлю текст и фирменную обложку.\n\nКоманды: новый пост, черновики, открыть <id>, текст <новый текст>, обложка, ещё вариант, публиковать, подтвердить, отмена. Публикация всегда требует подтверждения.');
    }
    if (['новый пост', 'создать пост', 'пост'].includes(command)) {
      this.options.store.setSession(userId, { ...session, waitingForBrief: true, confirmation: undefined });
      return reply('О чём расскажем? Пришлите тему и проверенные факты: дату, время, место и ссылку, если они нужны.');
    }
    if (command === 'отмена') {
      this.options.store.setSession(userId, { draftId: session.draftId });
      return reply('Действие отменено. Черновик сохранён.');
    }
    if (command === 'черновики') {
      const drafts = this.options.store.list().slice(0, 10);
      return reply(drafts.length ? drafts.map(draft => `${draft.id.slice(0, 8)} · ${draft.title} (${draft.status === 'published' ? 'опубликован' : 'черновик'})`).join('\n') + '\n\nОтправьте «открыть <id>».' : 'Пока нет черновиков. Нажмите «Новый пост».');
    }
    if (command.startsWith('открыть ')) {
      const id = text.slice(8).trim();
      const matches = this.options.store.list().filter(draft => draft.id.startsWith(id));
      if (matches.length !== 1) throw new AppError('Черновик не найден или ID неоднозначен. Посмотрите список черновиков.');
      const draft = matches[0];
      this.options.store.setSession(userId, { draftId: draft.id });
      return { ...reply(composePost(draft)), draft };
    }
    const isDraftAction = ['обложка', 'ещё вариант', 'еще вариант', 'публиковать', 'подтвердить'].includes(command) || command.startsWith('текст ');
    if (command.startsWith('пост ') || command.startsWith('/post ') || session.waitingForBrief && !isDraftAction) {
      const facts = session.waitingForBrief ? text : text.replace(/^(?:пост|\/post)\s+/i, '');
      const brief = briefSchema.parse({ topic: facts.split('\n')[0].slice(0, 140), facts: facts.slice(0, 8000), category: 'event' });
      const draft = this.options.store.create(brief, await this.options.generator.generate(brief));
      this.options.store.setSession(userId, { draftId: draft.id });
      return { ...reply(`${draft.source === 'demo' ? 'Демо · текст по шаблону\n\n' : ''}${composePost(draft)}\n\nЧерновик: ${draft.id.slice(0, 8)}. Проверьте факты перед публикацией.\nРедактор: ${this.options.publicUrl}/?draft=${draft.id}`), draft };
    }
    const draft = session.draftId ? this.options.store.get(session.draftId) : undefined;
    if (!draft) return reply('Сначала создайте пост или откройте черновик.');
    if (command.startsWith('текст ')) {
      const updated = this.options.store.update(draft.id, { body: text.slice(6).trim() });
      this.options.store.setSession(userId, { draftId: draft.id });
      return { ...reply('Текст обновлён.\n\n' + composePost(updated)), draft: updated };
    }
    if (command === 'обложка') return { ...reply('Фирменная обложка для вашего поста.'), draft, attachCover: true };
    if (['ещё вариант', 'еще вариант'].includes(command)) {
      const variant = this.options.store.create(draft.brief, await this.options.generator.generate(draft.brief));
      this.options.store.setSession(userId, { draftId: variant.id });
      return { ...reply('Новый вариант:\n\n' + composePost(variant)), draft: variant };
    }
    if (command === 'публиковать') {
      if (!this.options.publisher) return reply('Для публикации подключите пользовательский токен ВК в VK_PUBLISH_TOKEN. Пока можно сохранить текст и обложку.');
      const ticket = this.options.publisher.confirm(draft.id, draft.revision);
      this.options.store.setSession(userId, { draftId: draft.id, confirmation: ticket.token });
      return { text: `Проверьте текст и обложку. Отправьте «подтвердить», чтобы опубликовать этот вариант на стене ФМиИТ.\n\n${composePost(draft)}`, draft, attachCover: true, keyboard: [['Подтвердить', 'Отмена']] };
    }
    if (command === 'подтвердить') {
      if (!this.options.publisher || !session.confirmation) return reply('Сначала нажмите «Публиковать» и проверьте предпросмотр.');
      const published = await this.options.publisher.publish(draft.id, session.confirmation);
      this.options.store.setSession(userId, { draftId: draft.id });
      return { ...reply(`Пост опубликован: ${published.publishedUrl}`), draft: published };
    }
    return reply('Выберите действие на клавиатуре или отправьте «помощь». Для правки текста используйте «текст <новый текст>».');
  }
}

type LongPollServer = { key: string; server: string; ts: string };
type MessageEvent = { type: string; event_id?: string; object?: { message?: { from_id: number; peer_id: number; text?: string; id?: number } } };
export type BotState = { state: 'disabled' | 'starting' | 'connected' | 'retrying' };

export async function runBot(vk: VkClient, engine: BotEngine, store: DraftStore, groupId: number, signal: AbortSignal, state: BotState) {
  let server: LongPollServer | undefined;
  state.state = 'starting';
  while (!signal.aborted) {
    try {
      if (!server) server = await vk.call<LongPollServer>('groups.getLongPollServer', { group_id: groupId });
      const url = new URL(server.server);
      if (url.protocol !== 'https:' || !/(^|\.)(vk\.com|vk\.ru)$/.test(url.hostname)) throw new AppError('ВК вернул неподходящий сервер Long Poll.', 502);
      url.search = new URLSearchParams({ act: 'a_check', key: server.key, ts: String(server.ts), wait: '25' }).toString();
      const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]) });
      if (!response.ok) throw new AppError('Сервер Long Poll недоступен.', 502);
      const data = await response.json() as { failed?: number; ts?: string; updates?: MessageEvent[] };
      if (data.failed) { if (data.failed === 1 && data.ts) server.ts = String(data.ts); else server = undefined; continue; }
      if (data.ts) server.ts = String(data.ts);
      state.state = 'connected';
      for (const event of data.updates ?? []) {
        const message = event.object?.message;
        if (event.type !== 'message_new' || !message || message.from_id <= 0 || message.peer_id !== message.from_id) continue;
        const id = event.event_id ?? `${message.peer_id}:${message.id ?? randomUUID()}`;
        if (!store.recordEvent(id)) continue;
        try {
          const reply = await engine.handle(message.from_id, message.text ?? '');
          const attachment = reply.attachCover && reply.draft ? await vk.messageCover(message.peer_id, reply.draft) : undefined;
          await vk.send(message.peer_id, reply.text, reply.keyboard, attachment);
        } catch (error) { await vk.send(message.peer_id, safeMessage(error)); }
      }
    } catch (error) {
      if (signal.aborted) break;
      state.state = 'retrying'; server = undefined;
      console.warn(`VK bot: ${safeMessage(error)}`);
      await delay(5000, undefined, { signal }).catch(() => undefined);
    }
  }
  state.state = 'disabled';
}
