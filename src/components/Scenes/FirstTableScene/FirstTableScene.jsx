import { useRef } from 'react';
import { FIRST_TABLE } from '../../../data/story';
import { QUALITY } from '../../../config/quality';
import { useSceneTimeline } from '../../../story/context';
import { useStory } from '../../../story/store';
import { textIn, textOut, fadeIn, shot, worldTo } from '../../../story/helpers';
import { StoryText, Slate } from '../../StoryText/StoryText';
import { Media } from '../../Media/Media';
import '../common/WorldScenes.css';

/**
 * Scene 6 — أول تجربة (3D)
 * The first pizza is carried to a table under a warm lamp: «ومن أول بيتزا…».
 * The camera then rises over the whole lit restaurant with a promise to the
 * first guest — «صُنعت بحب… ومن أجلك خصيصًا» — and a burst of warm light
 * carries us into the montage (Scene 7).
 */
export function FirstTableScene() {
  const noWorld = useStory((st) => !QUALITY.webgl || st.worldFailed);
  const root = useRef(null);
  const lines = useRef([]);
  const slate = useRef(null);
  const promise = useRef([]);
  const leak = useRef(null);

  useSceneTimeline((tl) => {
    fadeIn(tl, root.current, 0, 0.04);

    worldTo(tl, { serve: 1 }, 0, 0.3, 'power1.inOut');
    shot(tl, 'tableClose', 0, 0.32, 'power2.inOut');
    worldTo(tl, { steam: 0.75 }, 0.26, 0.08);
    shot(tl, 'roomWide', 0.5, 0.42, 'sine.inOut');
    worldTo(tl, { fire: 0.7 }, 0.55, 0.2);

    // beat 1 — at the table
    textIn(tl, lines.current[0], 0.12);
    textIn(tl, lines.current[1], 0.28);
    textOut(tl, lines.current[0], 0.46);
    textOut(tl, lines.current[1], 0.47);

    // beat 2 — the promise, over the lit restaurant
    fadeIn(tl, slate.current, 0.54, 0.05, { y: 10 }, { y: 0 });
    textIn(tl, promise.current[0], 0.56);
    textIn(tl, promise.current[1], 0.66);
    textOut(tl, promise.current[0], 0.84);
    textOut(tl, promise.current[1], 0.85);
    tl.to(slate.current, { autoAlpha: 0, duration: 0.04 }, 0.84);

    // warm light leak → next scene
    tl.fromTo(leak.current, { autoAlpha: 0, xPercent: 30 }, { autoAlpha: 1, xPercent: 0, duration: 0.1, ease: 'power2.in' }, 0.89);
  });

  return (
    <section ref={root} className="scene world-scene first-table" aria-label="أول تجربة">
      {noWorld ? (
        <div className="world-fallback">
          <Media image={{ src: '/images/story/pizza', position: '43% 55%' }} />
        </div>
      ) : null}
      <div className="scene__text world-scene__text first-table__text">
        <div className="first-table__beat">
          {FIRST_TABLE.lines.map((line, i) => (
            <StoryText key={i} ref={(el) => (lines.current[i] = el)} className="display" text={line} />
          ))}
        </div>
        <div className="first-table__beat">
          <Slate ref={slate} label={FIRST_TABLE.slate.label} value={FIRST_TABLE.slate.value} />
          {FIRST_TABLE.promise.map((line, i) => (
            <StoryText key={i} ref={(el) => (promise.current[i] = el)} className="display" text={line} />
          ))}
        </div>
      </div>
      <div ref={leak} className="light-leak" aria-hidden="true" />
    </section>
  );
}
