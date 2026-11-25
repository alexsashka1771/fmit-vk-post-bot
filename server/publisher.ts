import { randomBytes } from 'node:crypto';
import type { Draft } from '../shared/contracts.ts';
import { AppError } from './errors.ts';
import type { DraftStore } from './store.ts';

export type PublishTransport = { publish(draft: Draft): Promise<{ postId: number; url: string }> };

export class Publisher {
  constructor(private readonly store: DraftStore, private readonly transport: PublishTransport, private readonly now: () => number = Date.now) {
    store.recoverInterruptedPublications();
  }

  confirm(id: string, expectedRevision?: number) {
    const draft = this.store.require(id);
    this.ensureDraft(draft);
    if (expectedRevision !== undefined && draft.revision !== expectedRevision) throw new AppError('Пост изменился после вашего предпросмотра. Откройте актуальный черновик.', 409, 'confirmation_stale');
    const token = randomBytes(32).toString('hex');
    const expiresAt = this.now() + 10 * 60 * 1000;
    this.store.ticket(id, token, draft.revision, expiresAt);
    return { token, expiresAt, revision: draft.revision };
  }

  async publish(id: string, token: string) {
    const draft = this.store.require(id);
    this.ensureDraft(draft);
    this.store.verifyTicket(id, token, draft.revision, this.now());
    const pending: Draft = { ...draft, status: 'publishing', publicationError: undefined };
    this.store.save(pending);
    try {
      const result = await this.transport.publish(pending);
      const published: Draft = { ...pending, status: 'published', publishedUrl: result.url, updatedAt: new Date().toISOString() };
      this.store.save(published);
      this.store.clearTicket(id);
      return published;
    } catch (error) {
      const rejected = error instanceof AppError && ['vk_api_error', 'vk_preparation_error', 'publishing_not_configured'].includes(error.code);
      const uncertain = !rejected || draft.status === 'uncertain';
      this.store.save({ ...draft, status: uncertain ? 'uncertain' : 'draft', publicationError: uncertain ? 'ВК не подтвердил результат. Проверьте стену перед повтором; исходный текст и ID сохранены.' : undefined });
      this.store.clearTicket(id);
      if (uncertain) throw new AppError('Результат публикации не подтверждён. Проверьте стену перед повторной отправкой исходного варианта.', 502, 'publication_uncertain');
      throw error;
    }
  }

  private ensureDraft(draft: Draft) {
    if (draft.status === 'published') throw new AppError('Пост уже опубликован.', 409, 'already_published');
    if (draft.status === 'publishing') throw new AppError('Пост уже публикуется. Дождитесь результата.', 409, 'publication_in_progress');
  }
}
