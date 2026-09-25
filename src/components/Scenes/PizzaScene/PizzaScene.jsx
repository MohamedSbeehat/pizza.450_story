import { useCallback, useEffect, useRef, useState } from 'react';
import { PIZZA } from '../../../data/story';
import { PIZZA_FILM } from '../../../data/film';
import { QUALITY } from '../../../config/quality';
import { useSceneTimeline } from '../../../story/context';
import { story, useStory } from '../../../story/store';
import { textIn, textOut, fadeIn, fadeOut, shot, worldTo } from '../../../story/helpers';
import { registerAnchor } from '../../../three/anchors';
import { StoryText } from '../../StoryText/StoryText';
import { Media } from '../../Media/Media';
import { ScrollFilm } from '../../ScrollFilm/ScrollFilm';
import { StepList, stepTween } from '../common/StepList';
import '../common/WorldScenes.css';
import './PizzaScene.css';

/** Times below are in "screens" of scrolling; the scene lasts PIZZA.duration. */
const S = (screens) => screens / PIZZA.duration;

/**
 * Scene 5 — البيتزا (3D), filmed like a food video.
 *
 *   العجين   flour is thrown, the ball is pressed with the fingers, then
 *            stretched and turned into a base
 *   الصوص    the ladle scoops from the bowl, pours in the centre and
 *            spreads the sauce in a spiral
 *   الجبنة   pieces are torn from a mozzarella ball and fly onto the pizza
 *   الفرن    into the copper oven: the crust puffs up, the cheese melts
 *   اللمسة   out of the oven: cheese is grated on top, basil floats down —
 *            and it is the real Pizzeria 450 pizza
 *
 * Each ingredient gets a small label pinned to it in 3D while it is used.
 *
 * When the film exists (`npm run film`, see PIZZA.film), a real-looking video
 * of the same steps plays over the 3D, scrubbed by the scroll, and the 3D
 * rests underneath. The 3D takes over again if the video cannot play.
 */
