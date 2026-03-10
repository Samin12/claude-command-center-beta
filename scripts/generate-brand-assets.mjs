import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const landingBrandDir = path.join(rootDir, 'landing', 'public', 'claude-command-center');
const iconsetDir = path.join(rootDir, 'icon.iconset');

const colors = {
  bgTop: '#0f766e',
  bgBottom: '#14532d',
  accent: '#f4d35e',
  shadow: '#082f49',
  text: '#f8fafc',
};

const markSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.bgTop}" />
      <stop offset="100%" stop-color="${colors.bgBottom}" />
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#134e4a" />
      <stop offset="100%" stop-color="#052e16" />
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" rx="240" fill="url(#bg)" />
  <rect x="96" y="96" width="832" height="832" rx="208" fill="rgba(255,255,255,0.06)" />
  <rect x="160" y="176" width="704" height="672" rx="88" fill="url(#panel)" stroke="rgba(248,250,252,0.12)" stroke-width="8" />
  <circle cx="256" cy="256" r="22" fill="#fb7185" />
  <circle cx="320" cy="256" r="22" fill="${colors.accent}" />
  <circle cx="384" cy="256" r="22" fill="#34d399" />
  <rect x="216" y="336" width="592" height="44" rx="22" fill="rgba(248,250,252,0.10)" />
  <rect x="216" y="424" width="420" height="36" rx="18" fill="rgba(248,250,252,0.14)" />
  <rect x="216" y="496" width="484" height="36" rx="18" fill="rgba(248,250,252,0.14)" />
  <rect x="216" y="568" width="356" height="36" rx="18" fill="rgba(248,250,252,0.14)" />
  <rect x="180" y="692" width="664" height="108" rx="54" fill="${colors.accent}" />
  <text x="512" y="769" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="204" letter-spacing="10" fill="${colors.shadow}">CCC</text>
</svg>
`;

const wordmarkSvg = `
<svg width="1400" height="320" viewBox="0 0 1400 320" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wordmark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.bgTop}" />
      <stop offset="100%" stop-color="${colors.bgBottom}" />
    </linearGradient>
  </defs>
  <rect width="1400" height="320" fill="transparent" />
  <text x="24" y="122" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="86" letter-spacing="14" fill="url(#wordmark)">CLAUDE</text>
  <text x="24" y="216" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="86" letter-spacing="10" fill="#0f172a">COMMAND CENTER</text>
  <rect x="24" y="248" width="520" height="18" rx="9" fill="${colors.accent}" />
</svg>
`;

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function writePng(svg, filePath, width, height) {
  await sharp(Buffer.from(svg))
    .resize(width, height, { fit: 'contain' })
    .png()
    .toFile(filePath);
}

async function generateIcns(sourcePath) {
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(iconsetDir, { recursive: true });

  const sizes = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' },
  ];

  for (const { size, name } of sizes) {
    await sharp(sourcePath).resize(size, size).png().toFile(path.join(iconsetDir, name));
  }

  execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(publicDir, 'icon.icns')}"`);
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}

async function main() {
  await ensureDir(publicDir);
  await ensureDir(landingBrandDir);

  await writePng(markSvg, path.join(publicDir, 'command-center-mark.png'), 1024, 1024);
  await writePng(wordmarkSvg, path.join(publicDir, 'command-center-wordmark.png'), 1400, 320);
  await writePng(markSvg, path.join(publicDir, 'icon-192.png'), 192, 192);
  await writePng(markSvg, path.join(publicDir, 'icon-512.png'), 512, 512);
  await writePng(markSvg, path.join(publicDir, 'apple-touch-icon.png'), 180, 180);

  await writePng(markSvg, path.join(landingBrandDir, 'mark.png'), 512, 512);
  await writePng(wordmarkSvg, path.join(landingBrandDir, 'wordmark.png'), 1400, 320);
  await writePng(markSvg, path.join(landingBrandDir, 'favicon-32.png'), 32, 32);
  await writePng(markSvg, path.join(landingBrandDir, 'icon-192.png'), 192, 192);

  await generateIcns(path.join(publicDir, 'command-center-mark.png'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
