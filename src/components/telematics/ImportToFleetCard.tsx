/**
 * D5 — Import explicite des véhicules télématiques vers « Ma flotte » :
 * aperçu du plan (mises à jour / créations / ignorés + raison), carburant
 * des nouveaux véhicules CHOISI par l'utilisateur, écriture seulement
 * après confirmation. La télématique ne modifie jamais Ma flotte seule.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { useVehicles } from "@/hooks/useVehicles";
import { supabase } from "@/integrations/supabase/client";
import { CARBURANTS, CATEGORIES_VEHICULE, bulkInsertVehicles, updateVehicle } from "@/lib/fleet/vehicles";
import { planifierImportTelematique, type VehiculeTelematique } from "@/lib/fleet/telematicsImport";
import { ArrowRightLeft, Loader2 } from "lucide-react";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

export default function ImportToFleetCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const { vehicles } = useVehicles(organization?.id);
  const [carburant, setCarburant] = useState("");
  const [categorie, setCategorie] = useState("");
  const [enCours, setEnCours] = useState(false);

  const { data: telematiques = [], isLoading } = useQuery({
    queryKey: ["telematics-vehicles-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telematics_vehicles")
        .select(
          "id, external_id, vin, make, model, model_year, vehicle_type, annual_km, has_real_odometer, fuel_consumption, consumption_source",
        );
      if (error) throw error;
      return (data ?? []) as VehiculeTelematique[];
    },
  });

  const plan = useMemo(() => {
    if (!organization) return null;
    return planifierImportTelematique(
      telematiques,
      vehicles,
      organization.id,
      carburant ? { fuel_type: carburant, category: categorie || undefined } : null,
    );
  }, [telematiques, vehicles, organization, carburant, categorie]);

  if (isLoading || !plan || telematiques.length === 0) return null;

  const appliquer = async () => {
    setEnCours(true);
    try {
      for (const m of plan.misesAJour) await updateVehicle(m.vehicleId, m.patch);
      const crees = await bulkInsertVehicles(plan.creations.map((c) => c.vehicule));
      await queryClient.invalidateQueries({ queryKey: ["vehicles", organization?.id] });
      toast({ title: t("telematics.importToFleet.done", { updated: plan.misesAJour.length, created: crees }) });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setEnCours(false);
    }
  };

  const raisons = plan.ignores.reduce<Record<string, number>>((acc, i) => {
    acc[i.raison] = (acc[i.raison] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowRightLeft className="w-5 h-5" /> {t("telematics.importToFleet.title")}
        </CardTitle>
        <CardDescription>{t("telematics.importToFleet.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{t("telematics.importToFleet.updates", { count: plan.misesAJour.length })}</Badge>
          <Badge variant="secondary">{t("telematics.importToFleet.creations", { count: plan.creations.length })}</Badge>
          <Badge variant="outline">{t("telematics.importToFleet.ignored", { count: plan.ignores.length })}</Badge>
          {plan.aReverifier > 0 && (
            <Badge variant="destructive">{t("telematics.importToFleet.toRecheck", { count: plan.aReverifier })}</Badge>
          )}
        </div>
        {plan.aReverifier > 0 && (
          <p className="text-muted-foreground">{t("telematics.importToFleet.toRecheckNote")}</p>
        )}
        {plan.misesAJour.length > 0 && (
          <p className="text-muted-foreground">
            {t("telematics.importToFleet.matched")}{" "}
            {plan.misesAJour.map((m) => `${m.unite} (${t(`telematics.importToFleet.by.${m.par}`)})`).join(", ")}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-border p-3">
          <p className="md:col-span-2 text-muted-foreground">{t("telematics.importToFleet.creationNote")}</p>
          <div className="space-y-1">
            <Label htmlFor="imp-fuel">{t("telematics.importToFleet.fuel")}</Label>
            <select id="imp-fuel" className={selectCls} value={carburant} onChange={(e) => setCarburant(e.target.value)}>
              <option value="">{t("telematics.importToFleet.noCreation")}</option>
              {CARBURANTS.map((f) => (
                <option key={f} value={f}>{t(`fleet.fuels.${f}`)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="imp-cat">{t("telematics.importToFleet.category")}</Label>
            <select id="imp-cat" className={selectCls} value={categorie} onChange={(e) => setCategorie(e.target.value)}>
              <option value="">{t("telematics.importToFleet.categoryFromProvider")}</option>
              {CATEGORIES_VEHICULE.map((c) => (
                <option key={c} value={c}>{t(`fleet.categories.${c}`)}</option>
              ))}
            </select>
          </div>
        </div>
        {plan.ignores.length > 0 && (
          <ul className="text-xs text-muted-foreground list-disc pl-5">
            {Object.entries(raisons).map(([raison, n]) => (
              <li key={raison}>{t(`telematics.importToFleet.reasons.${raison}`, { count: n })}</li>
            ))}
          </ul>
        )}
        <Button
          onClick={() => void appliquer()}
          disabled={enCours || plan.misesAJour.length + plan.creations.length === 0}
        >
          {enCours ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {t("telematics.importToFleet.confirm", { count: plan.misesAJour.length + plan.creations.length })}
        </Button>
      </CardContent>
    </Card>
  );
}
