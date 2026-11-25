import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';

export type Config = {
  port: number; host: string; publicUrl: string; dataDir: string;
  generationMode: 'ai' | 'demo'; apiKey: string; baseUrl: string; model: string;
  adminPassword: string; sessionSecret: string;
  groupId: number; groupToken: string; publishToken: string; adminIds: number[];
  botEnabled: boolean; vkVersion: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = z.coerce.number().int().min(1).max(65535).parse(env.PORT ?? 3001);
  const host = env.HOST ?? '127.0.0.1';
  const password = env.ADMIN_PASSWORD ?? '';
  if (password && password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !password) {
    throw new Error('Set ADMIN_PASSWORD before exposing the server beyond loopback.');
  }
  const mode = z.enum(['ai', 'demo']).parse(env.GENERATION_MODE ?? (env.OPENAI_API_KEY ? 'ai' : 'demo'));
  if (mode === 'ai' && !env.OPENAI_API_KEY) throw new Error('AI mode requires OPENAI_API_KEY.');
  const publicUrl = new URL(env.PUBLIC_URL ?? `http://localhost:${port}`).origin;
  const baseUrl = new URL(env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1');
  if (baseUrl.protocol !== 'https:' && !['127.0.0.1', 'localhost', '::1'].includes(baseUrl.hostname)) {
    throw new Error('OPENAI_BASE_URL must use HTTPS, except for local development providers.');
  }
  const adminIds = (env.VK_ADMIN_IDS ?? '').split(',').map(value => Number(value.trim())).filter(value => Number.isSafeInteger(value) && value > 0);
  const groupId = z.coerce.number().int().positive().parse(env.VK_GROUP_ID ?? 157438856);
  const botEnabled = env.VK_BOT_ENABLED === 'true';
  if (botEnabled && (!env.VK_GROUP_TOKEN || !adminIds.length)) {
    throw new Error('Enabled VK bot requires VK_GROUP_TOKEN and VK_ADMIN_IDS.');
  }
  const configuredSecret = env.SESSION_SECRET?.trim();
  if (configuredSecret && configuredSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  return {
    port, host, publicUrl, dataDir: resolve(env.DATA_DIR ?? './data'),
    generationMode: mode, apiKey: env.OPENAI_API_KEY ?? '', baseUrl: baseUrl.href.replace(/\/$/, ''),
    model: env.OPENAI_MODEL ?? 'gpt-4.1-mini', adminPassword: password,
    sessionSecret: configuredSecret || randomBytes(32).toString('hex'),
    groupId, groupToken: env.VK_GROUP_TOKEN ?? '', publishToken: env.VK_PUBLISH_TOKEN ?? '',
    adminIds, botEnabled, vkVersion: env.VK_API_VERSION ?? '5.199',
  };
}
