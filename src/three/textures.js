import * as THREE from 'three';
import { QUALITY } from '../config/quality';
import { rng } from './anim';
import { LAYOUT } from './worldState';

/*
 * Procedural textures, painted on canvases at load time.
 * No image files to download; sizes follow the device tier.
 * Every generator is cached, so calling it twice returns the same texture.
 */

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

const SIZE = () => QUALITY.texture || 1024;

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return [c, c.getContext('2d')];
}

function toTexture(c, { color = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = QUALITY.tier === 'low' ? 2 : 8;
  return t;
}

/** Fine luminance noise (material grain). */
function grain(ctx, w, h, amount, seed = 1) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Clone a texture with its own repeat (shares the image on the GPU). */
export function withRepeat(tex, x, y) {
  const t = tex.clone();
  t.repeat.set(x, y);
  t.needsUpdate = true;
  return t;
}

/* ── Painted white brick (walls) ─────────────────────────────── */
export const brickTextures = () =>
  once('brick', () => {
    const s = SIZE();
    const [c, x] = canvas(s);
    const [b, y] = canvas(s);
    const r = rng(7);
    const rows = 24;
    const cols = 8;
    const bh = s / rows;
    const bw = s / cols;
    const m = Math.max(2, s / 300);
    x.fillStyle = '#cfc6b6';
    x.fillRect(0, 0, s, s);
    y.fillStyle = '#303030';
    y.fillRect(0, 0, s, s);
    for (let row = 0; row < rows; row++) {
      const off = (row % 2) * (bw / 2);
      for (let col = -1; col <= cols; col++) {
        const px = col * bw + off + m / 2;
        const py = row * bh + m / 2;
        const l = 226 + r() * 20;
        x.fillStyle = `rgb(${l},${l - 5 - r() * 4},${l - 14 - r() * 6})`;
        x.fillRect(px, py, bw - m, bh - m);
        const g = 170 + r() * 50;
        y.fillStyle = `rgb(${g},${g},${g})`;
        y.fillRect(px, py, bw - m, bh - m);
      }
    }
    grain(x, s, s, 12, 3);
    grain(y, s, s, 46, 4);
    return { map: toTexture(c), bump: toTexture(b, { color: false }) };
  });

/* ── Patterned cement tile (one tile; tiles form rosettes) ─────── */
export const tileTexture = () =>
  once('tile', () => {
    const s = 256;
    const [c, x] = canvas(s);
    x.fillStyle = '#d9cfbc';
    x.fillRect(0, 0, s, s);
    const corners = [
      [0, 0],
      [s, 0],
      [0, s],
      [s, s],
    ];
    const ring = (rad, color) => {
      x.fillStyle = color;
      for (const [cx, cy] of corners) {
        x.beginPath();
        x.arc(cx, cy, rad, 0, Math.PI * 2);
        x.fill();
      }
    };
    ring(s * 0.34, '#8e8679');
    ring(s * 0.26, '#d9cfbc');
    ring(s * 0.19, '#6a645b');
    ring(s * 0.09, '#c9bea9');
    const diamond = (k, color) => {
      x.fillStyle = color;
      x.beginPath();
      x.moveTo(s / 2, s * (0.5 - k));
      x.lineTo(s * (0.5 + k), s / 2);
      x.lineTo(s / 2, s * (0.5 + k));
      x.lineTo(s * (0.5 - k), s / 2);
      x.closePath();
      x.fill();
    };
    diamond(0.27, '#8e8679');
    diamond(0.2, '#e3dac9');
    diamond(0.08, '#6a645b');
    grain(x, s, s, 16, 9);
    const t = toTexture(c, { wrap: false });
    return t;
  });

/* ── Wood (oak / dark) ─────────────────────────────────────────── */
export const woodTexture = (tone = 'oak') =>
  once(`wood-${tone}`, () => {
    const s = 512;
    const [c, x] = canvas(s);
    const r = rng(tone === 'oak' ? 13 : 17);
    const base = tone === 'dark' ? '#4a2f1d' : tone === 'light' ? '#c79a66' : '#96653c';
    x.fillStyle = base;
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 110; i++) {
      const y0 = r() * s;
      const amp = 1.5 + r() * 6;
      const f = 0.004 + r() * 0.012;
      const dark = r() < 0.62;
      x.strokeStyle = dark ? `rgba(38,20,8,${0.07 + r() * 0.16})` : `rgba(255,222,176,${0.04 + r() * 0.08})`;
      x.lineWidth = 0.5 + r() * 2.4;
      x.beginPath();
      for (let px = 0; px <= s; px += 8) {
        const py = y0 + Math.sin(px * f + i) * amp;
        if (px === 0) x.moveTo(px, py);
        else x.lineTo(px, py);
      }
      x.stroke();
    }
    grain(x, s, s, 10, 21);
    return toTexture(c);
  });

