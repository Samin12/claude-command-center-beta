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
          <stop offset="0%" stop-color="#f5eee6"/>
          <stop offset="100%" stop-color="#eadfd2"/>
        </linearGradient>
        <linearGradient id="terracotta" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#d79b7d"/>
          <stop offset="100%" stop-color="#bb6c4c"/>
        </linearGradient>
      </defs>
      <rect width="1464" height="768" fill="url(#bg)"/>
      <circle cx="1130" cy="162" r="316" fill="none" stroke="rgba(199,116,84,0.22)" stroke-width="42"/>
      <circle cx="1130" cy="162" r="228" fill="none" stroke="rgba(221,184,158,0.45)" stroke-width="6"/>
      <circle cx="176" cy="664" r="356" fill="none" stroke="rgba(199,116,84,0.18)" stroke-width="34"/>
      <circle cx="176" cy="664" r="276" fill="none" stroke="rgba(221,184,158,0.30)" stroke-width="26"/>
      <rect x="106" y="126" width="526" height="500" rx="42" fill="rgba(199,116,84,0.07)" stroke="rgba(143,91,70,0.18)" stroke-width="2"/>
      <rect x="168" y="208" width="400" height="230" rx="32" fill="rgba(251,246,239,0.65)" stroke="rgba(143,91,70,0.16)" stroke-width="2"/>
      <rect x="205" y="256" width="346" height="24" rx="12" fill="rgba(143,91,70,0.14)"/>
      <rect x="205" y="314" width="286" height="20" rx="10" fill="rgba(143,91,70,0.12)"/>
      <rect x="205" y="360" width="314" height="20" rx="10" fill="rgba(143,91,70,0.12)"/>
      <rect x="205" y="406" width="238" height="20" rx="10" fill="rgba(143,91,70,0.12)"/>
      <rect x="170" y="492" width="420" height="90" rx="26" fill="url(#terracotta)"/>
      <text x="380" y="557" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="80" fill="#f6efe5">S</text>
      <text x="748" y="236" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="88" fill="#c77454" letter-spacing="6">SAMINS</text>
      <text x="748" y="350" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="112" fill="#33251d" letter-spacing="5">COMMAND</text>
      <text x="748" y="468" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="112" fill="#33251d" letter-spacing="5">CENTER</text>
      <rect x="752" y="520" width="474" height="18" rx="9" fill="#bb6c4c"/>
      <text x="752" y="598" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="28" fill="#806756" letter-spacing="2">MULTI-AGENT WORKSPACE, TERRACOTTA EDITION</text>
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
