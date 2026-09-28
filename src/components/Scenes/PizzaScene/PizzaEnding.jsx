import { BRAND, LINKS, PIZZA } from '../../../data/story';
import { StoryText } from '../../StoryText/StoryText';
import { Media } from '../../Media/Media';

const ICONS = {
  contact: <path d="M5 5h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 14l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 6a1 1 0 0 1 1-1z" />,
  location: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17" cy="7" r="0.6" />
    </>
  ),
  menu: <path d="M5 6h14M5 12h14M5 18h9" />,
};

/** The links the ending shows: only real ones (not '#'), in PIZZA.ending order. */
const links = PIZZA.ending.buttons.map((key) => [key, LINKS[key]]).filter(([, l]) => l?.href && l.href !== '#');

/**
 * The end of the pizza chapter: over the settled, finished pizza — the logo,
 * the name, one line, and the buttons (the first real link is highlighted).
 * `parts` receives the elements the scene timeline animates.
 */
export function PizzaEnding({ parts }) {
  const set = (k) => (el) => {
    parts.current[k] = el;
  };
  return (
    <div className="pizza__ending">
      <div ref={set('logo')} className="pizza__logo">
        <Media image={{ ...BRAND.logo, fit: 'contain' }} eager />
      </div>
      <StoryText as="h2" ref={set('title')} className="pizza__title display display--m" text={BRAND.name} />
      <p ref={set('descriptor')} className="pizza__descriptor latin">
        {BRAND.descriptor}
      </p>
      <StoryText ref={set('line')} className="pizza__line lead" text={PIZZA.ending.line} />
      {links.length ? (
        <nav ref={set('actions')} className="pizza__actions" aria-label="تواصل مع بيتزرية 450">
          {links.map(([key, link], i) => {
            const external = /^https?:/.test(link.href);
            return (
              <a
                key={key}
                href={link.href}
                className={`pizza__btn${i === 0 ? ' is-primary' : ''}`}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {ICONS[key]}
                </svg>
                <span className={key === 'instagram' ? 'latin' : undefined}>{link.label}</span>
              </a>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
