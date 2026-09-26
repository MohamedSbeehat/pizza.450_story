/**
 * Shared by the two pizza-film generators (film-generate.mjs on the hosted
 * Hugging Face GPU, film-generate-local.mjs on this computer), so a shot is
 * prepared and prompted exactly the same way on both.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import sharp from 'sharp';

// FFMPEG_PATH, else the bundled binary, else ffmpeg from the system
export const ffmpeg = process.env.FFMPEG_PATH || (ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg');

/**
 * «Lights out»: the kitchen goes dark and only a warm golden spotlight stays
 * on the food. `night` = { x, y, rx, ry } the lit ellipse (fractions of the
 * frame), `floor` how much of the dark stays visible (0–1), `feather` the
 * softness of the edge, `glow` the strength of the golden bloom (0–1).
 *
 * Returns a filtergraph fragment from pad [in] to pad [out]; `t` makes its
 * inner pad names unique. The same fragment grades whole clips (film.mjs,
 * shot `night`) and the start frames of the shots that continue them
 * (startFrame, shot `startNight`), so a chained shot starts exactly where the
 * graded one ends.
 */
export function nightFilter(night, W, H, input, output, t = 'n') {
  const { x, y, rx, ry, floor = 0.03, feather = 0.5, glow = 0.4 } = night;
  const lum = `255*(${floor}+(1-${floor})*st(0,clip((1+${feather}-hypot((X/W-${x})/${rx},(Y/H-${y})/${ry}))/(2*${feather}),0,1))*ld(0)*(3-2*ld(0)))`;
  return [
    `[${input}]format=gbrp,` +
      'colorbalance=rs=0.08:gs=0.02:bs=-0.12:rm=0.1:gm=0.03:bm=-0.13:rh=0.07:gh=0.03:bh=-0.1,' +
      `curves=all='0/0 0.3/0.11 0.6/0.44 0.85/0.8 1/0.97'[${t}p]`,
    `color=c=black:s=${W}x${H}:r=16:d=0.0625,format=gray,geq=lum='${lum}',format=gbrp[${t}m]`,
    `[${t}p][${t}m]blend=all_mode=multiply,split[${t}a][${t}b]`,
    `[${t}b]gblur=sigma=${Math.round(W / 52)},curves=all='0/0 0.55/0.04 1/1'[${t}g]`,
    `[${t}a][${t}g]blend=all_mode=screen:all_opacity=${glow}[${output}]`,
  ].join(';');
}

/** A single image (PNG bytes) through nightFilter. */
export function nightImage(png, night, W, H) {
  return execFileSync(
    ffmpeg,
    ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-i', '-', '-filter_complex', nightFilter(night, W, H, '0:v', 'out'), '-map', '[out]', '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
    { input: png, maxBuffer: 64 * 1024 * 1024 },
  );
}

/** The full prompt of a shot: action + real details + the shared (or its own) style. */
export const promptOf = (shot, plan) => [shot.prompt, shot.details, shot.style || plan.style].filter(Boolean).join(' ');

/** Last frame of a clip, as PNG bytes (start of a chained shot). */
export function lastFrame(clip) {
  return execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-sseof', '-0.2', '-i', clip, '-update', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], {
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * The start frame at the render size W×H: cropped (tighter, macro-like
 * framing), then softly blurred outside the `focus` ellipse so a mismatched
 * background melts into bokeh. Returns PNG bytes.
 */
export async function startFrame(shot, filmDir, W, H) {
  const src = shot.startFromLastFrameOf ? lastFrame(path.join(filmDir, shot.startFromLastFrameOf)) : readFileSync(path.join(filmDir, shot.start));
  let img = sharp(src);
  if (shot.crop) {
    const [left, top, width, height] = shot.crop;
    img = img.extract({ left, top, width, height });
  }
  let base = await img.resize(W, H, { fit: 'cover', kernel: 'lanczos3' }).removeAlpha().png().toBuffer();
  if (shot.startNight) base = await sharp(nightImage(base, shot.startNight, W, H)).removeAlpha().png().toBuffer();
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
