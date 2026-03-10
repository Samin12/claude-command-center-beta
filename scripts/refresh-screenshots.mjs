import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const screenshotFiles = [
  'screenshots/0.png',
  'screenshots/agetns.png',
  'screenshots/kanban.png',
  'screenshots/plugins.png',
  'screenshots/skills.png',
  'screenshots/stats.png',
  'screenshots/super-agent.png',
  'screenshots/vault.png',
  'public/0.png',
  'landing/public/0.png',
];

const markPath = path.join(rootDir, 'public', 'command-center-mark.png');
const wordmarkPath = path.join(rootDir, 'public', 'command-center-wordmark.png');

function makeHeaderPanelSvg() {
  return Buffer.from(`
    <svg width="188" height="66" viewBox="0 0 188 66" xmlns="http://www.w3.org/2000/svg">
      <rect width="188" height="66" rx="0" fill="#e9e2d3"/>
      <rect x="0" y="0" width="187" height="65" rx="0" fill="#e9e2d3" stroke="#c7c0b1" stroke-width="1"/>
      <path d="M0 0H156C163 0 169 6 169 13V53C169 60 163 66 156 66H0V0Z" fill="#e9e2d3"/>
    </svg>
  `);
}

async function patchSidebarHeader(filePath) {
  const absPath = path.join(rootDir, filePath);
  const image = sharp(absPath);
  const metadata = await image.metadata();

  const panelWidth = Math.round((metadata.width ?? 1240) * 0.135);
  const panelHeight = Math.max(66, Math.round((metadata.height ?? 768) * 0.086));
  const markSize = Math.round(panelHeight * 0.62);
  const markLeft = 10;
  const markTop = Math.round((panelHeight - markSize) / 2);
  const wordmarkLeft = markLeft + markSize + 12;
  const wordmarkTop = Math.round(panelHeight * 0.18);
  const wordmarkWidth = Math.max(96, panelWidth - wordmarkLeft - 10);

  const panel = await sharp(makeHeaderPanelSvg())
    .resize(panelWidth, panelHeight)
    .png()
    .toBuffer();

  const mark = await sharp(markPath)
    .resize(markSize, markSize)
    .png()
    .toBuffer();

  const wordmark = await sharp(wordmarkPath)
    .resize(wordmarkWidth, Math.round(panelHeight * 0.6), { fit: 'contain' })
    .png()
    .toBuffer();

  const output = await image
    .composite([
      { input: panel, left: 0, top: 0 },
      { input: mark, left: markLeft, top: markTop },
      { input: wordmark, left: wordmarkLeft, top: wordmarkTop },
    ])
    .png()
    .toBuffer();

  await fs.promises.writeFile(absPath, output);
}

async function createBrandBanner() {
  const outputPath = path.join(rootDir, 'screenshots', 'background-2.png');
  const svg = `
    <svg width="1464" height="768" viewBox="0 0 1464 768" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f766e"/>
          <stop offset="100%" stop-color="#14532d"/>
        </linearGradient>
        <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f4d35e" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#fde68a" stop-opacity="0.35"/>
        </linearGradient>
      </defs>
      <rect width="1464" height="768" fill="url(#bg)"/>
      <circle cx="1080" cy="180" r="340" fill="none" stroke="url(#ring)" stroke-width="42" opacity="0.55"/>
      <circle cx="1080" cy="180" r="250" fill="none" stroke="#f8fafc" stroke-width="6" opacity="0.35"/>
      <circle cx="240" cy="640" r="420" fill="none" stroke="#f4d35e" stroke-width="38" opacity="0.35"/>
      <circle cx="240" cy="640" r="320" fill="none" stroke="#d9f99d" stroke-width="30" opacity="0.3"/>
      <rect x="112" y="116" width="540" height="536" rx="48" fill="rgba(12, 74, 110, 0.22)" stroke="rgba(248,250,252,0.18)" stroke-width="2"/>
      <rect x="170" y="198" width="420" height="260" rx="34" fill="rgba(3, 105, 161, 0.18)" stroke="rgba(248,250,252,0.20)" stroke-width="2"/>
      <rect x="205" y="248" width="345" height="24" rx="12" fill="rgba(248,250,252,0.20)"/>
      <rect x="205" y="304" width="282" height="20" rx="10" fill="rgba(248,250,252,0.22)"/>
      <rect x="205" y="350" width="310" height="20" rx="10" fill="rgba(248,250,252,0.22)"/>
      <rect x="205" y="396" width="236" height="20" rx="10" fill="rgba(248,250,252,0.22)"/>
      <rect x="170" y="494" width="420" height="90" rx="26" fill="#f4d35e"/>
      <text x="380" y="556" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="72" fill="#082f49" letter-spacing="8">CLAUDE</text>
      <text x="750" y="270" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="96" fill="#ecfeff" letter-spacing="10">CLAUDE</text>
      <text x="750" y="380" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="108" fill="#0f172a" letter-spacing="8">COMMAND</text>
      <text x="750" y="490" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="108" fill="#0f172a" letter-spacing="8">CENTER</text>
      <rect x="752" y="532" width="412" height="18" rx="9" fill="#f4d35e"/>
      <text x="752" y="606" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="30" fill="rgba(248,250,252,0.82)" letter-spacing="2">AI AGENTS, ORCHESTRATED CLEANLY</text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

async function main() {
  for (const file of screenshotFiles) {
    if (fs.existsSync(path.join(rootDir, file))) {
      await patchSidebarHeader(file);
    }
  }
  await createBrandBanner();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
