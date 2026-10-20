import { afterAll, describe, expect, it } from "vitest";
import { ROLES_BY_ORGANIZATION_TYPE, ORGANIZATION_TYPES } from "@leaseplace/domain";
import { roleCatalog } from "../schema";
import { testDatabase } from "./helpers";

const { db, close } = testDatabase();
afterAll(close);

describe("catalogue des rôles", () => {
  it("la base et packages/domain déclarent exactement les mêmes rôles", async () => {
    const rows = await db.select().from(roleCatalog);
    const enBase = rows.map((r) => `${r.organizationType}:${r.role}`).sort();
    const enDomaine = ORGANIZATION_TYPES.flatMap((t) =>
      ROLES_BY_ORGANIZATION_TYPE[t].map((r) => `${t}:${r}`),
    ).sort();
    expect(enBase).toEqual(enDomaine);
  });
});
