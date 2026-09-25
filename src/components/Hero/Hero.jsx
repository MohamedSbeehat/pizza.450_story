import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { INTRO } from '../../data/story';
import { QUALITY } from '../../config/quality';
import { useSceneTimeline } from '../../story/context';
import { StoryText } from '../StoryText/StoryText';
import './Hero.css';

/**
 * Opening title. Plays by itself on load (not scroll-driven):
 * darkness → a faint warm light → the two title lines → the subtitle → the
 * scroll cue. The first scroll then dissolves it into the sunrise.
 */
export function Hero() {
  const root = useRef(null);
  const content = useRef(null);
  const glow = useRef(null);
  const lines = useRef([]);
  const sub = useRef(null);
  const hintWrap = useRef(null);
  const hint = useRef(null);

  // ── Auto-played intro ────────────────────────────────────────
  useLayoutEffect(() => {
    const blur = (px) => (QUALITY.textBlur ? { filter: `blur(${px}px)` } : {});
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl.fromTo(glow.current, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 4, ease: 'sine.out' }, 0);
      lines.current.forEach((el, i) => {
        tl.fromTo(
          el.querySelectorAll('.w'),
          { autoAlpha: 0, y: 34, ...blur(18) },
          { autoAlpha: 1, y: 0, ...blur(0), duration: 1.8, stagger: 0.16 },
          0.5 + i * 1.15,
        );
      });
      tl.fromTo(sub.current.querySelectorAll('.w'), { autoAlpha: 0, y: 16, ...blur(10) }, { autoAlpha: 1, y: 0, ...blur(0), duration: 1.4, stagger: 0.1 }, 3.1);
      tl.fromTo(hint.current, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 1.2 }, 4.1);

      // Wait for the fonts so the words don't reflow mid-animation.
      const start = () => tl.play();
      const timer = setTimeout(start, 1400);
      document.fonts?.ready.then(() => {
        clearTimeout(timer);
        start();
      });
    }, root);
    return () => ctx.revert();
  }, []);

  // ── Scroll: the title dissolves, the story begins ────────────
  useSceneTimeline((tl) => {
    tl.to(hintWrap.current, { autoAlpha: 0, y: 20, duration: 0.25 }, 0);
    tl.to(content.current, { autoAlpha: 0, y: -70, scale: 0.97, ...(QUALITY.textBlur ? { filter: 'blur(12px)' } : {}), duration: 0.7, ease: 'power1.in' }, 0.08);
    tl.to(glow.current, { scale: 2.4, opacity: 0, duration: 0.9, ease: 'power1.in' }, 0.05);
    tl.to(root.current, { autoAlpha: 0, duration: 0.2 }, 0.8);
  });

  return (
    <section ref={root} className="scene scene--hero hero" aria-label="البداية">
      <div ref={glow} className="hero__glow" aria-hidden="true" />
      <div ref={content} className="hero__content">
        <h1 className="hero__title display display--xl">
          {INTRO.title.map((line, i) => (
            <StoryText key={i} as="span" className="hero__line" text={line} ref={(el) => (lines.current[i] = el)} />
          ))}
        </h1>
        <StoryText ref={sub} className="hero__sub lead" text={INTRO.subtitle} />
      </div>
      <div ref={hintWrap} className="hero__hint-wrap">
        <div ref={hint} className="hero__hint">
          <span className="latin">{INTRO.hint}</span>
          <span className="hero__rail" aria-hidden="true">
            <i />
          </span>
          <span className="hero__arrow" aria-hidden="true">
            ↓
          </span>
        </div>
      </div>
    </section>
  );
}
