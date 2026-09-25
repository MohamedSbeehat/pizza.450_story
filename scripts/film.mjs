/**
 * The pizza film: video clips → one scroll-scrubbed video.
 *
 * Put the clips in /film, named in order, e.g.
 *     film/01-dough.mp4  film/02-sauce.mp4  …  film/06-finish.mp4
 * (the part after the number is the clip id used in PIZZA.film in
 * src/data/story.js), then run:
 *     npm run film
 *
 * Writes:
 *   public/video/pizza-film.mp4    all clips, one after the other (H.264,
 *                                  a keyframe every 4 frames → cheap seeks)
 *   public/video/pizza-film.webp   the first frame (poster)
 *   src/data/pizza.film.json       size, fps and where each clip starts/ends
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import sharp from 'sharp';

// the bundled binary, else FFMPEG_PATH, else ffmpeg from the system
const ffmpeg = process.env.FFMPEG_PATH || (ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg');

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'film');
const OUT = path.join(ROOT, 'public/video');
const NAME = 'pizza-film';
const FPS = 16; // Wan 2.2 renders at 16 fps

const clips = readdirSync(SRC)
  .filter((f) => /\.(mp4|webm|mov)$/i.test(f))
  .sort()
  .map((f) => ({ file: path.join(SRC, f), id: f.replace(/\.[^.]+$/, '').replace(/^\d+[-_ ]*/, '') }));
if (!clips.length) throw new Error(`No clips in ${SRC}`);

/** Pixel size of a clip. */
function sizeOf(file) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = r.stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  if (!m) throw new Error(`Could not read ${file}`);
  return [Number(m[1]), Number(m[2])];
}
// Output size = the first clip's size (or FILM_SIZE=1024x768); the other
// clips are scaled and cropped to fit it.
const [WIDTH, HEIGHT] = process.env.FILM_SIZE ? process.env.FILM_SIZE.split('x').map(Number) : sizeOf(clips[0].file);

/** Exact number of frames a clip has once resampled to FPS. */
function frameCount(file) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-vf', `fps=${FPS}`, '-map', '0:v', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...r.stderr.matchAll(/frame=\s*(\d+)/g)].pop();
  if (!m) throw new Error(`Could not read ${file}`);
  return Number(m[1]);
}

let cursor = 0;
const timing = {};
for (const c of clips) {
  c.frames = frameCount(c.file);
  timing[c.id] = { from: +(cursor / FPS).toFixed(4), to: +((cursor + c.frames) / FPS).toFixed(4) };
  cursor += c.frames;
  console.log(`${c.id.padEnd(10)} ${String(c.frames).padStart(4)} frames`);
}

mkdirSync(OUT, { recursive: true });
const fit = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH}:${HEIGHT},fps=${FPS},setsar=1,format=yuv420p`;
const filter =
  clips.map((c, i) => `[${i}:v]${fit}[v${i}]`).join(';') + ';' + clips.map((c, i) => `[v${i}]`).join('') + `concat=n=${clips.length}:v=1:a=0[out]`;
const mp4 = path.join(OUT, `${NAME}.mp4`);
execFileSync(
  ffmpeg,
  [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...clips.flatMap((c) => ['-i', c.file]),
    '-filter_complex', filter, '-map', '[out]', '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-profile:v', 'high',
    '-g', '4', '-keyint_min', '4', '-sc_threshold', '0', '-bf', '0',
    '-movflags', '+faststart',
    mp4,
  ],
  { stdio: 'inherit' },
);

// poster = first frame
const png = execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', mp4, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], {
  maxBuffer: 64 * 1024 * 1024,
});
await sharp(png).webp({ quality: 80 }).toFile(path.join(OUT, `${NAME}.webp`));

const manifest = {
  src: `/video/${NAME}.mp4`,
  poster: `/video/${NAME}.webp`,
  width: WIDTH,
  height: HEIGHT,
  fps: FPS,
  frames: cursor,
  duration: +(cursor / FPS).toFixed(4),
  clips: timing,
};
writeFileSync(path.join(ROOT, 'src/data/pizza.film.json'), JSON.stringify(manifest, null, 2) + '\n');
const { size } = await import('node:fs').then((fs) => fs.statSync(mp4));
console.log(`\n${cursor} frames, ${(cursor / FPS).toFixed(1)} s, ${(size / 1e6).toFixed(1)} MB → ${path.relative(ROOT, mp4)}`);
