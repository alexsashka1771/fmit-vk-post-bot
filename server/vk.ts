import { randomInt } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { composePost } from '../shared/contracts.ts';
import type { Draft } from '../shared/contracts.ts';
import { AppError, safeMessage } from './errors.ts';
import { renderCover } from './cover.ts';

type VkOptions = { groupToken: string; publishToken: string; groupId: number; version: string };
type Params = Record<string, string | number | boolean>;
type Photo = { id: number; owner_id: number; access_key?: string };
type Upload = { photo: string; server: number; hash: string };

export class VkClient {
  private nextCall = 0;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly options: VkOptions, private readonly fetcher: typeof fetch = globalThis.fetch) {}

  async call<T = unknown>(method: string, params: Params, publishing = false): Promise<T> {
    const token = publishing ? this.options.publishToken : this.options.groupToken;
    if (!token) throw new AppError('Подключите токен ВК для этого действия.', 503, 'vk_not_configured');
    const operation = this.queue.catch(() => undefined).then(async () => {
      const wait = this.nextCall - Date.now();
      if (wait > 0) await delay(wait);
      this.nextCall = Date.now() + 350;
      const body = new URLSearchParams({ access_token: token, v: this.options.version });
      for (const [name, value] of Object.entries(params)) body.set(name, String(value));
      let response: Response;
      try {
        response = await this.fetcher(`https://api.vk.com/method/${method}`, { method: 'POST', body, signal: AbortSignal.timeout(20000) });
      } catch { throw new AppError('ВК не ответил вовремя. Проверьте стену перед повторной публикацией.', 504, 'vk_unavailable'); }
      if (!response.ok) throw new AppError('Сервис ВК временно недоступен.', 502, 'vk_unavailable');
      let data: { response?: T; error?: { error_code: number } };
      try { data = await response.json(); } catch { throw new AppError('ВК вернул некорректный ответ.', 502, 'vk_invalid_response'); }
      if (data.error) {
        const code = data.error.error_code;
        const message = code === 5 || code === 27 || code === 28 ? 'Проверьте токен ВК и срок его действия.' : code === 7 || code === 15 || code === 200 || code === 214 ? 'У токена ВК недостаточно прав. Проверьте доступ к сообщениям, фото и стене.' : code === 6 ? 'Слишком много запросов к ВК. Повторите действие через несколько секунд.' : `ВК отклонил действие (код ${code}). Проверьте настройки сообщества.`;
        throw new AppError(message, 502, 'vk_api_error');
      }
      if (data.response === undefined) throw new AppError('ВК вернул пустой ответ.', 502, 'vk_invalid_response');
      return data.response;
    });
    this.queue = operation;
    return operation;
  }

  async send(peerId: number, text: string, keyboard?: string[][], attachment?: string) {
    const chunks = text.match(/[\s\S]{1,3900}/g) ?? [''];
    for (const [index, chunk] of chunks.entries()) {
      const params: Params = { peer_id: peerId, random_id: randomInt(1, 2147483647), message: chunk, dont_parse_links: 1 };
      if (index === chunks.length - 1) {
        if (keyboard) params.keyboard = JSON.stringify({ one_time: false, buttons: keyboard.map(row => row.map(label => ({ action: { type: 'text', label }, color: label === 'Подтвердить' ? 'positive' : label === 'Новый пост' ? 'primary' : 'secondary' }))) });
        if (attachment) params.attachment = attachment;
      }
      await this.call('messages.send', params);
    }
  }

  private async upload(url: string, image: Buffer): Promise<Upload> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !/(^|\.)(vk\.com|vk\.ru|userapi\.com|vkuserphoto\.ru)$/.test(parsed.hostname)) throw new AppError('ВК вернул неподходящий адрес загрузки.', 502, 'vk_invalid_response');
    const form = new FormData();
    form.set('photo', new Blob([new Uint8Array(image)], { type: 'image/png' }), 'fmit-cover.png');
    let response: Response;
    try { response = await this.fetcher(url, { method: 'POST', body: form, signal: AbortSignal.timeout(45000) }); }
    catch { throw new AppError('Не удалось загрузить обложку в ВК.', 502, 'vk_upload_error'); }
    if (!response.ok) throw new AppError('Не удалось загрузить обложку в ВК.', 502, 'vk_upload_error');
    const data = await response.json() as Upload;
    if (typeof data.photo !== 'string' || !data.photo || !data.hash || !data.server) throw new AppError('ВК не сохранил обложку.', 502, 'vk_upload_error');
    return data;
  }

  private attachment(photo: Photo) {
    if (!photo || !Number.isSafeInteger(photo.id) || !Number.isSafeInteger(photo.owner_id)) throw new AppError('ВК не вернул сохранённую фотографию.', 502, 'vk_invalid_response');
    return `photo${photo.owner_id}_${photo.id}${photo.access_key ? `_${photo.access_key}` : ''}`;
  }

  async messageCover(peerId: number, draft: Draft) {
    const image = await renderCover({ ...draft, category: draft.brief.category });
    const server = await this.call<{ upload_url: string }>('photos.getMessagesUploadServer', { peer_id: peerId });
    const upload = await this.upload(server.upload_url, image);
    const saved = await this.call<Photo[]>('photos.saveMessagesPhoto', { ...upload });
    return this.attachment(saved[0]);
  }

  async publish(draft: Draft) {
    if (!this.options.publishToken) throw new AppError('Для публикации подключите VK_PUBLISH_TOKEN с правами wall и photos.', 503, 'publishing_not_configured');
    let attachment: string;
    try {
      const image = await renderCover({ ...draft, category: draft.brief.category });
      const server = await this.call<{ upload_url: string }>('photos.getWallUploadServer', { group_id: this.options.groupId }, true);
      const upload = await this.upload(server.upload_url, image);
      const saved = await this.call<Photo[]>('photos.saveWallPhoto', { group_id: this.options.groupId, ...upload }, true);
      attachment = this.attachment(saved[0]);
    } catch (error) { throw new AppError(safeMessage(error), error instanceof AppError ? error.status : 502, 'vk_preparation_error'); }
    const result = await this.call<{ post_id: number }>('wall.post', { owner_id: -this.options.groupId, from_group: 1, message: composePost(draft), attachments: attachment, guid: draft.id }, true);
    if (!Number.isSafeInteger(result.post_id)) throw new AppError('ВК не подтвердил публикацию. Проверьте стену сообщества.', 502, 'vk_invalid_response');
    return { postId: result.post_id, url: `https://vk.ru/wall-${this.options.groupId}_${result.post_id}` };
  }
}
