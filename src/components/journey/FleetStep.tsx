/**
 * Étape 1 du parcours projet — Flotte : quels véhicules réels de
 * l'organisation (« Ma flotte ») sont inclus dans ce projet, avec
 * l'année de remplacement et la technologie cible PAR VÉHICULE.
 * L'année suggérée à l'ajout = mise en service + durée de vie de la
 * catégorie (défauts « estimation » du moteur TCO), toujours modifiable.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { useVehicles } from "@/hooks/useVehicles";
import { anneeRemplacementSuggeree } from "@/lib/fleet/replacement";
import { TECHNOLOGIES_CIBLES, type ProjectVehicleInsert } from "@/lib/fleet/projectVehicles";
import { Loader2, Plus, Truck } from "lucide-react";

const selectCls =
  "flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface FleetStepProps {
  projectId: string;
}

export default function FleetStep({ projectId }: FleetStepProps) {
  const { t } = useTranslation();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { vehicles, isLoading: fleetLoading } = useVehicles(organization?.id);
  const { projectVehicles, isLoading, ajouter, modifier, retirer } = useProjectVehicles(projectId);

  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const anneeCourante = new Date().getFullYear();
  const anneesChoix = useMemo(() => {
    const annees = Array.from({ length: 21 }, (_, i) => anneeCourante + i);
    // valeurs déjà en base hors plage (données importées) restent visibles
    for (const pv of projectVehicles) {
      if (pv.replacement_year != null && !annees.includes(pv.replacement_year)) {
        annees.push(pv.replacement_year);
      }
    }
    return annees.sort((a, b) => a - b);
  }, [anneeCourante, projectVehicles]);

  const inclus = useMemo(
    () => new Set(projectVehicles.map((pv) => pv.vehicle_id)),
    [projectVehicles],
  );
  const disponibles = useMemo(
    () => vehicles.filter((v) => !inclus.has(v.id)),
    [vehicles, inclus],
  );

  const stats = useMemo(() => {
    const zeroEmission = projectVehicles.filter(
      (pv) => pv.target_technology === "bev" || pv.target_technology === "fcev",
    ).length;
    const sansCible = projectVehicles.filter((pv) => !pv.target_technology).length;
    const sansAnnee = projectVehicles.filter((pv) => pv.replacement_year == null).length;
    return { total: projectVehicles.length, zeroEmission, sansCible, sansAnnee };
  }, [projectVehicles]);

  const basculer = (id: string) => {
    setSelection((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  };

  const toutSelectionner = () => {
    setSelection((prev) =>
      prev.size === disponibles.length ? new Set() : new Set(disponibles.map((v) => v.id)),
    );
  };

  const confirmerAjout = async () => {
    const lignes: ProjectVehicleInsert[] = disponibles
      .filter((v) => selection.has(v.id))
      .map((v) => ({
        project_id: projectId,
        vehicle_id: v.id,
        replacement_year: anneeRemplacementSuggeree(v, anneeCourante),
        target_technology: null,
      }));
    try {
      const n = await ajouter.mutateAsync(lignes);
      toast({ title: t("journey.fleet.toast.added", { count: n }) });
      setDialogOuvert(false);
      setSelection(new Set());
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const majLigne = async (id: string, patch: { replacement_year?: number | null; target_technology?: string | null }) => {
    try {
      await modifier.mutateAsync({ id, patch });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const retirerLigne = async (id: string) => {
    try {
      await retirer.mutateAsync(id);
      toast({ title: t("journey.fleet.toast.removed") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const sourceBadge = (source: string) => {
    if (source === "telematique") return <Badge variant="default">{t("fleet.source.telematique")}</Badge>;
    if (source === "saisie") return <Badge variant="secondary">{t("fleet.source.saisie")}</Badge>;
    return <Badge variant="outline">{t("fleet.source.estimation")}</Badge>;
  };

  if (orgLoading || isLoading || fleetLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Inventaire « Ma flotte » encore vide : on y renvoie d'abord.
  if (vehicles.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-16 px-6 space-y-3">
          <Truck className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="font-medium">{t("journey.fleet.emptyInventory.title")}</p>
          <p className="text-sm text-muted-foreground">{t("journey.fleet.emptyInventory.subtitle")}</p>
          <Button asChild>
            <Link to="/dashboard/fleet">{t("journey.cta.openFleet")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(
          [
            ["included", stats.total],
            ["zeroEmissionTarget", stats.zeroEmission],
            ["noTarget", stats.sansCible],
            ["noYear", stats.sansAnnee],
          ] as const
        ).map(([cle, valeur]) => (
          <Card key={cle}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                {t(`journey.fleet.stats.${cle}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{valeur}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">{t("journey.fleet.tableTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t("journey.fleet.suggestedNote")}</p>
          </div>
          <Button onClick={() => setDialogOuvert(true)}>
            <Plus className="w-4 h-4 mr-2" /> {t("journey.fleet.addButton")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {projectVehicles.length === 0 ? (
            <div className="text-center py-12 px-6">
              <p className="font-medium">{t("journey.fleet.empty.title")}</p>
              <p className="text-sm text-muted-foreground">{t("journey.fleet.empty.subtitle")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fleet.columns.unit")}</TableHead>
                  <TableHead>{t("fleet.columns.vehicle")}</TableHead>
                  <TableHead>{t("fleet.columns.category")}</TableHead>
                  <TableHead className="text-right">{t("fleet.columns.annualKm")}</TableHead>
                  <TableHead>{t("fleet.columns.source")}</TableHead>
                  <TableHead>{t("journey.fleet.columns.replacementYear")}</TableHead>
                  <TableHead>{t("journey.fleet.columns.target")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectVehicles.map((pv) => (
                  <TableRow key={pv.id}>
                    <TableCell className="font-medium">{pv.vehicles.unit_number}</TableCell>
                    <TableCell>
                      {[pv.vehicles.make, pv.vehicles.model, pv.vehicles.model_year]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </TableCell>
                    <TableCell>{t(`fleet.categories.${pv.vehicles.category}`)}</TableCell>
                    <TableCell className="text-right">
                      {pv.vehicles.annual_km != null
                        ? pv.vehicles.annual_km.toLocaleString("fr-CA")
                        : "—"}
                    </TableCell>
                    <TableCell>{sourceBadge(pv.vehicles.consumption_source)}</TableCell>
                    <TableCell>
                      <select
                        className={selectCls}
                        aria-label={t("journey.fleet.columns.replacementYear")}
                        value={pv.replacement_year ?? ""}
                        onChange={(e) =>
                          void majLigne(pv.id, {
                            replacement_year: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      >
                        <option value="">—</option>
                        {anneesChoix.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        className={selectCls}
                        aria-label={t("journey.fleet.columns.target")}
                        value={pv.target_technology ?? ""}
                        onChange={(e) =>
                          void majLigne(pv.id, { target_technology: e.target.value || null })
                        }
                      >
                        <option value="">{t("journey.fleet.chooseTarget")}</option>
                        {TECHNOLOGIES_CIBLES.map((tech) => (
                          <option key={tech} value={tech}>{t(`journey.fleet.targets.${tech}`)}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void retirerLigne(pv.id)}
                        disabled={retirer.isPending}
                      >
                        {t("journey.fleet.remove")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sélection depuis « Ma flotte » */}
      <Dialog
        open={dialogOuvert}
        onOpenChange={(o) => {
          setDialogOuvert(o);
          if (!o) setSelection(new Set());
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("journey.fleet.dialog.title")}</DialogTitle>
            <DialogDescription>{t("journey.fleet.dialog.subtitle")}</DialogDescription>
          </DialogHeader>
          {disponibles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("journey.fleet.dialog.empty")}</p>
          ) : (
            <div className="space-y-3 py-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox
                  checked={selection.size === disponibles.length && disponibles.length > 0}
                  onCheckedChange={toutSelectionner}
                />
                {t("journey.fleet.dialog.selectAll")}
              </label>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {disponibles.map((v) => (
                  <label
                    key={v.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox checked={selection.has(v.id)} onCheckedChange={() => basculer(v.id)} />
                    <span className="font-medium w-20 shrink-0">{v.unit_number}</span>
                    <span className="flex-1 truncate">
                      {[v.make, v.model, v.model_year].filter(Boolean).join(" ") || "—"}
                    </span>
                    <span className="text-muted-foreground">{t(`fleet.categories.${v.category}`)}</span>
                    <Badge variant={v.status === "actif" ? "default" : "outline"}>
                      {t(`fleet.statuses.${v.status}`)}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOuvert(false)}>{t("common.cancel")}</Button>
            <Button onClick={confirmerAjout} disabled={selection.size === 0 || ajouter.isPending}>
              {ajouter.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("journey.fleet.dialog.confirm", { count: selection.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