/* ── Marble (counter top) ─────────────────────────────────────── */
export const marbleTexture = () =>
  once('marble', () => {
    const s = 512;
    const [c, x] = canvas(s);
    const r = rng(29);
    x.fillStyle = '#ece8e1';
    x.fillRect(0, 0, s, s);
    // soft grey clouds
    for (let i = 0; i < 26; i++) {
      const cx = r() * s;
      const cy = r() * s;
      const rad = 40 + r() * 140;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, `rgba(150,142,132,${0.04 + r() * 0.06})`);
      g.addColorStop(1, 'rgba(150,142,132,0)');
      x.fillStyle = g;
      x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // wandering veins
    x.shadowColor = 'rgba(90, 80, 70, 0.4)';
    x.shadowBlur = 4;
    for (let i = 0; i < 11; i++) {
      let px = r() * s;
      let py = r() * s;
      let ang = r() * Math.PI * 2;
      x.strokeStyle = `rgba(112, 102, 94, ${0.1 + r() * 0.26})`;
      x.lineWidth = 0.5 + r() * 1.6;
      x.beginPath();
      x.moveTo(px, py);
      for (let k = 0; k < 70; k++) {
        ang += (r() - 0.5) * 0.55;
        px += Math.cos(ang) * 11;
        py += Math.sin(ang) * 11;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    x.shadowBlur = 0;
    grain(x, s, s, 8, 30);
    return toTexture(c);
  });

/* ── Hammered copper (bump) ───────────────────────────────────── */
export const hammeredBump = (seams = 0) =>
  once(`hammer-${seams}`, () => {
    const s = 512;
    const [c, x] = canvas(s);
    const r = rng(5 + seams);
    x.fillStyle = '#808080';
    x.fillRect(0, 0, s, s);
    const cells = 22;
    const step = s / cells;
    for (let j = -1; j <= cells + 1; j++) {
      for (let i = -1; i <= cells; i++) {
        const cx = (i + (j % 2) * 0.5) * step + (r() - 0.5) * step * 0.3;
        const cy = j * step * 0.9 + (r() - 0.5) * step * 0.3;
        const rad = step * (0.55 + r() * 0.2);
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, 'rgba(50,50,50,0.85)');
        g.addColorStop(0.7, 'rgba(128,128,128,0.2)');
        g.addColorStop(1, 'rgba(200,200,200,0)');
        x.fillStyle = g;
        x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }
    }
    if (seams) {
      // vertical seams of the dome panels (U runs around the dome)
      for (let k = 0; k < seams; k++) {
        const px = (k / seams) * s;
        x.fillStyle = 'rgba(20,20,20,0.9)';
        x.fillRect(px - 1.5, 0, 3, s);
        x.fillStyle = 'rgba(230,230,230,0.6)';
        x.fillRect(px + 1.5, 0, 2, s);
      }
    }
    return toTexture(c, { color: false });
  });

/* ── Dough: raw and baked (planar, centre = centre of the pizza) ─ */
export const doughTextures = () =>
  once('dough', () => {
    const s = 512;
    const h = s / 2;
    const r = rng(31);

    const [a, x] = canvas(s);
    let g = x.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, '#f2e2c3');
    g.addColorStop(0.8, '#efddb8');
    g.addColorStop(0.9, '#e9d3a7');
    g.addColorStop(1, '#dfc493');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    // uneven, hand-worked tone
    for (let i = 0; i < 70; i++) {
      const cx = r() * s;
      const cy = r() * s;
      const rad = 18 + r() * 70;
      const bg = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const warm = r() < 0.5;
      bg.addColorStop(0, warm ? `rgba(214,178,120,${0.05 + r() * 0.08})` : `rgba(255,248,232,${0.06 + r() * 0.1})`);
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = bg;
      x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // tiny air bubbles under the skin of the dough
    for (let i = 0; i < 260; i++) {
      const cx = r() * s;
      const cy = r() * s;
      const rad = 1 + r() * r() * 5;
      x.strokeStyle = `rgba(190,150,95,${0.12 + r() * 0.18})`;
      x.lineWidth = 0.8;
      x.beginPath();
      x.arc(cx, cy, rad, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = `rgba(255,250,238,${0.15 + r() * 0.2})`;
      x.beginPath();
      x.arc(cx - rad * 0.3, cy - rad * 0.3, rad * 0.5, 0, Math.PI * 2);
      x.fill();
    }
    // flour: fine dust + a few soft patches
    for (let i = 0; i < 1400; i++) {
      x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.45})`;
      x.beginPath();
      x.arc(r() * s, r() * s, 0.4 + r() * 1.2, 0, Math.PI * 2);
      x.fill();
    }
    for (let i = 0; i < 14; i++) {
      const cx = r() * s;
      const cy = r() * s;
      const rad = 20 + r() * 50;
      const fg = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      fg.addColorStop(0, `rgba(255,255,255,${0.18 + r() * 0.15})`);
      fg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = fg;
      x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    grain(x, s, s, 9, 32);

    const [b, y] = canvas(s);
    g = y.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, '#e9c784');
    g.addColorStop(0.76, '#e3b56d');
    g.addColorStop(0.85, '#d99d50');
    g.addColorStop(0.93, '#bd7a38');
    g.addColorStop(1, '#8c5423');
    y.fillStyle = g;
    y.fillRect(0, 0, s, s);
    // "leopard" spots on the cornicione
    for (let i = 0; i < 300; i++) {
      const ang = r() * Math.PI * 2;
      const rr = h * (0.8 + r() * 0.2);
      const px = h + Math.cos(ang) * rr;
      const py = h + Math.sin(ang) * rr;
      const rad = 1.2 + r() * r() * 10;
      const sg = y.createRadialGradient(px, py, 0, px, py, rad);
      sg.addColorStop(0, 'rgba(30,17,8,0.95)');
      sg.addColorStop(0.6, 'rgba(60,32,14,0.5)');
      sg.addColorStop(1, 'rgba(90,50,20,0)');
      y.fillStyle = sg;
      y.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    // golden blisters
    for (let i = 0; i < 90; i++) {
      const ang = r() * Math.PI * 2;
      const rr = h * (0.84 + r() * 0.12);
      const px = h + Math.cos(ang) * rr;
      const py = h + Math.sin(ang) * rr;
      const rad = 3 + r() * 8;
      const sg = y.createRadialGradient(px, py, 0, px, py, rad);
      sg.addColorStop(0, 'rgba(255,214,140,0.55)');
      sg.addColorStop(1, 'rgba(255,214,140,0)');
      y.fillStyle = sg;
      y.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    grain(y, s, s, 12, 33);

    return { raw: toTexture(a, { wrap: false }), baked: toTexture(b, { wrap: false }) };
  });

/* ── Tomato sauce (with an irregular, hand-spread edge) ───────── */
export const sauceTexture = () =>
  once('sauce', () => {
    const s = 512;
    const h = s / 2;
    const r = rng(41);
    const [c, x] = canvas(s);
    x.beginPath();
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const rr = h * (0.93 + 0.035 * Math.sin(a * 7 + 1) + 0.022 * Math.sin(a * 13 + 2) + r() * 0.012);
      const px = h + Math.cos(a) * rr;
      const py = h + Math.sin(a) * rr;
      if (i === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.closePath();
    const g = x.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, '#96200f');
    g.addColorStop(0.85, '#8a1d0e');
    g.addColorStop(1, '#6f160a');
    x.fillStyle = g;
    x.fill();
    x.save();
    x.clip();
    for (let i = 0; i < 700; i++) {
      x.fillStyle = r() < 0.6 ? `rgba(95,16,8,${0.18 + r() * 0.25})` : `rgba(226,98,60,${0.12 + r() * 0.2})`;
      x.beginPath();
      x.arc(r() * s, r() * s, 0.8 + r() * 3.2, 0, Math.PI * 2);
      x.fill();
    }
    for (let i = 0; i < 70; i++) {
      x.fillStyle = `rgba(48,62,22,${0.5 + r() * 0.4})`;
      x.fillRect(r() * s, r() * s, 1.5 + r() * 2.5, 1 + r() * 1.5);
    }
    x.restore();
    return toTexture(c, { wrap: false });
  });

/**
 * Relief of the spread sauce: the spiral marks left by the back of the ladle,
 * plus crushed-tomato pieces. Same spiral as the sauce reveal (3 turns).
 */
export const sauceBump = () =>
  once('sauce-bump', () => {
    const s = 512;
    const h = s / 2;
    const r = rng(43);
    const [c, x] = canvas(s);
    x.fillStyle = '#808080';
    x.fillRect(0, 0, s, s);
    // ladle marks: a spiral groove with ridges on both sides
    const turns = 3;
    const stroke = (off, color, width) => {
      x.strokeStyle = color;
      x.lineWidth = width;
      x.beginPath();
      for (let k = 0; k <= 900; k++) {
        const t = k / 900;
        const rad = (t + off) * h * 0.98;
        const a = t * turns * Math.PI * 2;
        const px = h + Math.cos(a) * rad;
        const py = h - Math.sin(a) * rad;
        if (k === 0) x.moveTo(px, py);
        else x.lineTo(px, py);
      }
      x.stroke();
    };
    x.filter = 'blur(3px)';
    stroke(0, 'rgba(60,60,60,0.8)', 10);
    stroke(0.045, 'rgba(190,190,190,0.7)', 6);
    stroke(-0.045, 'rgba(180,180,180,0.5)', 5);
    x.filter = 'none';
    // crushed tomato pieces
    for (let i = 0; i < 260; i++) {
      const px = r() * s;
      const py = r() * s;
      const rad = 1.5 + r() * r() * 7;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(235,235,235,0.9)');
      g.addColorStop(1, 'rgba(128,128,128,0)');
      x.fillStyle = g;
      x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    return toTexture(c, { wrap: false, color: false });
  });

/** Finger dents in the pressed dough (bump). */
export const dimpleBump = () =>
  once('dimples', () => {
    const s = 512;
    const h = s / 2;
    const r = rng(19);
    const [c, x] = canvas(s);
    x.fillStyle = '#9a9a9a';
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2;
      const rad = h * 0.62 * Math.sqrt(r());
      const px = h + Math.cos(a) * rad;
      const py = h + Math.sin(a) * rad;
      const w = 9 + r() * 7;
      x.save();
      x.translate(px, py);
      x.rotate(r() * Math.PI);
      x.scale(1, 0.72);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, w);
      g.addColorStop(0, 'rgba(30,30,30,0.9)');
      g.addColorStop(0.65, 'rgba(90,90,90,0.4)');
      g.addColorStop(0.85, 'rgba(200,200,200,0.35)');
      g.addColorStop(1, 'rgba(154,154,154,0)');
      x.fillStyle = g;
      x.fillRect(-w, -w, w * 2, w * 2);
      x.restore();
    }
    return toTexture(c, { wrap: false, color: false });
  });

/** Fresh mozzarella: milky, faintly fibrous surface (bump). */
export const cheeseFiberBump = () =>
  once('cheese-fiber', () => {
    const s = 256;
    const r = rng(23);
    const [c, x] = canvas(s);
    x.fillStyle = '#808080';
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = r() < 0.5 ? `rgba(200,200,200,${0.2 + r() * 0.3})` : `rgba(60,60,60,${0.15 + r() * 0.25})`;
      x.lineWidth = 0.6 + r() * 1.6;
      x.beginPath();
      const y0 = r() * s;
      x.moveTo(-10, y0);
      x.bezierCurveTo(s * 0.3, y0 + (r() - 0.5) * 40, s * 0.7, y0 + (r() - 0.5) * 40, s + 10, y0 + (r() - 0.5) * 20);
      x.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const px = r() * s;
      const py = r() * s;
      const rad = 4 + r() * 12;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(210,210,210,0.4)');
      g.addColorStop(1, 'rgba(128,128,128,0)');
      x.fillStyle = g;
      x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    return toTexture(c, { color: false });
  });

/** Basil leaf: colour (midrib + veins, lighter underside tones) and relief. */
export const basilTextures = () =>
  once('basil', () => {
    const s = 256;
    const [c, x] = canvas(s);
    const [b, y] = canvas(s);
    const g = x.createLinearGradient(0, s, 0, 0);
    g.addColorStop(0, '#1f5a24');
    g.addColorStop(0.5, '#2d7a31');
    g.addColorStop(1, '#3b8f3a');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    y.fillStyle = '#9a9a9a';
    y.fillRect(0, 0, s, s);
    const veins = (ctx, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      // midrib (uv y runs base → tip; canvas y is flipped)
      ctx.beginPath();
      ctx.moveTo(s / 2, s * 0.98);
      ctx.quadraticCurveTo(s / 2 + 3, s / 2, s / 2, s * 0.03);
      ctx.stroke();
      ctx.lineWidth = width * 0.55;
      for (let k = 0; k < 7; k++) {
        const t = 0.15 + k * 0.11;
        const yy = s * (1 - t);
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s / 2, yy);
          ctx.quadraticCurveTo(s / 2 + side * s * 0.2, yy - s * 0.06, s / 2 + side * s * 0.36 * (1 - Math.abs(t - 0.45)), yy - s * 0.14);
          ctx.stroke();
        }
      }
    };
    veins(x, 'rgba(160,210,130,0.55)', 5);
    veins(y, 'rgba(40,40,40,0.9)', 5);
    grain(x, s, s, 8, 5);
    return { map: toTexture(c, { wrap: false }), bump: toTexture(b, { wrap: false, color: false }) };
  });

/** A halved tomato, seen from the cut side. */
export const tomatoCutTexture = () =>
  once('tomato-cut', () => {
    const s = 256;
    const h = s / 2;
    const r = rng(61);
    const [c, x] = canvas(s);
    x.fillStyle = '#b3180d';
    x.beginPath();
    x.arc(h, h, h, 0, Math.PI * 2);
    x.fill();
    // flesh wall
    x.fillStyle = '#d8331e';
    x.beginPath();
    x.arc(h, h, h * 0.9, 0, Math.PI * 2);
    x.fill();
    // locules with jelly and seeds
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      const cx = h + Math.cos(a) * h * 0.46;
      const cy = h + Math.sin(a) * h * 0.46;
      x.fillStyle = '#e8743d';
      x.beginPath();
      x.ellipse(cx, cy, h * 0.3, h * 0.2, a, 0, Math.PI * 2);
      x.fill();
      for (let i = 0; i < 9; i++) {
        x.fillStyle = '#f2d27a';
        x.beginPath();
        x.ellipse(cx + (r() - 0.5) * h * 0.34, cy + (r() - 0.5) * h * 0.22, 3.2, 2, r() * Math.PI, 0, Math.PI * 2);
        x.fill();
      }
    }
    // core
    x.fillStyle = '#f07a52';
    x.beginPath();
    x.arc(h, h, h * 0.16, 0, Math.PI * 2);
    x.fill();
    grain(x, s, s, 10, 6);
    return toTexture(c, { wrap: false });
  });

/** Grater plate: perforation pattern (alpha: white = metal, black = hole). */
export const graterAlpha = () =>
  once('grater', () => {
    const w = 512;
    const hgt = 128;
    const [c, x] = canvas(w, hgt);
    x.fillStyle = '#fff';
    x.fillRect(0, 0, w, hgt);
    x.fillStyle = '#000';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 26; col++) {
        const px = 24 + col * 18 + (row % 2) * 9;
        const py = 20 + row * 22;
        x.beginPath();
        x.ellipse(px, py, 5.5, 3.2, 0, 0, Math.PI * 2);
        x.fill();
      }
    }
    return toTexture(c, { wrap: false, color: false });
  });

/* ── Soft sprites ─────────────────────────────────────────────── */
export const glowTexture = () =>
  once('glow', () => {
    const s = 128;
    const [c, x] = canvas(s);
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    return toTexture(c, { wrap: false });
  });

export const shadowTexture = () =>
  once('shadow', () => {
    const s = 128;
    const [c, x] = canvas(s);
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    return toTexture(c, { wrap: false, color: false });
  });

/* ── The golden floor plan (drawn to the real layout) ─────────── */
export const blueprintTexture = () =>
  once('plan', () => {
    const ppm = QUALITY.tier === 'low' ? 56 : 90;
    const { width: W, depth: D, backZ, leftX } = LAYOUT.room;
    const [c, x] = canvas(W * ppm, D * ppm);
    const X = (m) => (m - leftX) * ppm;
    const Z = (m) => (m - backZ) * ppm;

    const lines = (step, color, width) => {
      x.strokeStyle = color;
      x.lineWidth = width;
      x.beginPath();
      for (let m = 0; m <= W + 0.001; m += step) {
        x.moveTo(m * ppm, 0);
        x.lineTo(m * ppm, D * ppm);
      }
      for (let m = 0; m <= D + 0.001; m += step) {
        x.moveTo(0, m * ppm);
        x.lineTo(W * ppm, m * ppm);
      }
      x.stroke();
    };
    lines(0.5, 'rgba(232,180,100,0.16)', 1);
    lines(2, 'rgba(232,180,100,0.34)', 1.5);

    x.strokeStyle = 'rgba(255,208,135,0.95)';
    x.lineWidth = 3;
    x.strokeRect(2, 2, W * ppm - 4, D * ppm - 4);

    const O = LAYOUT.oven;
    x.beginPath();
    x.arc(X(O.x), Z(O.z), O.radius * ppm, 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([8, 8]);
    x.beginPath();
    x.arc(X(O.x), Z(O.z), (O.radius + 0.35) * ppm, 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([]);

    const C = LAYOUT.counter;
    x.strokeRect(X(C.x - C.width / 2), Z(C.z - C.depth / 2), C.width * ppm, C.depth * ppm);

    for (const t of LAYOUT.tables) {
      x.beginPath();
      x.arc(X(t.x), Z(t.z), 0.42 * ppm, 0, Math.PI * 2);
      x.stroke();
      for (let k = 0; k < t.chairs; k++) {
        const a = t.rot + (k / t.chairs) * Math.PI * 2;
        const cx = X(t.x + Math.cos(a) * 0.72);
        const cz = Z(t.z + Math.sin(a) * 0.72);
        x.strokeRect(cx - 0.21 * ppm, cz - 0.21 * ppm, 0.42 * ppm, 0.42 * ppm);
      }
    }

    // tick marks along the walls, like an architect's drawing
    x.lineWidth = 2;
    for (let m = 0; m <= W; m += 1) {
      x.beginPath();
      x.moveTo(m * ppm, 0);
      x.lineTo(m * ppm, 14);
      x.stroke();
    }
    return toTexture(c, { wrap: false });
  });
