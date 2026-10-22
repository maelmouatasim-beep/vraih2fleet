import { expect, it } from "vitest";
import { isLeadKind } from "./leads";

it("types de contact connus", () => {
  expect(isLeadKind("lessor")).toBe(true);
  expect(isLeadKind("company")).toBe(true);
  expect(isLeadKind("supplier")).toBe(false);
  expect(isLeadKind(undefined)).toBe(false);
});
