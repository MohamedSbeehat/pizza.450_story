/**
 * Generates the pizza-film clips on hosted cloud GPUs (a Hugging Face Space
 * running Wan 2.2 image-to-video). Nothing runs on the local GPU: this script
 * only prepares and uploads the start frames and downloads the finished clips.
 *
 *     HF_TOKEN=hf_... npm run film:generate            # all missing clips
 *     HF_TOKEN=hf_... npm run film:generate -- sauce   # only these ids (re-made)
 *
 * Shots, prompts and start frames: film/shots.json and film/keys/ — prepared
 * exactly like film-generate-local.mjs (film-shared.mjs). Clips are written
 * to film/<file>; existing ones are skipped unless their id is passed; times
 * go to film/renders.json. Then run `npm run film` to build the site video.
 * Without HF_TOKEN the small anonymous daily GPU quota is used.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Client, handle_file } from '@gradio/client';
import { promptOf, startFrame } from './film-shared.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILM = path.join(ROOT, 'film');
const plan = JSON.parse(readFileSync(path.join(FILM, 'shots.json'), 'utf8'));
const { width: W, height: H } = plan.local;
const only = process.argv.slice(2);

const token = process.env.HF_TOKEN;
if (!token) console.warn('HF_TOKEN is not set: using the small anonymous GPU quota.');
const client = await Client.connect(plan.space, token ? { token } : {});

const rendersFile = path.join(FILM, 'renders.json');
const renders = existsSync(rendersFile) ? JSON.parse(readFileSync(rendersFile, 'utf8')) : [];

async function generate(shot) {
  const start = await startFrame(shot, FILM, W, H);
  const t0 = Date.now();
  const job = client.submit('/generate_video', {
    input_image: handle_file(new Blob([start], { type: 'image/png' })),
    prompt: promptOf(shot, plan),
    steps: plan.local.steps,
    negative_prompt: plan.negative,
    duration_seconds: shot.seconds,
    guidance_scale: 1,
    guidance_scale_2: 1,
    seed: shot.seed,
    randomize_seed: false,
  });
  let last = null;
  for await (const m of job) {
    if (process.env.FILM_DEBUG) console.log(JSON.stringify(m).slice(0, 300));
    if (m.type === 'status') last = m;
    if (m.type === 'status' && m.stage === 'error') throw new Error(m.message || 'generation failed');
    if (m.type === 'data') {
      const v = m.data[0];
      const url = v?.video?.url || v?.url;
      const buf = Buffer.from(await (await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : {})).arrayBuffer());
      writeFileSync(path.join(FILM, shot.file), buf);
      const seconds = Math.round((Date.now() - t0) / 1000);
      renders.push({ id: shot.id, file: shot.file, seed: shot.seed, where: 'space', seconds, date: new Date().toISOString() });
      writeFileSync(rendersFile, JSON.stringify(renders, null, 2) + '\n');
      return seconds;
    }
  }
  throw new Error(last?.message || `no result (last status: ${last?.stage || 'none'})`);
}

const makeable = (s) => s && (s.start || s.startFromLastFrameOf);
const todo = only.length
  ? only.map((id) => plan.shots.find((s) => s.id === id)).filter(makeable)
  : plan.shots.filter((s) => makeable(s) && !existsSync(path.join(FILM, s.file)));

for (const shot of todo) {
  if (shot.startFromLastFrameOf && !existsSync(path.join(FILM, shot.startFromLastFrameOf))) {
    console.log(`${shot.id.padEnd(8)} skipped: needs film/${shot.startFromLastFrameOf} first`);
    continue;
  }
  process.stdout.write(`${shot.id.padEnd(8)} … `);
  try {
    const secs = await generate(shot);
    console.log(`done in ${secs} s → film/${shot.file}`);
  } catch (e) {
    console.log('FAILED');
    console.error(`  ${e.message}`);
    if (/quota/i.test(e.message)) {
      console.error('  GPU quota reached. Run again later (it resumes), or use a Hugging Face token.');
      process.exit(2);
    }
  }
}
