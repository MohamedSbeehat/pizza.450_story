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
import { PizzaEnding } from './PizzaEnding';
import '../common/WorldScenes.css';
import './PizzaScene.css';

/** Times below are in "screens" of scrolling; the scene lasts PIZZA.duration. */
const S = (screens) => screens / PIZZA.duration;

/** The film leaves the screen here (in screens), after the ending. */
const FILM_OUT = PIZZA.duration - 0.25;
/** The ending: the finished pizza settles, then the logo and the buttons. */
const END = PIZZA.duration - 1.7;
/** Labels the 3D version pins to its objects. */
const TAGS_3D = ['flour', 'sauce', 'cheese', 'grated', 'basil'];
/** When each big line shows, [in, out] in screens (3D version / film). */
const BEATS_3D = [
  [0.4, 2.0],
  [2.3, 4.2],
  [4.5, 6.0],
  [6.4, 8.2],
  [9.4, 10.3],
];
const BEATS_FILM = [
  [0.4, 2.1],
  [2.5, 3.8],
  [4.1, 5.4],
  [5.7, 8.7],
  [9.0, 10.15],
];

/**
 * For viewers who prefer reduced motion: one still per clip instead of a
 * moving film — a frame ~60% into the clip (the step done), taken from the
 * every-8th-frame pack so nothing else has to load.
 */
function stillOf(id) {
  const c = PIZZA_FILM.clips[id];
  const every = PIZZA_FILM.keyEvery || 1;
  const last = PIZZA_FILM.frames - 1;
  const at = id === PIZZA.film.clips[PIZZA.film.clips.length - 1].id ? c.to : c.from + (c.to - c.from) * 0.6;
  const f = Math.min(Math.floor(last / every) * every, Math.round((at * PIZZA_FILM.fps) / every) * every);
  return f / PIZZA_FILM.fps;
}

