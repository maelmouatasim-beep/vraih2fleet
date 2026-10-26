import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { Card, CardContent, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { PageHeader } from "@/components/shell/shells";
import { appDb } from "@/lib/db";
import { listNotifications, preferencesOf } from "@/lib/notifications/data";
import { actorFor, type SpaceViewer } from "@/lib/viewer";
import { savePreferencesAction } from "@/app/[locale]/notification-actions";
import { NotificationList } from "./center";
import { PreferencesForm } from "./preferences-form";

/** Page « Notifications » d'un espace : liste et préférences de canaux. */
export async function NotificationsPage({ viewer }: { viewer: SpaceViewer }) {
  const t = await getTranslations("notifications");
  const { items, prefs } = await withActor(appDb(), await actorFor(viewer), async (tx) => ({
    items: await listNotifications(tx, viewer.user.id),
    prefs: await preferencesOf(tx, viewer.user.id),
  }));
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <NotificationList items={items} />
      <Card>
        <CardHeader>
          <CardTitle>{t("preferences.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm initial={prefs} action={savePreferencesAction} />
        </CardContent>
      </Card>
    </div>
  );
}
