/**
 * Plays a film made of single WebP frames on a <canvas>, at whatever frame
 * the scroll asks for — forwards or backwards, at any speed.
 *
 * The frames come packed in a few files (see scripts/film.mjs). Pack «k»
 * (every 8th frame of the whole film) is fetched first, so the film can be
 * scrubbed end to end almost at once; the other packs follow, the one nearest
 * to the playhead first, and fill in the frames in between. Until a frame has
 * arrived the nearest one that has is shown: scrolling never waits.
 *
 * Frames are decoded off the main thread (createImageBitmap) into a small
 * cache around the playhead, so memory stays bounded however long the film.
 */
export function createFramePlayer(canvas, variant, { frames, onFirstFrame, onError, keysOnly = false, cache = 40, parallel = 2 }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.width = variant.width;
  canvas.height = variant.height;

  const blobs = new Array(frames); // frame → Blob (still encoded)
  const bitmaps = new Map(); // frame → ImageBitmap, oldest first (LRU)
  const decoding = new Map(); // frame → Promise
  const queue = variant.packs.slice(1); // packs still to fetch (the first one is «k»)
  let loading = 0;
  let want = 0; // frame the scroll asks for
  let shown = -1; // frame on the canvas
  let dir = 1; // scroll direction, for prefetching
  let dead = false;

  /* ── loading ─────────────────────────────────────────────── */

  async function fetchPack(pack) {
    loading++;
    try {
      const res = await fetch(pack.src);
      if (!res.ok) throw new Error(`${res.status} ${pack.src}`);
      const blob = await res.blob();
      let at = 0;
      pack.frames.forEach((f, i) => {
        blobs[f] = blob.slice(at, at + pack.sizes[i], 'image/webp');
        at += pack.sizes[i];
      });
    } finally {
      loading--;
    }
    if (dead) return;
    show(); // a closer frame may have arrived
    next();
  }

  /** Start fetching the pack nearest to the playhead. */
  function next() {
    while (!keysOnly && !dead && loading < parallel && queue.length) {
      let best = 0;
      let bestD = Infinity;
      queue.forEach((p, i) => {
        const d = Math.min(...p.frames.map((f) => Math.abs(f - want)));
        if (d < bestD) [best, bestD] = [i, d];
      });
      const [pack] = queue.splice(best, 1);
      fetchPack(pack).catch(() => queue.push(pack)); // a failed filler pack is retried later
    }
  }

  /** Nearest frame to `n` that has arrived (−1 when none yet). */
  function nearest(n) {
    for (let d = 0; d < frames; d++) {
      if (blobs[n - d]) return n - d;
      if (blobs[n + d]) return n + d;
    }
    return -1;
  }

  /* ── decoding + drawing ──────────────────────────────────── */

  function decode(f) {
    if (bitmaps.has(f)) return Promise.resolve(bitmaps.get(f));
    if (decoding.has(f)) return decoding.get(f);
    const p = createImageBitmap(blobs[f])
      .then((bmp) => {
        decoding.delete(f);
        if (dead) {
          bmp.close();
          return null;
        }
        bitmaps.set(f, bmp);
        while (bitmaps.size > cache) {
          const [old, b] = bitmaps.entries().next().value;
          bitmaps.delete(old);
          if (old === shown) bitmaps.set(old, b); // never drop the frame on screen
          else b.close();
        }
        return bmp;
      })
      .catch((e) => {
        decoding.delete(f);
        throw e;
      });
    decoding.set(f, p);
    return p;
  }

  function draw(f, bmp) {
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    // keep it at the fresh end of the LRU
    bitmaps.delete(f);
    bitmaps.set(f, bmp);
    if (shown < 0) onFirstFrame?.();
    shown = f;
  }

  function show() {
    const f = nearest(want);
    if (f < 0 || dead) return;
    if (f !== shown) {
      const bmp = bitmaps.get(f);
      if (bmp) draw(f, bmp);
      else if (decoding.size < 3 || !decoding.has(f)) {
        decode(f)
          .then((b) => {
            // still the best frame we have for where the scroll is now?
            if (b && !dead && nearest(want) === f && shown !== f) draw(f, b);
            else if (!dead) show();
          })
          .catch(() => {});
      }
    }
    // prefetch-decode the next frames in the scroll direction
    for (let k = 1; k <= 3 && decoding.size < 4; k++) {
      const g = nearest(want + k * dir);
      if (g >= 0 && !bitmaps.has(g)) decode(g).catch(() => {});
    }
  }

  // start: «k» first, then the rest
  fetchPack(variant.packs[0]).catch((e) => !dead && onError?.(e));

  return {
    /** Show the frame for film time `t` (seconds) at `fps`. */
    seek(t, fps) {
      const f = Math.min(frames - 1, Math.max(0, Math.round(t * fps)));
      if (f !== want) dir = f > want ? 1 : -1;
      want = f;
      show();
    },
    /** Frame currently drawn (for tests). */
    get shown() {
      return shown;
    },
    destroy() {
      dead = true;
      bitmaps.forEach((b) => b.close());
      bitmaps.clear();
    },
  };
}
