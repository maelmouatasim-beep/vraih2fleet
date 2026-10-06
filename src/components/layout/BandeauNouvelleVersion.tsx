/**
 * Bandeau discret « Nouvelle version disponible — Recharger ». Le
 * rechargement n'a lieu QUE sur clic : aucune saisie n'est perdue sans
 * l'accord de l'utilisateur. « Plus tard » masque le bandeau pour l'onglet.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNouvelleVersion } from "@/hooks/useNouvelleVersion";

export default function BandeauNouvelleVersion() {
  const { t } = useTranslation();
  const disponible = useNouvelleVersion();
  const [masque, setMasque] = useState(false);
  if (!disponible || masque) return null;
  return (
    <div
      role="status"
      data-testid="new-version-banner"
      className="fixed bottom-4 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm shadow-lg"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1">{t("version.available")}</p>
      <Button size="sm" onClick={() => window.location.reload()} data-testid="new-version-reload">
        {t("version.reload")}
      </Button>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground hover:text-foreground"
        onClick={() => setMasque(true)}
        aria-label={t("version.later")}
        data-testid="new-version-later"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
