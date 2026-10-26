import { describe, expect, it } from "vitest";
import { PROGRAMMES } from "@/lib/tco";
import { echeancesDemandes, nomProgramme, plafondAffiche, type DemandeSubvention } from "../financing";

function demande(patch: Partial<DemandeSubvention> = {}): DemandeSubvention {
  return {
    id: patch.id ?? "d1",
    program_id: "pave",
    label: null,
    vehicle_id: "veh-1",
    status: "a_preparer",
    ...patch,
  };
}

describe("échéances des demandes de subvention (C5)", () => {
  it("la tâche du plan du même programme ET du même véhicule prime", () => {
    const e = echeancesDemandes(
      [demande()],
      [
        { subsidy_program: "pave", vehicle_id: "veh-1", due_date: "2027-03-31" },
        { subsidy_program: "pave", vehicle_id: "veh-2", due_date: "2026-01-15" },
      ],
    );
    expect(e.get("d1")).toEqual({ date: "2027-03-31", source: "tache" });
  });

  it("demande sans véhicule : n'importe quelle tâche du programme, la plus proche d'abord", () => {
    const e = echeancesDemandes(
      [demande({ vehicle_id: null })],
      [
        { subsidy_program: "pave", vehicle_id: "veh-2", due_date: "2028-03-31" },
        { subsidy_program: "pave", vehicle_id: "veh-3", due_date: "2026-06-30" },
      ],
    );
    expect(e.get("d1")).toEqual({ date: "2026-06-30", source: "tache" });
  });

  it("sans tâche : repli sur la date de fin du programme du registre", () => {
    const prog = PROGRAMMES.find((p) => p.dateFin != null)!;
    const e = echeancesDemandes([demande({ program_id: prog.id })], []);
    expect(e.get("d1")).toEqual({ date: prog.dateFin, source: "programme" });
  });

  it("programme inconnu du registre et aucune tâche : aucune échéance inventée", () => {
    const e = echeancesDemandes([demande({ program_id: "autre" })], []);
    expect(e.get("d1")).toEqual({ date: null, source: null });
  });
});

describe("nomProgramme", () => {
  it("nom court du registre, libellé libre pour « autre », jamais d'invention", () => {
    const prog = PROGRAMMES[0];
    expect(nomProgramme(prog.id, null)).toBe(prog.nom.split("—")[0].trim());
    expect(nomProgramme("autre", "PAGTCP volet 3")).toBe("PAGTCP volet 3");
    expect(nomProgramme("inconnu-xyz", null)).toBe("inconnu-xyz");
  });
});

describe("plafond affiché d'un programme (audit A9)", () => {
  const prog = (id: string) => PROGRAMMES.find((p) => p.id === id)!;

  it("PIVEZ (infrastructure) : 2 M$ PAR PROJET, jamais « par véhicule »", () => {
    expect(prog("pivez").cible).toBe("infrastructure");
    expect(plafondAffiche(prog("pivez"))).toEqual({ montant: 2_000_000, cle: "journey.financing.maxPerProject" });
  });

  it("programme d'achat : plafond par véhicule ; montant par projet (plafond 0) : rien d'affiché", () => {
    expect(plafondAffiche(prog("pave"))).toMatchObject({ cle: "journey.financing.maxPerVehicle" });
    expect(plafondAffiche(prog("pave"))!.montant).toBeGreaterThan(0);
    expect(plafondAffiche(prog("pagtcp"))).toBeNull();
  });

  it("chaque programme d'infrastructure du registre est affiché « par projet »", () => {
    for (const p of PROGRAMMES.filter((x) => x.cible === "infrastructure")) {
      const a = plafondAffiche(p);
      if (a) expect(a.cle).toBe("journey.financing.maxPerProject");
    }
  });
});