/**
 * Scene 5 — البيتزا, filmed like a food video.
 *
 *   العجين   the dough is kneaded, then the base is shaped by hand
 *   الصوص    the ladle pours the sauce in the centre and spreads it
 *   الجبنة   torn pieces of mozzarella go onto the sauce
 *   الفرن    into the copper oven: the cheese melts, the crust puffs up,
 *            and the peel pulls it out
 *   اللمسة   the real Pizzeria 450 pizza — then the logo and the buttons
 *
 * When the film exists (`npm run film`, see PIZZA.film), a real-looking film
 * of these steps is scrubbed by the scroll, with small labels pinned to the
 * ingredients. Without it — or if it cannot play — the same steps play in 3D
 * (the world underneath rests while the film covers it).
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
  const shade = useRef(null);
  const blackout = useRef(null);
  const ending = useRef({});
  const [filmFailed, setFilmFailed] = useState(false);
  const [filmReady, setFilmReady] = useState(false);
  const filmOn = !!PIZZA_FILM && !filmFailed;
  const stills = QUALITY.reducedMotion;
  const onFilmFailed = useCallback(() => setFilmFailed(true), []);
  const onFilmReady = useCallback(() => setFilmReady(true), []);
  const tagEls = useRef({});
  // the 3D labels always stay mounted (so their tweens survive a film that fails
  // later); the film-only ones (e.g. 450° at the oven) only while the film plays
  const tagIds = filmOn ? [...TAGS_3D, ...Object.keys(PIZZA.film.tags).filter((id) => !TAGS_3D.includes(id))] : TAGS_3D;

  // Film on screen → pause the 3D underneath; keep the labels on the film.
  useEffect(() => {
    if (!filmOn) return undefined;
    const mk = () => story.film?.marks.pizza;
    const onFrame = (t) => {
      const m = mk();
      if (!m) return;
      const local = ((t - m.start) / (m.end - m.start)) * PIZZA.duration; // screens
      story.set({ worldCovered: filmReady && local > 0.35 && local < FILM_OUT });
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

    // ── The light: a dark kitchen, a golden pool on the counter ───
    // (like a food commercial; it grows warmer as the pizza nears the fire)
    worldTo(tl, { mood: 0.8 }, 0, S(0.8), 'power1.inOut');
    worldTo(tl, { mood: 1 }, S(4.3), S(1.8));

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

    // ── «The lights go out» ──────────────────────────────────────
    // the camera steps back from the fire, the kitchen lights flicker and die:
    // for a moment only the oven glows
    shot(tl, 'ovenDark', S(8.0), S(0.5), 'power2.inOut');
    worldTo(tl, { blackout: 0.6 }, S(8.35), S(0.04), 'power4.in');
    worldTo(tl, { blackout: 0.12 }, S(8.39), S(0.05));
    worldTo(tl, { blackout: 0.85 }, S(8.44), S(0.04), 'power4.in');
    worldTo(tl, { blackout: 0.4 }, S(8.48), S(0.03));
    worldTo(tl, { blackout: 1 }, S(8.51), S(0.05));
    // …then golden beams slowly come down from above and from the sides
    worldTo(tl, { beams: 1 }, S(8.9), S(0.8), 'power1.inOut');

    // ── Out of the fire, into the light — and the finishing touch ─
    worldTo(tl, { out: 1 }, S(9.0), S(0.7), 'power1.inOut');
    worldTo(tl, { fire: 0.7 }, S(9.2), S(0.4));
    shot(tl, 'finishTop', S(9.45), S(0.45));
    worldTo(tl, { finish: 1 }, S(9.7), S(0.8), 'none');
    worldTo(tl, { steam: 1 }, S(10.1), S(0.4));

    // ── The hero: the camera circles the pizza, the light sweeps across it
    shot(tl, 'heroOrbitA', S(10.2), S(0.6), 'sine.inOut');
    worldTo(tl, { sweep: 1 }, S(10.2), S(1.5), 'sine.inOut');
    shot(tl, 'heroOrbitB', S(10.8), S(0.6), 'sine.inOut');
    shot(tl, 'heroClose', S(11.35), S(0.4), 'power2.inOut');

    // …and the lights come back on for the first table
    worldTo(tl, { mood: 0, blackout: 0, beams: 0 }, S(11.72), S(0.26), 'power1.inOut');

    // ── Words + checklist ────────────────────────────────────────
    const beats = PIZZA_FILM ? BEATS_FILM : BEATS_3D;
    beats.forEach(([a, b], i) => {
      textIn(tl, words.current[i], S(a), { dur: S(0.45), stagger: S(0.08) });
      textOut(tl, words.current[i], S(b), { dur: S(0.3) });
      stepTween(tl, items, fills, i, S(a), S(b));
    });
    fadeIn(tl, steps.current, S(0.2), S(0.3));
    fadeOut(tl, steps.current, S(beats[beats.length - 1][1]), S(0.2));

    // ── The film: each clip is scrubbed over its part of the scene ─
    if (PIZZA_FILM) {
      const head = { v: 0 };
      const seek = () => film.current?.seek(head.v);
      PIZZA.film.clips.forEach(({ id, at: [a, b] }, i) => {
        const c = PIZZA_FILM.clips[id];
        if (!c) return;
        // reduced motion: hold one still per clip; otherwise scrub through it
        const [from, to] = stills ? [stillOf(id), stillOf(id)] : [c.from, c.to - 1 / PIZZA_FILM.fps];
        tl.fromTo(head, { v: from }, { v: to, duration: S(b - a), ease: 'none', immediateRender: i === 0, onUpdate: seek }, S(a));
      });
      fadeIn(tl, filmWrap.current, 0, S(0.3));

      // «Lights out»: the kitchen light flickers and dies where PIZZA.film.lightsOut
      // starts; that shot comes out of the dark, lit only in gold.
      const dark = PIZZA.film.clips.find((c) => c.id === PIZZA.film.lightsOut);
      if (dark && !stills) {
        const t = dark.at[0];
        const b = blackout.current;
        tl.fromTo(b, { autoAlpha: 0 }, { autoAlpha: 0.72, duration: S(0.03), ease: 'power4.in' }, S(t - 0.2));
        tl.to(b, { autoAlpha: 0.12, duration: S(0.035) }, S(t - 0.165));
        tl.to(b, { autoAlpha: 0.9, duration: S(0.03), ease: 'power4.in' }, S(t - 0.1));
        tl.to(b, { autoAlpha: 0.45, duration: S(0.03) }, S(t - 0.07));
        tl.to(b, { autoAlpha: 1, duration: S(0.03) }, S(t - 0.035));
        tl.to(b, { autoAlpha: 0, duration: S(0.5), ease: 'power1.inOut' }, S(t + 0.12));
      }
      // the finished pizza settles: a slow push-in while the light goes down
      tl.fromTo(filmWrap.current, { scale: 1 }, { scale: stills ? 1 : 1.06, duration: S(FILM_OUT - END), ease: 'sine.out' }, S(END));
      fadeOut(tl, filmWrap.current, S(FILM_OUT), S(0.2));
    }
    fadeIn(tl, shade.current, S(END + 0.05), S(0.5), {}, { ease: 'power1.inOut' });
    fadeOut(tl, shade.current, S(FILM_OUT), S(0.2));

    // ── Ingredient labels (pinned to the ingredients) ────────────
    const tag = (id, a, b) => {
      const el = tags.current[id];
      if (!el) return;
      tl.fromTo(el, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: S(0.2), ease: 'power2.out' }, S(a));
      tl.to(el, { autoAlpha: 0, y: -8, duration: S(0.2) }, S(b));
    };
    if (filmOn) {
      for (const [id, { at }] of Object.entries(PIZZA.film.tags)) tag(id, at[0], at[1]);
    } else {
      tag('flour', 0.35, 1.2);
      tag('sauce', 2.1, 2.75);
      tag('cheese', 4.4, 5.0);
      tag('grated', 9.72, 10.15);
      tag('basil', 10.1, 10.45);
    }

    // ── The ending: logo, name, line, buttons ────────────────────
    const e = ending.current;
    tl.fromTo(e.logo, { autoAlpha: 0, scale: 0.8, y: 20 }, { autoAlpha: 1, scale: 1, y: 0, duration: S(0.35), ease: 'power2.out' }, S(END + 0.15));
    textIn(tl, e.title, S(END + 0.3), { dur: S(0.35), stagger: S(0.1), y: 30 });
    fadeIn(tl, e.descriptor, S(END + 0.45), S(0.3), { y: 10 }, { y: 0 });
    textIn(tl, e.line, S(END + 0.55), { dur: S(0.3), stagger: S(0.03), y: 14, blur: 8 });
    if (e.actions) {
      tl.fromTo(e.actions.children, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: S(0.25), stagger: S(0.08), ease: 'power2.out' }, S(END + 0.75));
    }
    fadeOut(tl, [e.logo, e.title, e.descriptor, e.line, e.actions].filter(Boolean), S(FILM_OUT - 0.05), S(0.2));

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
          <ScrollFilm ref={film} film={PIZZA_FILM} stillsOnly={stills} onFailed={onFilmFailed} onReady={onFilmReady} />
        </div>
      ) : null}
      {PIZZA_FILM ? <div ref={blackout} className="pizza__blackout" aria-hidden="true" /> : null}
      <div ref={heat} className="pizza__heat" aria-hidden="true" />
      <div ref={shade} className="pizza__shade" aria-hidden="true" />

      {/* labels pinned to the ingredients (moved every frame by the film or the 3D world) */}
      {noWorld && !filmOn
        ? null
        : tagIds.map((id) => (
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
                <span className={`ingredient-tag__label${/^[\d°\s]+$/.test(PIZZA.tags[id]) ? ' latin' : ''}`}>{PIZZA.tags[id]}</span>
              </div>
            </div>
          ))}

      <StepList ref={steps} steps={PIZZA.steps} items={items} fills={fills} />

      <div className="scene__text world-scene__text pizza__words">
        {PIZZA.steps.map((s, i) => (
          <StoryText key={s.id} ref={(el) => (words.current[i] = el)} className={`display ${s.id === 'oven' || s.id === 'finish' ? 'display--m' : 'display--xl'}`} text={s.text} />
        ))}
      </div>

      <PizzaEnding parts={ending} />
    </section>
  );
}
