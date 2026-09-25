import './Effects.css';

/**
 * Cinema bars at the top and bottom of the frame. The HUD lives inside them.
 * Scenes can "squeeze" to a 2.39:1 scope frame by tweening the CSS variable
 * --lb from 0 to 1 on `letterbox.el` (see RevealScene).
 */
export const letterbox = { el: null };

export function Letterbox() {
  return (
    <div
      className="letterbox"
      aria-hidden="true"
      ref={(el) => {
        letterbox.el = el;
      }}
    >
      <i className="letterbox__bar letterbox__bar--top" />
      <i className="letterbox__bar letterbox__bar--bottom" />
    </div>
  );
}
