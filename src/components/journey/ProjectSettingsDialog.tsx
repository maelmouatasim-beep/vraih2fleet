/**
 * D4 — Paramètres du projet (nom, description, horizon d'analyse, taux
 * d'actualisation), modifiables depuis le parcours. Toutes les étapes
 * recalculent avec les nouvelles valeurs ; un rapport déjà généré reste
 * figé et signale l'écart.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { tauxActualisationDepuisProjet, tauxDepuisSaisiePourcent } from "@/lib/projectParams";
import { updateProjectSettings, type ProjectDTO } from "@/lib/supabase/projects";
import { Loader2, Settings2 } from "lucide-react";

export default function ProjectSettingsDialog({ project }: { project: ProjectDTO }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [forme, setForme] = useState({ name: "", description: "", horizon: "", taux: "" });

  useEffect(() => {
    if (!ouvert) return;
    setForme({
      name: project.name,
      description: project.description ?? "",
      horizon: String(project.defaultAnalysisHorizonYears),
      taux: String(
        Math.round(tauxActualisationDepuisProjet(project.defaultDiscountRate) * 10000) / 100,
      ),
    });
  }, [ouvert, project]);

  const enregistrer = async () => {
    const horizon = Number(forme.horizon);
    const taux = tauxDepuisSaisiePourcent(forme.taux);
    if (!forme.name.trim() || !Number.isInteger(horizon) || horizon < 1 || horizon > 30 || taux === null) {
      toast({ title: t("journey.settings.invalid"), variant: "destructive" });
      return;
    }
    setEnCours(true);
    try {
      await updateProjectSettings(project.id, {
        name: forme.name.trim(),
        description: forme.description.trim() || null,
        horizonYears: horizon,
        discountRate: taux,
      });
      await queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast({ title: t("journey.settings.saved") });
      setOuvert(false);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOuvert(true)}>
        <Settings2 className="w-4 h-4 mr-2" /> {t("journey.settings.button")}
      </Button>
      <Dialog open={ouvert} onOpenChange={(o) => !enCours && setOuvert(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("journey.settings.title")}</DialogTitle>
            <DialogDescription>{t("journey.settings.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="ps-nom">{t("journey.settings.name")}</Label>
              <Input id="ps-nom" value={forme.name} onChange={(e) => setForme({ ...forme, name: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="ps-desc">{t("journey.settings.description")}</Label>
              <Input id="ps-desc" value={forme.description} onChange={(e) => setForme({ ...forme, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ps-horizon">{t("journey.settings.horizon")}</Label>
              <Input id="ps-horizon" inputMode="numeric" value={forme.horizon} onChange={(e) => setForme({ ...forme, horizon: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ps-taux">{t("journey.settings.rate")}</Label>
              <Input id="ps-taux" inputMode="decimal" value={forme.taux} onChange={(e) => setForme({ ...forme, taux: e.target.value })} />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">{t("journey.settings.note")}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOuvert(false)} disabled={enCours}>{t("common.cancel")}</Button>
            <Button onClick={() => void enregistrer()} disabled={enCours}>
              {enCours ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
