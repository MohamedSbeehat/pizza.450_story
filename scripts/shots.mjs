// Film review: renders frames of the story at chosen moments.
// Needs the dev server running (npm run dev).
//
//   node scripts/shots.mjs <outDir> <width>x<height> <moment> <moment> ...
//
// A moment is either a film time in screens ("12.5") or "<scene>@<0-1>",
// e.g. "pizza@0.35" = 35% into the pizza scene. "all" = 3 frames per scene.
// Env: URL (default http://localhost:5173), Q=low|medium|high, WAIT=ms.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const [outDir = 'shots', dims = '1440x810', ...moments] = process.argv.slice(2);
const [w, h] = dims.split('x').map(Number);
const base = process.env.URL || 'http://localhost:5173';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const mobile = w < 820;
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const logs = [];
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(`${base}/?instant&debug&quality=${process.env.Q || (mobile ? 'low' : 'high')}`);
await page.waitForFunction(() => window.__story?.film, null, { timeout: 60000 });
await page.waitForTimeout(1500);

const marks = await page.evaluate(() => window.__story.film.marks);
let list = moments;
if (!list.length || list[0] === 'all') {
  list = Object.keys(marks).flatMap((id) => [`${id}@0.15`, `${id}@0.5`, `${id}@0.85`]);
}

for (const mo of list) {
  let t;
  if (mo.includes('@')) {
    const [id, f] = mo.split('@');
    const m = marks[id];
    if (!m) {
      console.log('unknown scene', id);
      continue;
    }
    t = m.start + (m.end - m.start) * parseFloat(f);
  } else t = parseFloat(mo);
  await page.evaluate((t) => window.__story.seekTime(t, { instant: true }), t);
  await page.waitForTimeout(+process.env.WAIT || 700);
  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const s = performance.now();
        const f = () => {
          n++;
          if (performance.now() - s < 600) requestAnimationFrame(f);
          else res(Math.round((n * 1000) / (performance.now() - s)));
        };
        requestAnimationFrame(f);
      }),
  );
  const name = `${outDir}/${String(t.toFixed(2)).padStart(6, '0')}_${mo.replace(/[@.]/g, '-')}.png`;
  await page.screenshot({ path: name });
  console.log(`${mo.padEnd(18)} t=${t.toFixed(2)}  fps≈${fps}  → ${name}`);
}
if (logs.length) console.log('\nconsole:\n' + [...new Set(logs)].slice(0, 40).join('\n'));
await browser.close();
