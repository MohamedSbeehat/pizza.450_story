import { Fragment, useMemo } from 'react';
import { SHOW_PLACEHOLDERS } from '../../data/story';
import './StoryText.css';

export const isPlaceholder = (s) => typeof s === 'string' && /^\s*\[.*\]\s*$/.test(s);

/**
 * Splits a line into word tokens for the reveal animation.
 * Arabic letters join inside a word, so we only ever split on spaces — never
 * into letters. `*accent phrase*` and `[placeholder text]` stay one token.
 */
function tokenize(text) {
  // "*الحلم*." → "*الحلم.*" so trailing punctuation stays with its word
  const src = String(text ?? '').replace(/\*([^*]+)\*([.,،…!؟?]+)/g, '*$1$2*');
  const tokens = [];
  for (const [raw] of src.matchAll(/\[[^\]]*\]|\*[^*]+\*|\S+/g)) {
    if (raw.startsWith('[')) tokens.push({ text: raw, kind: 'ph' });
    else if (raw.length > 2 && raw.startsWith('*') && raw.endsWith('*')) tokens.push({ text: raw.slice(1, -1), kind: 'acc' });
    else tokens.push({ text: raw, kind: '' });
  }
  return tokens;
}

/**
 * A line of story text. Every word is wrapped in <span class="w"> so the
 * timeline helpers (textIn / textOut) can reveal it word by word.
 */
export function StoryText({ text, as: Tag = 'p', className = '', ref, ...rest }) {
  const tokens = useMemo(() => tokenize(text), [text]);

  if (!text) return null;
  if (!SHOW_PLACEHOLDERS && isPlaceholder(text)) return null;

  return (
    <Tag ref={ref} className={`story-text ${className}`} {...rest}>
      {tokens.map((t, i) => {
        if (t.kind === 'ph' && !SHOW_PLACEHOLDERS) return null;
        return (
          <Fragment key={i}>
            {i > 0 ? ' ' : null}
            <span className={`w${t.kind ? ` ${t.kind}` : ''}`}>{t.text}</span>
          </Fragment>
        );
      })}
    </Tag>
  );
}

/** A group of lines (each line reveals separately). */
export function StoryLines({ lines, className = '', lineClassName = '', refs }) {
  return (
    <div className={`story-lines ${className}`}>
      {lines.map((line, i) => (
        <StoryText
          key={i}
          text={line}
          className={lineClassName}
          ref={(el) => {
            if (refs) refs.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}

/** Small documentary "slate": label — value (value may be a placeholder). */
export function Slate({ label, value, className = '', ref }) {
  if (!label && !value) return null;
  const showValue = value && (SHOW_PLACEHOLDERS || !isPlaceholder(value));
  return (
    <div ref={ref} className={`slate ${className}`}>
      <span className="slate__rule" aria-hidden="true" />
      <StoryText as="span" className="slate__label is-static" text={label} />
      {showValue ? <StoryText as="span" className="slate__value is-static" text={value} /> : null}
    </div>
  );
}
