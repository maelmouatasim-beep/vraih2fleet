import { desc } from "drizzle-orm";
import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { schema } from "@leaseplace/db";
import { Card } from "@leaseplace/ui/card";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { Logo } from "@/components/brand/logo";
import { authDb } from "@/lib/db";
import { outboxReadable } from "@/lib/env";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("demo");
  return { title: t("outboxTitle"), robots: { index: false, follow: false } };
}

const LINK = /https?:\/\/\S+/;

/** Boîte d'envoi de démonstration : remplace un vrai fournisseur de courriels. */
export default async function DemoOutbox() {
  if (!outboxReadable()) notFound();
  const t = await getTranslations("demo");
  const mails = await authDb()
    .select()
    .from(schema.outbox)
    .orderBy(desc(schema.outbox.createdAt))
    .limit(20);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{t("outboxTitle")}</h1>
      <p className="mt-1 text-sm text-fg-muted">{t("outboxIntro")}</p>
      <div className="mt-6 flex flex-col gap-3">
        {mails.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={t("outboxEmptyTitle")}
            description={t("outboxEmptyBody")}
          />
        ) : (
          mails.map((m) => {
            const link = LINK.exec(m.text)?.[0];
            return (
              <Card key={m.id} className="p-4" data-outbox-to={m.to}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[14px] font-medium text-fg">{m.subject}</p>
                  <p className="tabular text-[12px] text-fg-subtle">
                    {formatDateTime(m.createdAt)}
                  </p>
                </div>
                <p className="mt-0.5 font-mono text-[12px] text-fg-muted" dir="ltr">
                  {m.to}
                </p>
                <pre
                  className="mt-3 font-sans text-[13px] whitespace-pre-wrap text-fg"
                  data-field="body"
                >
                  {m.text}
                </pre>
                {link ? (
                  <a
                    href={link}
                    className="mt-3 inline-block text-[13px] font-medium text-primary underline underline-offset-2"
                    data-field="link"
                  >
                    {t("openLink")}
                  </a>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
