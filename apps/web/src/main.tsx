import '@fontsource/anek-latin/600.css';
import '@fontsource/anek-latin/700.css';
import '@fontsource/anek-devanagari/600.css';
import '@fontsource/anek-devanagari/700.css';
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/500.css';
import '@fontsource/mukta/600.css';
import './index.css';
import './i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyLargeText } from './app/layouts/HeaderControls';

applyLargeText();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
