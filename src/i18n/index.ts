import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';

export const supportedLanguages = ['en', 'ko', 'ja'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageLabels: Record<SupportedLanguage, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
      ja: { translation: ja },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already handles escaping
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'modone-language',
      caches: ['localStorage'],
    },
  });

export default i18n;

/**
 * Change the application language
 */
export function changeLanguage(lng: SupportedLanguage): Promise<void> {
  return i18n.changeLanguage(lng).then(() => {
    localStorage.setItem('modone-language', lng);
    document.documentElement.lang = lng;
  });
}

/**
 * Get the current language
 */
export function getCurrentLanguage(): SupportedLanguage {
  const current = i18n.language;
  if (supportedLanguages.includes(current as SupportedLanguage)) {
    return current as SupportedLanguage;
  }
  // Handle language codes with region (e.g., 'en-US' -> 'en')
  const baseLanguage = current.split('-')[0];
  if (supportedLanguages.includes(baseLanguage as SupportedLanguage)) {
    return baseLanguage as SupportedLanguage;
  }
  return 'en';
}
