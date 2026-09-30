// Originals stay in photo/place. Run: npm run place:video
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public/video/place');
mkdirSync(output, { recursive: true });
const clips = [
  { id: 'terrace', source: 'خارج المحل الجلسة الخارجية.mp4', poster: 1 },
  { id: 'olive', source: 'خارج المحل الجلسة الخارجية تفاصيل المحل والزيتون.mp4', poster: 1 },
  { id: 'interior', source: 'video_inside.mp4', poster: 4.8 },
  { id: 'oven', source: 'الفرن.mp4', poster: 4.5 },
];
for (const clip of clips) {
  const input = path.join(root, 'photo/place', clip.source);
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-map', '0:v:0', '-an', '-vf', 'fps=24,setsar=1',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
    '-pix_fmt', 'yuv420p', '-g', '6', '-keyint_min', '6', '-sc_threshold', '0',
    '-movflags', '+faststart', path.join(output, `${clip.id}.mp4`),
  ], { stdio: 'inherit' });
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-ss', String(clip.poster), '-i', input,
    '-frames:v', '1', '-c:v', 'libwebp', '-quality', '85', path.join(output, `${clip.id}.webp`),
  ], { stdio: 'inherit' });
  console.log(`Prepared ${clip.id}`);
}
