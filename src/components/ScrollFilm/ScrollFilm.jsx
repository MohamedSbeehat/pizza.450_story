import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useSceneArmed } from '../../story/context';
import { QUALITY } from '../../config/quality';
import { createFramePlayer } from './framePlayer';
import './ScrollFilm.css';

/** The lighter film on phones and on slow or data-saving connections. */
function pickVariant(film) {
  const net = typeof navigator !== 'undefined' ? navigator.connection : null;
  const light = QUALITY.mobile || net?.saveData || /2g$/.test(net?.effectiveType || '');
  return film.variants[light ? 'mobile' : 'desktop'] || film.variants.desktop;
}

/**
 * A film whose playhead is the scroll position.
 *
 * The scene timeline calls `seek(seconds)`; the frame for that moment is
 * drawn on a canvas (see framePlayer.js: frames load «every 8th first», then
 * fill in, so the film can be scrubbed almost at once and never waits). The
 * poster (first frame) holds the place until the first frame is drawn.
 *
 * A film with `frame` (your own video, film/video.json) is shown whole and
 * framed on the page instead of filling it (see ScrollFilm.css).
 *
 * `stillsOnly` loads just the every-8th-frame pack (for reduced motion).
 * `onReady` is called once the first frame is on screen, `onFailed` when the
 * film cannot play — the scene then falls back to its 3D version.
 */
export function ScrollFilm({ film, stillsOnly = false, onReady, onFailed, className = '', ref }) {
  const armed = useSceneArmed();
  const canvas = useRef(null);
  const player = useRef(null);
  const want = useRef(0);
  const [ready, setReady] = useState(false);
  const variant = useMemo(() => pickVariant(film), [film]);

  useImperativeHandle(
    ref,
    () => ({
      seek(t) {
        want.current = t;
        player.current?.seek(t, film.fps);
      },
      /** Size of the film frame on screen (object-fit: cover, or framed) → for labels. */
      frameRect() {
        const c = canvas.current;
        if (!c) return null;
        const r = c.getBoundingClientRect();
        const k = Math.max(r.width / film.width, r.height / film.height);
        const w = film.width * k;
        const h = film.height * k;
        return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
      },
    }),
    [film],
  );

  useEffect(() => {
    if (!armed || !canvas.current) return undefined;
    if (typeof createImageBitmap !== 'function') {
      onFailed?.();
      return undefined;
    }
    const p = createFramePlayer(canvas.current, variant, {
      frames: film.frames,
      keysOnly: stillsOnly,
      cache: QUALITY.mobile ? 28 : 48,
      onFirstFrame: () => {
        setReady(true);
        onReady?.();
      },
      onError: () => onFailed?.(),
    });
    player.current = p;
    p.seek(want.current, film.fps);
    return () => {
      p.destroy();
      player.current = null;
    };
  }, [armed, film, variant, stillsOnly, onReady, onFailed]);

  return (
    <div
      className={`scroll-film${film.frame ? ' is-framed' : ''}${ready ? ' is-ready' : ''} ${className}`}
      style={{
        '--film-aspect': `${film.width} / ${film.height}`,
        '--film-ar': film.width / film.height,
        '--film-zoom': film.frame?.zoom,
        '--film-portrait': film.frame?.portrait,
      }}
      aria-hidden="true"
    >
      <img className="scroll-film__poster" src={variant.poster} alt="" decoding="async" />
      {armed ? <canvas ref={canvas} className="scroll-film__frames" /> : null}
    </div>
  );
}
