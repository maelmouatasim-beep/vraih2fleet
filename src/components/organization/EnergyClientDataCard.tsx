/**
 * Données client de prix de l'énergie (couche 3, §3.3 v2.2) : saisie au
 * niveau de l'ORGANISATION (project_id NULL) ou d'un PROJET (prioritaire).
 * Les montants s'entendent AVANT TPS/TVQ ; les champs vides retombent
 * sur la couche inférieure (organisation, puis défauts du registre).
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useEnergyClientInputs } from "@/hooks/useEnergyClientInputs";
import { useOrganization } from "@/hooks/useOrganization";
import { HYPOTHESES } from "@/lib/tco";
import { Loader2, Zap } from "lucide-react";

interface EnergyClientDataCardProps {
  /** Absent = niveau organisation ; présent = surcharge de CE projet. */
  projectId?: string;
}

type Champ = "diesel_price_per_l" | "electricity_cost_per_kwh" | "h2_price_per_kg" | "grid_connection_quote";

const DEFAUTS: Record<Champ, number> = {
  diesel_price_per_l: HYPOTHESES.prix_diesel.valeur,
  electricity_cost_per_kwh: HYPOTHESES.cout_effectif_elec_depot.valeur,
  h2_price_per_kg: HYPOTHESES.prix_h2_livre.valeur,
  grid_connection_quote: HYPOTHESES.raccordement_depot.valeur,
};

export default function EnergyClientDataCard({ projectId }: EnergyClientDataCardProps) {
  const { t } = useTranslation();
  const { organization } = useOrganization();
  const { organisation, projet, enregistrer, isLoading } = useEnergyClientInputs(projectId);
  const ligne = projectId ? projet : organisation;
  const peutEcrire = organization?.myRole === "admin" || organization?.myRole === "member";

  const [forme, setForme] = useState<Record<Champ | "notes", string>>({
    diesel_price_per_l: "",
    electricity_cost_per_kwh: "",
    h2_price_per_kg: "",
    grid_connection_quote: "",
    notes: "",
  });

  useEffect(() => {
    setForme({
      diesel_price_per_l: ligne?.diesel_price_per_l?.toString() ?? "",
      electricity_cost_per_kwh: ligne?.electricity_cost_per_kwh?.toString() ?? "",
      h2_price_per_kg: ligne?.h2_price_per_kg?.toString() ?? "",
      grid_connection_quote: ligne?.grid_connection_quote?.toString() ?? "",
      notes: ligne?.notes ?? "",
    });
  }, [ligne]);

  const sauvegarder = async () => {
    const nombre = (s: string): number | null => {
      const brut = s.replace(",", ".").trim();
      if (brut === "") return null;
      const v = Number(brut);
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    try {
      await enregistrer.mutateAsync({
        project_id: projectId ?? null,
        diesel_price_per_l: nombre(forme.diesel_price_per_l),
        electricity_cost_per_kwh: nombre(forme.electricity_cost_per_kwh),
        h2_price_per_kg: nombre(forme.h2_price_per_kg),
        grid_connection_quote: nombre(forme.grid_connection_quote),
        notes: forme.notes.trim() || null,
      });
      toast({ title: t("energyClient.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const champs: { cle: Champ; suffixe: string }[] = [
    { cle: "diesel_price_per_l", suffixe: "$/L" },
    { cle: "electricity_cost_per_kwh", suffixe: "$/kWh" },
    { cle: "h2_price_per_kg", suffixe: "$/kg" },
    { cle: "grid_connection_quote", suffixe: "$" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="w-5 h-5" /> {t("energyClient.title")}
        </CardTitle>
        <CardDescription>
          {projectId ? t("energyClient.subtitleProject") : t("energyClient.subtitleOrg")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {champs.map(({ cle, suffixe }) => (
                <div key={cle} className="space-y-2">
                  <Label htmlFor={`energie-${cle}`}>
                    {t(`energyClient.fields.${cle}`)} ({suffixe})
                  </Label>
                  <Input
                    id={`energie-${cle}`}
                    inputMode="decimal"
                    value={forme[cle]}
                    disabled={!peutEcrire}
                    placeholder={t("energyClient.defaultPlaceholder", {
                      valeur: DEFAUTS[cle].toLocaleString("fr-CA"),
                    })}
                    onChange={(e) => setForme({ ...forme, [cle]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="energie-notes">{t("energyClient.fields.notes")}</Label>
              <Input
                id="energie-notes"
                value={forme.notes}
                disabled={!peutEcrire}
                placeholder={t("energyClient.notesPlaceholder")}
                onChange={(e) => setForme({ ...forme, notes: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("energyClient.beforeTaxNote")}</p>
            {peutEcrire && (
              <Button onClick={sauvegarder} disabled={enregistrer.isPending} size="sm">
                {enregistrer.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("energyClient.save")}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
