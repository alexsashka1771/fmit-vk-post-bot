import { createApp } from '../server/app.ts';
import { loadConfig } from '../server/config.ts';
import { DraftStore } from '../server/store.ts';
import { Publisher } from '../server/publisher.ts';

const config = loadConfig({ GENERATION_MODE: 'demo', PORT: '3031', PUBLIC_URL: 'http://localhost:3031' });
const store = new DraftStore(':memory:');
let attempts = 0;
const publisher = new Publisher(store, { publish: async () => {
  attempts++;
  if (attempts === 1) throw new Error('Simulated lost response');
  return { postId: 42, url: 'https://vk.ru/wall-157438856_42' };
} });
const server = createApp({ config, store, publisher }).listen(3031, '127.0.0.1', () => console.log('Browser fixture: http://localhost:3031 — local fake publishing only; no VK requests.'));
process.on('SIGINT', () => server.close(() => { store.close(); process.exit(0); }));
