/**
 * Fusion des espaces pages_marketing / pages_support / pages_telematics
 * dans « pages » — PURE, partagée par l'initialisation i18n et le test
 * des clés utilisées (E1). ATTENTION : la fusion est superficielle, un
 * sous-objet de pages_* REMPLACE celui de même nom dans pages.
 */
export type TranslationDict = Record<string, unknown>;

export function normalizeTranslations(input: TranslationDict): TranslationDict {
  const { pages_marketing, pages_support, pages_telematics, ...rest } = input as Record<string, TranslationDict | undefined>;
  return {
    ...rest,
    pages: {
      ...((rest.pages as TranslationDict | undefined) ?? {}),
      ...(pages_marketing ?? {}),
      ...(pages_support ?? {}),
      ...(pages_telematics ?? {}),
    },
  };
}
