/**
 * Garde-fous i18n (Phase 2e) :
 * 1. AUCUNE clé dupliquée dans les JSON (un doublon masque silencieusement
 *    tout un bloc — la page Confidentialité affichait des clés brutes) ;
 * 2. parité fr ↔ en : toute clé présente dans une locale existe dans l'autre.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHEMINS = {
  fr: resolve(__dirname, '../locales/fr/translation.json'),
  en: resolve(__dirname, '../locales/en/translation.json'),
};

/** Petit analyseur JSON qui détecte les clés dupliquées à tout niveau
 *  (JSON.parse les avale en silence, le dernier gagnant). */
function clesDupliquees(texte: string): string[] {
  const doublons: string[] = [];
  let i = 0;
  const pile: Array<{ type: 'obj' | 'arr'; cles?: Set<string>; chemin: string; chemin_cle?: string }> = [];
  let derniereChaine = '';
  let attenteValeur = false;

  function lireChaine(): string {
    // i pointe sur la quote ouvrante
    let s = '';
    i++;
    while (i < texte.length) {
      const c = texte[i];
      if (c === '\\') {
        s += texte[i] + texte[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') {
        i++;
        return s;
      }
      s += c;
      i++;
    }
    throw new Error('chaîne non terminée');
  }

  while (i < texte.length) {
    const c = texte[i];
    if (c === '"') {
      derniereChaine = lireChaine();
      continue;
    }
    if (c === '{') {
      pile.push({ type: 'obj', cles: new Set(), chemin: pile.length ? cheminCourant() : '' });
      attenteValeur = false;
    } else if (c === '[') {
      pile.push({ type: 'arr', chemin: cheminCourant() });
    } else if (c === '}' || c === ']') {
      pile.pop();
      attenteValeur = false;
    } else if (c === ':') {
      const sommet = pile[pile.length - 1];
      if (sommet?.type === 'obj') {
        const chemin = sommet.chemin ? `${sommet.chemin}.${derniereChaine}` : derniereChaine;
        if (sommet.cles!.has(derniereChaine)) doublons.push(chemin);
        sommet.cles!.add(derniereChaine);
        sommet.chemin_cle = derniereChaine; // mémorise pour les enfants
        attenteValeur = true;
      }
    }
    i++;
  }

  function cheminCourant(): string {
    const sommet = pile[pile.length - 1] as { chemin: string; chemin_cle?: string } | undefined;
    if (!sommet) return '';
    if (sommet.chemin_cle === undefined) return sommet.chemin;
    return sommet.chemin ? `${sommet.chemin}.${sommet.chemin_cle}` : sommet.chemin_cle;
  }

  return doublons;
}

function aplatir(objet: Record<string, unknown>, prefixe = ''): Set<string> {
  const cles = new Set<string>();
  for (const [k, v] of Object.entries(objet)) {
    const chemin = prefixe ? `${prefixe}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const c of aplatir(v as Record<string, unknown>, chemin)) cles.add(c);
    } else {
      cles.add(chemin);
    }
  }
  return cles;
}

describe('détecteur de doublons (méta-test : il doit vraiment détecter)', () => {
  it('repère un doublon imbriqué et un doublon de premier niveau', () => {
    const casse = '{"a": {"x": 1, "x": 2}, "b": 3, "a": 4}';
    const doublons = clesDupliquees(casse);
    expect(doublons.length).toBe(2);
    expect(doublons.some((d) => d.endsWith('x'))).toBe(true);
    expect(doublons.some((d) => d === 'a')).toBe(true);
  });

  it('ne signale rien sur un JSON sain (clés identiques dans des objets différents)', () => {
    expect(clesDupliquees('{"a": {"x": 1}, "b": {"x": 2}}')).toEqual([]);
  });
});

describe('fichiers de traduction', () => {
  for (const [locale, chemin] of Object.entries(CHEMINS)) {
    it(`${locale} : aucune clé dupliquée`, () => {
      const doublons = clesDupliquees(readFileSync(chemin, 'utf-8'));
      expect(doublons, `clés dupliquées dans ${locale} : ${doublons.join(', ')}`).toEqual([]);
    });
  }

  it('parité fr ↔ en : les deux locales ont exactement les mêmes clés', () => {
    const fr = aplatir(JSON.parse(readFileSync(CHEMINS.fr, 'utf-8')));
    const en = aplatir(JSON.parse(readFileSync(CHEMINS.en, 'utf-8')));
    const frSeulement = [...fr].filter((c) => !en.has(c));
    const enSeulement = [...en].filter((c) => !fr.has(c));
    expect(frSeulement, `clés fr sans équivalent en : ${frSeulement.slice(0, 20).join(', ')}`).toEqual([]);
    expect(enSeulement, `clés en sans équivalent fr : ${enSeulement.slice(0, 20).join(', ')}`).toEqual([]);
  });
});

describe('audit acheteur, point 9 — libellés du parcours compréhensibles', () => {
  const valeurs = (o: unknown, out: string[] = []): string[] => {
    if (typeof o === 'string') out.push(o);
    else if (o && typeof o === 'object') for (const v of Object.values(o)) valeurs(v, out);
    return out;
  };
  for (const langue of ['fr', 'en'] as const) {
    it(`${langue} : ni sigles BEV/FCEV, ni « (s) », ni « pot d'échappement », ni « bornes défavorables » dans le parcours`, () => {
      const parcours = valeurs(JSON.parse(readFileSync(CHEMINS[langue], 'utf8')).journey);
      const fautifs = parcours.filter((v) =>
        /\b(BEV|FCEV)\b|\w\(s\)|pot d'échappement|tailpipe|bornes défavorables|unfavourable bounds?|Diesel \(statu quo\)|Diesel \(status quo\)/.test(v),
      );
      expect(fautifs).toEqual([]);
    });
  }
});

describe('re-audit — une langue régionale (« en-CA ») suit sa langue', () => {
  it('aucune comparaison stricte de i18n.language (utiliser startsWith)', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const racine = resolve(__dirname, '../..');
    const fautifs: string[] = [];
    const parcourir = (dossier: string) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) {
          if (nom !== '__tests__' && nom !== 'node_modules') parcourir(chemin);
        } else if (/\.tsx?$/.test(nom) && /\blanguage\s*[!=]==\s*["'](en|fr)["']/.test(readFileSync(chemin, 'utf8'))) {
          fautifs.push(chemin.slice(racine.length + 1));
        }
      }
    };
    parcourir(racine);
    expect(fautifs).toEqual([]);
  });
});
