/**
 * Generates the pizza-film clips on THIS computer's NVIDIA GPU, with ComfyUI
 * running Wan 2.2 A14B image-to-video (GGUF) — the same model, LoRA, steps and
 * size as the Hugging Face Space used by `npm run film:generate`.
 *
 *     npm run film:generate:local                        # all missing clips
 *     npm run film:generate:local -- sauce               # (re)make these ids
 *     npm run film:generate:local -- sauce --seed 4551   # …with another seed
 *     npm run film:generate:local -- sauce --nag         # …with the negative prompt on (≈2× slower)
 *     npm run film:generate:local -- --keys              # only write the prepared start frames
 *
 * Reads film/shots.json: `local` = the recipe and model files, per shot
 * `start` (+ `crop` [x, y, w, h] in source pixels, `focus` = a soft lens blur
 * outside an ellipse) or `startFromLastFrameOf`, `prompt` + `details` + the
 * shared `style` (or the shot's own), `seconds`, `seed`.
 *
 * Needs ComfyUI (Windows portable) with ComfyUI-GGUF and the model files in
 * its models/ folders; COMFYUI_DIR overrides `local.comfyui`. It is started
 * (and stopped again) when it is not already running on 127.0.0.1:8188.
 *
 * Every take is kept in film/takes/ (ignored by git) with an 8-frame contact
 * sheet; the newest take becomes film/<file>. Times go to film/renders.json.
 */
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ROOT = path.resolve(import.meta.dirname, '..');
const FILM = path.join(ROOT, 'film');
const TAKES = path.join(FILM, 'takes');
const plan = JSON.parse(readFileSync(path.join(FILM, 'shots.json'), 'utf8'));
const L = plan.local;
const COMFY_DIR = process.env.COMFYUI_DIR || L.comfyui;
const HOST = 'http://127.0.0.1:8188';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').match(/^--(seed)$/));
const seedOverride = option('seed') ? Number(option('seed')) : undefined;

mkdirSync(TAKES, { recursive: true });

/* ───────────────────────── start frames ───────────────────────── */

