/**
 * Étape 1 du parcours projet — Flotte : quels véhicules réels de
 * l'organisation (« Ma flotte ») sont inclus dans ce projet, avec
 * l'année de remplacement et la technologie cible PAR VÉHICULE.
 * - L'année suggérée à l'ajout = mise en service + durée de vie de la
 *   catégorie (défauts « estimation » du moteur TCO), toujours modifiable.
 * - La cible est PRÉ-SUGGÉRÉE par la Faisabilité (meilleure technologie
 *   au verdict non défavorable), affichée à côté du choix et applicable
 *   en un clic à la sélection.
 * - Tableau triable et actions groupées (année, cible, retrait).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { useOptionsProjet } from "@/hooks/useEnergyClientInputs";
import { useOrganization } from "@/hooks/useOrganization";
import { useProjectVehicles } from "@/hooks/useProjectVehicles";
import { useVehicles } from "@/hooks/useVehicles";
import { anneeFinVie, lisserRattrapage, RATTRAPAGE_ANS_DEFAUT } from "@/lib/fleet/replacement";
import { TECHNOLOGIES_CIBLES, type ProjectVehicleInsert } from "@/lib/fleet/projectVehicles";
import { cibleSuggeree, evaluerFaisabiliteVehicule } from "@/lib/journey/feasibility";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Plus, Sparkles, Truck } from "lucide-react";
import { StatusBadge, LoadingState } from "@/components/layout/States";
import { ton, TON_SOURCE, TON_VEHICULE } from "@/components/layout/tons";
import { StatCard, StatGrid } from "@/components/layout/StatCard";
import { formateurNombre } from "@/lib/format";

const selectCls =
  "flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type CleTri = "unit" | "vehicle" | "category" | "km" | "year" | "target";

interface FleetStepProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
}

export default function FleetStep({ projectId, project }: FleetStepProps) {
  const { t, i18n } = useTranslation();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { vehicles, isLoading: fleetLoading } = useVehicles(organization?.id);
  const { projectVehicles, isLoading, ajouter, modifier, appliquerLot, retirer } = useProjectVehicles(projectId);
  const { options } = useOptionsProjet(project, projectId);

  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  // sélection de LIGNES du projet (actions groupées), distincte de la
  // sélection d'ajout depuis « Ma flotte »
  const [lignesChoisies, setLignesChoisies] = useState<Set<string>>(new Set());
  const [tri, setTri] = useState<{ cle: CleTri; asc: boolean }>({ cle: "unit", asc: true });
  const [anneeGroupee, setAnneeGroupee] = useState<string>("");
  const [cibleGroupee, setCibleGroupee] = useState<string>("");

  const anneeCourante = new Date().getFullYear();
  const [rattrapageAns, setRattrapageAns] = useState(RATTRAPAGE_ANS_DEFAUT);
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

  // Cible pré-suggérée par la Faisabilité (même moteur, mêmes options
  // que l'étape 2) — null tant que les options du projet chargent.
  const suggestions = useMemo(() => {
    if (!options) return null;
    const parVehicule = new Map<string, "bev" | "fcev" | null>();
    for (const pv of projectVehicles) {
      parVehicule.set(
        pv.vehicle_id,
        cibleSuggeree(
          evaluerFaisabiliteVehicule(
            { ...pv.vehicles, replacement_year: pv.replacement_year },
            options,
          ),
        ),
      );
    }
    return parVehicule;
  }, [options, projectVehicles]);

  const lignesTriees = useMemo(() => {
    const valeur = (pv: (typeof projectVehicles)[number]): string | number => {
      switch (tri.cle) {
        case "unit":
          return pv.vehicles.unit_number;
        case "vehicle":
          return [pv.vehicles.make, pv.vehicles.model, pv.vehicles.model_year].filter(Boolean).join(" ");
        case "category":
          return t(`fleet.categories.${pv.vehicles.category}`);
        case "km":
          return pv.vehicles.annual_km ?? -1;
        case "year":
          return pv.replacement_year ?? Number.MAX_SAFE_INTEGER;
        case "target":
          return pv.target_technology ?? "";
      }
    };
    return [...projectVehicles].sort((a, b) => {
      const va = valeur(a);
      const vb = valeur(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "fr", { numeric: true });
      return tri.asc ? cmp : -cmp;
    });
  }, [projectVehicles, tri, t]);

  const stats = useMemo(() => {
    const zeroEmission = projectVehicles.filter(
      (pv) => pv.target_technology === "bev" || pv.target_technology === "fcev",
    ).length;
    const sansCible = projectVehicles.filter((pv) => !pv.target_technology).length;
    const sansAnnee = projectVehicles.filter((pv) => pv.replacement_year == null).length;
    return { total: projectVehicles.length, zeroEmission, sansCible, sansAnnee };
  }, [projectVehicles]);

  const trierPar = (cle: CleTri) => {
    setTri((prev) => (prev.cle === cle ? { cle, asc: !prev.asc } : { cle, asc: true }));
  };

  const iconeTri = (cle: CleTri) => {
    if (tri.cle !== cle) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
    return tri.asc ? (
      <ArrowUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-1" />
    );
  };

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

  const basculerLigne = (id: string) => {
    setLignesChoisies((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  };

  const toutesLignes = () => {
    setLignesChoisies((prev) =>
      prev.size === projectVehicles.length ? new Set() : new Set(projectVehicles.map((pv) => pv.id)),
    );
  };

  // Remplacements prévus cette année ou avant (en retard) : à étaler.
  const enRetard = projectVehicles.filter((pv) => pv.replacement_year != null && pv.replacement_year <= anneeCourante);
  const lisserRetards = async () => {
    const annees = lisserRattrapage(
      enRetard.map((pv) => ({ id: pv.id, anneeFinVie: anneeFinVie(pv.vehicles) ?? pv.replacement_year })),
      anneeCourante,
      rattrapageAns,
    );
    try {
      const n = await appliquerLot.mutateAsync(enRetard.map((pv) => ({ id: pv.id, replacement_year: annees.get(pv.id) ?? null })));
      toast({ title: t("journey.fleet.catchUp.done", { count: n, years: rattrapageAns }) });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const confirmerAjout = async () => {
    const choisis = disponibles.filter((v) => selection.has(v.id));
    // Véhicules déjà en fin de vie : rattrapage LISSÉ sur les années
    // suivantes (point 7 de l'audit), jamais tous dans l'année en cours.
    const annees = lisserRattrapage(
      choisis.map((v) => ({ id: v.id, anneeFinVie: anneeFinVie(v) })),
      anneeCourante,
      rattrapageAns,
    );
    const lignes: ProjectVehicleInsert[] = choisis.map((v) => ({
      project_id: projectId,
      vehicle_id: v.id,
      replacement_year: annees.get(v.id) ?? null,
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

  // Actions groupées sur les lignes cochées du tableau du projet
  const appliquerGroupe = async (
    patchPour: (pv: (typeof projectVehicles)[number]) => { replacement_year?: number | null; target_technology?: string | null } | null,
  ) => {
    const cibles = projectVehicles.filter((pv) => lignesChoisies.has(pv.id));
    try {
      // Une écriture atomique pour tout le groupe (point 6 de l'audit).
      const lot = cibles.flatMap((pv) => {
        const patch = patchPour(pv);
        return patch ? [{ id: pv.id, ...patch }] : [];
      });
      const appliques = await appliquerLot.mutateAsync(lot);
      toast({ title: t("journey.fleet.bulk.applied", { count: appliques }) });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const retirerGroupe = async () => {
    const ids = [...lignesChoisies];
    try {
      for (const id of ids) {
        await retirer.mutateAsync(id);
      }
      toast({ title: t("journey.fleet.bulk.removed", { count: ids.length }) });
      setLignesChoisies(new Set());
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const retirerLigne = async (id: string) => {
    try {
      await retirer.mutateAsync(id);
      toast({ title: t("journey.fleet.toast.removed") });
      setLignesChoisies((prev) => {
        const suivant = new Set(prev);
        suivant.delete(id);
        return suivant;
      });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const sourceBadge = (source: string) => {
    const cle = source === "telematique" || source === "saisie" || source === "import" ? source : "estimation";
    return <StatusBadge ton={TON_SOURCE[cle]}>{t(`fleet.source.${cle}`)}</StatusBadge>;
  };

  if (orgLoading || isLoading || fleetLoading) {
    return (
      <Card>
        <LoadingState nombre={6} />
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

  const entetesTriables: Array<{ cle: CleTri; label: string; alignRight?: boolean }> = [
    { cle: "unit", label: t("fleet.columns.unit") },
    { cle: "vehicle", label: t("fleet.columns.vehicle") },
    { cle: "category", label: t("fleet.columns.category") },
    { cle: "km", label: t("fleet.columns.annualKm"), alignRight: true },
  ];

  return (
    <div className="space-y-4">
      <StatGrid>
        {(
          [
            ["included", stats.total],
            ["zeroEmissionTarget", stats.zeroEmission],
            ["noTarget", stats.sansCible],
            ["noYear", stats.sansAnnee],
          ] as const
        ).map(([cle, valeur]) => (
          <StatCard key={cle} libelle={t(`journey.fleet.stats.${cle}`)} valeur={valeur} />
        ))}
      </StatGrid>

      {enRetard.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between" data-testid="catch-up-banner">
          <p className="min-w-0">{t("journey.fleet.catchUp.banner", { count: enRetard.length, year: anneeCourante })}</p>
          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="rattrapage-ans" className="whitespace-nowrap">{t("journey.fleet.catchUp.over")}</label>
            <select
              id="rattrapage-ans"
              className={selectCls}
              value={rattrapageAns}
              onChange={(e) => setRattrapageAns(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {t("journey.fleet.catchUp.years", { count: n })}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={() => void lisserRetards()} disabled={appliquerLot.isPending} data-testid="catch-up-apply">
              {t("journey.fleet.catchUp.apply")}
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
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
            <>
              {lignesChoisies.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-3 text-sm">
                  <span className="font-medium">
                    {t("journey.fleet.bulk.selected", { count: lignesChoisies.size })}
                  </span>
                  <select
                    className={selectCls}
                    aria-label={t("journey.fleet.columns.replacementYear")}
                    value={anneeGroupee}
                    onChange={(e) => setAnneeGroupee(e.target.value)}
                  >
                    <option value="">{t("journey.fleet.bulk.chooseYear")}</option>
                    {anneesChoix.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!anneeGroupee || modifier.isPending}
                    onClick={() =>
                      void appliquerGroupe(() => ({ replacement_year: Number(anneeGroupee) }))
                    }
                  >
                    {t("journey.fleet.bulk.applyYear")}
                  </Button>
                  <select
                    className={selectCls}
                    aria-label={t("journey.fleet.columns.target")}
                    value={cibleGroupee}
                    onChange={(e) => setCibleGroupee(e.target.value)}
                  >
                    <option value="">{t("journey.fleet.bulk.chooseTarget")}</option>
                    {TECHNOLOGIES_CIBLES.map((tech) => (
                      <option key={tech} value={tech}>{t(`journey.fleet.targets.${tech}`)}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!cibleGroupee || modifier.isPending}
                    onClick={() =>
                      void appliquerGroupe(() => ({ target_technology: cibleGroupee }))
                    }
                  >
                    {t("journey.fleet.bulk.applyTarget")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!suggestions || modifier.isPending}
                    onClick={() =>
                      void appliquerGroupe((pv) => {
                        const s = suggestions?.get(pv.vehicle_id);
                        return s ? { target_technology: s } : null;
                      })
                    }
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    {t("journey.fleet.bulk.applySuggested")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={retirer.isPending}
                    onClick={() => void retirerGroupe()}
                  >
                    {t("journey.fleet.bulk.remove")}
                  </Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={lignesChoisies.size === projectVehicles.length && projectVehicles.length > 0}
                        onCheckedChange={toutesLignes}
                        aria-label={t("journey.fleet.bulk.selectAll")}
                      />
                    </TableHead>
                    {entetesTriables.map(({ cle, label, alignRight }) => (
                      <TableHead
                        key={cle}
                        className={`cursor-pointer select-none ${alignRight ? "text-right" : ""}`}
                        onClick={() => trierPar(cle)}
                      >
                        {label}
                        {iconeTri(cle)}
                      </TableHead>
                    ))}
                    <TableHead>{t("fleet.columns.source")}</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => trierPar("year")}>
                      {t("journey.fleet.columns.replacementYear")}
                      {iconeTri("year")}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => trierPar("target")}>
                      {t("journey.fleet.columns.target")}
                      {iconeTri("target")}
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignesTriees.map((pv) => {
                    const suggestion = suggestions?.get(pv.vehicle_id) ?? null;
                    return (
                      <TableRow key={pv.id}>
                        <TableCell>
                          <Checkbox
                            checked={lignesChoisies.has(pv.id)}
                            onCheckedChange={() => basculerLigne(pv.id)}
                            aria-label={pv.vehicles.unit_number}
                          />
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{pv.vehicles.unit_number}</TableCell>
                        <TableCell>
                          {[pv.vehicles.make, pv.vehicles.model, pv.vehicles.model_year]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </TableCell>
                        <TableCell>{t(`fleet.categories.${pv.vehicles.category}`)}</TableCell>
                        <TableCell className="text-right">
                          {pv.vehicles.annual_km != null
                            ? formateurNombre(i18n.language).format(pv.vehicles.annual_km)
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
                              <option key={tech} value={tech}>
                                {t(`journey.fleet.targets.${tech}`)}
                                {suggestion === tech ? ` ${t("journey.fleet.suggestedSuffix")}` : ""}
                              </option>
                            ))}
                          </select>
                          {!pv.target_technology && suggestion && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              {t("journey.fleet.suggestion", {
                                target: t(`journey.fleet.targets.${suggestion}`),
                              })}
                            </p>
                          )}
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
                    );
                  })}
                </TableBody>
              </Table>
            </>
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
                    <span className="font-medium w-20 shrink-0 whitespace-nowrap">{v.unit_number}</span>
                    <span className="flex-1 truncate">
                      {[v.make, v.model, v.model_year].filter(Boolean).join(" ") || "—"}
                    </span>
                    <span className="text-muted-foreground">{t(`fleet.categories.${v.category}`)}</span>
                    <StatusBadge ton={ton(TON_VEHICULE, v.status)}>
                      {t(`fleet.statuses.${v.status}`)}
                    </StatusBadge>
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
