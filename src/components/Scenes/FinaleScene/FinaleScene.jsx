import { useRef } from 'react';
import { FINALE, LINKS, BRAND } from '../../../data/story';
import { useSceneTimeline } from '../../../story/context';
import { textIn, textOut, fadeIn, m } from '../../../story/helpers';
import { StoryText } from '../../StoryText/StoryText';
import { Media } from '../../Media/Media';
import './FinaleScene.css';

const ICONS = {
  menu: <path d="M5 6h14M5 12h14M5 18h9" />,
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
};

/**
 * النهاية
 * The real restaurant in the morning light — the sunrise of Scene 1 comes back
 * as "a new beginning". The camera drifts back, the logo and the name appear,
 * and the story hands over to the buttons.
 */
export function FinaleScene() {
  const root = useRef(null);
  const cam = useRef(null);
  const sun = useRef(null);
  const lines = useRef([]);
  const logo = useRef(null);
  const title = useRef(null);
  const descriptor = useRef(null);
  const badge = useRef(null);
  const teaser = useRef(null);
  const teaserText = useRef(null);
  const actions = useRef(null);
  const footer = useRef(null);

  useSceneTimeline((tl) => {
    fadeIn(tl, root.current, 0, 0.14);
    tl.fromTo(cam.current, { scale: m(1.22) }, { scale: 1, duration: 1, ease: 'sine.out' }, 0);
    // morning light washes across (echo of the sunrise)
    tl.fromTo(sun.current, { xPercent: 40, opacity: 0 }, { xPercent: -10, opacity: 1, duration: 0.5, ease: 'sine.out' }, 0.02);

    textIn(tl, lines.current[0], 0.1);
    textIn(tl, lines.current[1], 0.26);
    textOut(tl, lines.current[0], 0.46);
    textOut(tl, lines.current[1], 0.47);

    tl.fromTo(logo.current, { autoAlpha: 0, scale: 0.8, y: 20 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.52);
    textIn(tl, title.current, 0.55, { dur: 0.1, stagger: 0.04, y: 34 });
    fadeIn(tl, descriptor.current, 0.6, 0.08, { y: 10 }, { y: 0 });

    // the suspense: coming soon
    fadeIn(tl, badge.current, 0.66, 0.06, { scale: 0.8 }, { scale: 1, ease: 'back.out(2)' });
    textIn(tl, teaser.current, 0.69, { dur: 0.09, stagger: 0.04, y: 26, blur: 16 });
    textIn(tl, teaserText.current, 0.76, { dur: 0.08, stagger: 0.012, y: 12, blur: 8 });

    tl.fromTo(actions.current.children, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.08, stagger: 0.025, ease: 'power2.out' }, 0.82);
    fadeIn(tl, footer.current, 0.9, 0.08);
  });

  return (
    <section ref={root} className="scene finale" aria-label="النهاية">
      <div className="finale__ambient" aria-hidden="true">
        <Media image={FINALE.image} variant="bg" />
      </div>
      <div className="finale__photo-wrap">
        <div ref={cam} className="finale__photo">
          <Media image={FINALE.image} />
        </div>
      </div>
      <div ref={sun} className="finale__sun" aria-hidden="true" />
      <div className="finale__shade" aria-hidden="true" />

      <div className="finale__content">
        <div className="finale__lines">
          {FINALE.lines.map((line, i) => (
            <StoryText key={i} ref={(el) => (lines.current[i] = el)} className={i === 0 ? 'lead' : 'display display--m'} text={line} />
          ))}
        </div>

        <div className="finale__brand">
          <div ref={logo} className="finale__logo">
            <Media image={{ ...BRAND.logo, fit: 'contain' }} eager />
          </div>
          <StoryText as="h2" ref={title} className="finale__title display display--xl" text={FINALE.title} />
          <p ref={descriptor} className="finale__descriptor latin">
            {BRAND.descriptor}
          </p>

          {FINALE.teaser ? (
            <div className="finale__teaser">
              <span ref={badge} className="finale__badge">
                <i aria-hidden="true" />
                {FINALE.teaser.badge}
              </span>
              <StoryText as="p" ref={teaser} className="finale__teaser-title display display--m" text={FINALE.teaser.title} />
              <StoryText ref={teaserText} className="finale__teaser-text" text={FINALE.teaser.text} />
            </div>
          ) : null}

          <nav ref={actions} className="finale__actions" aria-label="روابط بيتزرية 450">
            {FINALE.buttons.map((key) => {
              const link = LINKS[key];
              if (!link) return null;
              const icon = (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {ICONS[key]}
                </svg>
              );
              const label = <span className={key === 'instagram' ? 'latin' : undefined}>{link.label}</span>;
              // no link yet → "coming soon", not a dead link
              if (!link.href || link.href === '#') {
                return (
                  <span key={key} className="finale__btn is-soon" aria-disabled="true">
                    {icon}
                    {label}
                    <em>قريبًا</em>
                  </span>
                );
              }
              const external = /^https?:/.test(link.href);
              return (
                <a
                  key={key}
                  href={link.href}
                  className={`finale__btn${key === FINALE.primary ? ' is-primary' : ''}`}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {icon}
                  {label}
                </a>
              );
            })}
          </nav>
          <div ref={footer} className="finale__footer">
            <StoryText as="span" className="is-static" text={FINALE.footer} />
          </div>
        </div>
      </div>
    </section>
  );
}
