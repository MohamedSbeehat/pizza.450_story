import { useMemo, useRef } from 'react';
import { SUNRISE } from '../../../data/story';
import { useSceneTimeline } from '../../../story/context';
import { textIn, textOut, fadeIn, m } from '../../../story/helpers';
import { StoryText, Slate } from '../../StoryText/StoryText';
import { skyline, VIEW } from './skyline';
import './SunriseScene.css';

const HERO = { x: 800, w: 190, h: 300 };

/**
 * Scene 1 — البداية
 * Night over the rooftops. With the scroll the sun rises, the sky warms, the
 * city lights go out… and one window catches the first light: an idea.
 * The camera then flies into that window (→ Scene 2).
 */
export function SunriseScene() {
  const root = useRef(null);
  const cam = useRef(null);
  const sky = useRef(null);
  const stars = useRef(null);
  const sun = useRef(null);
  const halo = useRef(null);
  const rays = useRef(null);
  const clouds = useRef(null);
  const haze = useRef(null);
  const far = useRef(null);
  const mid = useRef(null);
  const cityLights = useRef(null);
  const near = useRef(null);
  const glint = useRef(null);
  const flare = useRef(null);
  const slate = useRef(null);
  const scrim = useRef(null);
  const lines = useRef([]);

  const layers = useMemo(
    () => ({
      far: skyline({ seed: 11, min: 150, max: 290, detail: 0.6 }),
      mid: skyline({ seed: 23, min: 90, max: 220, detail: 1, lit: 0.16 }),
      near: skyline({ seed: 5, min: 50, max: 190, detail: 1.3, lit: 0.1, hero: HERO }),
    }),
    [],
  );
  const hw = layers.near.hero;

  /**
   * Position of the idea window inside the (untransformed) camera, in px.
   * The camera scales around this point for the whole scene, so the final
   * fly-in lands exactly in the window at any screen size.
   */
  const windowPoint = () => {
    const el = near.current;
    if (!el) return { x: window.innerWidth / 2, y: window.innerHeight * 0.6 };
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const s = Math.max(w / VIEW.W, h / VIEW.H);
    const ox = (w - VIEW.W * s) / 2;
    const oy = h - VIEW.H * s;
    return { x: ox + (hw.x + hw.w / 2) * s, y: el.offsetTop + oy + (hw.y + hw.h / 2) * s };
  };
  const windowOrigin = () => {
    const p = windowPoint();
    return `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`;
  };

  useSceneTimeline((tl) => {
    fadeIn(tl, root.current, 0, 0.12);

    // Night → dawn
    tl.fromTo(sky.current, { yPercent: 0 }, { yPercent: -60, duration: 0.8, ease: 'sine.inOut' }, 0);
    tl.fromTo(stars.current, { opacity: 0.9 }, { opacity: 0, duration: 0.38, ease: 'power1.in' }, 0.08);
    tl.fromTo(sun.current, { yPercent: 110 }, { yPercent: -95, duration: 0.74, ease: 'sine.out' }, 0.04);
    tl.fromTo(halo.current, { scale: 0.55, opacity: 0.2 }, { scale: 1.25, opacity: 1, duration: 0.7, ease: 'sine.out' }, 0.08);
    tl.fromTo(rays.current, { opacity: 0, rotate: -6 }, { opacity: 0.55, rotate: 4, duration: 0.5, ease: 'sine.inOut' }, 0.32);
    tl.fromTo(clouds.current, { xPercent: 3, opacity: 0.35 }, { xPercent: -4, opacity: 0.95, duration: 0.9 }, 0);
    tl.fromTo(haze.current, { opacity: 0.15 }, { opacity: 0.85, duration: 0.6 }, 0.12);
    tl.fromTo(cityLights.current, { opacity: 1 }, { opacity: 0, duration: 0.3 }, 0.3);

    // Slow camera drift toward the window; near layers move more (depth)
    tl.fromTo(
      cam.current,
      { scale: 1, transformOrigin: windowOrigin },
      { scale: m(1.08), transformOrigin: windowOrigin, duration: 0.72, ease: 'sine.inOut' },
      0,
    );
    tl.fromTo(far.current, { yPercent: 2 }, { yPercent: 0, duration: 0.72 }, 0);
    tl.fromTo(mid.current, { yPercent: 5 }, { yPercent: 0, duration: 0.72 }, 0);
    tl.fromTo(near.current, { yPercent: 9 }, { yPercent: 0, duration: 0.72, ease: 'sine.out' }, 0);

    // Text (a soft shadow behind it keeps it readable on the bright sky)
    tl.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.08);
    tl.to(scrim.current, { opacity: 0, duration: 0.08 }, 0.66);
    fadeIn(tl, slate.current, 0.06, 0.08, { y: 12 }, { y: 0 });
    textIn(tl, lines.current[0], 0.12, { dur: 0.12 });
    textIn(tl, lines.current[1], 0.38, { dur: 0.1 });
    textOut(tl, lines.current[0], 0.66);
    textOut(tl, lines.current[1], 0.68);
    tl.to(slate.current, { autoAlpha: 0, duration: 0.06 }, 0.66);

    // …one window catches the first light: an idea
    tl.fromTo(glint.current, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.1, ease: 'power2.out' }, 0.5);

    // Fly into the window; its light fills the frame
    tl.to(cam.current, { scale: m(7, 1.08), duration: 0.25, ease: 'power3.in' }, 0.74);
    tl.fromTo(
      flare.current,
      { opacity: 0, scale: 0.15, left: () => windowPoint().x, top: () => windowPoint().y },
      { opacity: 1, scale: 1, left: () => windowPoint().x, top: () => windowPoint().y, duration: 0.18, ease: 'power2.in' },
      0.78,
    );
    tl.to(root.current, { autoAlpha: 0, duration: 0.01 }, 0.99);
  });

  return (
    <section ref={root} className="scene sunrise" aria-label="البداية">
      <div ref={cam} className="sunrise__cam">
        <div ref={sky} className="sunrise__sky" />
        <div ref={stars} className="sunrise__stars" />
        <div ref={sun} className="sunrise__sun">
          <i ref={halo} className="sunrise__halo" />
          <i className="sunrise__core" />
        </div>
        <div ref={rays} className="sunrise__rays" />
        <div ref={clouds} className="sunrise__clouds">
          <i />
          <i />
          <i />
          <i />
        </div>

        <div ref={far} className="sunrise__layer sunrise__layer--far">
          <svg viewBox={`0 0 ${VIEW.W} ${VIEW.H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <path d={layers.far.d} />
          </svg>
        </div>
        <div ref={haze} className="sunrise__haze" />
        <div ref={mid} className="sunrise__layer sunrise__layer--mid">
          <svg viewBox={`0 0 ${VIEW.W} ${VIEW.H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <path d={layers.mid.d} />
          </svg>
        </div>
        <div ref={near} className="sunrise__layer sunrise__layer--near">
          <svg viewBox={`0 0 ${VIEW.W} ${VIEW.H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <path d={layers.near.d} />
          </svg>
          {/* City lights (go out at dawn) — separate layer so fading it is cheap */}
          <svg ref={cityLights} className="sunrise__lights" viewBox={`0 0 ${VIEW.W} ${VIEW.H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            {layers.near.windows.map((w, i) => (
              <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h} />
            ))}
          </svg>
          {/* The idea: first light caught in one window */}
          <svg ref={glint} className="sunrise__glint" viewBox={`0 0 ${VIEW.W} ${VIEW.H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <defs>
              <radialGradient id="glintGlow">
                <stop offset="0" stopColor="#fff1cf" stopOpacity="1" />
                <stop offset="0.25" stopColor="#ffc56e" stopOpacity="0.7" />
                <stop offset="1" stopColor="#e8892b" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="glintRayH" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#ffd28a" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff4dc" stopOpacity="0.95" />
                <stop offset="1" stopColor="#ffd28a" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="glintRayV" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#ffd28a" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff4dc" stopOpacity="0.9" />
                <stop offset="1" stopColor="#ffd28a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect x={hw.x} y={hw.y} width={hw.w} height={hw.h} fill="#ffcf85" />
            <circle cx={hw.x + hw.w / 2} cy={hw.y + hw.h / 2} r="95" fill="url(#glintGlow)" />
            <rect x={hw.x + hw.w / 2 - 170} y={hw.y + hw.h / 2 - 1.5} width="340" height="3" fill="url(#glintRayH)" />
            <rect x={hw.x + hw.w / 2 - 1.5} y={hw.y + hw.h / 2 - 75} width="3" height="150" fill="url(#glintRayV)" />
          </svg>
        </div>
        <div className="sunrise__ground" />
      </div>
      {/* Light that bursts from the window and carries us into Scene 2 */}
      <div ref={flare} className="sunrise__flare" />

      <div ref={scrim} className="sunrise__scrim" aria-hidden="true" />
      <div className="scene__text sunrise__text">
        <Slate ref={slate} label={SUNRISE.slate.label} value={SUNRISE.slate.value} />
        {SUNRISE.lines.map((line, i) => (
          <StoryText key={i} ref={(el) => (lines.current[i] = el)} className="display" text={line} />
        ))}
      </div>
    </section>
  );
}
