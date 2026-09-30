import { useRef } from 'react';
import { QUALITY } from '../../../config/quality';
import { useSceneArmed, useSceneTimeline } from '../../../story/context';
import { fadeIn, fadeOut } from '../../../story/helpers';
import { Slate, StoryText } from '../../StoryText/StoryText';
import { PlaceVideo } from './PlaceVideo';
import './PlaceScene.css';

/** The exterior and interior share one four-shot walk through the real place. */
export function PlaceFilmScene({ chapter, label }) {
  const root = useRef(null);
  const panels = useRef([]);
  const copy = useRef([]);
  const fills = useRef([]);
  const armed = useSceneArmed();

  useSceneTimeline((tl) => {
    fadeIn(tl, root.current, 0, 0.035);
    chapter.shots.forEach((shot, i) => {
      const start = i / chapter.shots.length;
      const end = (i + 1) / chapter.shots.length;
      fadeIn(tl, panels.current[i], start, 0.055);
      fadeIn(tl, copy.current[i], start + 0.025, 0.055,
        { y: QUALITY.reducedMotion ? 0 : 16 }, { y: 0 });
      tl.fromTo(fills.current[i], { scaleX: 0 }, { scaleX: 1, duration: end - start, ease: 'none' }, start);
      if (i < chapter.shots.length - 1) fadeOut(tl, panels.current[i], end, 0.055);
    });
    fadeOut(tl, root.current, 0.975, 0.025);
  });

  return (
    <section ref={root} className="scene place-tour" aria-label={label}>
      <div className="place-tour__heading">
        <Slate label={chapter.slate.label} value={chapter.slate.value} />
        <span className="place-tour__edition" lang="en">A LITTLE CLOSER</span>
      </div>

      {chapter.shots.map((shot, i) => (
        <div key={shot.id} ref={(el) => (panels.current[i] = el)} className={`place-tour__shot place-tour__shot--${shot.format}`}>
          {armed ? <img className="place-tour__ambient" src={`/video/place/${shot.id}.webp`} alt="" aria-hidden="true" /> : null}
          <div className="place-tour__layout">
            <figure className="place-tour__figure">
              <div className="place-tour__frame">
                <PlaceVideo shot={shot} start={i / chapter.shots.length} end={(i + 1) / chapter.shots.length} />
                <span className="place-tour__frame-no" aria-hidden="true">{shot.no} / 04</span>
                <div className="place-tour__progress" aria-hidden="true"><i ref={(el) => (fills.current[i] = el)} /></div>
              </div>
              <figcaption>{shot.caption}</figcaption>
            </figure>

            <div ref={(el) => (copy.current[i] = el)} className="place-tour__copy" dir="rtl">
              <p className="place-tour__eyebrow"><span>{shot.no}</span>{shot.label}</p>
              <h2 className="place-tour__title">
                {shot.title.split('\n').map((line) => <StoryText key={line} as="span" className="is-static" text={line} />)}
              </h2>
              <p className="place-tour__body">{shot.text}</p>
              <ul className="place-tour__details" aria-label="تفاصيل المكان">
                {shot.details.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
            </div>
          </div>
        </div>
      ))}

      <div className="place-tour__footer" aria-hidden="true">
        <span>مرّر بهدوء… واكتشف التفاصيل</span>
        <span className="latin">Pizzeria 450°</span>
      </div>
    </section>
  );
}
