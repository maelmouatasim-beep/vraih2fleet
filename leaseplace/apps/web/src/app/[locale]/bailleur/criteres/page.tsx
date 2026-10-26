import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { can, isGrade, type BusinessSector, type EquipmentCategory } from "@leaseplace/domain";
import { Card, CardContent } from "@leaseplace/ui/card";
import { AppetiteEditor } from "@/components/lessor/lessor-forms";
import { PageHeader } from "@/components/shell/shells";
import type { Locale } from "@/i18n/routing";
import { appDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { appetiteOf } from "@/lib/lessor/data";
import { actorFor, requireSpace } from "@/lib/viewer";
import { saveAppetiteAction } from "../actions";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lessor.appetite" });
  return { title: t("title") };
}

/** Critères d'appétit : seuls les dossiers qui les respectent sont orientés vers ce bailleur. */
export default async function Appetite({ params }: Props) {
  const { locale } = await params;
  const viewer = await requireSpace("lessor", locale as Locale);
  const t = await getTranslations("lessor.appetite");
  const row = await withActor(appDb(), await actorFor(viewer), (tx) =>
    appetiteOf(tx, viewer.membership.organizationId),
  );
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardContent>
          <AppetiteEditor
            readOnly={!can(viewer.membership.role, "appetite.manage")}
            action={saveAppetiteAction}
            initial={{
              active: row?.active ?? true,
              minAmountHt: row?.minAmountHt ?? 100_000,
              maxAmountHt: row?.maxAmountHt ?? 5_000_000,
              minDurationMonths: row?.minDurationMonths ?? 24,
              maxDurationMonths: row?.maxDurationMonths ?? 84,
              sectors: (row?.sectors ?? []) as BusinessSector[],
              categories: (row?.categories ?? []) as EquipmentCategory[],
              minGrade: row && isGrade(row.minGrade) ? row.minGrade : "C",
            }}
          />
        </CardContent>
      </Card>
      {row ? (
        <p className="text-[12px] text-fg-subtle">
          {t("updated", { date: formatDateTime(row.updatedAt), version: row.version })}
        </p>
      ) : null}
    </div>
  );
}
