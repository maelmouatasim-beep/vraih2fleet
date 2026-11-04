import { describe, expect, it } from "vitest";
import { actionsParJalon, anneeJalon, type TacheSource } from "../actions";

function tache(patch: Partial<TacheSource>): TacheSource {
  return { id: patch.id ?? "t", title: "Action", status: "todo", dueDate: null, orderIndex: 0, ...patch };
}

describe("Suivi : actions regroupées par jalon (audit B6)", () => {
  it("année du jalon : année du plan liée, sinon année de l'échéance, sinon aucune", () => {
    expect(anneeJalon({ planYear: 2028, dueDate: "2027-12-31" })).toBe(2028);
    expect(anneeJalon({ planYear: null, dueDate: "2027-03-31" })).toBe(2027);
    expect(anneeJalon({ dueDate: null })).toBeNull();
  });

  it("jalons par année croissante, « sans échéance » en dernier ; compteurs faites / en retard", () => {
    const groupes = actionsParJalon(
      [
        tache({ id: "a", planYear: 2028, dueDate: "2028-03-31" }),
        tache({ id: "b", dueDate: null }),
        tache({ id: "c", planYear: 2026, dueDate: "2026-03-31" }),
        tache({ id: "d", planYear: 2026, dueDate: "2026-12-31", status: "completed" }),
      ],
      "2026-11-04",
    );
    expect(groupes.map((g) => g.annee)).toEqual([2026, 2028, null]);
    expect(groupes[0]).toMatchObject({ faites: 1, enRetard: 1 });
    expect(groupes[0].actions.map((a) => a.id)).toEqual(["c", "d"]);
    expect(groupes[1]).toMatchObject({ faites: 0, enRetard: 0 });
  });

  it("dans un jalon : à faire d'abord par échéance croissante, puis les faites ; une action faite n'est jamais en retard", () => {
    const [g] = actionsParJalon(
      [
        tache({ id: "fait", planYear: 2027, dueDate: "2027-01-15", status: "completed" }),
        tache({ id: "tard", planYear: 2027, dueDate: "2027-06-30" }),
        tache({ id: "tot", planYear: 2027, dueDate: "2027-03-31", status: "in_progress" }),
        tache({ id: "sans", planYear: 2027, dueDate: null }),
      ],
      "2027-12-01",
    );
    expect(g.actions.map((a) => a.id)).toEqual(["tot", "tard", "sans", "fait"]);
    expect(g.actions.find((a) => a.id === "fait")!.enRetard).toBe(false);
    expect(g.enRetard).toBe(2);
  });
});
