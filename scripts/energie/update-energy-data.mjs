/**
 * Couche « collecte » des prix de l'énergie (règle A1) : calcule la
 * moyenne mobile 12 mois du diesel depuis la série StatCan archivée et
 * met à jour src/lib/tco/energy-data.json — SOUS GARDE D'ANOMALIE :
 * une variation de plus de 20 % par rapport à la valeur en place n'est
 * JAMAIS appliquée automatiquement ; elle est écrite dans
 * data/energie/en-attente-<date>.json et attend une décision humaine.
 *
 * Appelé par .github/workflows/update-energy-data.yml (cron hebdo).
 * Fonctions pures exportées, testées par
 * src/lib/tco/__tests__/energy-update.test.ts.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** TPS 5 % + TVQ 9,975 % calculées sur le prix accises comprises. */
export const DIVISEUR_TPS_TVQ = 1.14975;

/** Seuil de la garde d'anomalie : au-delà, mise en attente. */
export const SEUIL_VARIATION = 0.2;

const arrondi4 = (x) => Math.round(x * 10000) / 10000;

/**
 * Extrait, de la réponse WDS StatCan archivée (tableau 18-10-0001-01,
 * diesel libre-service, Montréal et Québec), les 12 derniers mois
 * COMPLETS communs aux deux villes, et calcule la moyenne TTC puis le
 * prix avant TPS/TVQ. Lève une erreur explicite si la série est
 * incomplète : jamais de valeur inventée ou partielle.
 */
export function moyenne12Mois(statcanArchive) {
  const series = {};
  for (const entree of statcanArchive) {
    const pts = entree?.reponse?.[0]?.object?.vectorDataPoint ?? [];
    const valides = pts
      .filter((p) => p.value !== null && p.value !== undefined)
      .map((p) => ({ mois: String(p.refPer).slice(0, 7), cents: p.value }));
    if (valides.length === 0) continue; // série morte (ex. « avec service »)
    const ville = /Montréal/i.test(entree.ville) ? 'montreal' : /Québec/i.test(entree.ville) ? 'quebec' : null;
    if (ville) series[ville] = valides;
  }
  if (!series.montreal || !series.quebec) {
    throw new Error('série StatCan incomplète : il faut Montréal ET Québec (diesel libre-service)');
  }
  const moisCommuns = series.montreal
    .map((p) => p.mois)
    .filter((m) => series.quebec.some((q) => q.mois === m))
    .sort();
  if (moisCommuns.length < 12) {
    throw new Error(`série StatCan incomplète : ${moisCommuns.length} mois communs, 12 requis`);
  }
  const mois = moisCommuns.slice(-12);
  const valeurs = (ville) => mois.map((m) => series[ville].find((p) => p.mois === m).cents);
  const quebec = valeurs('quebec');
  const montreal = valeurs('montreal');
  const moyenneVille = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const moyenneTtc = (moyenneVille(quebec) + moyenneVille(montreal)) / 2 / 100;
  const minTtc = Math.min(...quebec, ...montreal) / 100;
  return {
    mois,
    quebec,
    montreal,
    periode: `${mois[0]} à ${mois[11]}`,
    moyenneTtcParL: arrondi4(moyenneTtc),
    moyenneAvantTpsTvqParL: arrondi4(moyenneTtc / DIVISEUR_TPS_TVQ),
    minMensuelAvantTpsTvqParL: arrondi4(minTtc / DIVISEUR_TPS_TVQ),
  };
}

/**
 * Garde d'anomalie : décide si la nouvelle valeur peut être appliquée.
 * Retourne { action: 'aucune' | 'appliquer' | 'en_attente', variation }.
 */
export function appliquerGarde(valeurActuelle, valeurProposee, seuil = SEUIL_VARIATION) {
  if (!(valeurActuelle > 0) || !(valeurProposee > 0)) {
    throw new Error('valeurs de garde invalides');
  }
  const variation = Math.abs(valeurProposee - valeurActuelle) / valeurActuelle;
  if (variation < 1e-6) return { action: 'aucune', variation: 0 };
  return { action: variation > seuil ? 'en_attente' : 'appliquer', variation };
}

/** Point d'entrée CLI :
 *  node update-energy-data.mjs <statcan.json> <energy-data.json> <archiveRel> [dossierEnAttente] */
export function executer(cheminStatcan, cheminEnergyData, archiveRel, dossierEnAttente = 'data/energie') {
  const statcan = JSON.parse(readFileSync(cheminStatcan, 'utf8'));
  const donnees = JSON.parse(readFileSync(cheminEnergyData, 'utf8'));
  const calcul = moyenne12Mois(statcan);
  const jour = new Date().toISOString().slice(0, 10);

  const garde = appliquerGarde(donnees.diesel.moyenne12MoisAvantTpsTvqParL, calcul.moyenneAvantTpsTvqParL);
  if (garde.action === 'aucune') {
    console.log(`Aucun changement : moyenne 12 mois inchangée (${calcul.moyenneAvantTpsTvqParL} $/L avant TPS/TVQ).`);
    return garde;
  }
  if (garde.action === 'en_attente') {
    const chemin = `${dossierEnAttente}/en-attente-${jour}.json`;
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(
      chemin,
      JSON.stringify(
        {
          motif: `variation de ${(garde.variation * 100).toFixed(1)} % > ${SEUIL_VARIATION * 100} % — jamais appliquée automatiquement (règle A1)`,
          date: jour,
          valeurEnPlace: donnees.diesel.moyenne12MoisAvantTpsTvqParL,
          valeurProposee: calcul.moyenneAvantTpsTvqParL,
          calcul,
          archive: archiveRel,
          aFaire:
            'Vérifier la série archivée, puis reporter manuellement les valeurs dans src/lib/tco/energy-data.json ' +
            'et relancer npm run docs:tco + node scripts/reference-cases/generate.mjs.',
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`MISE EN ATTENTE (${(garde.variation * 100).toFixed(1)} %) : ${chemin} — energy-data.json INCHANGÉ.`);
    return garde;
  }

  donnees.versionDonnees = jour;
  donnees.diesel.moyenne12MoisTtcParL = calcul.moyenneTtcParL;
  donnees.diesel.moyenne12MoisAvantTpsTvqParL = calcul.moyenneAvantTpsTvqParL;
  donnees.diesel.minMensuelAvantTpsTvqParL = calcul.minMensuelAvantTpsTvqParL;
  donnees.diesel.periode = calcul.periode;
  donnees.diesel.mois = calcul.mois;
  donnees.diesel.serieTtcCentsParL = { quebec: calcul.quebec, montreal: calcul.montreal };
  donnees.diesel.source.archive = archiveRel;
  donnees.diesel.dateVerification = jour;
  writeFileSync(cheminEnergyData, JSON.stringify(donnees, null, 2) + '\n');
  console.log(
    `Appliqué (${(garde.variation * 100).toFixed(1)} %) : moyenne 12 mois ${calcul.moyenneTtcParL} $ TTC → ` +
      `${calcul.moyenneAvantTpsTvqParL} $/L avant TPS/TVQ (${calcul.periode}).`,
  );
  return garde;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [statcan, energyData, archiveRel, dossier] = process.argv.slice(2);
  if (!statcan || !energyData || !archiveRel) {
    console.error('usage : node update-energy-data.mjs <statcan.json> <energy-data.json> <archiveRel> [dossierEnAttente]');
    process.exit(2);
  }
  executer(statcan, energyData, archiveRel, dossier);
}
