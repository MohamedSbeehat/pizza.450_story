// Converts the original photos in /photo into optimized web images.
// Usage: npm run images        (config: scripts/images.config.mjs)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { IMAGES } from './images.config.mjs';
import { cleanToppings, findCheese } from './pizza-top.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'photo');
const OUT = join(ROOT, 'public', 'images');
const MANIFEST = join(ROOT, 'src', 'data', 'images.manifest.json');

const MAX_WIDTH = 1600;

/** Base pipeline: orientation, crop, flatten (unless the image needs its alpha). */
function base(entry) {
  let img = sharp(join(SRC, entry.in)).rotate();
  if (entry.crop) img = img.extract(entry.crop);
  if (!entry.keepAlpha) img = img.flatten({ background: '#0b0907' });
  return img;
}

/**
 * Gold line drawing ("the idea"): classic pencil-sketch (colour-dodge of the
 * grey image with its blurred negative), inverted to light lines on black and
 * tinted with the brand gold.
 */
async function sketch(entry, width, file, { blur = 4, gain = 2.6, floor = 0.12, gamma = 0.85 } = {}) {
  const { data: g, info } = await base(entry)
    .resize({ width, kernel: 'lanczos3' })
    .greyscale()
    .median(3) // calm texture noise (leaves, plaster) before tracing
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = { width: info.width, height: info.height, channels: info.channels };
  const { data: b } = await sharp(g, { raw })
    .negate({ alpha: false })
    .blur(blur)
    .extractChannel(0) // libvips widens to 3 channels; keep one to match `g`
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Gold (#F5C77E-ish) lines on near-black paper
  const gold = [245, 200, 128];
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0, p = 0; i < g.length; i += info.channels, p += 3) {
    const dodge = b[i] >= 255 ? 255 : Math.min(255, (g[i] * 255) / (255 - b[i]));
    let line = (255 - dodge) / 255; // 0 on paper, 1 on strong edges
    line = Math.max(0, line * gain - floor) / (1 - floor);
    line = Math.pow(Math.min(1, line), gamma);
    out[p] = 11 + line * (gold[0] - 11);
    out[p + 1] = 9 + line * (gold[1] - 9);
    out[p + 2] = 7 + line * (gold[2] - 7);
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).webp({ quality: 82 }).toFile(file);
}

/**
 * Top view of a round object photographed at an angle (the real pizza).
 * The ellipse (cx, cy, rx, ry — pixels of the original) is stretched back to
 * a circle and masked, giving a square texture whose centre is the centre of
 * the pizza. Also writes a height/bump map from its luminance.
 * Used as the "baked" look of the 3D pizza.
 */
async function topView(entry) {
  const { cx, cy, rx, ry, size = 1024, edge = 0.985, out, pile, cheeseOut } = entry.topView;
  const outBase = join(ROOT, 'public', out);
  mkdirSync(dirname(outBase), { recursive: true });
  const box = { left: Math.round(cx - rx), top: Math.round(cy - ry), width: Math.round(rx * 2), height: Math.round(ry * 2) };
  const square = await sharp(join(SRC, entry.in)).rotate().extract(box).resize(size, size, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().toBuffer();
  const r = (size / 2) * edge;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><defs><radialGradient id="g"><stop offset="${((r - 6) / r).toFixed(3)}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="url(#g)"/></svg>`,
  );
  const alpha = await sharp(mask).extractChannel('alpha').toBuffer();
  // the finished pizza, exactly as photographed (final shot)
  await sharp(square).joinChannel(alpha).webp({ quality: 88, alphaQuality: 90 }).toFile(`${outBase}.webp`);
  // the same pizza without basil and grated cheese (straight out of the oven)
  const clean = await cleanToppings(square, size, pile);
  await sharp(clean).joinChannel(alpha).webp({ quality: 88, alphaQuality: 90 }).toFile(`${outBase}-clean.webp`);
  // relief: bright cheese and crust bubbles stand up, dark char/sauce sits low
  await sharp(clean).greyscale().normalise().blur(1.2).webp({ quality: 85 }).toFile(`${outBase}-bump.webp`);
  // where the melted mozzarella is → where the 3D torn pieces land
  if (cheeseOut) {
    const blobs = await findCheese(clean, { edge, pile });
    writeFileSync(join(ROOT, cheeseOut), JSON.stringify({ edge, pile, blobs }, null, 2) + '\n');
    console.log(`ok    ${''.padEnd(22)} → ${cheeseOut} (${blobs.length} cheese spots)`);
  }
  console.log(`ok    ${entry.in.padEnd(22)} → /${out} (top view ${size}×${size}, clean + bump)`);
}

const manifest = {};
for (const entry of IMAGES) {
  const input = join(SRC, entry.in);
  if (!existsSync(input)) {
    console.warn(`skip  ${entry.in} (not found in /photo)`);
    continue;
  }
  const outBase = join(OUT, entry.out);
  mkdirSync(dirname(outBase), { recursive: true });

  const meta = await base(entry).toBuffer({ resolveWithObject: true }).then((r) => r.info);
  const width = Math.min(entry.maxWidth ?? MAX_WIDTH, Math.round(meta.width * (entry.upscale ?? 2)));
  const height = Math.round((meta.height / meta.width) * width);

  const resized = () => base(entry).resize({ width, kernel: 'lanczos3' }).sharpen({ sigma: 0.7, m1: 0.6, m2: 1.4 });

  await resized().webp({ quality: 84, alphaQuality: 90 }).toFile(`${outBase}.webp`);
  await resized().avif({ quality: 58, effort: 5 }).toFile(`${outBase}.avif`);
  if (entry.png) await resized().png({ compressionLevel: 9 }).toFile(`${outBase}.png`);
  await base(entry).resize({ width: 72 }).blur(1.4).webp({ quality: 70 }).toFile(`${outBase}-bg.webp`);

  const key = `/images/${entry.out}`;
  manifest[key] = { w: width, h: height };

  if (entry.sketch) {
    const sketchBase = join(OUT, entry.sketch);
    mkdirSync(dirname(sketchBase), { recursive: true });
    await sketch(entry, width, `${sketchBase}.webp`);
    manifest[`/images/${entry.sketch}`] = { w: width, h: height, ext: 'webp' };
  }
  if (entry.topView) await topView(entry);
  console.log(`ok    ${entry.in.padEnd(22)} → ${key} (${width}×${height})`);
}

// Favicons from the logo
const logo = IMAGES.find((e) => e.out === 'brand/logo');
if (logo && existsSync(join(SRC, logo.in))) {
  await base(logo).resize(64).png().toFile(join(ROOT, 'public', 'favicon.png'));
  await base(logo).resize(180).flatten({ background: '#0b0907' }).png().toFile(join(ROOT, 'public', 'apple-touch-icon.png'));
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nmanifest → src/data/images.manifest.json (${Object.keys(manifest).length} images)`);
