// @vitest-environment happy-dom
/**
 * Barre des 7 étapes : structure identique pour les 7 étapes (cercle
 * numéroté + libellé, aucun indicateur de plus), un seul système d'états,
 * étape affichée marquée aria-current="step", états annoncés, ligne de
 * progression, modes de mise en page, contraste AA des couleurs d'état.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MemoryRouter } from "react-router-dom";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ETAPES_PARCOURS, type EtapeParcoursCle } from "@/lib/journey/steps";
import type { EtatParcours } from "@/lib/journey/progress";
import { etatVisuel, modeBarre, segmentTermine, SEUILS_BARRE } from "@/lib/journey/stepper";
import JourneyStepper from "../JourneyStepper";

const i18n = i18next.createInstance();
let largeurSimulee = 1200;
beforeAll(async () => {
  // happy-dom ne calcule pas de mise en page : largeur du conteneur simulée.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => largeurSimulee });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await i18n.use(initReactI18next).init({ lng: "fr", resources: { fr: { translation: fr }, en: { translation: en } }, interpolation: { escapeValue: false } });
});

let racine: Root | null = null;
afterEach(() => {
  act(() => racine?.unmount());
  document.body.innerHTML = "";
  largeurSimulee = 1200;
});

const ETATS: Record<EtapeParcoursCle, EtatParcours> = {
  flotte: { etat: "termine", manques: [] },
  faisabilite: { etat: "termine", manques: [] },
  strategies: { etat: "termine", manques: [] },
  plan: { etat: "en_cours", manques: [{ cle: "sansAnnee", count: 1 }] },
  financement: { etat: "a_faire", manques: [{ cle: "demandesManquantes", count: 1 }] },
  rapports: { etat: "termine", manques: [] },
  suivi: { etat: "a_faire", manques: [] },
};

function monter(etape: EtapeParcoursCle = "financement") {
  const div = document.createElement("div");
  document.body.appendChild(div);
  racine = createRoot(div);
  act(() =>
    racine!.render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <TooltipProvider>
            <JourneyStepper base="/dashboard/projects/p1" etape={etape} etats={ETATS} />
          </TooltipProvider>
        </MemoryRouter>
      </I18nextProvider>,
    ),
  );
  return div;
}

describe("JourneyStepper — structure et états", () => {
  it("7 colonnes égales, chaque étape = cercle qui contient son numéro + libellé, aucun indicateur supplémentaire", () => {
    const d = monter();
    expect(d.querySelector("ol")!.className).toContain("grid-cols-7");
    const etapes = d.querySelectorAll('[data-testid="journey-step"]');
    expect(etapes).toHaveLength(7);
    etapes.forEach((li, i) => {
      const lien = li.querySelector("a")!;
      expect(li.querySelector('[data-testid="journey-step-circle"]')!.textContent).toBe(String(i + 1));
      expect(li.querySelector('[data-testid="journey-step-label"]')!.textContent).toBe(fr.journey.steps[ETAPES_PARCOURS[i]].title);
      // Aucune icône (coche, rond, pointillé) dans l'étape : numéro et libellé seulement.
      expect(lien.querySelectorAll("svg")).toHaveLength(0);
      expect(lien.children).toHaveLength(2);
    });
  });

  it("un seul système d'états : même classe de cercle pour un même état, trois rendus distincts", () => {
    const d = monter();
    const cercles = [...d.querySelectorAll('[data-testid="journey-step-circle"]')];
    const classe = (i: number) => cercles[i].className;
    expect(classe(0)).toBe(classe(1)); // terminé = terminé
    expect(classe(0)).toBe(classe(5));
    expect(classe(4)).toBe(classe(6)); // à faire = à faire
    expect(new Set([classe(0), classe(3), classe(4)]).size).toBe(3);
    expect(classe(0)).toContain("bg-primary-strong");
    expect(classe(3)).toContain("border-amber-600");
    expect(classe(4)).toContain("border-muted-foreground");
  });

  it("l'étape affichée est la seule en aria-current=\"step\", libellé gras souligné ; sans changer son cercle", () => {
    const d = monter("financement");
    const courants = d.querySelectorAll('[aria-current="step"]');
    expect(courants).toHaveLength(1);
    expect(courants[0].getAttribute("href")).toBe("/dashboard/projects/p1/financement");
    const libelle = courants[0].querySelector('[data-testid="journey-step-label"]')!;
    expect(libelle.className).toContain("font-semibold");
    expect(libelle.className).toContain("border-primary-strong");
    // Le cercle de l'étape affichée garde la classe de son état (à faire), comme Suivi.
    const cercles = d.querySelectorAll('[data-testid="journey-step-circle"]');
    expect(cercles[4].className).toBe(cercles[6].className);
  });

  it("chaque état est annoncé aux lecteurs d'écran (position, titre, état)", () => {
    const d = monter();
    const liens = [...d.querySelectorAll("a[data-etat]")];
    expect(liens[0].getAttribute("aria-label")).toBe("Étape 1 sur 7 : Flotte — Étape terminée");
    expect(liens[3].getAttribute("aria-label")).toBe("Étape 4 sur 7 : Plan — Étape en cours");
    expect(liens[4].getAttribute("aria-label")).toBe("Étape 5 sur 7 : Financement — Étape à faire");
  });

  it("ligne de progression : primaire entre deux étapes terminées, grise ensuite", () => {
    const d = monter();
    const segments = [...d.querySelectorAll('[data-testid="journey-segment"]')].map((s) => s.getAttribute("data-termine"));
    expect(segments).toEqual(["true", "true", "false", "false", "false", "false"]);
  });

  it("phrase sous la barre : état de l'étape affichée et ce qui manque, dans le même conteneur", () => {
    const d = monter("plan");
    const phrase = d.querySelector('[data-testid="etat-etape"]')!;
    // Espaces insécables de la typographie française ramenées à des espaces simples pour la comparaison.
    expect(phrase.textContent!.replace(/[\u00a0\u202f]/g, " ")).toBe("Étape en cours — ce qui manque : 1 véhicule sans année de remplacement");
    expect(phrase.parentElement).toBe(d.querySelector("ol")!.parentElement);
  });
});

describe("JourneyStepper — responsive", () => {
  it("compact : mêmes 7 étapes, cercles et libellés plus petits", () => {
    largeurSimulee = 700;
    const d = monter();
    expect(d.querySelector('[data-testid="journey-stepper"]')!.getAttribute("data-mode")).toBe("compact");
    expect(d.querySelectorAll('[data-testid="journey-step-label"]')).toHaveLength(7);
    expect(d.querySelector('[data-testid="journey-step-circle"]')!.className).toContain("h-7");
  });

  it("étroit : cercles seuls sur une ligne + libellé de l'étape affichée dessous", () => {
    largeurSimulee = 300;
    const d = monter("plan");
    expect(d.querySelector('[data-testid="journey-stepper"]')!.getAttribute("data-mode")).toBe("cercles");
    expect(d.querySelectorAll('[data-testid="journey-step-label"]')).toHaveLength(0);
    expect(d.querySelectorAll('[data-testid="journey-step-circle"]')).toHaveLength(7);
    expect(d.querySelector('[data-testid="journey-active-label"]')!.textContent).toBe("Étape 4 sur 7 · Plan");
  });
});

describe("JourneyStepper — règles pures", () => {
  it("modes selon la largeur réelle disponible", () => {
    expect(modeBarre(1200)).toBe("complet");
    expect(modeBarre(SEUILS_BARRE.complet)).toBe("complet");
    expect(modeBarre(SEUILS_BARRE.complet - 1)).toBe("compact");
    expect(modeBarre(SEUILS_BARRE.compact)).toBe("compact");
    expect(modeBarre(SEUILS_BARRE.compact - 1)).toBe("cercles");
    // Compact : une colonne garde au moins 77 px.
    expect(SEUILS_BARRE.compact / 7).toBeGreaterThanOrEqual(77);
  });

  it("état inconnu (chargement) = à faire ; segments", () => {
    expect(etatVisuel(undefined)).toBe("a_faire");
    expect(segmentTermine(["termine", "termine"], 0)).toBe(true);
    expect(segmentTermine(["termine", "en_cours"], 0)).toBe(false);
    expect(segmentTermine(["termine", undefined], 0)).toBe(false);
  });
});

describe("JourneyStepper — contraste AA", () => {
  const css = readFileSync(join(__dirname, "../../../index.css"), "utf8");
  const clair = css.slice(css.indexOf(":root"), css.indexOf(".dark"));
  const sombre = css.slice(css.indexOf(".dark"));
  const token = (bloc: string, nom: string) => {
    const m = bloc.match(new RegExp(`--${nom}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
    if (!m) throw new Error(`token ${nom} introuvable`);
    return hsl(Number(m[1]), Number(m[2]), Number(m[3]));
  };
  function hsl(h: number, s: number, l: number): [number, number, number] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)];
  }
  const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lum = ([r, g, b]: number[]) => {
    const c = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
  };
  const ratio = (a: number[], b: number[]) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  // Palette Tailwind (amber-400/600/700).
  const AMBRE = { 400: hex("#fbbf24"), 600: hex("#d97706"), 700: hex("#b45309") };

  it("thème clair : textes ≥ 4,5:1, contours ≥ 3:1", () => {
    const carte = token(clair, "card");
    expect(ratio(token(clair, "primary-strong"), carte)).toBeGreaterThanOrEqual(4.5); // libellé terminé
    expect(ratio(token(clair, "primary-foreground"), token(clair, "primary-strong"))).toBeGreaterThanOrEqual(4.5); // numéro blanc
    expect(ratio(AMBRE[700], carte)).toBeGreaterThanOrEqual(4.5); // numéro en cours
    expect(ratio(AMBRE[600], carte)).toBeGreaterThanOrEqual(3); // contour en cours
    expect(ratio(token(clair, "muted-foreground"), carte)).toBeGreaterThanOrEqual(4.5); // à faire
    expect(ratio(token(clair, "foreground"), carte)).toBeGreaterThanOrEqual(4.5);
  });

  it("thème sombre : mêmes exigences", () => {
    const carte = token(sombre, "card");
    expect(ratio(token(sombre, "primary-strong"), carte)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token(sombre, "primary-foreground"), token(sombre, "primary-strong"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(AMBRE[400], carte)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(token(sombre, "muted-foreground"), carte)).toBeGreaterThanOrEqual(4.5);
  });
});
