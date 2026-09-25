import { StoryText } from '../../StoryText/StoryText';
import './StepList.css';

/**
 * A small vertical checklist (01 الأرضية, 02 الجدران…). Each item has a
 * hairline that fills while its step happens; the scene timeline animates
 * `fills.current[i]` (scaleX) and `items.current[i]` (class-free opacity).
 */
export function StepList({ steps, items, fills, className = '', ref }) {
  return (
    <ol ref={ref} className={`step-list ${className}`} aria-hidden="true">
      {steps.map((s, i) => (
        <li key={i} ref={(el) => (items.current[i] = el)} className="step-list__item">
          <span className="step-list__no latin">{s.no ?? String(i + 1).padStart(2, '0')}</span>
          <StoryText as="span" className="step-list__label is-static" text={s.label ?? s} />
          <i className="step-list__line">
            <i ref={(el) => (fills.current[i] = el)} className="step-list__fill" />
          </i>
        </li>
      ))}
    </ol>
  );
}

/** Animate a step: highlight + fill its line between `from` and `to` (scene time). */
export function stepTween(tl, items, fills, i, from, to) {
  const item = items.current[i];
  const fill = fills.current[i];
  if (!item || !fill) return;
  tl.fromTo(item, { opacity: 0.38 }, { opacity: 1, duration: 0.03 }, from);
  tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: Math.max(0.01, to - from) }, from);
  tl.to(item, { opacity: 0.62, duration: 0.03 }, to);
}
