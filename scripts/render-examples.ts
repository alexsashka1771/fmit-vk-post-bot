import { mkdir, writeFile } from 'node:fs/promises';
import { renderCover } from '../server/cover.ts';

await mkdir('docs/covers', { recursive: true });
for (const coverStyle of ['brand', 'dark', 'paper'] as const) {
  const cover = await renderCover({ coverTitle: 'Технологии.\nИдеи.\nБудущее.', coverSubtitle: 'ФМиИТ СФ УУНиТ', category: 'science', coverStyle });
  await writeFile(`docs/covers/${coverStyle}.png`, cover);
  console.log(`${coverStyle}: 1600 × 1000 PNG (${cover.length} bytes)`);
}
