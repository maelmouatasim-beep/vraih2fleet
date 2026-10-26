import { and, eq, ne } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { schema } from "@leaseplace/db";
import { can } from "@leaseplace/domain";
import { Card, CardContent } from "@leaseplace/ui/card";
import { MessageComposer } from "@/components/messaging/composer";
import { ThreadMessages } from "@/components/messaging/thread";
import { PageHeader } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import { loadCompanyPage } from "@/lib/company-page";
import { markThreadRead, threadView } from "@/lib/messaging/data";
import { sendMessageAction } from "../../actions";

type Props = { params: Promise<{ locale: string; threadId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "messages" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CompanyThread({ params }: Props) {
  const { locale, threadId } = await params;
  if (!UUID.test(threadId)) notFound();
  const data = await loadCompanyPage(locale, async (tx, v) => {
    const view = await threadView(tx, threadId);
    if (view?.companyId !== v.membership.organizationId) return { view: null };
    await markThreadRead(tx, threadId, v.user.id);
    const [deal] = await tx
      .select({ id: schema.deals.id })
      .from(schema.deals)
      .where(
        and(
          eq(schema.deals.requestId, view.thread.requestId),
          eq(schema.deals.lessorOrganizationId, view.thread.lessorOrganizationId),
          ne(schema.deals.status, "cancelled"),
        ),
      );
    return { view, dealAccepted: Boolean(deal) };
  });
  const { view, viewer } = data;
  if (!view || !("dealAccepted" in data)) notFound();
  const t = await getTranslations("messages");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2">
      <Link
        href="/entreprise/messages"
        className="inline-flex w-fit items-center gap-1 text-[13px] text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader
        title={view.lessorName}
        description={t("threadDescription", { reference: view.reference })}
        actions={
          <Link
            href={`/entreprise/demandes/${view.thread.requestId}`}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-[13px] font-medium text-fg hover:bg-surface-muted"
          >
            {t("openRequest")}
          </Link>
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-5">
          <ThreadMessages
            messages={view.messages}
            myOrganizationId={viewer.membership.organizationId}
            names={{ [view.thread.lessorOrganizationId]: view.lessorName }}
          />
          {can(viewer.membership.role, "message.send") ? (
            <MessageComposer
              threadId={view.thread.id}
              warnContacts={!data.dealAccepted}
              action={sendMessageAction}
            />
          ) : null}
          <p className="text-[12px] text-fg-subtle">{t("onPlatform")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
