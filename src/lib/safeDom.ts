// Construction de nœuds DOM sûrs pour les popups Mapbox (setDOMContent).
// Tout texte passe par textContent — jamais par innerHTML — et les liens
// n'acceptent que https.

export function el(
  tag: string,
  style: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElement {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Retourne l'URL si elle est https, sinon null (refuse javascript:, http:, data:…). */
export function httpsUrlOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Lien externe sûr : texte via textContent, href https uniquement. */
export function safeExternalLink(
  href: string,
  text: string,
  style: Partial<CSSStyleDeclaration> = {},
): HTMLAnchorElement | null {
  const safeHref = httpsUrlOrNull(href);
  if (!safeHref) return null;
  const a = document.createElement("a");
  a.href = safeHref;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = text;
  Object.assign(a.style, style);
  return a;
}
