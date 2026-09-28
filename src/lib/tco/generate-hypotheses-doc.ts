/**
 * Génère docs/tco-hypotheses.md depuis assumptions.ts et
 * subsidy-programs.ts. Le document est GÉNÉRÉ : ne pas l'éditer à la
 * main. Régénération : `npm run docs:tco`. Un test de CI échoue si le
 * document sur disque ne correspond plus au registre.
 */

import { DEFAUTS_CATEGORIES, LISTE_HYPOTHESES } from './assumptions';
import { PROGRAMMES } from './subsidy-programs';
import type { StatutHypothese } from './assumption-types';

const LIBELLE_STATUT: Record<StatutHypothese, string> = {
  verifie: '✅ vérifié',
  estimation: '≈ estimation',
  a_valider: '⚠️ à valider',
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

export function buildHypothesesMarkdown(): string {
  const lines: string[] = [];
  const p = (s = '') => lines.push(s);

  p('# Hypothèses par défaut du moteur TCO');
  p();
  p('**DOCUMENT GÉNÉRÉ** depuis `src/lib/tco/assumptions.ts` et');
  p('`src/lib/tco/subsidy-programs.ts` — ne pas éditer à la main');
  p('(`npm run docs:tco` pour régénérer ; un test de CI vérifie la fraîcheur).');
  p();
  p('Statuts : ✅ vérifié = source réellement lue à la date indiquée ;');
  p('≈ estimation = ordre de grandeur professionnel à affiner ;');
  p('⚠️ à valider = source non consultable depuis l’environnement — consulter l’URL.');
  p();

  const nb = { verifie: 0, estimation: 0, a_valider: 0 } as Record<StatutHypothese, number>;
  for (const h of LISTE_HYPOTHESES) nb[h.statut] += 1;
  p(`Bilan : ${nb.verifie} vérifiées, ${nb.estimation} estimations, ${nb.a_valider} à valider (hors défauts par catégorie, tous « estimation »).`);
  p();

  p('## Hypothèses générales');
  p();
  p('| Hypothèse | Valeur | Unité | Plage | Région | Statut | Source | Vérifiée le |');
  p('|---|---|---|---|---|---|---|---|');
  for (const h of LISTE_HYPOTHESES) {
    const src = `[${h.source.organisme} — ${h.source.document}${h.source.tableauOuPage ? `, ${h.source.tableauOuPage}` : ''}](${h.source.url})`;
    p(
      `| ${h.description} | ${fmt(h.valeur)}${h.anneeDollars ? ` (CAD ${h.anneeDollars})` : ''} | ${h.unite} | ${fmt(h.plage.basse)} – ${fmt(h.plage.haute)} | ${h.region} | ${LIBELLE_STATUT[h.statut]} | ${src} | ${h.dateVerification} |`,
    );
  }
  p();

  p('### Notes');
  p();
  for (const h of LISTE_HYPOTHESES) {
    if (h.notes) p(`- **${h.id}** : ${h.notes}`);
  }
  p();

  p('## Défauts par catégorie de véhicule (tous « estimation »)');
  p();
  for (const d of Object.values(DEFAUTS_CATEGORIES)) {
    p(`### ${d.libelle}`);
    p();
    p(`Durée de vie : ${d.dureeVieAns} ans — km/an par défaut : ${d.kmParAnDefaut}`);
    p();
    p('| Technologie | Consommation | Prix d’achat (CAD 2026) | Entretien ($/km) |');
    p('|---|---|---|---|');
    const unites = { diesel: 'L/100 km', BEV: 'kWh/100 km', FCEV: 'kg H2/100 km' } as const;
    for (const t of ['diesel', 'BEV', 'FCEV'] as const) {
      const c = d.consommation[t];
      const px = d.prixAchat[t];
      const e = d.entretien[t];
      p(
        `| ${t} | ${fmt(c.valeur)} ${unites[t]} (${fmt(c.plage.basse)}–${fmt(c.plage.haute)}) | ${px.valeur.toLocaleString('fr-CA')} $ (${px.plage.basse.toLocaleString('fr-CA')}–${px.plage.haute.toLocaleString('fr-CA')}) | ${fmt(e.valeur)} (${fmt(e.plage.basse)}–${fmt(e.plage.haute)}) |`,
      );
    }
    p();
    p('Sources :');
    for (const s of d.sources) p(`- ${s}`);
    p();
  }

  p('## Programmes de subventions');
  p();
  p('Seuls les programmes au statut « actif » sont comptés automatiquement par le moteur.');
  p();
  for (const prog of PROGRAMMES) {
    p(`### ${prog.nom}`);
    p();
    p(
      `Palier : ${prog.palier} — cible : ${prog.cible} — **statut : ${prog.statut}** (${LIBELLE_STATUT[prog.statutVerification]}, le ${prog.dateVerification})${prog.dateFin ? ` — fin : ${prog.dateFin}` : ''}`,
    );
    p();
    p(`Source : [${prog.source.organisme} — ${prog.source.document}](${prog.source.url})`);
    p();
    for (const b of prog.baremes) {
      const montant =
        b.pourcentage !== undefined
          ? `${(b.pourcentage * 100).toFixed(0)} % du coût, max ${b.plafondParVehicule.toLocaleString('fr-CA')} $`
          : b.plafondParVehicule > 0
            ? `jusqu’à ${b.plafondParVehicule.toLocaleString('fr-CA')} $`
            : 'montant du projet à saisir (jamais compté automatiquement)';
      p(`- ${b.categories.join(', ')} × ${b.technologies.join('/')} : ${montant}${b.notes ? ` — ${b.notes}` : ''}`);
    }
    if (prog.bonificationAchatLocal) {
      p(`- Bonification achat local : +${(prog.bonificationAchatLocal * 100).toFixed(0)} %`);
    }
    p(`- Cumul : ${prog.cumul}`);
    if (prog.limites) p(`- Limites : ${prog.limites}`);
    p(`- Année de versement par défaut : ${prog.anneeVersementDefaut === 0 ? 'année d’acquisition (point de vente)' : 'année suivant l’acquisition (après livraison/approbation)'}`);
    if (prog.notes) p(`- Notes : ${prog.notes}`);
    p();
  }

  p('## À valider en priorité (sources inaccessibles depuis l’environnement)');
  p();
  for (const h of LISTE_HYPOTHESES) {
    if (h.statut === 'a_valider') p(`- ${h.description} → ${h.source.url}`);
  }
  for (const prog of PROGRAMMES) {
    if (prog.statutVerification === 'a_valider') p(`- ${prog.nom} → ${prog.source.url}`);
  }
  p();

  return lines.join('\n');
}
