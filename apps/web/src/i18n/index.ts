import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import mr from './mr.json';

export const LANGS = ['en', 'hi', 'mr'] as const;
export type Lang = (typeof LANGS)[number];

const stored = (() => {
  try {
    return localStorage.getItem('lang');
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, mr: { translation: mr } },
  lng: stored ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

const syncHtml = (lng: string) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem('lang', lng);
  } catch {
    /* private mode: language just isn't remembered */
  }
};
syncHtml(i18n.language);
i18n.on('languageChanged', syncHtml);

export default i18n;
