/**
 * The pizza film: the clips in /film → one graded film, scrubbed by the scroll.
 *
 * The order, trims and the dissolve between shots come from film/shots.json
 * (a shot whose clip is missing is left out). Run:
 *     npm run film
 *
 * Every clip is trimmed, resized to the film size, given the same colour
 * grade (warm, the page's coal black, gentle contrast — see GRADE), and joined
 * to the next one with a short dissolve. The film is then written as single
 * WebP frames, packed into a few files, in two sizes:
 *
 *   public/video/pizza-film/desktop/*.bin   832×624
 *   public/video/pizza-film/mobile/*.bin    576×432
 *   public/video/pizza-film/{desktop,mobile}.webp   poster (first frame)
 *   src/data/pizza.film.json                sizes, packs, where each clip sits
 *
 * Pack «k» holds every 8th frame of the whole film: it loads first, so the
 * film can be scrubbed end to end almost at once; the other packs fill in the
 * frames in between (see src/components/ScrollFilm/ScrollFilm.jsx).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'film');
const OUT = path.join(ROOT, 'public/video/pizza-film');
const plan = JSON.parse(readFileSync(path.join(SRC, 'shots.json'), 'utf8'));

const FPS = plan.local?.fps ?? 16; // Wan 2.2 renders at 16 fps
const DISSOLVE = Math.max(0, Math.round((plan.dissolve ?? 0.375) * FPS)); // in frames
const KEY_EVERY = 8; // pack «k»: every 8th frame
const PACK = 48; // frames per pack after that
const VARIANTS = {
  desktop: { width: 832, height: 624, quality: 72 },
  mobile: { width: 576, height: 432, quality: 64 },
};
const [WIDTH, HEIGHT] = [VARIANTS.desktop.width, VARIANTS.desktop.height];

/**
 * One grade for every clip: blacks lifted to the page's coal (#0B0907),
 * highlights warmed toward the logo's parchment, a gentle S-curve, slightly
 * less saturation and greens pushed toward olive. `grade` in shots.json adds
 * a per-clip correction before it (e.g. the oven clip's cool shadows).
 */
const GRADE = [
  "curves=interp=pchip:r='0/0.043 0.25/0.235 0.5/0.52 0.75/0.79 1/1':g='0/0.035 0.25/0.22 0.5/0.5 0.75/0.765 1/0.975':b='0/0.027 0.25/0.2 0.5/0.46 0.75/0.72 1/0.92'",
  'eq=saturation=0.9',
  "selectivecolor=correction_method=relative:greens='0 0.08 0.06 0'",
].join(',');

const run = (args, opts) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit', ...opts });

const clips = plan.shots
  .map((s) => ({ ...s, path: path.join(SRC, s.file) }))
  .filter((s) => {
    if (existsSync(s.path)) return true;
    console.warn(`(missing, left out) film/${s.file}`);
    return false;
  });
if (!clips.length) throw new Error('No clips in /film');

