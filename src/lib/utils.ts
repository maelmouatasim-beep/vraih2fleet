import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { fr, frCA, enUS, enCA, type Locale } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Locale date-fns de la langue de l'interface (fr, fr-CA, en, en-CA…). */
export function getDateLocale(language: string): Locale {
  const l = (language || '').toLowerCase();
  if (l.startsWith('fr')) return l === 'fr-ca' ? frCA : fr;
  return l === 'en-ca' ? enCA : enUS;
}
