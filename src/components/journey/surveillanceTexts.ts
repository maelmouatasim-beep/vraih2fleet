/**
 * Phase 5.6 — Textes des alertes de surveillance (fr/en), construits à
 * partir du DÉTAIL calculé par src/lib/journey/surveillance.ts : chaque
 * nombre affiché vient du moteur ou des données du projet.
 */
import type { TFunction } from "i18next";
import { formateurCad } from "@/lib/format";
import { nomCourtProgramme } from "@/lib/tco/translations-en";
import type { AlertePlan, Energie } from "@/lib/journey/surveillance";

const UNITES: Record<Energie, string> = { diesel: "$/L", electricite: "$/kWh", hydrogene: "$/kg" };

const majuscule = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

export function texteAlerte(a: AlertePlan, t: TFunction, langue: "fr" | "en"): { titre: string; message: string } {
  const argent = formateurCad(langue);
  const nombre = (x: number, d = 0) =>
    new Intl.NumberFormat(langue === "en" ? "en-CA" : "fr-CA", { maximumFractionDigits: d, minimumFractionDigits: d }).format(x);
  const d = a.detail;
  const k = "journey.monitoring";
  switch (d.type) {
    case "donnees_energie": {
      const changements = d.variations
        .map((v) =>
          t(`${k}.energyChange_${v.pct < 0 ? "down" : "up"}`, {
            energie: t(`${k}.energyNames.${v.energie}`),
            pct: Math.abs(v.pct),
            avant: `${nombre(v.avant, 3)} ${UNITES[v.energie]}`,
            apres: `${nombre(v.apres, 3)} ${UNITES[v.energie]}`,
          }),
        )
        .join(t(`${k}.and`));
      const verdict = d.gagnants === 0 ? t(`${k}.verdictNone`) : t(`${k}.verdict`, { count: d.gagnants });
      return {
        titre: t(`${k}.energyTitle`, { date: d.dateRapport }),
        message:
          `${majuscule(changements)}${t(`${k}.colon`)}${verdict}. ${t(`${k}.energyVan`, {
            avant: argent.format(d.vanAnciensPrix),
            apres: argent.format(d.vanActuelle),
            prudent: argent.format(d.vanPrudente),
          })}` +
          (d.planModifie && d.vanRapport != null ? ` ${t(`${k}.energyPlanChanged`, { van: argent.format(d.vanRapport) })}` : "") +
          ` ${t(`${k}.energyRegenerate`)}`,
      };
    }
    case "echeance_subvention":
      return {
        titre: t(`${k}.deadlineTitle`, { programme: nomCourtProgramme(d.programmeId, langue), date: d.dateFin }),
        message: t(`${k}.deadlineMessage`, { count: d.jours, montant: argent.format(d.montant), vehicules: d.vehicules }),
      };
    case "remplacement_retard": {
      const liste = d.vehicules
        .slice(0, 6)
        .map((v) => `${v.unite} (${v.annee})`)
        .join(", ");
      return {
        titre: t(`${k}.lateTitle`, { count: d.vehicules.length }),
        message: t(`${k}.lateMessage`, {
          liste: d.vehicules.length > 6 ? `${liste}${t(`${k}.andMore`, { count: d.vehicules.length - 6 })}` : liste,
        }),
      };
    }
    case "programme_modifie":
      return {
        titre: t(`${k}.programTitle`, { programme: nomCourtProgramme(d.programmeId, langue) }),
        message: t(`${k}.programMessage`, { resume: (langue === "en" ? d.resumeEn : d.resumeFr).replace(/[.\s]+$/, ""), date: d.valideLe }),
      };
    case "capacite_garage":
      return {
        titre: t(`${k}.garageTitle`, { garage: d.garage ?? t(`${k}.noGarage`) }),
        message:
          t(`${k}.garageMessage`, {
            demandes: nombre(d.kwDemandes),
            disponibles: nombre(d.kwDisponibles),
            supp: nombre(d.kwSupplementaires),
            cout: argent.format(d.cout),
            source: t(`${k}.sources.${d.source}`, { defaultValue: d.source }),
          }) + (d.presumee ? ` ${t(`${k}.garagePresumed`)}` : ""),
      };
  }
}
