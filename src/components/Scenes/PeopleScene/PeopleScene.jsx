import { useRef } from 'react';
import { PEOPLE } from '../../../data/story';
import { useSceneTimeline } from '../../../story/context';
import { textIn, textOut, fadeIn, m } from '../../../story/helpers';
import { StoryText } from '../../StoryText/StoryText';
import { Media } from '../../Media/Media';
import './PeopleScene.css';

/**
 * Scene 2 — الشخص وراء القصة
 * The window's light fades into darkness and a face emerges from it.
 * The camera slowly moves in; a second person joins the story.
 */
export function PeopleScene() {
  const root = useRef(null);
  const warm = useRef(null);
  const beam = useRef(null);
  const portraits = useRef([]);
  const shades = useRef([]);
  const zooms = useRef([]);
  const captions = useRef([]);
  const first = useRef([]);
  const second = useRef([]);
  const note = useRef(null);

  const [p1, p2] = PEOPLE.people;

  useSceneTimeline((tl) => {
    fadeIn(tl, root.current, 0, 0.1);
    // the light from the window cools into darkness
    tl.fromTo(warm.current, { opacity: 1 }, { opacity: 0, duration: 0.18, ease: 'power1.out' }, 0.02);
    tl.fromTo(beam.current, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0.08);

    // ── Person 1 emerges from the dark ───────────────────────────
    const [f1, f2] = portraits.current;
    tl.fromTo(f1, { autoAlpha: 0, y: 40, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out' }, 0.06);
    tl.fromTo(shades.current[0], { opacity: 1 }, { opacity: 0.05, duration: 0.24, ease: 'sine.inOut' }, 0.08);
    tl.fromTo(zooms.current[0], { scale: 1.16 }, { scale: m(1.02), duration: 0.5, ease: 'sine.out' }, 0.06);
    fadeIn(tl, captions.current[0], 0.22, 0.06, { y: 10 }, { y: 0 });

    textIn(tl, first.current[0], 0.14);
    textIn(tl, first.current[1], 0.24);

    // ── Person 1 steps back, person 2 comes forward ──────────────
    if (f2) {
      textOut(tl, first.current[0], 0.44);
      textOut(tl, first.current[1], 0.45);
      tl.to(f1, { xPercent: () => (window.innerWidth <= 820 ? -30 : -42), scale: 0.82, duration: 0.2, ease: 'power2.inOut' }, 0.44);
      tl.to(shades.current[0], { opacity: 0.55, duration: 0.2 }, 0.44);
      tl.to(captions.current[0], { autoAlpha: 0, duration: 0.06 }, 0.44);

      tl.fromTo(f2, { autoAlpha: 0, xPercent: 12, y: 30, scale: 0.94 }, { autoAlpha: 1, xPercent: () => (window.innerWidth <= 820 ? 18 : 26), y: 0, scale: 1.02, duration: 0.2, ease: 'power2.out' }, 0.48);
      tl.fromTo(shades.current[1], { opacity: 1 }, { opacity: 0.05, duration: 0.22, ease: 'sine.inOut' }, 0.5);
      tl.fromTo(zooms.current[1], { scale: 1.16 }, { scale: m(1.03), duration: 0.45, ease: 'sine.out' }, 0.48);
      fadeIn(tl, captions.current[1], 0.62, 0.06, { y: 10 }, { y: 0 });

      textIn(tl, second.current[0], 0.56);
      textIn(tl, second.current[1], 0.64);
      if (note.current) textIn(tl, note.current, 0.7, { dur: 0.06, stagger: 0.004, blur: 6, y: 10 });
    } else {
      textIn(tl, second.current[0], 0.5);
      textIn(tl, second.current[1], 0.58);
    }

    // ── Back into the dark ───────────────────────────────────────
    textOut(tl, second.current[0], 0.86);
    textOut(tl, second.current[1], 0.87);
    if (note.current) textOut(tl, note.current, 0.86);
    tl.to(shades.current, { opacity: 1, duration: 0.12, ease: 'power1.in' }, 0.86);
    tl.to(captions.current, { autoAlpha: 0, duration: 0.06 }, 0.86);
    tl.to(beam.current, { opacity: 0, duration: 0.12 }, 0.86);
    tl.to(root.current, { autoAlpha: 0, duration: 0.04 }, 0.96);
  });

  const renderPortrait = (p, i) => (
    <figure key={p.name + i} ref={(el) => (portraits.current[i] = el)} className={`portrait portrait--${i + 1}`}>
      <div className="portrait__frame">
        <div ref={(el) => (zooms.current[i] = el)} className="portrait__zoom">
          <Media image={p.image} className="portrait__media" />
        </div>
        <div ref={(el) => (shades.current[i] = el)} className="portrait__shade" />
      </div>
      <figcaption ref={(el) => (captions.current[i] = el)} className="portrait__caption">
        <StoryText as="span" className="portrait__name is-static" text={p.name} />
        <StoryText as="span" className="portrait__role is-static" text={p.role} />
      </figcaption>
    </figure>
  );

  return (
    <section ref={root} className="scene people" aria-label="الشخص وراء القصة">
      <div ref={beam} className="people__beam" aria-hidden="true" />
      <div className="people__stage">
        {p1 ? renderPortrait(p1, 0) : null}
        {p2 ? renderPortrait(p2, 1) : null}
      </div>
      <div ref={warm} className="people__warm" aria-hidden="true" />

      <div className="scene__text people__text">
        <div className="people__block">
          {PEOPLE.first.map((line, i) => (
            <StoryText key={i} ref={(el) => (first.current[i] = el)} className={i === 0 ? 'lead' : 'display'} text={line} />
          ))}
        </div>
        <div className="people__block people__block--second">
          {PEOPLE.second.map((line, i) => (
            <StoryText key={i} ref={(el) => (second.current[i] = el)} className={i === 0 ? 'lead' : 'display'} text={line} />
          ))}
          <StoryText ref={note} className="body-note" text={PEOPLE.note} />
        </div>
      </div>
    </section>
  );
}
