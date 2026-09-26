/**
 * Your own pizza video → the film scrubbed by the scroll (in place of the AI
 * clips of film.mjs). Run:
 *     npm run film:video
 *
 * The settings are in film/video.json:
 *   source  the video, from the project folder (any format ffmpeg reads)
 *   fps     frames per second of the film — the video's own rate scrubs smoothest
 *   cuts    where each step of PIZZA.film.clips starts, in seconds of the video
 *           (how much scrolling each step gets is set in src/data/story.js)
 *   sizes   frame width per size (the height follows the video's shape) and
 *           WebP quality
 *   frame   how the page frames it (see ScrollFilm.css): `zoom` = its height
 *           on wide screens, in screen heights (1.15 → a little is cut at the
 *           top and bottom, the sides melt into the dark); `portrait` = its
 *           width on phones, in screen widths
 *
 * The video is used as it is (no colour grade), only resized. Kept light:
 * ffmpeg on 2 threads (FILM_THREADS) at below-normal priority, no GPU.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ffmpeg, writeFilm } from './film-shared.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const plan = JSON.parse(readFileSync(path.join(ROOT, 'film/video.json'), 'utf8'));
const SOURCE = path.join(ROOT, plan.source);
const FPS = plan.fps ?? 24;
const THREADS = Number(process.env.FILM_THREADS) || 2;
const limit = ['-threads', String(THREADS), '-filter_threads', String(THREADS)];

// ffmpeg, started from here, inherits the lower priority
try {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  // not allowed here: run at normal priority
}

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const probe = (args) => spawnSync(ffmpeg, ['-hide_banner', ...args], { encoding: 'utf8' }).stderr;

// ── The video's shape → the frame sizes ──────────────────────────────
const shape = probe(['-i', SOURCE]).match(/Video:.*?, (\d{2,5})x(\d{2,5})[,\s]/);
if (!shape) throw new Error(`Could not read the video: ${plan.source}`);
const aspect = Number(shape[1]) / Number(shape[2]);
const even = (n) => Math.round(n / 2) * 2;
const variants = Object.fromEntries(
  Object.entries(plan.sizes).map(([name, v]) => [name, { width: v.width, height: even(v.width / aspect), quality: v.quality }]),
);
const [W, H] = Object.values(variants).reduce((a, v) => (v.width > a[0] ? [v.width, v.height] : a), [0, 0]);

// ── Master: the video at the largest size, lossless ─────────────────────
const work = mkdtempSync(path.join(os.tmpdir(), 'pizza-video-'));
const master = path.join(work, 'master.mkv');
run([...limit, '-i', SOURCE, '-vf', `fps=${FPS},scale=${W}:${H}:flags=lanczos,setsar=1,format=yuv420p`, '-an', '-c:v', 'ffv1', '-level', '3', master]);
const counted = [...probe([...limit, '-i', master, '-map', '0:v', '-f', 'null', '-']).matchAll(/frame=\s*(\d+)/g)].pop();
if (!counted) throw new Error('Could not count the frames of the video');
const frames = Number(counted[1]);

// ── Where each step sits in the video ───────────────────────────────────
const cuts = Object.entries(plan.cuts).sort((a, b) => a[1] - b[1]);
const clips = {};
cuts.forEach(([id, t], i) => {
  const from = Math.round(t * FPS);
  const to = i === cuts.length - 1 ? frames : Math.round(cuts[i + 1][1] * FPS);
  clips[id] = { from: +(from / FPS).toFixed(4), to: +(to / FPS).toFixed(4) };
  console.log(`${id.padEnd(8)} ${String(to - from).padStart(4)} frames  ${clips[id].from.toFixed(2)}–${clips[id].to.toFixed(2)} s`);
});

writeFilm({ root: ROOT, master, frames, fps: FPS, variants, clips, frame: plan.frame, threads: THREADS });
rmSync(work, { recursive: true, force: true });
