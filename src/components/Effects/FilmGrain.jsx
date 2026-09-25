import { useEffect, useRef } from 'react';
import { QUALITY } from '../../config/quality';
import './Effects.css';

/** Film grain: a small noise tile generated once, shifted every few frames. */
export function FilmGrain() {
  const ref = useRef(null);
  useEffect(() => {
    const size = 180;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    c.toBlob((blob) => {
      if (!blob || !ref.current) return;
      ref.current.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
    });
  }, []);
  return <div ref={ref} className={`grain${QUALITY.tier !== 'low' ? ' is-animated' : ''}`} aria-hidden="true" />;
}
