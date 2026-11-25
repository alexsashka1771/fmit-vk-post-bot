import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './config.ts';
import { DraftStore } from './store.ts';
import { createApp } from './app.ts';
import { createGenerator } from './generator.ts';
import { BotEngine, runBot } from './bot.ts';
import type { BotState } from './bot.ts';
import { VkClient } from './vk.ts';
import { Publisher } from './publisher.ts';

const config = loadConfig();
mkdirSync(config.dataDir, { recursive: true });
const store = new DraftStore(join(config.dataDir, 'studio.sqlite'));
const generator = createGenerator({ mode: config.generationMode, apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model });
const vk = new VkClient({ groupToken: config.groupToken, publishToken: config.publishToken, groupId: config.groupId, version: config.vkVersion });
const publisher = config.publishToken ? new Publisher(store, vk) : undefined;
const botState: BotState = { state: 'disabled' };
const app = createApp({ config, store, generator, publisher, botState });
const controller = new AbortController();
const server = app.listen(config.port, config.host, () => {
  console.log(`FMIT Post Studio: ${config.publicUrl}`);
  console.log(`Generation: ${config.generationMode}; VK bot: ${config.botEnabled ? 'enabled' : 'disabled'}`);
});
if (config.botEnabled) {
  const engine = new BotEngine({ store, generator, publisher, adminIds: config.adminIds, publicUrl: config.publicUrl });
  void runBot(vk, engine, store, config.groupId, controller.signal, botState);
}

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  controller.abort();
  server.close(() => { store.close(); process.exit(0); });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('error', error => { console.error(`Server could not start: ${error.message}`); controller.abort(); store.close(); process.exitCode = 1; });
