import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr/translation.json';
import en from './locales/en/translation.json';

type TranslationDict = Record<string, any>;

function normalizeTranslations(input: TranslationDict): TranslationDict {
  const { pages_marketing, pages_support, pages_telematics, ...rest } = input;

  return {
    ...rest,
    pages: {
      ...(rest.pages ?? {}),
      ...(pages_marketing ?? {}),
      ...(pages_support ?? {}),
      ...(pages_telematics ?? {}),
    },
  };
}

const resources = {
  fr: { translation: normalizeTranslations(fr as unknown as TranslationDict) },
  en: { translation: normalizeTranslations(en as unknown as TranslationDict) },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    lng: 'en', // Force English as default
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'h2fleet-language',
    },
  });

export default i18n;
