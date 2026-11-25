import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { draftPatchSchema, normalizeHashtags } from '../shared/contracts.ts';
import type { Brief, Draft, DraftPatch, GeneratedPost } from '../shared/contracts.ts';
import { AppError } from './errors.ts';

type DraftRow = { content: string };
export type BotSession = { draftId?: string; confirmation?: string; waitingForBrief?: boolean };
type TicketRow = { hash: string; revision: number; expires_at: number };

export class DraftStore {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, content TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS confirmations (draft_id TEXT PRIMARY KEY, hash TEXT NOT NULL, revision INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS bot_sessions (user_id TEXT PRIMARY KEY, content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bot_events (event_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);`);
  }

  create(brief: Brief, post: GeneratedPost) {
    const now = new Date().toISOString();
    const draft: Draft = { ...post, id: randomUUID(), brief, coverStyle: brief.coverStyle, status: 'draft', revision: 1, createdAt: now, updatedAt: now };
    this.db.prepare('INSERT INTO drafts (id, content, created_at) VALUES (?, ?, ?)').run(draft.id, JSON.stringify(draft), now);
    return draft;
  }

  list() {
    return (this.db.prepare('SELECT content FROM drafts ORDER BY created_at DESC, rowid DESC LIMIT 200').all() as unknown as DraftRow[]).map(row => JSON.parse(row.content) as Draft);
  }

  get(id: string): Draft | undefined {
    const row = this.db.prepare('SELECT content FROM drafts WHERE id = ?').get(id) as DraftRow | undefined;
    return row ? JSON.parse(row.content) as Draft : undefined;
  }

  require(id: string) {
    const draft = this.get(id);
    if (!draft) throw new AppError('Черновик не найден.', 404, 'draft_not_found');
    return draft;
  }

  update(id: string, patch: DraftPatch) {
    const draft = this.require(id);
    if (draft.status !== 'draft') throw new AppError(draft.status === 'published' ? 'Этот пост уже опубликован. Создайте новый вариант.' : draft.status === 'uncertain' ? 'Результат публикации не подтверждён. Исходный текст сохранён для проверки и повтора.' : 'Пост сейчас публикуется.', 409, 'draft_locked');
    const data = draftPatchSchema.parse(patch);
    const updated: Draft = { ...draft, ...data, hashtags: data.hashtags ? normalizeHashtags(data.hashtags) : draft.hashtags, revision: draft.revision + 1, updatedAt: new Date().toISOString() };
    this.save(updated);
    return updated;
  }

  save(draft: Draft) {
    this.db.prepare('UPDATE drafts SET content = ? WHERE id = ?').run(JSON.stringify(draft), draft.id);
  }

  recoverInterruptedPublications() {
    const rows = this.db.prepare('SELECT content FROM drafts').all() as unknown as DraftRow[];
    for (const row of rows) {
      const draft = JSON.parse(row.content) as Draft;
      if (draft.status !== 'publishing') continue;
      this.save({ ...draft, status: 'uncertain', publicationError: 'Отправка была прервана. Проверьте стену перед повторным подтверждением.' });
      this.clearTicket(draft.id);
    }
  }

  ticket(id: string, token: string, revision: number, expiresAt: number) {
    this.db.prepare('INSERT OR REPLACE INTO confirmations (draft_id, hash, revision, expires_at) VALUES (?, ?, ?, ?)').run(id, this.hash(token), revision, expiresAt);
  }

  verifyTicket(id: string, token: string, revision: number, now: number) {
    const ticket = this.db.prepare('SELECT hash, revision, expires_at FROM confirmations WHERE draft_id = ?').get(id) as TicketRow | undefined;
    if (!ticket || !token || ticket.hash !== this.hash(token)) throw new AppError('Публикация требует подтверждения после предпросмотра.', 403, 'confirmation_required');
    if (ticket.revision !== revision) throw new AppError('Пост изменился после предпросмотра. Подтвердите новый вариант.', 409, 'confirmation_stale');
    if (ticket.expires_at < now) throw new AppError('Срок подтверждения истек. Откройте предпросмотр снова.', 403, 'confirmation_expired');
  }

  clearTicket(id: string) { this.db.prepare('DELETE FROM confirmations WHERE draft_id = ?').run(id); }
  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }

  session(userId: number): BotSession {
    const row = this.db.prepare('SELECT content FROM bot_sessions WHERE user_id = ?').get(String(userId)) as DraftRow | undefined;
    return row ? JSON.parse(row.content) as BotSession : {};
  }

  setSession(userId: number, value: BotSession) {
    this.db.prepare('INSERT OR REPLACE INTO bot_sessions (user_id, content) VALUES (?, ?)').run(String(userId), JSON.stringify(value));
  }

  recordEvent(eventId: string) {
    const result = this.db.prepare('INSERT OR IGNORE INTO bot_events (event_id, created_at) VALUES (?, ?)').run(eventId, Date.now());
    this.db.prepare('DELETE FROM bot_events WHERE rowid NOT IN (SELECT rowid FROM bot_events ORDER BY rowid DESC LIMIT 10000)').run();
    return result.changes === 1;
  }

  close() { this.db.close(); }
}
