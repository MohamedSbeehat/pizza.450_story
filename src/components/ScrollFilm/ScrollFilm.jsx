import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useSceneArmed } from '../../story/context';
import './ScrollFilm.css';

/**
 * A real video whose playhead is the scroll position.
 *
 * The scene timeline calls `seek(seconds)`; only the latest wanted time is
 * kept and a new seek starts when the previous frame is on screen, so fast
 * scrolling never queues up work. A time asked for before the video has
 * loaded (e.g. a jump from the chapter menu) is applied once it can be.
 * The file is encoded with a keyframe every few frames (`npm run film`),
 * which keeps every seek cheap.
 *
 * `onReady` is called once the first frame can be shown, `onFailed` when the
 * video cannot play — the scene then falls back to its 3D version.
 */
export function ScrollFilm({ film, onReady, onFailed, className = '', ref }) {
  const armed = useSceneArmed();
  const video = useRef(null);
  const seek = useRef({ busy: false, want: 0 });
  const [ready, setReady] = useState(false);

  /** Start a seek to the wanted time, unless one is running or it's already there. */
  const apply = (v) => {
    const s = seek.current;
    if (s.busy || v.readyState < 1 || Math.abs(v.currentTime - s.want) < 0.4 / film.fps) return;
    s.busy = true;
    v.currentTime = s.want;
  };

  useImperativeHandle(
    ref,
    () => ({
      seek(t) {
        seek.current.want = Math.min(Math.max(t, 0), film.duration - 0.5 / film.fps);
        if (video.current) apply(video.current);
      },
      /** Size of the video frame on screen (object-fit: cover) → for labels. */
      frameRect() {
        const v = video.current;
        if (!v) return null;
        const r = v.getBoundingClientRect();
        const k = Math.max(r.width / film.width, r.height / film.height);
        const w = film.width * k;
        const h = film.height * k;
        return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
      },
    }),
    [film],
  );

  useEffect(() => {
    const v = video.current;
    if (!v || !armed) return undefined;
    const s = seek.current;
    const onSeeked = () => {
      s.busy = false;
      apply(v);
    };
    const onMeta = () => apply(v);
    const onData = () => {
      setReady(true);
      onReady?.();
    };
    const onError = () => onFailed?.();
    // iOS only buffers a video after it has played once: a muted play/pause
    // on the first touch makes the frames available for seeking.
    const unlock = () => {
      v.play()
        .then(() => v.pause())
        .catch(() => {});
    };
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('loadeddata', onData);
    v.addEventListener('error', onError);
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    if (v.readyState >= 1) onMeta();
    if (v.readyState >= 2) onData();
    return () => {
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('loadeddata', onData);
      v.removeEventListener('error', onError);
      window.removeEventListener('touchstart', unlock);
    };
  }, [armed, film, onReady, onFailed]);

  return (
    <div
      className={`scroll-film${ready ? ' is-ready' : ''} ${className}`}
      style={{ '--film-aspect': `${film.width} / ${film.height}` }}
      aria-hidden="true"
    >
      <img className="scroll-film__poster" src={film.poster} alt="" decoding="async" />
      {armed ? (
        <video
          ref={video}
          className="scroll-film__video"
          src={film.src}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
        />
      ) : null}
    </div>
  );
}
