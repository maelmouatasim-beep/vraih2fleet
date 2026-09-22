/**
 * i18n Validation Utility
 * 
 * This script provides utilities to detect missing translation keys
 * and ensure consistency between FR and EN locale files.
 * 
 * Usage:
 * - Import and call `validateTranslations()` in development
 * - Or run via console: `import('@/lib/i18n-check').then(m => m.validateTranslations())`
 */

import frTranslations from '@/i18n/locales/fr/translation.json';
import enTranslations from '@/i18n/locales/en/translation.json';

type TranslationObject = Record<string, unknown>;

/**
 * Recursively extract all keys from a translation object
 */
function extractKeys(obj: TranslationObject, prefix = ''): string[] {
  const keys: string[] = [];
  
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractKeys(value as TranslationObject, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

/**
 * Find keys that exist in source but not in target
 */
function findMissingKeys(sourceKeys: string[], targetKeys: string[]): string[] {
  const targetSet = new Set(targetKeys);
  return sourceKeys.filter(key => !targetSet.has(key));
}

/**
 * Compare two locale files and find discrepancies
 */
export function compareLocales(): {
  missingInFr: string[];
  missingInEn: string[];
  totalFrKeys: number;
  totalEnKeys: number;
} {
  const frKeys = extractKeys(frTranslations as TranslationObject);
  const enKeys = extractKeys(enTranslations as TranslationObject);
  
  return {
    missingInFr: findMissingKeys(enKeys, frKeys),
    missingInEn: findMissingKeys(frKeys, enKeys),
    totalFrKeys: frKeys.length,
    totalEnKeys: enKeys.length,
  };
}

/**
 * Validate translations and log results to console
 */
export function validateTranslations(): void {
  const results = compareLocales();
  
  console.group('🌐 i18n Translation Validation');
  console.log(`📊 Total keys - FR: ${results.totalFrKeys}, EN: ${results.totalEnKeys}`);
  
  if (results.missingInFr.length > 0) {
    console.warn(`⚠️ ${results.missingInFr.length} keys missing in French:`);
    results.missingInFr.forEach(key => console.warn(`   - ${key}`));
  }
  
  if (results.missingInEn.length > 0) {
    console.warn(`⚠️ ${results.missingInEn.length} keys missing in English:`);
    results.missingInEn.forEach(key => console.warn(`   - ${key}`));
  }
  
  if (results.missingInFr.length === 0 && results.missingInEn.length === 0) {
    console.log('✅ All translation keys are synchronized!');
  }
  
  console.groupEnd();
}

/**
 * Check if a specific key exists in both locales
 */
export function checkKeyExists(key: string): { fr: boolean; en: boolean } {
  const frKeys = new Set(extractKeys(frTranslations as TranslationObject));
  const enKeys = new Set(extractKeys(enTranslations as TranslationObject));
  
  return {
    fr: frKeys.has(key),
    en: enKeys.has(key),
  };
}

/**
 * Get all keys that match a pattern
 */
export function findKeysByPattern(pattern: string): {
  frMatches: string[];
  enMatches: string[];
} {
  const regex = new RegExp(pattern, 'i');
  const frKeys = extractKeys(frTranslations as TranslationObject);
  const enKeys = extractKeys(enTranslations as TranslationObject);
  
  return {
    frMatches: frKeys.filter(key => regex.test(key)),
    enMatches: enKeys.filter(key => regex.test(key)),
  };
}

// Auto-run validation in development mode
if (import.meta.env.DEV) {
  // Delay to avoid blocking initial render
  setTimeout(() => {
    const results = compareLocales();
    const hasMissing = results.missingInFr.length > 0 || results.missingInEn.length > 0;
    
    if (hasMissing) {
      console.warn(
        `🌐 i18n: ${results.missingInFr.length + results.missingInEn.length} missing translation keys detected. ` +
        `Run validateTranslations() for details.`
      );
    }
  }, 2000);
}

export default {
  validateTranslations,
  compareLocales,
  checkKeyExists,
  findKeysByPattern,
};
