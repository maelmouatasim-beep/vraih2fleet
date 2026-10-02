/**
 * Revue 1.7 — subventions explicables : règle appliquée et raison d'un
 * 0 $ ou d'un montant réduit, en français ou en anglais, à partir des
 * explications STRUCTURÉES du résolveur (src/lib/tco/subsidy-resolver).
 * Même texte à l'écran (Financement) et dans l'Excel.
 */
import type { ExplicationSubvention, RaisonSubvention, RegleSubvention } from "@/lib/tco";
import { traduireLibelleSubvention } from "@/lib/tco/translations-en";

type Langue = "fr" | "en";

function dollars(v: number, langue: Langue): string {
  return new Intl.NumberFormat(langue === "en" ? "en-CA" : "fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(v);
}

const pct = (x: number) => `${Math.round(x * 1000) / 10} %`;

function classes(c: string[] | null, langue: Langue): string {
  if (!c || c.length === 0) return "";
  const mot = langue === "en" ? (c.length > 1 ? "classes" : "class") : c.length > 1 ? "classes" : "classe";
  return `${mot} ${c.join(", ")}`;
}

export function texteRegle(r: RegleSubvention, langue: Langue): string {
  const en = langue === "en";
  const morceaux: string[] = [];
  const cl = classes(r.classes, langue);
  if (cl) morceaux.push(cl);
  if (r.type === "pourcentage") {
    morceaux.push(
      en
        ? `${pct(r.pourcentage ?? 0)} of the price before taxes (${dollars(r.base ?? 0, langue)}), capped at ${dollars(r.plafond ?? 0, langue)}`
        : `${pct(r.pourcentage ?? 0)} du prix avant taxes (${dollars(r.base ?? 0, langue)}), plafonné à ${dollars(r.plafond ?? 0, langue)}`,
    );
  } else {
    morceaux.push(
      r.anneeAchat != null
        ? en
          ? `flat ${dollars(r.montant, langue)} for a purchase in ${r.anneeAchat} (declining scale)`
          : `forfait de ${dollars(r.montant, langue)} pour un achat en ${r.anneeAchat} (barème dégressif)`
        : en
          ? `flat ${dollars(r.montant, langue)}`
          : `forfait de ${dollars(r.montant, langue)}`,
    );
  }
  if (r.bonificationPct) {
    morceaux.push(
      en
        ? `local-purchase bonus +${pct(r.bonificationPct)} within the cap`
        : `bonification achat local +${pct(r.bonificationPct)} dans le plafond`,
    );
  }
  return morceaux.join(" — ");
}

export function texteRaison(r: RaisonSubvention, langue: Langue): string {
  const en = langue === "en";
  switch (r.code) {
    case "programme_ferme":
      return r.statut === "ferme"
        ? en ? "program closed" : "programme fermé"
        : en ? "program suspended (not accepting applications)" : "programme suspendu (guichet fermé aux demandes)";
    case "organisme_non_admissible":
      return en ? "organization type not eligible" : "type d'organisme non admissible";
    case "prix_plafond":
      return r.inclusif
        ? en
          ? `price before taxes ${dollars(r.prix, langue)} above the ${dollars(r.plafond, langue)} cap (unless made in Canada)`
          : `prix avant taxes de ${dollars(r.prix, langue)} supérieur au plafond de ${dollars(r.plafond, langue)} (sauf véhicule fabriqué au Canada)`
        : en
          ? `MSRP ${dollars(r.prix, langue)} not below the ${dollars(r.plafond, langue)} cap`
          : `PDSF de ${dollars(r.prix, langue)} non inférieur au plafond de ${dollars(r.plafond, langue)}`;
    case "programme_echu":
      return en
        ? `program ends on ${r.dateFin}, purchase planned in ${r.anneeAchat}`
        : `programme terminé le ${r.dateFin}, achat prévu en ${r.anneeAchat}`;
    case "classe_non_couverte":
      return en ? `weight class ${r.classe} not covered by the program` : `classe de poids ${r.classe} non couverte par le programme`;
    case "bareme_nul_annee": {
      const cl = classes(r.classes, langue);
      return en
        ? `${cl ? `${cl} scale` : "scale"}: $0 for a purchase in ${r.anneeAchat} (declining scale)`
        : `barème ${cl ? `${cl} ` : ""}: 0 $ pour un achat en ${r.anneeAchat} (barème dégressif)`;
    }
    case "classe_inconnue":
      return en
        ? `weight class (GVWR) unknown: lowest possible scale used (${dollars(r.montant, langue)}${r.classes ? `, ${classes(r.classes, langue)}` : ""}) — enter the class for the exact scale`
        : `classe de poids (PNBV) inconnue : barème le plus bas retenu (${dollars(r.montant, langue)}${r.classes ? `, ${classes(r.classes, langue)}` : ""}) — renseignez la classe pour le barème exact`;
    case "montant_par_projet":
      return en ? "amount set per project — enter it (never counted automatically)" : "montant fixé par projet — à saisir (jamais compté automatiquement)";
    case "cumul_aides":
      return en
        ? `reduced by ${dollars(r.reduction, langue)}: public aid stacking limited to ${pct(r.pct)} of eligible costs`
        : `réduite de ${dollars(r.reduction, langue)} : cumul des aides publiques limité à ${pct(r.pct)} des dépenses admissibles`;
    case "plafond_cout":
      return en
        ? `reduced by ${dollars(r.reduction, langue)}: total aid limited to the vehicle cost`
        : `réduite de ${dollars(r.reduction, langue)} : total des aides limité au coût du véhicule`;
    case "pourcentage_a_valider":
      return en ? `${pct(r.pct)} to be confirmed with the program` : `${pct(r.pct)} à valider auprès du programme`;
  }
}

/** Une ligne lisible : « Programme : 0 $ — raison » ou « Programme : 2 500 $ — règle ». */
export function texteExplication(e: ExplicationSubvention, langue: Langue): string {
  const nom = traduireLibelleSubvention(e.programme, langue);
  const parties = [`${nom}${langue === "en" ? ":" : " :"} ${dollars(e.montant, langue)}`];
  if (e.regle && e.statut !== "exclue") parties.push(texteRegle(e.regle, langue));
  for (const r of e.raisons) parties.push(texteRaison(r, langue));
  return parties.join(" — ");
}
