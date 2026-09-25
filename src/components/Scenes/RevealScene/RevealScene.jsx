import { useRef } from 'react';
import { REVEAL } from '../../../data/story';
import { useSceneTimeline } from '../../../story/context';
import { textIn, textOut, fadeIn, m } from '../../../story/helpers';
import { StoryText, Slate } from '../../StoryText/StoryText';
import { CoverBox, aspectOf } from '../../Media/Media';
import { letterbox } from '../../Effects/Letterbox';
import './RevealScene.css';

/**
 * Scene 8 — الوصول إلى بيتزرية 450
 * Everything stops for a beat in the dark. The frame widens to cinema scope.
 * Close on the sign, the lights of the facade switch on one by one, and the
 * camera slowly pulls back to show the whole place. Then the name.
 */
export function RevealScene() {
  const root = useRef(null);
  const cam = useRef(null);
  const dark = useRef(null);
  const glows = useRef([]);
  const slate = useRef(null);
  const title = useRef(null);
  const lines = useRef([]);
  const scrim = useRef(null);

  /** REVEAL.focus (in % of the photo) → px on the stage, where the photo is 'cover'-fitted. */
  const focusOrigin = () => {
    const W = window.innerWidth;
    const H = cam.current?.offsetHeight || window.innerHeight;
    const r = aspectOf(REVEAL.image.src, 16 / 9);
    const w = Math.max(W, H * r);
    const h = w / r;
    const x = (W - w) / 2 + (w * REVEAL.focus.x) / 100;
    const y = (H - h) / 2 + (h * REVEAL.focus.y) / 100;
    return `${x.toFixed(1)}px ${y.toFixed(1)}px`;
  };

  useSceneTimeline((tl) => {
    fadeIn(tl, root.current, 0, 0.04);
    // a held beat of darkness while the frame widens
    if (letterbox.el) {
      tl.fromTo(letterbox.el, { '--lb': 0 }, { '--lb': 1, duration: 0.14, ease: 'power2.inOut' }, 0.02);
      tl.to(letterbox.el, { '--lb': 0, duration: 0.1, ease: 'power2.inOut' }, 0.9);
    }

    // close on the sign → slow pull back
    tl.fromTo(
      cam.current,
      { scale: m(2.1), transformOrigin: focusOrigin },
      { scale: 1, transformOrigin: focusOrigin, duration: 0.72, ease: 'power2.inOut' },
      0.1,
    );
    // lights off → on
    tl.fromTo(dark.current, { opacity: 1 }, { opacity: 0.94, duration: 0.08 }, 0.1);
    tl.to(dark.current, { opacity: 0.12, duration: 0.3, ease: 'power1.inOut' }, 0.22);
    tl.fromTo(glows.current, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.08, stagger: 0.025, ease: 'power2.out' }, 0.24);

    // the name
    tl.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0.44);
    fadeIn(tl, slate.current, 0.5, 0.05, { y: 10 }, { y: 0 });
    textIn(tl, title.current, 0.52, { dur: 0.1, stagger: 0.04, y: 40, blur: 20 });
    textIn(tl, lines.current[0], 0.64);
    textIn(tl, lines.current[1], 0.72);

    textOut(tl, title.current, 0.9);
    textOut(tl, lines.current[0], 0.9);
    textOut(tl, lines.current[1], 0.9);
    tl.to(slate.current, { autoAlpha: 0, duration: 0.04 }, 0.9);
    tl.to(root.current, { autoAlpha: 0, duration: 0.01 }, 0.99);
  });

  return (
    <section ref={root} className="scene reveal" aria-label="بيتزرية 450 اليوم">
      <div ref={cam} className="reveal__cam">
        <CoverBox image={REVEAL.image}>
          {REVEAL.lights.map((l, i) => (
            <i
              key={i}
              ref={(el) => (glows.current[i] = el)}
              className={`reveal__glow${l.soft ? ' is-soft' : ''}`}
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.s}%` }}
            />
          ))}
        </CoverBox>
        <div ref={dark} className="reveal__dark" />
      </div>
      <div ref={scrim} className="reveal__scrim" aria-hidden="true" />

      <div className="reveal__text">
        <Slate ref={slate} className="reveal__slate" label={REVEAL.slate.label} value={REVEAL.slate.value} />
        <StoryText as="h2" ref={title} className="reveal__title display display--xl" text={REVEAL.title} />
        <div className="reveal__lines">
          {REVEAL.lines.map((line, i) => (
            <StoryText key={i} ref={(el) => (lines.current[i] = el)} className="lead" text={line} />
          ))}
        </div>
      </div>
    </section>
  );
}
