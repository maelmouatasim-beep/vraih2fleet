import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import {
  CLIENT_NAMESPACES,
  pickMessages,
  SPACE_NAMESPACES,
  type MessageSpace,
} from "./client-messages";

/** Fournit aux composants clients d'un espace ses traductions en plus des communes. */
export async function SpaceMessages({
  space,
  children,
}: {
  space: MessageSpace;
  children: ReactNode;
}) {
  const messages = pickMessages((await getMessages()) as Parameters<typeof pickMessages>[0], [
    ...CLIENT_NAMESPACES,
    ...SPACE_NAMESPACES[space],
  ]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
