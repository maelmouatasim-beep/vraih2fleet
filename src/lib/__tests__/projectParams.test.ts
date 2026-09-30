import { describe, expect, it } from "vitest";
import { tauxActualisationDepuisProjet, tauxDepuisSaisiePourcent } from "../projectParams";

describe("taux d'actualisation du projet (D4 — unité unique)", () => {
  it("la fraction stockée est utilisée telle quelle : 0.05 → 5 %", () => {
    expect(tauxActualisationDepuisProjet(0.05)).toBe(0.05);
    expect(tauxActualisationDepuisProjet(0)).toBe(0);
  });

  it("un ancien pourcentage (instantané antérieur) est converti, jamais pris pour 500 %", () => {
    expect(tauxActualisationDepuisProjet(5)).toBeCloseTo(0.05, 10);
    expect(tauxActualisationDepuisProjet(6.5)).toBeCloseTo(0.065, 10);
  });

  it("régression : un projet créé à l'écran n'est plus actualisé à 0,05 %", () => {
    // Avant : la création stockait 0.05 et le moteur divisait par 100.
    const stocke = tauxDepuisSaisiePourcent("5")!;
    expect(tauxActualisationDepuisProjet(stocke)).toBeCloseTo(0.05, 10);
  });

  it("saisie en % : virgule acceptée, valeur illisible ou hors bornes refusée", () => {
    expect(tauxDepuisSaisiePourcent("5,5")).toBeCloseTo(0.055, 10);
    expect(tauxDepuisSaisiePourcent("abc")).toBeNull();
    expect(tauxDepuisSaisiePourcent("-1")).toBeNull();
    expect(tauxDepuisSaisiePourcent("150")).toBeNull();
  });

  it("une valeur négative ou non finie est une erreur explicite", () => {
    expect(() => tauxActualisationDepuisProjet(-0.01)).toThrow();
    expect(() => tauxActualisationDepuisProjet(Number.NaN)).toThrow();
  });
});
