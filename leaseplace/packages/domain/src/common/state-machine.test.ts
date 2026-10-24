import { expect, it } from "vitest";
import { defineMachine, InvalidTransitionError } from "./state-machine";

const m = defineMachine<"a" | "b" | "c", "go" | "stop">({
  a: { go: "b", stop: "c" },
  b: { stop: "c" },
  c: {},
});

it("transitions déclarées seulement", () => {
  expect(m.next("a", "go")).toBe("b");
  expect(m.can("b", "go")).toBe(false);
  expect(m.can("b", "stop")).toBe(true);
  expect(() => m.next("c", "go")).toThrow(InvalidTransitionError);
  try {
    m.next("b", "go");
  } catch (e) {
    expect((e as InvalidTransitionError).from).toBe("b");
    expect((e as InvalidTransitionError).event).toBe("go");
  }
  expect(m.edges()).toEqual([
    ["a", "b"],
    ["a", "c"],
    ["b", "c"],
  ]);
});

it("une transition déclarée « undefined » n'existe pas", () => {
  const partial = defineMachine<"a" | "b", "go">({ a: { go: undefined }, b: {} });
  expect(partial.can("a", "go")).toBe(false);
  expect(partial.edges()).toEqual([]);
});
