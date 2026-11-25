import { z } from 'zod';

export const categories = {
  event: { label: 'Анонс события', tag: '#СобытияФМиИТ', kicker: 'СОБЫТИЯ', emoji: '📅' },
  news: { label: 'Новости факультета', tag: '#НовостиФМиИТ', kicker: 'НОВОСТИ', emoji: '📣' },
  science: { label: 'Наука и технологии', tag: '#Наука', kicker: 'НАУКА И ТЕХНОЛОГИИ', emoji: '🔬' },
  students: { label: 'Студенческая жизнь', tag: '#СтудентыФМиИТ', kicker: 'СТУДЕНЧЕСКАЯ ЖИЗНЬ', emoji: '💬' },
} as const;

export const tones = { friendly: 'Дружелюбный', formal: 'Официальный', energetic: 'Вдохновляющий' } as const;
export const lengths = { short: 'Короткий', medium: 'Средний', long: 'Подробный' } as const;
export const coverStyles = { brand: 'Фирменный', dark: 'Технологичный', paper: 'Минималистичный' } as const;

export const briefSchema = z.object({
  topic: z.string().trim().min(3, 'Опишите тему хотя бы тремя символами.').max(300),
  facts: z.string().trim().max(8000).default(''),
  category: z.enum(['event', 'news', 'science', 'students']).default('event'),
  tone: z.enum(['friendly', 'formal', 'energetic']).default('friendly'),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  coverStyle: z.enum(['brand', 'dark', 'paper']).default('brand'),
});

export const postSchema = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(12000),
  hashtags: z.array(z.string().max(80)).max(10),
  coverTitle: z.string().trim().min(1).max(110),
  coverSubtitle: z.string().trim().max(140),
});

export const draftPatchSchema = postSchema.partial().extend({
  coverStyle: z.enum(['brand', 'dark', 'paper']).optional(),
}).refine(value => Object.keys(value).length > 0, 'Передайте поля для изменения.');

export type Brief = z.infer<typeof briefSchema>;
export type PostCopy = z.infer<typeof postSchema>;
export type GeneratedPost = PostCopy & { source: 'ai' | 'demo' };
export type DraftPatch = z.infer<typeof draftPatchSchema>;
export type Draft = GeneratedPost & {
  id: string;
  brief: Brief;
  coverStyle: Brief['coverStyle'];
  status: 'draft' | 'publishing' | 'published' | 'uncertain';
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedUrl?: string;
  publicationError?: string;
};

export type BotReply = { text: string; draft?: Draft; attachCover?: boolean; keyboard?: string[][] };

export type AppStatus = {
  authenticated: boolean;
  passwordRequired: boolean;
  generationMode: 'ai' | 'demo';
  model: string;
  aiConfigured: boolean;
  botConfigured: boolean;
  botEnabled: boolean;
  botState: 'disabled' | 'starting' | 'connected' | 'retrying';
  canPublish: boolean;
  groupId: number;
  communityUrl: string;
};

export const initialBrief: Brief = {
  topic: '', facts: '', category: 'event', tone: 'friendly', length: 'medium', coverStyle: 'brand',
};

export function normalizeHashtags(tags: string[]) {
  const normalized = tags.map(tag => '#' + tag.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(tag => tag.length > 1);
  return [...new Set([...normalized, '#СФУУНиТ', '#СФУУНиТ_ФМиИТ'])].slice(0, 10);
}

export function composePost(post: PostCopy) {
  return `${post.title}\n\n${post.body}\n\n${post.hashtags.join(' ')}`.trim();
}
