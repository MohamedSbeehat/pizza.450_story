/**
 * Source photos → web images.
 *
 * Put the original photos in /photo, add (or edit) an entry here, then run:
 *     npm run images
 *
 * Each entry writes into /public/images/<out>:
 *   <out>.avif  <out>.webp   the image itself (upscaled up to `upscale`×, max `maxWidth`)
 *   <out>-bg.webp            a tiny blurred copy used for ambient full-screen backgrounds
 *   <sketch>.webp            (optional) a gold line-drawing version, used for "the idea"
 *
 * In src/data/story.js refer to an image by its public path WITHOUT extension,
 * e.g.  image: { src: '/images/story/facade-day' }
 *
 * `crop` removes screenshot UI (Instagram arrows, carousel dots, story captions):
 *   { left, top, width, height } in pixels of the ORIGINAL photo.
 */
export const IMAGES = [
  // ── Brand ──────────────────────────────────────────────
  { in: 'logo.png', out: 'brand/logo', upscale: 2, keepAlpha: true },

  // ── People ─────────────────────────────────────────────
  { in: 'شادي.png', out: 'people/shadi' },
  { in: 'احمد.png', out: 'people/ahmad' },

  // ── The place ──────────────────────────────────────────
  // Daylight facade (design image) — also generates the gold "idea" sketch.
  { in: 'pizzeria.450_5.png', out: 'story/facade-vision', crop: { left: 0, top: 0, width: 742, height: 466 }, sketch: 'story/facade-sketch' },
  // Night facade (design image) — used for the big reveal.
  { in: 'pizzeria.450_4.png', out: 'story/facade-night', crop: { left: 0, top: 0, width: 770, height: 540 } },
  // Real facade photos.
  { in: 'pizzeria.450_2.png', out: 'story/facade-day' },
  { in: 'pizzeria.450_1.png', out: 'story/facade-sign' },

  // ── The oven ───────────────────────────────────────────
  { in: 'pizzeria.450_3.png', out: 'story/oven-copper', crop: { left: 0, top: 0, width: 484, height: 772 } },
  // Story caption at the bottom of the original is cropped out.
  { in: 'pizzeria.450_6.png', out: 'story/oven-install', crop: { left: 0, top: 0, width: 480, height: 604 } },

  // ── Growth montage ─────────────────────────────────────
  // The real pizza is also unwarped into a top-down texture for the 3D pizza.
  //   cx, cy, rx, ry  the ellipse of the crust in the ORIGINAL photo (pixels)
  //   pile            the grated-cheese pile in the top view (fractions), removed
  //                   from the "clean" texture and added live in 3D
  //   cheeseOut       where the melted mozzarella spots are written (3D pieces land there)
  {
    in: 'pizza.png',
    out: 'story/pizza',
    topView: {
      out: 'textures/pizza-top',
      cx: 367,
      cy: 501,
      rx: 325,
      ry: 243,
      edge: 0.968,
      pile: { x: 0.575, y: 0.39, r: 0.14 },
      cheeseOut: 'src/data/pizza.cheese.json',
    },
  },
];
