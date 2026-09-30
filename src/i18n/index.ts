import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr/translation.json';
import en from './locales/en/translation.json';
import { normalizeTranslations, type TranslationDict } from './normalize';
import { CLE_CHOIX_LANGUE, langueHtml, migrerPreferenceLangue } from './preference';

const stockage = typeof window !== 'undefined' ? window.localStorage : null;
migrerPreferenceLangue(stockage);

const resources = {
  fr: { translation: normalizeTranslations(fr as unknown as TranslationDict) },
  en: { translation: normalizeTranslations(en as unknown as TranslationDict) },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Produit québécois : français par défaut. La langue vient du choix
    // enregistré (localStorage), sinon du navigateur (fr-CA → fr via
    // load:'languageOnly'), avec repli en français.
    fallbackLng: 'fr',
    load: 'languageOnly',
    interpolation: {
      // React échappe déjà toute valeur interpolée rendue en JSX.
      // CONTRAT DE SÉCURITÉ : ne jamais injecter une chaîne i18n via
      // dangerouslySetInnerHTML ou innerHTML — pour du balisage dans une
      // traduction, utiliser <Trans> (les valeurs restent échappées).
      escapeValue: false,
    },
    detection: {
      // seul un CHOIX explicite (sélecteur) est mémorisé — voir preference.ts
      order: ['localStorage', 'navigator'],
      caches: [],
      lookupLocalStorage: CLE_CHOIX_LANGUE,
    },
  });

// <html lang> suit la langue affichée (lecteurs d'écran, césure, traduction)
const synchroniserLangHtml = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = langueHtml(lng);
};
i18n.on('languageChanged', synchroniserLangHtml);
synchroniserLangHtml(i18n.resolvedLanguage ?? i18n.language);

export default i18n;
