// Read the mod_icons sprites back out of the PACKED cache, the way the client's Pix8 does, and
// write each one as a PNG beside a mock chat line.
//
// WHY THE PACKED CACHE AND NOT THE PNG. The sprite sheet in content is a strip of 13-pixel tiles
// and PixPack decides how many sprites that is by dividing the image's width by the tile size from
// the .opt. Nothing states the count, so a sheet whose width is not a multiple of 13 silently
// packs a different number of sprites than the artist drew - and the thing that then goes wrong is
// a missing icon in the chatbox, days later. This reads what the client will actually load.
import fs from 'fs';

import Jagfile from '#/io/Jagfile.js';

const ARCHIVE = 'data/pack/client/media';
const NAME = 'mod_icons';

const jag = Jagfile.load(ARCHIVE);
const dat = jag.read(`${NAME}.dat`);
const idx = jag.read('index.dat');
if (!dat || !idx) {
    console.error(`${ARCHIVE} has no ${NAME}.dat or no index.dat`);
    process.exit(1);
}

// Pix8's own read order: the palette and the sheet-wide size live at the front of index.dat, at an
// offset the .dat names, then one header per sprite in sequence.
const offset = dat.g2();
idx.pos = offset;
const sheetWidth = idx.g2();
const sheetHeight = idx.g2();
const paletteCount = idx.g1();
const palette: number[] = [0];
for (let i = 0; i < paletteCount - 1; i++) {
    palette.push(idx.g3());
}

type Sprite = { w: number; h: number; pixels: Uint8Array };
const sprites: Sprite[] = [];
// The client loads sprite N by walking every header before it, so a count is only knowable by
// reading until the data runs out.
while (idx.pos + 9 <= idx.data.length && dat.pos < dat.data.length) {
    idx.g1(); // cropX
    idx.g1(); // cropY
    const w = idx.g2();
    const h = idx.g2();
    if (w <= 0 || h <= 0 || w > sheetWidth || h > sheetHeight) {
        break;
    }
    const type = idx.g1();
    const pixels = new Uint8Array(w * h);
    if (type === 0) {
        for (let i = 0; i < w * h; i++) {
            pixels[i] = dat.g1();
        }
    } else {
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
                pixels[x + y * w] = dat.g1();
            }
        }
    }
    sprites.push({ w, h, pixels });
}

console.log(`${NAME}: ${sprites.length} sprite(s), sheet ${sheetWidth}x${sheetHeight}, ${paletteCount} palette entries`);
for (let i = 0; i < sprites.length; i++) {
    const s = sprites[i];
    const used = new Set<number>();
    for (const p of s.pixels) {
        used.add(p);
    }
    const opaque = [...used].filter(p => p !== 0).length;
    console.log(`  [${i}] @cr${i + 1}@  ${s.w}x${s.h}  ${opaque} colour(s), ${s.pixels.filter(p => p === 0).length} transparent px`);
}

// A PPM per sprite on the chatbox grey - no encoder needed, and any viewer reads it.
const out = process.argv[2];
if (out) {
    fs.mkdirSync(out, { recursive: true });
    for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i];
        const body: number[] = [];
        for (let y = 0; y < s.h; y++) {
            for (let x = 0; x < s.w; x++) {
                const p = s.pixels[x + y * s.w];
                const rgb = p === 0 ? 0x808080 : palette[p];
                body.push((rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff);
            }
        }
        fs.writeFileSync(`${out}/mod_icon_${i}.ppm`, Buffer.concat([Buffer.from(`P6\n${s.w} ${s.h}\n255\n`), Buffer.from(body)]));
    }
    console.log(`wrote ${sprites.length} ppm(s) to ${out}`);
}

process.exit(0);
