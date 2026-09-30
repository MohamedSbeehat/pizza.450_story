import { useContext, useEffect, useRef, useState } from 'react';
import { QUALITY } from '../../../config/quality';
import { SceneContext, useSceneArmed } from '../../../story/context';
import { story } from '../../../story/store';

/** Only seek the visible shot; coalesce rapid scrolling to the latest frame. */
export function PlaceVideo({ shot, start, end }) {
  const { id } = useContext(SceneContext);
  const armed = useSceneArmed();
  const video = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = `/video/place/${shot.id}`;

  useEffect(() => {
    const el = video.current;
    if (!armed || !el || QUALITY.reducedMotion || failed) return undefined;
    let wanted = shot.from;
    let active = false;
    let pending = 0;

    const seek = () => {
      pending = 0;
      if (!active || el.readyState < 2 || el.seeking || !Number.isFinite(el.duration)) return;
      const target = Math.min(wanted, Math.max(0, el.duration - 1 / 24));
      if (Math.abs(el.currentTime - target) < 1 / 48) return;
      el.currentTime = target;
    };
    const schedule = () => {
      if (!pending) pending = requestAnimationFrame(seek);
    };
    const onFrame = (time) => {
      const mark = story.film?.marks[id];
      if (!mark) return;
      const p = (time - mark.start) / (mark.end - mark.start);
      active = !document.hidden && p >= start - 0.06 && p <= end + 0.06;
      if (!active) return;
      const progress = Math.max(0, Math.min(1, (p - start) / (end - start)));
      wanted = shot.from + (shot.to - shot.from) * progress;
      schedule();
    };
    const onVisibility = () => onFrame(story.time);

    el.addEventListener('loadeddata', schedule);
    el.addEventListener('canplay', schedule);
    el.addEventListener('seeked', schedule);
    document.addEventListener('visibilitychange', onVisibility);
    story.onFrame.add(onFrame);
    onFrame(story.time);
    return () => {
      cancelAnimationFrame(pending);
      el.removeEventListener('loadeddata', schedule);
      el.removeEventListener('canplay', schedule);
      el.removeEventListener('seeked', schedule);
      document.removeEventListener('visibilitychange', onVisibility);
      story.onFrame.delete(onFrame);
    };
  }, [armed, failed, id, shot, start, end]);

  return (
    <div className={`place-video${ready && !failed ? ' is-ready' : ''}`}>
      {armed ? <img className="place-video__poster" src={`${src}.webp`} alt={shot.alt} decoding="async" /> : null}
      {armed && !QUALITY.reducedMotion && !failed ? (
        <video
          ref={video}
          className="place-video__film"
          src={`${src}.mp4`}
          poster={`${src}.webp`}
          preload="auto"
          muted
          playsInline
          disablePictureInPicture
          aria-hidden="true"
          onSeeked={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
