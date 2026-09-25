import { useRef } from 'react';
import { BUILD } from '../../../data/story';
import { QUALITY } from '../../../config/quality';
import { useSceneTimeline } from '../../../story/context';
import { useStory } from '../../../story/store';
import { textIn, textOut, fadeIn, fadeOut, shot, worldTo } from '../../../story/helpers';
import { world, SHOTS, BUILD_PHASES } from '../../../three/worldState';
import { StoryText } from '../../StoryText/StoryText';
import { Media } from '../../Media/Media';
import { StepList, stepTween } from '../common/StepList';
import '../common/WorldScenes.css';

/**
 * Scene 4 — تجهيز المطعم (3D)
 * Out of the dark, a golden floor plan. Then the place assembles itself:
 * floor tiles, walls, the copper oven, tables, lamps… and the lights come on.
 * Real photos of the preparation float in as memories.
 */
export function BuildScene() {
  const noWorld = useStory((st) => !QUALITY.webgl || st.worldFailed);
  const root = useRef(null);
  const lines = useRef([]);
  const steps = useRef(null);
  const items = useRef([]);
  const fills = useRef([]);
  const cards = useRef([]);

  useSceneTimeline((tl) => {
    fadeIn(tl, root.current, 0, 0.04);

    // ── The 3D world ───────────────────────────────────────────
    const B0 = 0.06; // build starts
    const BD = 0.72; // build duration
    tl.fromTo(world.cam, { ...SHOTS.buildStart }, { ...SHOTS.buildMid, duration: 0.5, ease: 'sine.inOut' }, 0);
    worldTo(tl, { blueprint: 1 }, 0, 0.08, 'power1.out');
    worldTo(tl, { build: 1 }, B0, BD, 'none');
    worldTo(tl, { blueprint: 0 }, 0.26, 0.2);
    worldTo(tl, { fire: 0.3 }, B0 + BD * 0.55, 0.12);
    shot(tl, 'buildEnd', 0.5, 0.42, 'sine.inOut');
    worldTo(tl, { lights: 1 }, 0.78, 0.16, 'power1.inOut');

    // ── Checklist of what is being built ───────────────────────
    fadeIn(tl, steps.current, 0.06, 0.05);
    const phases = [BUILD_PHASES.floor, BUILD_PHASES.walls, BUILD_PHASES.oven, BUILD_PHASES.furniture];
    phases.forEach(([a, b], i) => stepTween(tl, items, fills, i, B0 + a * BD, B0 + b * BD));
    stepTween(tl, items, fills, 4, 0.78, 0.94); // lights
    fadeOut(tl, steps.current, 0.95, 0.04);

    // ── Words ──────────────────────────────────────────────────
    textIn(tl, lines.current[0], 0.1);
    textOut(tl, lines.current[0], 0.44);
    textIn(tl, lines.current[1], 0.62);
    textOut(tl, lines.current[1], 0.94);

    // ── Memories: real photos of the preparation ───────────────
    BUILD.memories.forEach((mem, i) => {
      const card = cards.current[i];
      if (!card) return;
      const tilt = i % 2 ? 3 : -3;
      tl.fromTo(card, { autoAlpha: 0, y: 70, rotate: tilt * 2 }, { autoAlpha: 1, y: 0, rotate: tilt, duration: 0.07, ease: 'power2.out' }, mem.at);
      tl.to(card, { y: -24, duration: 0.16 }, mem.at + 0.07);
      tl.to(card, { autoAlpha: 0, y: -60, duration: 0.06, ease: 'power1.in' }, mem.at + 0.2);
    });
    tl.to(root.current, { autoAlpha: 0, duration: 0.02 }, 0.98);
  });

  const stepLabels = BUILD.steps.map((label, i) => ({ label, no: String(i + 1).padStart(2, '0') }));

  return (
    <section ref={root} className="scene world-scene build" aria-label="تجهيز المطعم">
      {noWorld ? (
        <div className="world-fallback">
          <Media image={{ src: '/images/story/oven-copper', position: '50% 60%' }} />
        </div>
      ) : null}

      {BUILD.memories.map((mem, i) => (
        <figure key={i} ref={(el) => (cards.current[i] = el)} className={`memory memory--${i + 1}`}>
          <Media image={mem.image} className="memory__media" />
          <figcaption>
            <StoryText as="span" className="memory__caption is-static" text={mem.caption} />
            <StoryText as="span" className="memory__note is-static" text={mem.note} />
          </figcaption>
        </figure>
      ))}

      <StepList ref={steps} steps={stepLabels} items={items} fills={fills} />

      <div className="scene__text world-scene__text">
        {BUILD.lines.map((line, i) => (
          <StoryText key={i} ref={(el) => (lines.current[i] = el)} className="display" text={line} />
        ))}
      </div>
    </section>
  );
}
