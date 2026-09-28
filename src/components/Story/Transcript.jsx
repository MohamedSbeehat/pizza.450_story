import { SHOW_PLACEHOLDERS, INTRO, SUNRISE, PEOPLE, PLACE, BUILD, PIZZA, GROWTH, REVEAL, FINALE, LINKS } from '../../data/story';
import { isPlaceholder } from '../StoryText/StoryText';

const clean = (s) => String(s).replace(/\*/g, '');
const keep = (s) => s && (SHOW_PLACEHOLDERS || !isPlaceholder(s));

/**
 * The whole story as plain text for screen readers and search engines.
 * Visually hidden; the film itself is decorative motion around this text.
 */
export function Transcript() {
  const paragraphs = [
    [...INTRO.title, INTRO.subtitle],
    SUNRISE.lines,
    [...PEOPLE.first, ...PEOPLE.second, PEOPLE.note],
    PEOPLE.people.map((p) => `${p.name}: ${p.role}`),
    PLACE.lines,
    BUILD.lines,
    PIZZA.steps.map((s) => s.text),
    GROWTH.frames.map((f) => `${f.label}: ${f.story || ''}`),
    [REVEAL.title, ...REVEAL.lines],
    [...FINALE.lines, FINALE.title, FINALE.teaser?.title, FINALE.teaser?.text, FINALE.footer],
  ];
  return (
    <article className="sr-only" lang="ar">
      <h1>بيتزرية 450 — الحكاية</h1>
      {paragraphs.map((lines, i) => (
        <p key={i}>{lines.filter(keep).map(clean).join(' ')}</p>
      ))}
      <ul>
        {Object.values(LINKS).map((l) => (
          <li key={l.label}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>
    </article>
  );
}
