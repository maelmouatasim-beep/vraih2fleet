/**
 * Machine d'états typée : les seules transitions possibles sont celles
 * déclarées. Aucun changement de statut ne se fait en dehors (la base
 * applique la même table par trigger).
 */
export type Transitions<S extends string, E extends string> = Readonly<
  Record<S, Partial<Readonly<Record<E, S>>>>
>;

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly event: string,
  ) {
    super(`Transition interdite : ${event} depuis ${from}`);
    this.name = "InvalidTransitionError";
  }
}

export interface Machine<S extends string, E extends string> {
  readonly transitions: Transitions<S, E>;
  can(from: S, event: E): boolean;
  next(from: S, event: E): S;
  /** Paires (de, vers) autorisées, pour générer ou vérifier la table SQL. */
  edges(): readonly (readonly [S, S])[];
}

export function defineMachine<S extends string, E extends string>(
  transitions: Transitions<S, E>,
): Machine<S, E> {
  return {
    transitions,
    can: (from, event) => transitions[from][event] !== undefined,
    next(from, event) {
      const to = transitions[from][event];
      if (to === undefined) throw new InvalidTransitionError(from, event);
      return to;
    },
    edges: () =>
      (Object.entries(transitions) as [S, Partial<Record<E, S>>][]).flatMap(([from, events]) =>
        Object.values<S | undefined>(events).flatMap((to) =>
          to === undefined ? [] : [[from, to] as const],
        ),
      ),
  };
}
