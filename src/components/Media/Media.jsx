import { useMemo, useState } from 'react';
import manifest from '../../data/images.manifest.json';
import { SHOW_PLACEHOLDERS } from '../../data/story';
import { useSceneArmed } from '../../story/context';
import './Media.css';

const HAS_EXT = /\.(avif|webp|jpe?g|png|gif|svg)(\?.*)?$/i;

/**
 * Which files to try, in order, for an image path.
 *  - '/images/x.jpg'             → exactly that file
 *  - '/images/x' (in manifest)   → <picture> AVIF + WebP made by `npm run images`
 *  - '/images/x' (not generated) → x.webp, x.jpg, x.jpeg, x.png  (first that exists)
 */
function candidates(src, variant) {
  if (HAS_EXT.test(src)) return [{ src }];
  const m = manifest[src];
  if (variant === 'bg' && m && !m.ext) return [{ src: `${src}-bg.webp` }, { src: `${src}.webp`, blur: true }];
  if (m?.ext) return [{ src: `${src}.${m.ext}`, blur: variant === 'bg' }];
  if (m) return [{ avif: `${src}.avif`, src: `${src}.webp` }, { src: `${src}.webp` }];
  return ['webp', 'jpg', 'jpeg', 'png'].map((e) => ({ src: `${src}.${e}`, blur: variant === 'bg' }));
}

/** Natural aspect ratio of an image, if known from the manifest. */
export function aspectOf(src, fallback = 4 / 3) {
  const m = manifest[src];
  return m ? m.w / m.h : fallback;
}

/**
 * A story image.
 * - Loads only when its scene is near the playhead (lazy, see useSceneArmed).
 * - Falls back to a clear placeholder frame when the file does not exist, so
 *   you can add photos later without touching the code.
 *
 * image: { src, position?, fit?, alt?, placeholder? }
 * variant: 'main' | 'bg' (tiny blurred copy for ambient backgrounds)
 */
export function Media({ image, variant = 'main', className = '', eager = false, children, style }) {
  const armed = useSceneArmed() || eager;
  const list = useMemo(() => (image?.src ? candidates(image.src, variant) : []), [image?.src, variant]);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const failed = idx >= list.length;
  const c = list[idx];
  const imgStyle = {
    objectFit: image?.fit || 'cover',
    objectPosition: image?.position || '50% 50%',
  };
  const onError = () => {
    setLoaded(false);
    setIdx((i) => i + 1);
  };
  const img = c && (
    <img
      key={c.src}
      src={c.src}
      alt={variant === 'bg' ? '' : image?.alt || ''}
      decoding="async"
      draggable={false}
      style={imgStyle}
      className={c.blur ? 'is-blurred' : undefined}
      onLoad={() => setLoaded(true)}
      onError={onError}
    />
  );

  return (
    <div className={`media media--${variant} ${loaded ? 'is-loaded' : ''} ${className}`} style={style}>
      {armed && !failed && (c.avif ? (
        <picture key={c.avif}>
          <source type="image/avif" srcSet={c.avif} />
          {img}
        </picture>
      ) : (
        img
      ))}
      {failed && variant === 'main' ? <Placeholder label={image?.placeholder} path={image?.src} /> : null}
      {children}
    </div>
  );
}

/** Shown where a photo is still missing. */
export function Placeholder({ label, path }) {
  if (!SHOW_PLACEHOLDERS) return <div className="ph-frame ph-frame--quiet" aria-hidden="true" />;
  const file = path ? `public${HAS_EXT.test(path) ? path : `${path}.webp`}` : null;
  return (
    <div className="ph-frame" role="img" aria-label={label || 'صورة قادمة'}>
      <svg className="ph-frame__icon" viewBox="0 0 48 48" aria-hidden="true">
        <rect x="5" y="12" width="38" height="28" rx="3" />
        <path d="M17 12l3-5h8l3 5" />
        <circle cx="24" cy="26" r="8" />
      </svg>
      <span className="ph-frame__label">{label || '[ضع هنا صورة]'}</span>
      {file ? (
        <code className="ph-frame__path" dir="ltr">
          {file}
        </code>
      ) : null}
    </div>
  );
}

/**
 * Covers the whole stage with an image like `object-fit: cover`, but exposes
 * the image's own coordinate space: children positioned in % land on the
 * same spot of the photo at any screen size (used for lights on the facade).
 */
export function CoverBox({ image, className = '', children, ref }) {
  const ratio = aspectOf(image?.src, 16 / 9);
  return (
    <div ref={ref} className={`cover-box ${className}`} style={{ '--r': ratio }}>
      <Media image={{ ...image, position: '50% 50%' }} className="cover-box__media" />
      {children}
    </div>
  );
}
