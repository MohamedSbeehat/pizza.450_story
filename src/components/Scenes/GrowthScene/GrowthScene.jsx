import { useRef } from 'react';
import { GROWTH } from '../../../data/story';
import { QUALITY } from '../../../config/quality';
import { useSceneTimeline } from '../../../story/context';
import { fadeIn } from '../../../story/helpers';
import { StoryText, Slate } from '../../StoryText/StoryText';
import { Media } from '../../Media/Media';
import './GrowthScene.css';

/** Smooth step: frames dwell, then glide to the next one. */
const dwell = (r) => {
  const i = Math.floor(r);
  const f = r - i;
  return i + f * f * f * (f * (f * 6 - 15) + 10);
};

/**
 * Scene 7 — تطور المطعم
 * A faster montage: moments of the story on a curved film strip that turns
 * with the scroll (right → left, the way Arabic is read), with a timeline
 * underneath. Not a carousel: the scroll *is* the passing of time.
 */
export function GrowthScene() {
  const root = useRef(null);
  const frames = useRef([]);
  const shades = useRef([]);
  const dots = useRef([]);
  const fill = useRef(null);
  const kicker = useRef(null);
  const rail = useRef(null);
  const state = useRef({ r: -0.9 });

  const n = GROWTH.frames.length;

  const layout = () => {
    const c = dwell(state.current.r);
    const w = window.innerWidth;
    const mobile = w <= 820;
    const spacing = mobile ? w * 0.7 : Math.min(w * 0.3, 560);
    const depth = mobile ? 320 : 420;
    const turn = mobile ? 30 : 24;
    frames.current.forEach((el, i) => {
      if (!el) return;
      const o = i - c; // >0: still to come (left), <0: already passed (right)
      const a = Math.abs(o);
      const x = -o * spacing;
      const z = -Math.min(a, 3) * depth;
      const ry = Math.max(-60, Math.min(60, -o * turn));
      const s = 1 - Math.min(a, 2) * 0.06;
      const op = Math.max(0, Math.min(1, 1.35 - a * 0.42));
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) scale(${s.toFixed(3)})`;
      el.style.opacity = op.toFixed(3);
      el.style.visibility = op < 0.01 ? 'hidden' : 'visible';
      if (shades.current[i]) shades.current[i].style.opacity = Math.min(0.72, a * 0.55).toFixed(3);
      if (dots.current[i]) dots.current[i].classList.toggle('is-active', a < 0.5);
      if (dots.current[i]) dots.current[i].classList.toggle('is-past', o <= -0.5);
    });
    if (fill.current) fill.current.style.transform = `scaleX(${Math.max(0, Math.min(1, c / (n - 1))).toFixed(4)})`;
  };

  useSceneTimeline((tl) => {
    fadeIn(tl, root.current, 0, 0.1);
    fadeIn(tl, kicker.current, 0.06, 0.06, { y: 12 }, { y: 0 });
    fadeIn(tl, rail.current, 0.08, 0.06);
    tl.fromTo(
      state.current,
      { r: -0.9 },
      { r: n - 1 + 0.001, duration: 0.8, ease: 'none', onUpdate: layout, onStart: layout },
      0.06,
    );
    // the strip leaves; darkness before the big moment
    tl.to(frames.current, { autoAlpha: 0, y: -30, duration: 0.07, stagger: 0.004 }, 0.9);
    tl.to([kicker.current, rail.current], { autoAlpha: 0, duration: 0.05 }, 0.9);
    tl.to(root.current, { autoAlpha: 0, duration: 0.03 }, 0.97);
  });

  return (
    <section ref={root} className="scene growth" aria-label="تطور المطعم">
      <div className="growth__glow" aria-hidden="true" />
      <Slate ref={kicker} className="growth__kicker" label={GROWTH.kicker} />

      <div className="growth__track">
        {GROWTH.frames.map((f, i) => (
          <figure key={i} ref={(el) => (frames.current[i] = el)} className="gframe">
            <div className={`gframe__photo${f.images ? ' is-pair' : ''}`}>
              {f.images ? f.images.map((img, k) => <Media key={k} image={img} />) : <Media image={f.image} />}
              <i ref={(el) => (shades.current[i] = el)} className="gframe__shade" />
            </div>
            <figcaption className="gframe__caption">
              <span className="gframe__head">
                <span className="gframe__no latin">{String(i + 1).padStart(2, '0')}</span>
                <StoryText as="span" className="gframe__label is-static" text={f.label} />
              </span>
              <StoryText as="span" className="gframe__story is-static" text={f.story} />
            </figcaption>
          </figure>
        ))}
      </div>

      <div ref={rail} className="growth__rail" aria-hidden="true">
        <div className="growth__line">
          <i ref={fill} className="growth__fill" />
        </div>
        <ol className="growth__dots">
          {GROWTH.frames.map((f, i) => (
            <li key={i} ref={(el) => (dots.current[i] = el)} style={{ insetInlineStart: `${(i / (n - 1)) * 100}%` }}>
              <i />
            </li>
          ))}
        </ol>
      </div>
      {QUALITY.tier === 'low' ? null : <div className="growth__dust" aria-hidden="true" />}
    </section>
  );
}
