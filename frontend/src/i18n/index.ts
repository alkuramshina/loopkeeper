import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from './locales/ru/common.json';

i18n.use(initReactI18next).init({
  resources: { ru: { common } },
  lng: localStorage.getItem('loopkeeper.locale') ?? 'ru',
  fallbackLng: 'ru',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

void i18n.on('languageChanged', (language) => {
  localStorage.setItem('loopkeeper.locale', language);
  document.documentElement.lang = language;
});

export default i18n;
