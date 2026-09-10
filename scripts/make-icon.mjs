/**
 * Generates the app icon:
 *  - build/icon.png        512x512 master PNG
 *  - build/icon.ico        multi-size Windows ICO (PNG-compressed entries)
 * Run: node scripts/make-icon.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(process.cwd(), ".");
const buildDir = path.join(root, "build");

const SVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c1519"/>
      <stop offset="1" stop-color="#04080a"/>
    </linearGradient>
    <linearGradient id="cy" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7deffb"/>
      <stop offset="0.55" stop-color="#22d3ee"/>
      <stop offset="1" stop-color="#0e7490"/>
    </linearGradient>
  </defs>

  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="12" y="12" width="488" height="488" rx="102" fill="none"
        stroke="#22d3ee" stroke-opacity="0.5" stroke-width="7"/>

  <circle cx="256" cy="250" r="168" fill="#22d3ee" fill-opacity="0.07"/>

  <!-- gamepad (lucide gamepad-2, scaled 24 -> 312) -->
  <g transform="translate(100,94) scale(13)" fill="none" stroke="url(#cy)"
     stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <line x1="6" x2="10" y1="11" y2="11"/>
    <line x1="8" x2="8" y1="9" y2="13"/>
    <line x1="15" x2="15.01" y1="12" y2="12"/>
    <line x1="18" x2="18.01" y1="10" y2="10"/>
    <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>
  </g>

  <!-- signal dot: DNS ping motif -->
  <circle cx="256" cy="416" r="10" fill="url(#cy)"/>
  <path d="M216 400a56 56 0 0 1 80 0" fill="none" stroke="#22d3ee"
        stroke-opacity="0.85" stroke-width="9" stroke-linecap="round"/>
</svg>
`;

function makeIco(pngBuffers) {
  const sizes = Object.keys(pngBuffers);
  const count = sizes.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  const blobs = [];
  let offset = 6 + 16 * count;

  for (const sizeStr of sizes) {
    const size = Number(sizeStr);
    const png = pngBuffers[size];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
    blobs.push(png);
  }

  return Buffer.concat([header, ...entries, ...blobs]);
}

async function main() {
  mkdirSync(buildDir, { recursive: true });

  const master = await sharp(Buffer.from(SVG)).resize(512, 512).png().toBuffer();
  writeFileSync(path.join(buildDir, "icon.png"), master);

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = {};
  for (const s of sizes) {
    buffers[s] = await sharp(Buffer.from(SVG)).resize(s, s).png().toBuffer();
  }
  writeFileSync(path.join(buildDir, "icon.ico"), makeIco(buffers));

  console.log("icon generated:", path.join(buildDir, "icon.png"), "+", path.join(buildDir, "icon.ico"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
