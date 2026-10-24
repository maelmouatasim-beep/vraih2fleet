import "server-only";
import { withActor, type Transaction } from "@leaseplace/db";
import type { Locale } from "@/i18n/routing";
import { appDb } from "./db";
import { actorFor, requireSpace, type SpaceViewer } from "./viewer";

/** Page de l'espace entreprise : lecture sous l'identité de l'utilisateur (RLS). */
export async function loadCompanyPage<T>(
  locale: string,
  fn: (tx: Transaction, viewer: SpaceViewer) => Promise<T>,
): Promise<T & { viewer: SpaceViewer }> {
  const viewer = await requireSpace("company", locale as Locale);
  const data = await withActor(appDb(), await actorFor(viewer), (tx) => fn(tx, viewer));
  return { ...data, viewer };
}