/** Last frame of a clip, as PNG bytes (start of a chained shot). */
function lastFrame(clip) {
  return execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-sseof', '-0.2', '-i', clip, '-update', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], {
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * The start frame at the render size: cropped (tighter, macro-like framing),
 * then softly blurred outside the `focus` ellipse so a mismatched background
 * melts into bokeh. Returns PNG bytes.
 */
async function startFrame(shot) {
  const W = L.width;
  const H = L.height;
  const src = shot.startFromLastFrameOf ? lastFrame(path.join(FILM, shot.startFromLastFrameOf)) : readFileSync(path.join(FILM, shot.start));
  let img = sharp(src);
  if (shot.crop) {
    const [left, top, width, height] = shot.crop;
    img = img.extract({ left, top, width, height });
  }
  const base = await img.resize(W, H, { fit: 'cover', kernel: 'lanczos3' }).removeAlpha().png().toBuffer();
  if (!shot.focus) return base;

  // alpha = 1 inside the ellipse, easing to 0 outside it (smoothstep)
  const { x, y, rx, ry, blur, feather = 0.35 } = shot.focus;
  const mask = Buffer.alloc(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const d = Math.hypot((i / W - x) / rx, (j / H - y) / ry);
      const t = Math.min(1, Math.max(0, (1 + feather - d) / (2 * feather)));
      mask[j * W + i] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  const sharpPart = await sharp(base)
    .joinChannel(mask, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toBuffer();
  return sharp(base).blur(blur).composite([{ input: sharpPart }]).png().toBuffer();
}

/* ───────────────────────── ComfyUI ───────────────────────── */

const up = () =>
  fetch(`${HOST}/system_stats`)
    .then((r) => r.ok)
    .catch(() => false);

let server = null;
async function ensureServer() {
  if (await up()) return;
  const logFile = path.join(path.dirname(COMFY_DIR), 'logs', 'comfyui.log');
  mkdirSync(path.dirname(logFile), { recursive: true });
  console.log(`Starting ComfyUI (log: ${logFile}) …`);
  const out = openSync(logFile, 'a');
  server = spawn(
    path.join(COMFY_DIR, 'python_embeded', 'python.exe'),
    // --disable-pinned-memory: pinned RAM cannot be paged out, and with 16 GB of RAM the two
    // 10.8 GB experts already push Windows into the pagefile; it does not change the result
    ['-u', '-s', 'ComfyUI/main.py', '--windows-standalone-build', '--listen', '127.0.0.1', '--port', '8188', '--disable-auto-launch', '--reserve-vram', '1', '--disable-pinned-memory'],
    { cwd: COMFY_DIR, stdio: ['ignore', out, out], env: { ...process.env, PYTHONUNBUFFERED: '1' } },
  );
  for (let i = 0; i < 180; i++) {
    if (await up()) return;
    if (server.exitCode !== null) throw new Error(`ComfyUI exited (code ${server.exitCode}); see ${logFile}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('ComfyUI did not start within 3 minutes');
}

async function upload(png, name) {
  const form = new FormData();
  form.append('image', new Blob([png], { type: 'image/png' }), name);
  form.append('overwrite', 'true');
  const r = await fetch(`${HOST}/upload/image`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`upload failed: ${r.status} ${await r.text()}`);
  return (await r.json()).name;
}

/** The Wan 2.2 A14B I2V graph: high-noise expert for the first steps, low-noise for the rest. */
function graph({ image, prompt, negative, frames, seed, prefix, nag }) {
  const g = {
    high: { class_type: 'UnetLoaderGGUF', inputs: { unet_name: L.high } },
    low: { class_type: 'UnetLoaderGGUF', inputs: { unet_name: L.low } },
    highLora: { class_type: 'LoraLoaderModelOnly', inputs: { model: ['high', 0], lora_name: L.lora, strength_model: L.loraHigh } },
    lowLora: { class_type: 'LoraLoaderModelOnly', inputs: { model: ['low', 0], lora_name: L.lora, strength_model: L.loraLow } },
    highModel: { class_type: 'ModelSamplingSD3', inputs: { model: ['highLora', 0], shift: L.shift } },
    lowModel: { class_type: 'ModelSamplingSD3', inputs: { model: ['lowLora', 0], shift: L.shift } },
    clip: { class_type: 'CLIPLoader', inputs: { clip_name: L.textEncoder, type: 'wan' } },
    pos: { class_type: 'CLIPTextEncode', inputs: { clip: ['clip', 0], text: prompt } },
    neg: { class_type: 'CLIPTextEncode', inputs: { clip: ['clip', 0], text: negative } },
    vae: { class_type: 'VAELoader', inputs: { vae_name: L.vae } },
    image: { class_type: 'LoadImage', inputs: { image } },
    i2v: {
      class_type: 'WanImageToVideo',
      inputs: { positive: ['pos', 0], negative: ['neg', 0], vae: ['vae', 0], start_image: ['image', 0], width: L.width, height: L.height, length: frames, batch_size: 1 },
    },
    sampleHigh: {
      class_type: 'KSamplerAdvanced',
      inputs: {
        model: [nag ? 'highNag' : 'highModel', 0],
        add_noise: 'enable',
        noise_seed: seed,
        steps: L.steps,
        cfg: L.cfg,
        sampler_name: L.sampler,
        scheduler: L.scheduler,
        positive: ['i2v', 0],
        negative: ['i2v', 1],
        latent_image: ['i2v', 2],
        start_at_step: 0,
        end_at_step: L.highSteps,
        return_with_leftover_noise: 'enable',
      },
    },
    sampleLow: {
      class_type: 'KSamplerAdvanced',
      inputs: {
        model: [nag ? 'lowNag' : 'lowModel', 0],
        add_noise: 'disable',
        noise_seed: seed,
        steps: L.steps,
        cfg: L.cfg,
        sampler_name: L.sampler,
        scheduler: L.scheduler,
        positive: ['i2v', 0],
        negative: ['i2v', 1],
        latent_image: ['sampleHigh', 0],
        start_at_step: L.highSteps,
        end_at_step: 10000,
        return_with_leftover_noise: 'disable',
      },
    },
    decode: { class_type: 'VAEDecodeTiled', inputs: { samples: ['sampleLow', 0], vae: ['vae', 0], tile_size: 512, overlap: 64, temporal_size: 64, temporal_overlap: 8 } },
    save: { class_type: 'SaveImage', inputs: { images: ['decode', 0], filename_prefix: prefix } },
  };
  if (nag) {
    g.highNag = { class_type: 'NAGuidance', inputs: { model: ['highModel', 0], nag_scale: 5, nag_alpha: 0.5, nag_tau: 1.5 } };
    g.lowNag = { class_type: 'NAGuidance', inputs: { model: ['lowModel', 0], nag_scale: 5, nag_alpha: 0.5, nag_tau: 1.5 } };
  }
  return g;
}

async function run(g) {
  const r = await fetch(`${HOST}/prompt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: g }) });
  const body = await r.json();
  if (!r.ok || body.error) throw new Error(`ComfyUI refused the graph: ${JSON.stringify(body.error || body.node_errors || body).slice(0, 800)}`);
  const id = body.prompt_id;
  const t0 = Date.now();
  let lastLog = 0;
  for (;;) {
    await new Promise((res) => setTimeout(res, 2000));
    const h = await (await fetch(`${HOST}/history/${id}`)).json();
    const job = h[id];
    if (job?.status?.completed) return job;
    if (job?.status?.status_str === 'error') {
      const err = job.status.messages?.find(([k]) => k === 'execution_error')?.[1];
      throw new Error(err ? `${err.node_type}: ${err.exception_message}` : 'generation failed');
    }
    if (Date.now() - lastLog > 60000) {
      lastLog = Date.now();
      process.stdout.write(`${Math.round((Date.now() - t0) / 60000)}m `);
    }
  }
}

/* ───────────────────────── one shot ───────────────────────── */

const renders = existsSync(path.join(FILM, 'renders.json')) ? JSON.parse(readFileSync(path.join(FILM, 'renders.json'), 'utf8')) : [];

function contactSheet(mp4, frames, out) {
  const picks = Array.from({ length: 8 }, (_, i) => Math.round((i * (frames - 1)) / 7));
  const select = picks.map((n) => `eq(n\\,${n})`).join('+');
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', mp4, '-vf', `select='${select}',scale=416:-1,tile=4x2:padding=4`, '-frames:v', '1', '-q:v', '3', out]);
}

async function generate(shot) {
  const seed = seedOverride ?? shot.seed;
  const nag = flag('nag');
  const frames = 1 + Math.min(80, Math.max(8, Math.round(shot.seconds * L.fps))); // like the Space
  const stem = `${shot.file.replace(/\.mp4$/, '')}.s${seed}${nag ? '-nag' : ''}`;
  const start = await startFrame(shot);
  writeFileSync(path.join(TAKES, `${stem}.start.png`), start);

  const prompt = [shot.prompt, shot.details, shot.style || plan.style].filter(Boolean).join(' ');
  const image = await upload(start, `pizza-film-${stem}.png`);
  const prefix = `pizza-film/${stem}-${Date.now()}`;
  const t0 = Date.now();
  const job = await run(graph({ image, prompt, negative: plan.negative, frames, seed, prefix, nag }));
  const seconds = Math.round((Date.now() - t0) / 1000);

  // frames → an almost lossless H.264 master (the film step grades and re-encodes it)
  const pics = Object.values(job.outputs).flatMap((o) => o.images || []);
  if (!pics.length) throw new Error('ComfyUI returned no frames');
  const dir = path.join(COMFY_DIR, 'ComfyUI', 'output', pics[0].subfolder);
  const first = pics[0].filename.match(/^(.*)_(\d{5})_\.png$/); // SaveImage: <prefix>_00001_.png …
  if (!first) throw new Error(`unexpected frame name ${pics[0].filename}`);
  const take = path.join(TAKES, `${stem}.mp4`);
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(L.fps), '-start_number', String(Number(first[2])),
    '-i', path.join(dir, `${first[1]}_%05d_.png`), '-frames:v', String(pics.length),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', take,
  ]);
  for (const p of pics) rmSync(path.join(dir, p.filename), { force: true });
  contactSheet(take, pics.length, path.join(TAKES, `${stem}.jpg`));
  copyFileSync(take, path.join(FILM, shot.file));

  renders.push({ id: shot.id, file: shot.file, seed, nag, frames: pics.length, width: L.width, height: L.height, seconds, date: new Date().toISOString() });
  writeFileSync(path.join(FILM, 'renders.json'), JSON.stringify(renders, null, 2) + '\n');
  return { seconds, frames: pics.length, stem };
}

