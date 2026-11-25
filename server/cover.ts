import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { categories } from '../shared/contracts.ts';
import type { Brief } from '../shared/contracts.ts';

type CoverInput = { coverTitle: string; coverSubtitle: string; category: Brief['category']; coverStyle: Brief['coverStyle'] };
const fontfile = fileURLToPath(new URL('../assets/fonts/Manrope.ttf', import.meta.url));

function escape(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function textLayer(text: string, color: string, size: number, width: number, height?: number, weight = 'Bold') {
  if (!text.trim()) return sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const rendered = await sharp({ text: { text: `<span foreground="${color}">${escape(text)}</span>`, font: `Manrope ${weight} ${size}`, fontfile, width, rgba: true, wrap: 'word-char', align: 'left', spacing: 12 } }).png().toBuffer();
  const metadata = await sharp(rendered).metadata();
  return height && metadata.height && metadata.height > height ? sharp(rendered).resize({ height, withoutEnlargement: true }).png().toBuffer() : rendered;
}

export async function renderCover(input: CoverInput) {
  const paper = input.coverStyle === 'paper';
  const brand = input.coverStyle === 'brand';
  const foreground = paper ? '#18213f' : '#ffffff';
  const muted = paper ? '#626581' : '#d8d6f1';
  const stroke = paper ? '#6e63ce' : '#aaa0ff';
  const background = brand ? 'url(#brand)' : paper ? '#f3f0e8' : '#111326';
  const base = `<svg width="1600" height="1000" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="brand" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#4920a9"/><stop offset=".52" stop-color="#6040dd"/><stop offset="1" stop-color="#6196ff"/></linearGradient>
      <radialGradient id="orb"><stop stop-color="${paper ? '#e5defe' : '#866bff'}" stop-opacity=".9"/><stop offset="1" stop-color="${paper ? '#ddd5fb' : '#493282'}" stop-opacity=".1"/></radialGradient>
      <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="${stroke}" stroke-opacity=".12" stroke-width="1"/></pattern>
    </defs>
    <rect width="1600" height="1000" fill="${background}"/>
    <rect width="1600" height="1000" fill="url(#grid)"/>
    <circle cx="1380" cy="490" r="420" fill="url(#orb)"/>
    <g fill="none" stroke="${stroke}">
      <ellipse cx="1320" cy="520" rx="295" ry="340" transform="rotate(-31 1320 520)" stroke-width="3" opacity=".8"/>
      <ellipse cx="1320" cy="520" rx="230" ry="340" transform="rotate(33 1320 520)" stroke-width="2" opacity=".4"/>
      <ellipse cx="1320" cy="520" rx="350" ry="100" transform="rotate(-31 1320 520)" stroke-width="2" opacity=".4"/>
      <path d="M1175 342L1393 317L1492 505L1397 721L1186 724L1083 530Z M1175 342L1397 721M1393 317L1186 724M1083 530L1492 505" stroke-width="3" opacity=".65"/>
    </g>
    <circle cx="1087" cy="528" r="12" fill="${paper ? '#6d45cf' : '#c9fe84'}"/>
    <circle cx="1400" cy="720" r="8" fill="${foreground}"/>
    <path d="M72 88H146" stroke="${foreground}" stroke-width="4"/>
    <path d="M72 812H1518" stroke="${foreground}" stroke-opacity=".25"/>
    <rect x="72" y="166" width="12" height="12" rx="3" fill="${paper ? '#714adb' : '#c9fe84'}"/>
    <g fill="none" stroke="${foreground}" stroke-width="3" opacity=".6"><path d="M1500 69v44m-22-22h44"/><path d="M1480 875l20 20-20 20"/></g>
  </svg>`;
  const title = input.coverTitle.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim() || 'Новости ФМиИТ';
  const layers = await Promise.all([
    textLayer('ФМиИТ', foreground, 40, 420),
    textLayer(categories[input.category].kicker, foreground, 24, 1100),
    textLayer(title, foreground, 118, 860, 370),
    textLayer(input.coverSubtitle, muted, 34, 850, 100, 'Regular'),
    textLayer('СФ УУНиТ  /  МАТЕМАТИКА И ТЕХНОЛОГИИ', muted, 23, 1300),
    textLayer('@fmiit_struust', muted, 23, 500),
  ]);
  return sharp(Buffer.from(base)).composite([
    { input: layers[0], left: 170, top: 64 },
    { input: layers[1], left: 101, top: 157 },
    { input: layers[2], left: 70, top: 288 },
    { input: layers[3], left: 74, top: 705 },
    { input: layers[4], left: 72, top: 870 },
    { input: layers[5], left: 72, top: 925 },
  ]).png().toBuffer();
}
