/**
 * Barre des 7 étapes du parcours — composant UNIQUE.
 *
 * Grille de 7 colonnes de largeur égale ; chaque étape = un cercle de
 * taille fixe qui contient TOUJOURS son numéro + le libellé dessous, sur
 * une ligne. Un seul système d'états, porté par le cercle et la couleur du
 * libellé (terminé / en cours / à faire) ; l'étape affichée est marquée à
 * part (libellé gras souligné, aria-current="step"). Ligne de progression
 * entre les cercles. Infobulle au survol et au focus : état + ce qui
 * manque. Mise en page selon la largeur réelle (src/lib/journey/stepper.ts).
 */
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ETAPES_PARCOURS, type EtapeParcoursCle } from "@/lib/journey/steps";
import type { EtatEtape, EtatParcours } from "@/lib/journey/progress";
import { etatVisuel, modeBarre, segmentTermine, type ModeBarre } from "@/lib/journey/stepper";

interface JourneyStepperProps {
  /** Préfixe des liens : /dashboard/projects/:id */
  base: string;
  etape: EtapeParcoursCle;
  etats: Record<EtapeParcoursCle, EtatParcours> | null | undefined;
}

// Contraste AA : texte ≥ 4,5:1 et contours ≥ 3:1 sur la carte (clair et sombre).
const CERCLE: Record<EtatEtape, string> = {
  termine: "bg-primary-strong border-primary-strong text-primary-foreground",
  en_cours: "bg-card border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-400",
  a_faire: "bg-card border-muted-foreground text-muted-foreground",
};
const LIBELLE: Record<EtatEtape, string> = {
  termine: "text-primary-strong",
  en_cours: "text-foreground",
  a_faire: "text-muted-foreground",
};

/** Largeur intérieure de l'élément, suivie au redimensionnement. */
function useLargeur<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largeur, setLargeur] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mesurer = () => setLargeur(el.clientWidth);
    mesurer();
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, largeur };
}

export default function JourneyStepper({ base, etape, etats }: JourneyStepperProps) {
  const { t } = useTranslation();
  const { ref, largeur } = useLargeur<HTMLDivElement>();
  // Avant la première mesure (rendu serveur, tests) : version complète.
  const mode: ModeBarre = largeur === null ? "complet" : modeBarre(largeur);
  const compact = mode !== "complet";
  const listeEtats = ETAPES_PARCOURS.map((e) => etats?.[e]?.etat);
  const indexActif = ETAPES_PARCOURS.indexOf(etape);

  const manques = (e: EtapeParcoursCle) =>
    (etats?.[e]?.manques ?? []).map((m) => t(`journey.progress.missing.${m.cle}`, { count: m.count ?? 0 })).join(" · ");
  const etatActif = etatVisuel(etats?.[etape]?.etat);
  const manquesActif = manques(etape);

  return (
    <nav
      aria-label={t("journey.progress.ariaLabel")}
      className="rounded-xl border border-border bg-card px-4 py-5 sm:px-6"
      data-testid="journey-stepper"
      data-mode={mode}
    >
      <div ref={ref}>
        <ol className="grid grid-cols-7">
          {ETAPES_PARCOURS.map((e, i) => {
            const etat = etatVisuel(listeEtats[i]);
            const actif = e === etape;
            const titre = t(`journey.steps.${e}.title`);
            const detail = manques(e);
            return (
              <li key={e} className="relative flex min-w-0 justify-center" data-testid="journey-step" data-etape={e}>
                {/* Segment vers l'étape suivante : du centre de ce cercle au centre du suivant. */}
                {i < ETAPES_PARCOURS.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-1/2 h-0.5 w-full",
                      compact ? "top-[13px]" : "top-[15px]",
                      segmentTermine(listeEtats, i) ? "bg-primary-strong" : "bg-border",
                    )}
                    data-testid="journey-segment"
                    data-termine={segmentTermine(listeEtats, i) ? "true" : "false"}
                  />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={`${base}/${e}`}
                      aria-current={actif ? "step" : undefined}
                      aria-label={`${t("journey.progress.stepOf", { n: i + 1, total: ETAPES_PARCOURS.length })} : ${titre} — ${t(`journey.progress.state.${etat}`)}`}
                      data-etat={listeEtats[i]}
                      className="group relative z-10 flex min-w-0 max-w-full flex-col items-center rounded-md pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <span
                        className={cn(
                          "flex shrink-0 items-center justify-center rounded-full border-2 font-semibold tabular-nums transition-colors",
                          compact ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm",
                          CERCLE[etat],
                        )}
                        data-testid="journey-step-circle"
                      >
                        {i + 1}
                      </span>
                      {mode !== "cercles" && (
                        <span
                          className={cn(
                            "mt-2 block max-w-full truncate whitespace-nowrap border-b-2 pb-0.5 leading-5",
                            compact ? "px-0.5 text-xs" : "px-1.5 text-sm",
                            LIBELLE[etat],
                            actif ? "border-primary-strong font-semibold" : "border-transparent font-medium group-hover:border-border",
                          )}
                          data-testid="journey-step-label"
                        >
                          {titre}
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align={i < 2 ? "start" : i > 4 ? "end" : "center"} className="max-w-xs">
                    <p className="font-medium">
                      {i + 1}. {titre} — {t(`journey.progress.state.${etat}`)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {detail ? `${t("journey.progress.missingLabel")} ${detail}` : t("journey.progress.complete")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ol>

        {mode === "cercles" && (
          <p className="mt-3 text-center text-sm font-semibold" data-testid="journey-active-label">
            {t("journey.progress.stepOf", { n: indexActif + 1, total: ETAPES_PARCOURS.length })} · {t(`journey.steps.${etape}.title`)}
          </p>
        )}

        {etats && (
          <p className="mt-4 border-t border-border pt-3 text-sm" data-testid="etat-etape">
            <span className="font-medium">{t(`journey.progress.state.${etatActif}`)}</span>
            {manquesActif && (
              <span className="text-muted-foreground">
                {" — "}
                {t("journey.progress.missingLabel")} {manquesActif}
              </span>
            )}
          </p>
        )}
      </div>
    </nav>
  );
}
