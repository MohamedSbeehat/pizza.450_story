// Helpers that turn the real pizza photo into what the 3D pizza needs.
//
//   cleanToppings()  removes the basil and the grated-cheese pile from the
//                    top view (they are added live in 3D after the oven)
//   findCheese()     finds where the melted mozzarella is, so the 3D torn
//                    pieces can land exactly there and melt into the photo
import sharp from 'sharp';

/**
 * Fills masked pixels from their surroundings (multi-resolution diffusion):
 * coarse levels give the overall colour, fine levels blend the edges.
 * data: Float32Array RGB (w*h*3), mask: Uint8Array (1 = fill).
 */
function inpaint(data, mask, w, h) {
  const iterate = (d, m, W, H, n) => {
    for (let k = 0; k < n; k++) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (!m[i]) continue;
          let r = 0,
            g = 0,
            b = 0,
            c = 0;
          const add = (j) => {
            r += d[j * 3];
            g += d[j * 3 + 1];
            b += d[j * 3 + 2];
            c++;
          };
          if (x > 0) add(i - 1);
          if (x < W - 1) add(i + 1);
          if (y > 0) add(i - W);
          if (y < H - 1) add(i + W);
          d[i * 3] = r / c;
          d[i * 3 + 1] = g / c;
          d[i * 3 + 2] = b / c;
        }
      }
    }
  };

  if (w <= 32 || h <= 32) {
    // coarsest level: start from the mean of the known pixels
    let r = 0,
      g = 0,
      b = 0,
      c = 0;
    for (let i = 0; i < w * h; i++) {
      if (mask[i]) continue;
      r += data[i * 3];
      g += data[i * 3 + 1];
      b += data[i * 3 + 2];
      c++;
    }
    for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue;
      data[i * 3] = r / Math.max(1, c);
      data[i * 3 + 1] = g / Math.max(1, c);
      data[i * 3 + 2] = b / Math.max(1, c);
    }
    iterate(data, mask, w, h, 300);
    return;
  }

  // downsample (known pixels only)
  const w2 = w >> 1;
  const h2 = h >> 1;
  const small = new Float32Array(w2 * h2 * 3);
  const smallMask = new Uint8Array(w2 * h2);
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      let r = 0,
        g = 0,
        b = 0,
        c = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = (y * 2 + dy) * w + x * 2 + dx;
          if (mask[i]) continue;
          r += data[i * 3];
          g += data[i * 3 + 1];
          b += data[i * 3 + 2];
          c++;
        }
      }
      const j = y * w2 + x;
      if (c) {
        small[j * 3] = r / c;
        small[j * 3 + 1] = g / c;
        small[j * 3 + 2] = b / c;
      } else smallMask[j] = 1;
    }
  }
  inpaint(small, smallMask, w2, h2);
  // upsample into the holes, then smooth at this level
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const j = Math.min(h2 - 1, y >> 1) * w2 + Math.min(w2 - 1, x >> 1);
      data[i * 3] = small[j * 3];
      data[i * 3 + 1] = small[j * 3 + 1];
      data[i * 3 + 2] = small[j * 3 + 2];
    }
  }
  iterate(data, mask, w, h, 40);
}

/**
 * Removes basil leaves (green pixels) and the grated-cheese pile (a disc
 * given in `pile`, fractions of the image) from a square RGB buffer.
 */
export async function cleanToppings(square, size, pile) {
  const { data } = await sharp(square).raw().toBuffer({ resolveWithObject: true });
  const n = size * size;
  const img = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) img[i] = data[i];

  // 1. basil: strongly green pixels, grown by a few pixels
  const leaf = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    if (g >= r * 1.02 && g > b * 1.18 && g > 30) leaf[i] = 1;
  }
  const mask = new Uint8Array(n);
  const grow = Math.round(size * 0.013);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!leaf[y * size + x]) continue;
      for (let dy = -grow; dy <= grow; dy++) {
        for (let dx = -grow; dx <= grow; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < size && yy < size && dx * dx + dy * dy <= grow * grow) mask[yy * size + xx] = 1;
        }
      }
    }
  }
  // 2. grated-cheese pile
  if (pile) {
    const px = pile.x * size;
    const py = pile.y * size;
    const pr = pile.r * size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if ((x - px) ** 2 + (y - py) ** 2 <= pr * pr) mask[y * size + x] = 1;
      }
    }
  }

  inpaint(img, mask, size, size);

  // a little grain in the filled areas so they don't look airbrushed
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  const out = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    const noise = mask[i] ? rand() * 10 : 0;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.max(0, Math.min(255, Math.round(img[i * 3 + c] + noise)));
  }
  return sharp(out, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}

/**
 * Finds melted-mozzarella areas (bright, low-saturation pixels inside the
 * sauce area) and returns blobs in pizza units: x/z in −1…1 (image right /
 * down), r = radius. Greedy: densest area first, then its neighbourhood is
 * excluded.
 */
export async function findCheese(square, { edge = 0.968, max = 32, pile = null } = {}) {
  const N = 128;
  const { data } = await sharp(square).resize(N, N).raw().toBuffer({ resolveWithObject: true });
  const cheese = new Float32Array(N * N);
  const R = (N / 2) * edge;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - N / 2;
      const dy = y + 0.5 - N / 2;
      if (Math.hypot(dx, dy) > R * 0.8) continue; // skip the crust
      if (pile && Math.hypot(x / N - pile.x, y / N - pile.y) < pile.r) continue;
      const i = (y * N + x) * 3;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = mx > 0 ? (mx - mn) / mx : 0;
      if (lum > 0.6 && sat < 0.5) cheese[y * N + x] = 1;
    }
  }
  // density over a 7×7 window
  const K = 3;
  const dens = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (let dy = -K; dy <= K; dy++) {
        for (let dx = -K; dx <= K; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < N && yy < N) s += cheese[yy * N + xx];
        }
      }
      dens[y * N + x] = s / ((2 * K + 1) ** 2);
    }
  }
  const blobs = [];
  const taken = new Uint8Array(N * N);
  while (blobs.length < max) {
    let best = -1;
    let bestD = 0.25;
    for (let i = 0; i < N * N; i++) {
      if (!taken[i] && dens[i] > bestD) {
        bestD = dens[i];
        best = i;
      }
    }
    if (best < 0) break;
    const bx = best % N;
    const by = Math.floor(best / N);
    const r = 0.06 + 0.075 * bestD; // pizza units
    blobs.push({
      x: +(((bx + 0.5) / N - 0.5) * 2).toFixed(3),
      z: +(((by + 0.5) / N - 0.5) * 2).toFixed(3),
      r: +r.toFixed(3),
    });
    const excl = (r * 1.35 * N) / 2;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if ((x - bx) ** 2 + (y - by) ** 2 <= excl * excl) taken[y * N + x] = 1;
      }
    }
  }
  return blobs;
}
