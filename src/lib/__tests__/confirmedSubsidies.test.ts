/**
 * Subventions confirmées par le client : fusion PURE avec les
 * subventions résolues (priorité au client), libellés et années.
 */
import { describe, expect, it } from "vitest";
import {
  appliquerSubventionsConfirmees,
  libelleCourtProgramme,
  parVehicule,
  type SubventionConfirmee,
} from "@/lib/confirmedSubsidies";
import { PROGRAMMES } from "@/lib/tco";

const NOM_PAVE = PROGRAMMES.find((p) => p.id === "pave")!.nom;

function confirmee(patch: Partial<SubventionConfirmee> = {}): SubventionConfirmee {
  return {
    programId: "pagtcp",
    libelle: "Programme d'aide gouvernementale au transport collectif (Québec, MTMD)",
    montant: 400000,
    anneeCalendaireVersement: null,
    reference: "lettre MTMD 2026-1234",
    ...patch,
  };
}

describe("appliquerSubventionsConfirmees", () => {
  it("un programme non chiffré automatiquement (PAGTCP) s'AJOUTE, marqué « confirmée par le client »", () => {
    const resolues = [{ libelle: NOM_PAVE, montant: 5000, annee: 2 }];
    const r = appliquerSubventionsConfirmees(resolues, [confirmee()], 2, 2026);
    expect(r).toHaveLength(2);
    const c = r.find((s) => s.libelle.includes("confirmée par le client"))!;
    expect(c.montant).toBe(400000);
    expect(c.libelle).toContain("réf. lettre MTMD 2026-1234");
    expect(c.annee).toBe(2); // pas d'année confirmée → année d'achat k
  });

  it("un programme DÉJÀ résolu est REMPLACÉ par le montant confirmé (priorité au client)", () => {
    const resolues = [
      { libelle: NOM_PAVE, montant: 5000, annee: 2 },
      { libelle: "Roulez vert (Québec) — véhicule neuf", montant: 2000, annee: 2 },
    ];
    const r = appliquerSubventionsConfirmees(
      resolues,
      [confirmee({ programId: "pave", libelle: "PAVÉ", montant: 4000, reference: "dossier TC-42" })],
      2,
      2026,
    );
    expect(r.filter((s) => s.libelle === NOM_PAVE)).toHaveLength(0); // la résolue disparaît
    const c = r.find((s) => s.libelle.startsWith("PAVÉ — confirmée"))!;
    expect(c.montant).toBe(4000);
    expect(r.some((s) => s.libelle.includes("Roulez vert"))).toBe(true); // les autres restent
  });

  it("année de versement confirmée : convertie en année du plan, jamais avant l'achat", () => {
    const r = appliquerSubventionsConfirmees(
      [],
      [
        confirmee({ anneeCalendaireVersement: 2031 }),
        confirmee({ programId: "ftcze", libelle: "FTCZE", anneeCalendaireVersement: 2024 }),
      ],
      3,
      2026,
    );
    expect(r[0].annee).toBe(5); // 2031 − 2026
    expect(r[1].annee).toBe(3); // 2024 avant l'achat → ramenée à k
  });

  it("aucune confirmation : les résolues sont retournées telles quelles", () => {
    const resolues = [{ libelle: NOM_PAVE, montant: 5000, annee: 0 }];
    expect(appliquerSubventionsConfirmees(resolues, undefined, 0, 2026)).toBe(resolues);
  });
});

describe("libellés et regroupement", () => {
  it("libelleCourtProgramme : nom court du registre, libellé libre pour « autre »", () => {
    expect(libelleCourtProgramme("pave", null)).toBe("PAVÉ");
    expect(libelleCourtProgramme("autre", "Subvention FCM")).toBe("Subvention FCM");
    expect(libelleCourtProgramme("inconnu", null)).toBe("inconnu");
  });

  it("parVehicule regroupe les lignes de la table par véhicule", () => {
    const m = parVehicule([
      { vehicle_id: "a", program_id: "pagtcp", label: null, amount: 1, payment_year: null, document_reference: "x" },
      { vehicle_id: "a", program_id: "autre", label: "FCM", amount: 2, payment_year: 2027, document_reference: "y" },
      { vehicle_id: "b", program_id: "ftcze", label: null, amount: 3, payment_year: null, document_reference: "z" },
    ]);
    expect(m.get("a")).toHaveLength(2);
    expect(m.get("b")![0].libelle).toBe("FTCZE");
    expect(m.get("a")![1].anneeCalendaireVersement).toBe(2027);
  });
});
