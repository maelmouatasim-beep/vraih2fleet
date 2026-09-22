import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { fr, enUS, type Locale } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDateLocale(language: string): Locale {
  return language === 'fr' ? fr : enUS;
}
