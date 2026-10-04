/**
 * Phase 5 — Intelligence artificielle de l'organisation : chaque fonction
 * est activable par un administrateur (désactivée par défaut, Loi 25),
 * plafonds de requêtes et de jetons, consommation du mois et coût estimé.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { enregistrerReglagesIa, lireReglagesIa, resumeUsageIa } from "@/lib/supabase/ai";
import { DATE_TARIFS, coutEstimeUsd } from "@/lib/ai/tarifs";
import { Sparkles } from "lucide-react";

const FONCTIONS = [
  ["copilot_enabled", "copilot"],
  ["smart_import_enabled", "smartImport"],
  ["document_reading_enabled", "documents"],
  ["council_note_enabled", "councilNote"],
] as const;
type Colonne = (typeof FONCTIONS)[number][0];

interface Props {
  organizationId: string;
  estAdmin: boolean;
}

export default function AiSettingsCard({ organizationId, estAdmin }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: reglages } = useQuery({
    queryKey: ["ai-settings", organizationId],
    queryFn: () => lireReglagesIa(organizationId),
  });
  const { data: usage } = useQuery({
    queryKey: ["ai-usage", organizationId],
    queryFn: () => resumeUsageIa(organizationId),
  });
  const [limites, setLimites] = useState({ mois: "", jour: "" });
  useEffect(() => {
    setLimites({
      mois: String(reglages?.monthly_token_limit ?? 3000000),
      jour: String(reglages?.daily_request_limit ?? 300),
    });
  }, [reglages]);

  const enregistrer = async (patch: Partial<Record<Colonne, boolean>> & { monthly_token_limit?: number; daily_request_limit?: number }) => {
    try {
      await enregistrerReglagesIa(organizationId, patch);
      await queryClient.invalidateQueries({ queryKey: ["ai-settings", organizationId] });
      toast({ title: t("organization.ai.saved") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const nombre = new Intl.NumberFormat(i18n.language.startsWith("en") ? "en-CA" : "fr-CA");
  const usd = new Intl.NumberFormat(i18n.language.startsWith("en") ? "en-CA" : "fr-CA", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const jetonsMois = (usage?.month_input_tokens ?? 0) + (usage?.month_output_tokens ?? 0);
  const cout = usage
    ? coutEstimeUsd("claude-opus-5-5", {
        entree: usage.month_input_tokens,
        sortie: usage.month_output_tokens,
        lectureCache: usage.month_cache_read_tokens,
      })
    : null;

  return (
    <Card data-testid="ai-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {t("organization.ai.title")}
        </CardTitle>
        <CardDescription>{t("organization.ai.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("organization.ai.privacy")}
        </p>
        <div className="divide-y divide-border rounded-md border border-border">
          {FONCTIONS.map(([colonne, cle]) => (
            <div key={colonne} className="flex items-center justify-between gap-4 px-3 py-2">
              <div>
                <Label htmlFor={`ai-${cle}`} className="font-medium">
                  {t(`organization.ai.features.${cle}.title`)}
                </Label>
                <p className="text-xs text-muted-foreground">{t(`organization.ai.features.${cle}.description`)}</p>
              </div>
              <Switch
                id={`ai-${cle}`}
                checked={reglages?.[colonne] === true}
                disabled={!estAdmin}
                onCheckedChange={(v) => void enregistrer({ [colonne]: v })}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div className="space-y-1">
            <Label htmlFor="ai-limit-month">{t("organization.ai.monthlyTokens")}</Label>
            <Input
              id="ai-limit-month"
              inputMode="numeric"
              disabled={!estAdmin}
              value={limites.mois}
              onChange={(e) => setLimites((l) => ({ ...l, mois: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ai-limit-day">{t("organization.ai.dailyRequests")}</Label>
            <Input
              id="ai-limit-day"
              inputMode="numeric"
              disabled={!estAdmin}
              value={limites.jour}
              onChange={(e) => setLimites((l) => ({ ...l, jour: e.target.value }))}
            />
          </div>
          {estAdmin && (
            <Button
              variant="outline"
              onClick={() =>
                void enregistrer({
                  monthly_token_limit: Math.max(0, Math.round(Number(limites.mois) || 0)),
                  daily_request_limit: Math.max(0, Math.round(Number(limites.jour) || 0)),
                })
              }
            >
              {t("common.save")}
            </Button>
          )}
        </div>
        <div className="rounded-md bg-muted/40 p-3 space-y-1">
          <p className="font-medium">{t("organization.ai.usageTitle")}</p>
          <p>
            {t("organization.ai.usage", {
              tokens: nombre.format(jetonsMois),
              requests: nombre.format(usage?.month_requests ?? 0),
              today: nombre.format(usage?.today_requests ?? 0),
            })}
          </p>
          {cout != null && (
            <p className="text-xs text-muted-foreground">
              {t("organization.ai.cost", { amount: usd.format(cout), date: DATE_TARIFS })}
            </p>
          )}
        </div>
        {!estAdmin && <p className="text-xs text-muted-foreground">{t("organization.ai.adminOnly")}</p>}
      </CardContent>
    </Card>
  );
}
