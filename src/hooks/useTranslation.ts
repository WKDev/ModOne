import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useCallback } from 'react';
import {
  changeLanguage,
  getCurrentLanguage,
  SupportedLanguage,
  supportedLanguages,
  languageLabels,
} from '../i18n';

/**
 * Custom hook for translations with app-specific utilities
 */
export function useTranslation() {
  const { t, i18n } = useI18nTranslation();

  const currentLanguage = getCurrentLanguage();

  const setLanguage = useCallback(
    (lng: SupportedLanguage) => {
      changeLanguage(lng);
    },
    []
  );

  return {
    /** Translation function */
    t,
    /** i18n instance */
    i18n,
    /** Current language code */
    language: currentLanguage,
    /** Change the language */
    setLanguage,
    /** List of supported languages */
    supportedLanguages,
    /** Language display labels */
    languageLabels,
  };
}

/**
 * Hook for language management only
 */
export function useLanguage() {
  const { i18n } = useI18nTranslation();

  const language = getCurrentLanguage();

  const setLanguage = useCallback((lng: SupportedLanguage) => {
    changeLanguage(lng);
  }, []);

  return {
    language,
    setLanguage,
    supportedLanguages,
    languageLabels,
    isReady: i18n.isInitialized,
  };
}

export type { SupportedLanguage };
