/**
 * Generates the pizza-film clips on hosted cloud GPUs (a Hugging Face Space
 * running Wan 2.2 image-to-video). Nothing runs on the local GPU: this script
 * only uploads the start frames and downloads the finished clips.
 *
 * Meant to run in a Claude cloud session (see README → «فيلم صناعة البيتزا»).
 *
 *     HF_TOKEN=hf_... npm run film:generate            # all missing clips
 *     HF_TOKEN=hf_... npm run film:generate -- sauce   # only these ids (re-made)
 *
 * Shots, prompts and start frames: film/shots.json and film/keys/.
 * Clips are written to film/<NN-id>.mp4; existing ones are skipped unless
 * their id is passed. Then run `npm run film` to build the site video.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client, handle_file } from '@gradio/client';
import ffmpegStatic from 'ffmpeg-static';

const ffmpeg = process.env.FFMPEG_PATH || (ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg');
const ROOT = path.resolve(import.meta.dirname, '..');
const FILM = path.join(ROOT, 'film');
const plan = JSON.parse(readFileSync(path.join(FILM, 'shots.json'), 'utf8'));
const only = process.argv.slice(2);

// The owner's rule: generation happens in the cloud, never on their Windows PC.
if (process.platform === 'win32' && !process.env.FILM_ALLOW_WINDOWS) {
  console.error('This script is meant for the cloud session (Linux). Stopping.');
  process.exit(1);
}

const token = process.env.HF_TOKEN;
if (!token) console.warn('HF_TOKEN is not set: using the small anonymous GPU quota.');
const client = await Client.connect(plan.space, token ? { token } : {});

/** Last frame of a clip, as a PNG file (start of a chained shot). */
function lastFrame(clip) {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'film-')), 'last.png');
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-sseof', '-0.5', '-i', clip, '-update', '1', out]);
  return out;
}

async function generate(shot) {
  const start = shot.startFromLastFrameOf ? lastFrame(path.join(FILM, shot.startFromLastFrameOf)) : path.join(FILM, shot.start);
  const type = start.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const t0 = Date.now();
  const job = client.submit('/generate_video', {
    input_image: handle_file(new Blob([readFileSync(start)], { type })),
    prompt: shot.prompt,
    steps: 6,
    negative_prompt: plan.negative,
    duration_seconds: shot.seconds,
    guidance_scale: 1,
    guidance_scale_2: 1,
    seed: shot.seed,
    randomize_seed: false,
  });
  for await (const m of job) {
    if (m.type === 'status' && m.stage === 'error') throw new Error(m.message || 'generation failed');
    if (m.type === 'data') {
      const v = m.data[0];
      const url = v?.video?.url || v?.url;
      const buf = Buffer.from(await (await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : {})).arrayBuffer());
      writeFileSync(path.join(FILM, shot.file), buf);
      return ((Date.now() - t0) / 1000).toFixed(0);
    }
  }
  throw new Error('no result');
}

for (const shot of plan.shots) {
  if (!shot.prompt) continue; // made elsewhere
  const target = path.join(FILM, shot.file);
  if (only.length ? !only.includes(shot.id) : existsSync(target)) continue;
  process.stdout.write(`${shot.id.padEnd(8)} … `);
  try {
    const secs = await generate(shot);
    console.log(`done in ${secs} s → film/${shot.file}`);
  } catch (e) {
    console.log('FAILED');
    console.error(`  ${e.message}`);
    if (/quota/i.test(e.message)) {
      console.error('  GPU quota reached. Run again later (it resumes), or use a Hugging Face PRO token.');
      process.exit(2);
    }
  }
}