/** The filter that turns input `i` into a graded, trimmed clip at the film size. */
function clipFilter(c, i) {
  const trim = c.trim ? `trim=start=${c.trim[0]}:end=${c.trim[1]},` : '';
  const fit = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH}:${HEIGHT},setsar=1`;
  return `[${i}:v]${trim}setpts=PTS-STARTPTS,fps=${FPS},${fit},${c.grade ? c.grade + ',' : ''}${GRADE},format=yuv420p,settb=1/${FPS}`;
}

/** Exact number of frames a clip has after trim + resample. */
function frameCount(c) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', c.path, '-filter_complex', clipFilter(c, 0) + '[v]', '-map', '[v]', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...r.stderr.matchAll(/frame=\s*(\d+)/g)].pop();
  if (!m) throw new Error(`Could not read ${c.file}:\n${r.stderr.slice(-800)}`);
  return Number(m[1]);
}

// ── Timing: clip i starts where the previous one's dissolve begins ──────
let cursor = 0;
for (const [i, c] of clips.entries()) {
  c.frames = frameCount(c);
  c.start = i === 0 ? 0 : cursor - DISSOLVE;
  cursor = c.start + c.frames;
}
const FRAMES = cursor;
const timing = {};
for (const [i, c] of clips.entries()) {
  // the scroll hands over from one clip to the next in the middle of their dissolve
  const from = i === 0 ? 0 : c.start + DISSOLVE / 2;
  const to = i === clips.length - 1 ? FRAMES : clips[i + 1].start + DISSOLVE / 2;
  timing[c.id] = { from: +(from / FPS).toFixed(4), to: +(to / FPS).toFixed(4) };
  console.log(`${c.id.padEnd(8)} ${String(c.frames).padStart(4)} frames  ${timing[c.id].from.toFixed(2)}–${timing[c.id].to.toFixed(2)} s`);
}

// ── Master: all clips graded and dissolved into one lossless file ───────
const work = mkdtempSync(path.join(tmpdir(), 'pizza-film-'));
const master = path.join(work, 'master.mkv');
{
  const parts = clips.map((c, i) => `${clipFilter(c, i)}[c${i}]`);
  let last = 'c0';
  for (let i = 1; i < clips.length; i++) {
    const out = i === clips.length - 1 ? 'out' : `x${i}`;
    parts.push(
      DISSOLVE
        ? `[${last}][c${i}]xfade=transition=fade:duration=${DISSOLVE / FPS}:offset=${clips[i].start / FPS}[${out}]`
        : `[${last}][c${i}]concat=n=2:v=1:a=0[${out}]`,
    );
    last = out;
  }
  if (clips.length === 1) parts.push('[c0]null[out]');
  run([...clips.flatMap((c) => ['-i', c.path]), '-filter_complex', parts.join(';'), '-map', '[out]', '-an', '-c:v', 'ffv1', '-level', '3', master]);
}

// ── Frames → WebP → packs, per size ──────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
const variants = {};
let totalBytes = 0;
for (const [name, v] of Object.entries(VARIANTS)) {
  const dir = path.join(work, name);
  mkdirSync(dir, { recursive: true });
  run([
    '-i', master, '-vf', `scale=${v.width}:${v.height}:flags=lanczos`,
    '-c:v', 'libwebp', '-quality', String(v.quality), '-compression_level', '6', '-preset', 'photo',
    '-start_number', '0', path.join(dir, '%04d.webp'),
  ]);
  const files = readdirSync(dir).filter((f) => f.endsWith('.webp')).sort();
  if (files.length !== FRAMES) console.warn(`${name}: ${files.length} frames written, expected ${FRAMES}`);

  const outDir = path.join(OUT, name);
  mkdirSync(outDir, { recursive: true });
  const groups = [{ id: 'k', frames: files.map((_, i) => i).filter((i) => i % KEY_EVERY === 0) }];
  const rest = files.map((_, i) => i).filter((i) => i % KEY_EVERY !== 0);
  for (let i = 0; i < rest.length; i += PACK) groups.push({ id: String(groups.length - 1).padStart(2, '0'), frames: rest.slice(i, i + PACK) });

  const packs = groups.map((g) => {
    const bufs = g.frames.map((i) => readFileSync(path.join(dir, files[i])));
    const file = path.join(outDir, `${g.id}.bin`);
    writeFileSync(file, Buffer.concat(bufs));
    return { src: `/video/pizza-film/${name}/${g.id}.bin`, frames: g.frames, sizes: bufs.map((b) => b.length) };
  });
  copyFileSync(path.join(dir, files[0]), path.join(OUT, `${name}.webp`));
  const bytes = packs.reduce((s, p) => s + p.sizes.reduce((a, b) => a + b, 0), 0);
  totalBytes += bytes;
  variants[name] = { width: v.width, height: v.height, poster: `/video/pizza-film/${name}.webp`, bytes, packs };
  console.log(`${name.padEnd(8)} ${v.width}×${v.height}  ${(bytes / 1e6).toFixed(1)} MB in ${packs.length} packs`);
}
rmSync(work, { recursive: true, force: true });

const manifest = {
  kind: 'frames',
  width: WIDTH,
  height: HEIGHT,
  fps: FPS,
  frames: FRAMES,
  duration: +(FRAMES / FPS).toFixed(4),
  keyEvery: KEY_EVERY,
  clips: timing,
  variants,
};
writeFileSync(path.join(ROOT, 'src/data/pizza.film.json'), JSON.stringify(manifest) + '\n');
console.log(`\n${FRAMES} frames, ${(FRAMES / FPS).toFixed(1)} s, ${(totalBytes / 1e6).toFixed(1)} MB in total → public/video/pizza-film/`);
