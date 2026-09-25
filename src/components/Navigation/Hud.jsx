import { useEffect, useRef } from 'react';
import { CHAPTERS, BRAND } from '../../data/story';
import { story, useStory } from '../../story/store';
import './Hud.css';

/**
 * The film's frame UI, living inside the letterbox bars:
 *  top    — brand mark + chapter navigation (01 — البداية …)
 *  bottom — scroll progress line with chapter ticks + chapter counter
 */
export function Hud() {
  const chapter = useStory((s) => s.chapter);
  const ready = useStory((s) => s.ready);
  const fill = useRef(null);

  // Progress is written straight to the DOM every frame (no React render).
  useEffect(() => {
    const onFrame = (_t, p) => {
      if (fill.current) fill.current.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    story.onFrame.add(onFrame);
    return () => story.onFrame.delete(onFrame);
  }, []);

  const ticks = ready && story.film ? CHAPTERS.map((c) => (story.film.marks[c.scene]?.start ?? 0) / story.film.total) : [];
  const total = String(CHAPTERS.length).padStart(2, '0');

  return (
    <div className="hud">
      <header className="hud__top">
        <button type="button" className="hud__brand" onClick={() => story.seekTime(0)} aria-label="العودة إلى بداية القصة">
          <img src={`${BRAND.logo.src}.webp`} alt="" width="30" height="30" />
          <span>{BRAND.name}</span>
        </button>

        <nav className="hud__chapters" aria-label="فصول القصة">
          <ol>
            {CHAPTERS.map((c, i) => (
              <li key={c.no}>
                <button
                  type="button"
                  className={`hud__chapter${i === chapter ? ' is-active' : ''}${i < chapter ? ' is-past' : ''}`}
                  aria-current={i === chapter ? 'step' : undefined}
                  onClick={() => story.seekScene(c.scene)}
                >
                  <span className="hud__no">{c.no}</span>
                  <span className="hud__dash" aria-hidden="true">—</span>
                  <span className="hud__label">{c.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <footer className="hud__bottom" aria-hidden="true">
        <div className="hud__progress">
          <i className="hud__fill" ref={fill} />
          {ticks.map((p, i) => (
            <i key={i} className={`hud__tick${i <= chapter ? ' is-past' : ''}`} style={{ insetInlineStart: `${p * 100}%` }} />
          ))}
        </div>
        <span className="hud__count">
          {chapter >= 0 ? CHAPTERS[chapter].no : '00'} <span>/ {total}</span>
        </span>
      </footer>
    </div>
  );
}
