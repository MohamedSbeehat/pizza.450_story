import { useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { TIMELINE, CHAPTERS, WORLD_SCENES, PACE } from '../data/story';
import { QUALITY } from '../config/quality';
import { story } from './store';
import { StoryContext } from './context';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * The film projector.
 *
 * Every scene registers a timeline builder (useSceneTimeline). Once all scenes
 * are mounted, this provider assembles them into ONE master timeline, in the
 * order of TIMELINE (src/data/story.js), with overlaps for the transitions.
 * A ScrollTrigger then scrubs the master timeline with the scroll position:
 * scrolling is the playhead.
 *
 * The stage itself is position:fixed; the tall `.scroll-spacer` below it only
 * provides the scroll distance.
 */
export function StoryProvider({ children }) {
  const builders = useRef(new Map());
  const spacer = useRef(null);

  const api = useMemo(
    () => ({
      register(id, build) {
        builders.current.set(id, build);
        return () => builders.current.delete(id);
      },
    }),
    [],
  );

  // Runs after every scene's own layout effect (children first), so all
  // builders are registered by now.
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const instant = params.has('instant'); // testing: no scrub smoothing
    const unit = QUALITY.mobile ? PACE.mobile : PACE.desktop;

    // ── Smooth wheel scrolling (desktop) ─────────────────────────────
    let lenis = null;
    const raf = (t) => lenis?.raf(t * 1000);
    if (QUALITY.smoothScroll && !instant) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      story.lenis = lenis;
    }

    const ctx = gsap.context(() => {
      // ── Assemble the film ────────────────────────────────────────
      const master = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
      const marks = {};
      let cursor = 0;
      TIMELINE.forEach((entry, index) => {
        const start = index === 0 ? 0 : Math.max(0, cursor - (entry.overlap || 0));
        const tl = gsap.timeline({ defaults: { ease: 'none' } });
        builders.current.get(entry.id)?.(tl);
        tl.set({}, {}, 1); // normalised length = 1
        tl.duration(entry.duration); // …stretched to the scene's duration
        master.add(tl, start);
        marks[entry.id] = { start, end: start + entry.duration, index };
        cursor = start + entry.duration;
      });
      const total = cursor;
      spacer.current.style.height = `${(total * unit + 1) * 100}vh`;

      const sceneStarts = TIMELINE.map((e) => marks[e.id].start);
      const chapterStarts = CHAPTERS.map((c) => marks[c.scene]?.start ?? Infinity);
      const worldFrom = marks[WORLD_SCENES[0]].start - 0.05;
      const worldTo = marks[WORLD_SCENES[WORLD_SCENES.length - 1]].end + 0.05;
      // Load the 3D chunk while the viewer is still watching the sunrise.
      const armWorldAt = (marks.sunrise?.start ?? 0) + 0.5;

      const onUpdate = () => {
        const t = master.time();
        story.time = t;
        story.progress = t / total;

        let sceneIndex = 0;
        for (let i = 0; i < sceneStarts.length; i++) if (t >= sceneStarts[i] + 0.001) sceneIndex = i;
        let chapter = -1;
        for (let i = 0; i < chapterStarts.length; i++) if (t >= chapterStarts[i] - 0.02) chapter = i;

        const s = story.get();
        story.set({
          sceneIndex,
          sceneId: TIMELINE[sceneIndex].id,
          chapter,
          armedUpTo: Math.max(s.armedUpTo, sceneIndex + 2),
          worldArmed: s.worldArmed || t >= armWorldAt,
          worldVisible: t >= worldFrom && t <= worldTo,
          started: s.started || t > 0.02,
        });
        story.onFrame.forEach((fn) => fn(t, story.progress));
      };
      master.eventCallback('onUpdate', onUpdate);

      const trigger = ScrollTrigger.create({
        trigger: spacer.current,
        start: 'top top',
        end: 'bottom bottom',
        animation: master,
        scrub: instant ? true : QUALITY.touch ? 0.55 : 0.9,
        invalidateOnRefresh: true,
      });

      story.film = { master, marks, total, trigger };
      story.set({ ready: true });
      onUpdate();

      // Deep links (handy while editing): ?scene=pizza  or  ?t=14.2
      const deepScene = params.get('scene');
      const deepTime = parseFloat(params.get('t'));
      if (deepScene && marks[deepScene]) story.seekScene(deepScene, { instant: true });
      else if (!Number.isNaN(deepTime)) story.seekTime(deepTime, { instant: true });
    });

    if (import.meta.env.DEV || params.has('debug')) window.__story = story;

    return () => {
      ctx.revert();
      story.film = null;
      if (lenis) {
        gsap.ticker.remove(raf);
        lenis.destroy();
        story.lenis = null;
      }
    };
  }, []);

  return (
    <StoryContext.Provider value={api}>
      {children}
      <div ref={spacer} className="scroll-spacer" aria-hidden="true" />
    </StoryContext.Provider>
  );
}