/* ───────────────────────── main ───────────────────────── */

// ids given → in that order (e.g. a chained shot after the one it starts from); else every missing clip
const makeable = (s) => s && (s.start || s.startFromLastFrameOf);
const todo = only.length
  ? only.map((id) => plan.shots.find((s) => s.id === id)).filter(makeable)
  : plan.shots.filter((s) => makeable(s) && !existsSync(path.join(FILM, s.file)));

if (flag('keys')) {
  for (const shot of todo.filter((s) => s.start)) {
    const out = path.join(TAKES, `${shot.id}.start.png`);
    writeFileSync(out, await startFrame(shot));
    console.log(`${shot.id.padEnd(8)} → ${path.relative(ROOT, out)}`);
  }
  process.exit(0);
}

if (!todo.length) {
  console.log('Nothing to generate (all clips exist). Pass ids to re-make some.');
  process.exit(0);
}

await ensureServer();
let failed = 0;
for (const shot of todo) {
  if (shot.startFromLastFrameOf && !existsSync(path.join(FILM, shot.startFromLastFrameOf))) {
    console.log(`${shot.id.padEnd(8)} skipped: needs film/${shot.startFromLastFrameOf} first`);
    failed++;
    continue;
  }
  process.stdout.write(`${shot.id.padEnd(8)} … `);
  try {
    const { seconds, frames, stem } = await generate(shot);
    console.log(`done in ${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s, ${frames} frames → film/${shot.file} (take ${stem})`);
  } catch (e) {
    failed++;
    console.log('FAILED');
    console.error(`  ${e.message}`);
  }
}
if (server) server.kill();
process.exit(failed ? 1 : 0);
