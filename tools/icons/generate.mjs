/**
 * Renders POD's app icons from the SVG masters in this folder into public/.
 *
 *   npm run icons
 *
 * There is no rasterizer in the dependency tree, so this drives a headless
 * Chromium (Edge or Chrome, whichever is installed) and screenshots each SVG at
 * the exact pixel size. Set CHROME_BIN to point at a different binary.
 *
 * Masters:
 *   icon.svg           rounded square, for manifest "any" + desktop
 *   icon-square.svg    same glyph, full-bleed — iOS applies its own mask
 *   icon-maskable.svg  glyph shrunk into the inner 80% safe zone for Android
 *   favicon.svg        tighter padding so the mark survives 16px
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(SRC, '..', '..', 'public');

const CANDIDATES = [
  process.env.CHROME_BIN,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => existsSync(p));
if (!BROWSER) throw new Error('No Chromium found. Set CHROME_BIN to a Chrome/Edge binary.');

const work = mkdtempSync(join(tmpdir(), 'pod-icons-'));

function render(master, size, out) {
  const svg = readFileSync(join(SRC, master), 'utf8');
  const page = join(work, `${master}-${size}.html`);
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent;overflow:hidden}
    svg{display:block;width:${size}px;height:${size}px}
  </style>${svg}`);
  execFileSync(BROWSER, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--window-size=${size},${size}`,
    `--screenshot=${out}`,
    pathToFileURL(page).href,
  ], { stdio: 'pipe' });
}

/** Multi-resolution .ico holding PNG entries — understood by every modern browser. */
function buildIco(pngPaths, out) {
  const imgs = pngPaths.map((p) => readFileSync(p));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);            // type: icon
  header.writeUInt16LE(imgs.length, 4);
  const dir = Buffer.alloc(16 * imgs.length);
  let offset = header.length + dir.length;
  imgs.forEach((img, i) => {
    const b = 16 * i;
    dir.writeUInt8(img.readUInt32BE(16) % 256, b);      // PNG IHDR width; 0 means 256
    dir.writeUInt8(img.readUInt32BE(20) % 256, b + 1);  // IHDR height
    dir.writeUInt16LE(1, b + 4);                        // color planes
    dir.writeUInt16LE(32, b + 6);                       // bits per pixel
    dir.writeUInt32LE(img.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += img.length;
  });
  writeFileSync(out, Buffer.concat([header, dir, ...imgs]));
}

const jobs = [
  ...[72, 96, 128, 144, 152, 192, 384, 512].map((s) => ['icon.svg', s, `icons/icon-${s}x${s}.png`]),
  ...[192, 512].map((s) => ['icon-maskable.svg', s, `icons/icon-maskable-${s}x${s}.png`]),
  ['icon-square.svg', 180, 'icons/apple-touch-icon.png'],
];
for (const [master, size, out] of jobs) {
  render(master, size, join(OUT, out));
  console.log(`${out.padEnd(34)} ${size}x${size}`);
}

const favParts = [16, 32, 48].map((s) => {
  const p = join(work, `fav-${s}.png`);
  render('favicon.svg', s, p);
  return p;
});
buildIco(favParts, join(OUT, 'favicon.ico'));
console.log('favicon.ico'.padEnd(34) + '16+32+48');

// The two SVGs the app itself links to ship alongside the PNGs.
copyFileSync(join(SRC, 'icon.svg'), join(OUT, 'icons', 'icon.svg'));
copyFileSync(join(SRC, 'favicon.svg'), join(OUT, 'favicon.svg'));

rmSync(work, { recursive: true, force: true });
