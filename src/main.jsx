import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted fonts. Each file declares unicode-ranges, so the browser only
// downloads the subsets (Arabic / Latin) that are actually on screen.
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import '@fontsource/ibm-plex-sans-arabic/300.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';

import './styles/global.css';
import App from './App';

// A film always starts at the beginning.
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
