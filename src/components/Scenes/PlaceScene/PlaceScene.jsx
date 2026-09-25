import { useRef } from 'react';
import { PLACE } from '../../../data/story';
import { useSceneTimeline } from '../../../story/context';
import { textIn, textOut, fadeIn, m } from '../../../story/helpers';
import { StoryText, Slate } from '../../StoryText/StoryText';
import { Media } from '../../Media/Media';
import './PlaceScene.css';

/**
 * Scene 3 — المكان
 * The place goes through its stages in one frame:
 *   sketch  → drawn line by line (right to left, like Arabic handwriting)
 *   vision  → colour blooms out of the drawing
 *   real    → a band of light sweeps across and leaves the real photo
 * Then the camera flies into the window and comes out inside the 3D
 * restaurant (Scene 4).
 */
export function PlaceScene() {
  const root = useRef(null);
  const cam = useRef(null);
  const frame = useRef(null);
  const layers = useRef([]);
  const kb = useRef([]);
  const ambient = useRef([]);
  const labels = useRef([]);
  const pen = useRef(null);
  const sweep = useRef(null);
  const dark = useRef(null);
  const slate = useRef(null);
  const lines = useRef([]);

  const stages = PLACE.stages;

  /** Fly-in point (PLACE.enter, in % of the frame) in camera pixels. */
  const enterOrigin = () => {
    const f = frame.current;
    if (!f) return '50% 50%';
    const x = f.offsetLeft + (f.offsetWidth * PLACE.enter.x) / 100;
    const y = f.offsetTop + (f.offsetHeight * PLACE.enter.y) / 100;
    return `${x.toFixed(1)}px ${y.toFixed(1)}px`;
  };

  useSceneTimeline((tl) => {
    fadeIn(tl, root.current, 0, 0.08);
    tl.fromTo(frame.current, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.02);

    // The whole shot slowly pushes toward the entrance.
    tl.fromTo(
      cam.current,
      { scale: 0.96, transformOrigin: enterOrigin },
      { scale: m(1.05), transformOrigin: enterOrigin, duration: 0.8, ease: 'sine.inOut' },
      0,
    );

    // ── Stages ─────────────────────────────────────────────────
    const from = 0.05;
    const slot = 0.64 / stages.length;
    stages.forEach((stage, i) => {
      const at = from + i * slot;
      const dur = slot * 0.8;
      const layer = layers.current[i];

      if (stage.kind === 'sketch' || i === 0) {
        // drawn from right to left, a glowing pen edge leads the line
        tl.fromTo(layer, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: dur, ease: 'power1.inOut' }, at);
        tl.set(pen.current, { autoAlpha: 1 }, at);
        tl.fromTo(pen.current, { left: '100%' }, { left: '0%', duration: dur, ease: 'power1.inOut' }, at);
        tl.to(pen.current, { autoAlpha: 0, duration: 0.03 }, at + dur);
      } else if (stage.kind === 'vision') {
        // colour blooms out from the centre of the drawing
        tl.fromTo(layer, { clipPath: 'circle(0% at 55% 52%)' }, { clipPath: 'circle(85% at 55% 52%)', duration: dur, ease: 'power2.inOut' }, at);
      } else {
        // a band of warm light sweeps across and leaves the real place behind it
        tl.fromTo(
          layer,
          { clipPath: 'polygon(100% 0%, 100% 0%, 100% 100%, 124% 100%)' },
          { clipPath: 'polygon(-24% 0%, 100% 0%, 100% 100%, 0% 100%)', duration: dur, ease: 'power1.inOut' },
          at,
        );
        tl.set(sweep.current, { autoAlpha: 1 }, at);
        tl.fromTo(sweep.current, { xPercent: 0 }, { xPercent: -560, duration: dur, ease: 'power1.inOut' }, at);
        tl.to(sweep.current, { autoAlpha: 0, duration: 0.02 }, at + dur);
      }

      // slow Ken Burns inside each picture
      tl.fromTo(kb.current[i], { scale: 1.1 }, { scale: 1, duration: 0.9 - at, ease: 'sine.out' }, at);
      // ambient light of the current picture
      tl.fromTo(ambient.current[i], { opacity: 0 }, { opacity: 0.5, duration: dur }, at);
      if (i > 0) tl.to(ambient.current[i - 1], { opacity: 0, duration: dur }, at);
      // small stage caption
      fadeIn(tl, labels.current[i], at + dur * 0.5, 0.05, { y: 8 }, { y: 0 });
      if (i < stages.length - 1) tl.to(labels.current[i], { autoAlpha: 0, duration: 0.04 }, from + (i + 1) * slot + slot * 0.3);
    });

    // ── Text ───────────────────────────────────────────────────
    fadeIn(tl, slate.current, 0.05, 0.06, { y: 10 }, { y: 0 });
    textIn(tl, lines.current[0], 0.1);
    textIn(tl, lines.current[1], 0.42);
    textOut(tl, lines.current[0], 0.74);
    textOut(tl, lines.current[1], 0.75);
    tl.to([slate.current, labels.current[stages.length - 1]], { autoAlpha: 0, duration: 0.05 }, 0.74);

    // ── Into the window → inside ───────────────────────────────
    tl.to(cam.current, { scale: m(5.5, 1.05), duration: 0.2, ease: 'power3.in' }, 0.78);
    tl.fromTo(dark.current, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'power2.in' }, 0.84);
    tl.to(root.current, { autoAlpha: 0, duration: 0.03 }, 0.97);
  });

  return (
    <section ref={root} className="scene place" aria-label="المكان">
      <div className="place__ambient" aria-hidden="true">
        {stages.map((s, i) => (
          <div key={i} ref={(el) => (ambient.current[i] = el)} className="place__ambient-layer">
            <Media image={s.image} variant="bg" />
          </div>
        ))}
      </div>

      <div ref={cam} className="place__cam">
        <div ref={frame} className="place__frame">
          {stages.map((s, i) => (
            <div key={i} ref={(el) => (layers.current[i] = el)} className={`place__stage place__stage--${s.kind}`}>
              <div ref={(el) => (kb.current[i] = el)} className="place__kb">
                <Media image={s.image} />
              </div>
            </div>
          ))}
          <div className="place__fx" aria-hidden="true">
            <i ref={pen} className="place__pen" />
            <i ref={sweep} className="place__sweep" />
          </div>
          <div className="place__labels">
            {stages.map((s, i) => (
              <span key={i} ref={(el) => (labels.current[i] = el)} className="place__label">
                <b className="latin">{String(i + 1).padStart(2, '0')}</b> {s.caption}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div ref={dark} className="place__dark" aria-hidden="true" />

      <div className="scene__text place__text">
        <Slate ref={slate} label={PLACE.slate.label} value={PLACE.slate.value} />
        {PLACE.lines.map((line, i) => (
          <StoryText key={i} ref={(el) => (lines.current[i] = el)} className="display" text={line} />
        ))}
      </div>
    </section>
  );
}
