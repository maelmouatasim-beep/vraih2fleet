/**
 * Bibliothèque › Catégories de véhicules : les défauts du moteur par
 * catégorie (prix d'achat avant taxes, consommation, entretien, durée de
 * vie) avec leur plage de stress test et leurs sources. C'est ici que
 * mène « Achat des véhicules » de la VAN et la catégorie d'un véhicule en
 * Faisabilité (traçabilité pour le trésorier, point 12 de l'audit).
 */
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/layout/States";
import { DEFAUTS_CATEGORIES, type CategorieVehicule } from "@/lib/tco";
import { formateurCad, formateurNombre } from "@/lib/format";
import { libelleCategorie } from "@/lib/journey/report";
import { sourcesCategorie, type ColonneCategorie } from "@/lib/library/liens";
import { cn } from "@/lib/utils";

const TECHNOS = ["diesel", "BEV", "FCEV"] as const;
const UNITE_CONSO: Record<(typeof TECHNOS)[number], string> = { diesel: "L/100 km", BEV: "kWh/100 km", FCEV: "kg H₂/100 km" };

interface Props {
  categorie: CategorieVehicule | null;
  colonne: ColonneCategorie | null;
}

export default function CategoryDefaultsTab({ categorie, colonne }: Props) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language.startsWith("en") ? "en" : "fr";
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);
  const nombre = useMemo(() => formateurNombre(i18n.language, 2), [i18n.language]);
  // Entretien en $/km : au cent près (0,10 $/km), jamais arrondi au dollar.
  const argentKm = useMemo(() => formateurCad(i18n.language, 2), [i18n.language]);
  const cible = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    cible.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [categorie]);

  const surligne = (c: ColonneCategorie) => (colonne === c ? "bg-primary/10" : undefined);
  const plage = (basse: string, haute: string) => `${basse} – ${haute}`;

  return (
    <div className="space-y-3" data-testid="library-categories">
      <p className="text-sm text-muted-foreground">{t("library.categories.intro")}</p>
      {(Object.keys(DEFAUTS_CATEGORIES) as CategorieVehicule[]).map((cat) => {
        const d = DEFAUTS_CATEGORIES[cat];
        const actif = cat === categorie;
        return (
          <Card
            key={cat}
            id={`cat-${cat}`}
            ref={actif ? cible : undefined}
            data-testid={`library-category-${cat}`}
            data-cible={actif ? "oui" : undefined}
            className={cn("scroll-mt-24", actif && "ring-2 ring-primary")}
          >
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-base">{libelleCategorie(cat, langue)}</CardTitle>
                <StatusBadge ton="info">{t("library.status.estimation")}</StatusBadge>
              </div>
              <CardDescription>
                {t("library.categories.meta", {
                  ans: d.dureeVieAns,
                  km: formateurNombre(i18n.language).format(d.kmParAnDefaut),
                  kwh: d.batterieUtileKwh.valeur,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">{t("library.categories.columns.technology")}</th>
                      <th className={cn("py-2 px-3 text-right font-medium", surligne("prix"))}>{t("library.categories.columns.price")}</th>
                      <th className={cn("py-2 px-3 text-right font-medium", surligne("consommation"))}>{t("library.categories.columns.consumption")}</th>
                      <th className={cn("py-2 pl-3 text-right font-medium", surligne("entretien"))}>{t("library.categories.columns.maintenance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TECHNOS.map((tech) => (
                      <tr key={tech} className="border-b last:border-0" data-testid={`library-category-${cat}-${tech}`}>
                        <td className="py-2 pr-3 whitespace-nowrap">{t(`library.categories.techno.${tech}`)}</td>
                        <td className={cn("py-2 px-3 text-right tabular-nums", surligne("prix"))}>
                          <p className="font-medium whitespace-nowrap" data-testid={`prix-${cat}-${tech}`}>{argent.format(d.prixAchat[tech].valeur)}</p>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {plage(argent.format(d.prixAchat[tech].plage.basse), argent.format(d.prixAchat[tech].plage.haute))}
                          </p>
                        </td>
                        <td className={cn("py-2 px-3 text-right tabular-nums", surligne("consommation"))}>
                          <p className="font-medium whitespace-nowrap">
                            {nombre.format(d.consommation[tech].valeur)}{" "}{UNITE_CONSO[tech]}
                          </p>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {plage(nombre.format(d.consommation[tech].plage.basse), nombre.format(d.consommation[tech].plage.haute))}
                          </p>
                        </td>
                        <td className={cn("py-2 pl-3 text-right tabular-nums", surligne("entretien"))}>
                          <p className="font-medium whitespace-nowrap">{argentKm.format(d.entretien[tech].valeur)}{" "}/km</p>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {plage(argentKm.format(d.entretien[tech].plage.basse), argentKm.format(d.entretien[tech].plage.haute))}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">{t("library.categories.sources")}</p>
                <ul className="space-y-1">
                  {sourcesCategorie(cat).map((s, i) => (
                    <li key={i}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">
                          {s.texte} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        s.texte
                      )}
                      {s.aValider && <span> — {t("library.status.a_valider")}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <p className="text-xs text-muted-foreground">{t("library.categories.note")}</p>
    </div>
  );
}
