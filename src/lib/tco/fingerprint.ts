/**
 * Version du moteur et empreinte des entrées.
 * Deux résultats portant la même version et la même empreinte sont
 * identiques au cent près (docs/tco-methodologie.md §6.3).
 */

/** Version sémantique du moteur : à incrémenter à CHAQUE changement de calcul. */
export const ENGINE_VERSION = '1.1.0';

/** Sérialisation canonique : clés d'objets triées récursivement. */
export function serialiserCanonique(valeur: unknown): string {
  return JSON.stringify(trier(valeur));
}

function trier(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(trier);
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = trier((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

/** FNV-1a 64 bits (sans dépendance, déterministe, utilisable en navigateur). */
export function empreinte(valeur: unknown): string {
  const s = serialiserCanonique(valeur);
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const masque = 0xffffffffffffffffn;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * prime) & masque;
  }
  return h.toString(16).padStart(16, '0');
}