export function PizzaScene() {
  const noWorld = useStory((st) => !QUALITY.webgl || st.worldFailed);
  const root = useRef(null);
  const words = useRef([]);
  const heat = useRef(null);
  const steps = useRef(null);
  const items = useRef([]);
  const fills = useRef([]);
  const tags = useRef({});
  const film = useRef(null);
  const filmWrap = useRef(null);
  const [filmFailed, setFilmFailed] = useState(false);
  const [filmReady, setFilmReady] = useState(false);
  const filmOn = !!PIZZA_FILM && !filmFailed;
  const onFilmFailed = useCallback(() => setFilmFailed(true), []);
  const onFilmReady = useCallback(() => setFilmReady(true), []);
  const tagEls = useRef({});

  // Film on screen → pause the 3D underneath; keep the labels on the film.
  useEffect(() => {
    if (!filmOn) return undefined;
    const mk = () => story.film?.marks.pizza;
    const onFrame = (t) => {
      const m = mk();
      if (!m) return;
      const local = ((t - m.start) / (m.end - m.start)) * PIZZA.duration; // screens
      story.set({ worldCovered: filmReady && local > 0.35 && local < 9.7 });
      if (local < 0 || local > PIZZA.duration) return;
      const r = film.current?.frameRect();
      if (!r) return;
      for (const [id, cfg] of Object.entries(PIZZA.film.tags)) {
        const el = tagEls.current[id];
        if (el) el.style.transform = `translate3d(${(r.x + cfg.x * r.w).toFixed(1)}px,${(r.y + cfg.y * r.h).toFixed(1)}px,0)`;
      }
    };
    story.onFrame.add(onFrame);
    onFrame(story.time);
    return () => {
      story.onFrame.delete(onFrame);
      story.set({ worldCovered: false });
    };
  }, [filmOn, filmReady]);

  useSceneTimeline((tl) => {
    fadeIn(tl, root.current, 0, 0.02);

    // ── 01 Dough ─────────────────────────────────────────────────
    shot(tl, 'doughLow', 0, S(0.5), 'power2.inOut');
    worldTo(tl, { flour: 1 }, S(0.2), S(0.7), 'power1.out');
    worldTo(tl, { dough: 0.4 }, S(0.7), S(0.7), 'power2.inOut'); // pressed with the fingers
    worldTo(tl, { dough: 1 }, S(1.4), S(0.7), 'power2.inOut'); // stretched and turned
    shot(tl, 'doughTop', S(1.3), S(0.6));

    // ── 02 Sauce ─────────────────────────────────────────────────
    shot(tl, 'sauceBowl', S(2.0), S(0.45));
    worldTo(tl, { sauce: 1 }, S(2.4), S(2.0), 'none');
    shot(tl, 'sauceSpread', S(2.72), S(0.45));

    // ── 03 Cheese ────────────────────────────────────────────────
    shot(tl, 'mozzBall', S(4.3), S(0.5));
    worldTo(tl, { cheese: 1 }, S(4.7), S(1.4), 'none');
    shot(tl, 'cheeseFlight', S(4.95), S(0.5));
    shot(tl, 'cheeseTop', S(5.6), S(0.5));

    // ── 04 Oven ──────────────────────────────────────────────────
    shot(tl, 'ovenFront', S(6.1), S(0.5));
    worldTo(tl, { peel: 1 }, S(6.2), S(0.8), 'power1.inOut');
    worldTo(tl, { fire: 1 }, S(6.5), S(0.5), 'power2.in');
    shot(tl, 'ovenMouth', S(6.9), S(0.45), 'power2.inOut');
    worldTo(tl, { bake: 1 }, S(7.1), S(1.1), 'none');
    if (!PIZZA_FILM) {
      tl.fromTo(heat.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: S(0.4) }, S(7.1));
      tl.to(heat.current, { autoAlpha: 0, duration: S(0.4) }, S(8.0));
    }

    // ── …out, and the finishing touch ────────────────────────────
    worldTo(tl, { fire: 0.55 }, S(8.2), S(0.4));
    worldTo(tl, { out: 1 }, S(8.2), S(0.6), 'power1.inOut');
    shot(tl, 'finishTop', S(8.55), S(0.45));
    worldTo(tl, { finish: 1 }, S(8.85), S(0.9), 'none');
    worldTo(tl, { steam: 1 }, S(9.6), S(0.3));
    shot(tl, 'pizzaHero', S(9.6), S(0.4), 'power2.inOut');

    // ── Words + checklist ────────────────────────────────────────
    const beats = [
      [0.4, 2.0],
      [2.3, 4.2],
      [4.5, 6.0],
      [6.4, 8.2],
      [8.9, 9.8],
    ];
    beats.forEach(([a, b], i) => {
      textIn(tl, words.current[i], S(a), { dur: S(0.45), stagger: S(0.08) });
      textOut(tl, words.current[i], S(b), { dur: S(0.3) });
      stepTween(tl, items, fills, i, S(a), S(b));
    });
    fadeIn(tl, steps.current, S(0.2), S(0.3));
    fadeOut(tl, steps.current, S(9.8), S(0.2));

    // ── The film: each clip is scrubbed over its part of the scene ─
    if (PIZZA_FILM) {
      const head = { v: 0 };
      PIZZA.film.clips.forEach(({ id, at: [a, b] }, i) => {
        const c = PIZZA_FILM.clips[id];
        if (!c) return;
        tl.fromTo(
          head,
          { v: c.from },
          { v: c.to - 1 / PIZZA_FILM.fps, duration: S(b - a), ease: 'none', immediateRender: i === 0, onUpdate: () => film.current?.seek(head.v) },
          S(a),
        );
      });
      fadeIn(tl, filmWrap.current, 0, S(0.3));
      fadeOut(tl, filmWrap.current, S(9.7), S(0.25));
    }

    // ── Ingredient labels (pinned to the ingredients) ────────────
    const tag = (id, a, b) => {
      const el = tags.current[id];
      if (!el) return;
      tl.fromTo(el, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: S(0.2), ease: 'power2.out' }, S(a));
      tl.to(el, { autoAlpha: 0, y: -8, duration: S(0.2) }, S(b));
    };
    if (PIZZA_FILM) {
      for (const [id, { at }] of Object.entries(PIZZA.film.tags)) tag(id, at[0], at[1]);
    } else {
      tag('flour', 0.35, 1.2);
      tag('sauce', 2.1, 2.75);
      tag('cheese', 4.4, 5.0);
      tag('grated', 8.8, 9.25);
      tag('basil', 9.2, 9.55);
    }

    tl.to(root.current, { autoAlpha: 0, duration: 0.01 }, 0.99);
  });

  return (
    <section ref={root} className={`scene world-scene pizza${filmOn ? ' has-film' : ''}`} aria-label="البيتزا">
      {noWorld ? (
        <div className="world-fallback">
          <Media image={{ src: '/images/story/pizza', position: '43% 55%' }} />
        </div>
      ) : null}
      {PIZZA_FILM ? (
        <div ref={filmWrap} className={`pizza__film${filmOn ? '' : ' is-off'}`}>
          <ScrollFilm ref={film} film={PIZZA_FILM} onFailed={onFilmFailed} onReady={onFilmReady} />
        </div>
      ) : null}
      <div ref={heat} className="pizza__heat" aria-hidden="true" />

      {/* labels pinned to the ingredients (moved every frame by the film or the 3D world) */}
      {noWorld && !filmOn
        ? null
        : Object.entries(PIZZA.tags).map(([id, label]) => (
            <div
              key={id}
              className="ingredient-tag"
              ref={(el) => {
                tagEls.current[id] = el;
                registerAnchor(id, filmOn ? null : el);
              }}
              aria-hidden="true"
            >
              <div className="ingredient-tag__inner" ref={(el) => (tags.current[id] = el)}>
                <i className="ingredient-tag__dot" />
                <i className="ingredient-tag__line" />
                <span className="ingredient-tag__label">{label}</span>
              </div>
            </div>
          ))}

      <StepList ref={steps} steps={PIZZA.steps} items={items} fills={fills} />

      <div className="scene__text world-scene__text pizza__words">
        {PIZZA.steps.map((s, i) => (
          <StoryText key={s.id} ref={(el) => (words.current[i] = el)} className={`display ${s.id === 'oven' || s.id === 'finish' ? 'display--m' : 'display--xl'}`} text={s.text} />
        ))}
      </div>
    </section>
  );
}
