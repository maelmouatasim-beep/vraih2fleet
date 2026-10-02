/**
 * Phase 5.1 — Optimiseur de calendrier : formulaire des contraintes et
 * détail de la stratégie « Optimisée » (décisions expliquées, contraintes
 * non respectées et ce qui bloque, indicateurs par année). Tous les
 * chiffres viennent de src/lib/journey/optimizer.ts (moteur TCO).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TECHNOS_PAR_DEFAUT,
  type ContraintesOptimiseur,
  type ResultatOptimisation,
} from "@/lib/journey/optimizer";
import { texteRaison, texteViolation } from "./optimizerTexts";
import type { TechnoAlternative } from "@/lib/journey/strategies";
import { PROGRAMMES } from "@/lib/tco/subsidy-programs";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";

const TECHNOS: TechnoAlternative[] = ["diesel", "BEV", "FCEV"];

// ---------------------------------------------------------------------------
// Formulaire des contraintes
// ---------------------------------------------------------------------------

export interface GarageOptimiseur {
  cle: string;
  nom: string | null;
  placesConnues: number | null;
  kwDisponibles: number | null;
}

interface ConstraintsDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initiales: ContraintesOptimiseur;
  vehicules: { id: string; unite: string; category: string }[];
  garages: GarageOptimiseur[];
  categories: string[];
  onSubmit: (c: ContraintesOptimiseur) => void;
}

const nombreOuNull = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return s.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n;
};

export function OptimizerConstraintsDialog({
  open,
  onOpenChange,
  initiales,
  vehicules,
  garages,
  categories,
  onSubmit,
}: ConstraintsDialogProps) {
  const { t } = useTranslation();
  const [c, setC] = useState<ContraintesOptimiseur>(initiales);
  const [ouvertPour, setOuvertPour] = useState<ContraintesOptimiseur | null>(null);
  // Réinitialise le formulaire à chaque ouverture.
  if (open && ouvertPour !== initiales) {
    setOuvertPour(initiales);
    setC(initiales);
  }
  const programmes = useMemo(
    () => PROGRAMMES.filter((p) => p.cible === "vehicule" && p.statut === "actif"),
    [],
  );
  const maj = (patch: Partial<ContraintesOptimiseur>) => setC((x) => ({ ...x, ...patch }));
  const technos = (cat: string) => c.technologiesParCategorie[cat] ?? TECHNOS_PAR_DEFAUT;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("journey.optimizer.form.title")}</DialogTitle>
          <DialogDescription>{t("journey.optimizer.form.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <section className="space-y-2">
            <p className="font-medium">{t("journey.optimizer.form.objective")}</p>
            <RadioGroup
              value={c.objectif}
              onValueChange={(v) => maj({ objectif: v as ContraintesOptimiseur["objectif"] })}
              className="flex flex-wrap gap-4"
            >
              {(["economies", "co2"] as const).map((o) => (
                <label key={o} className="flex items-center gap-2">
                  <RadioGroupItem value={o} id={`obj-${o}`} />
                  {t(`journey.optimizer.objectives.${o}`)}
                </label>
              ))}
            </RadioGroup>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="opt-budget-inv">{t("journey.optimizer.form.budgetInvestment")}</Label>
              <Input
                id="opt-budget-inv"
                inputMode="decimal"
                value={c.budgetInvestissementAnnuel ?? ""}
                placeholder={t("journey.optimizer.form.none")}
                onChange={(e) => maj({ budgetInvestissementAnnuel: nombreOuNull(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="opt-budget-raf">{t("journey.optimizer.form.budgetRemaining")}</Label>
              <Input
                id="opt-budget-raf"
                inputMode="decimal"
                value={c.budgetResteAFinancerAnnuel ?? ""}
                placeholder={t("journey.optimizer.form.none")}
                onChange={(e) => maj({ budgetResteAFinancerAnnuel: nombreOuNull(e.target.value) })}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("journey.optimizer.form.budgetHelp")}</p>
          </section>

          {(["ciblesZe", "ciblesGes"] as const).map((cle) => (
            <section key={cle} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">{t(`journey.optimizer.form.${cle}`)}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    cle === "ciblesZe"
                      ? maj({ ciblesZe: [...c.ciblesZe, { annee: 2030, part: 0.5 }] })
                      : maj({ ciblesGes: [...c.ciblesGes, { annee: 2030, reduction: 0.3 }] })
                  }
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t("journey.optimizer.form.addTarget")}
                </Button>
              </div>
              {(cle === "ciblesZe" ? c.ciblesZe : c.ciblesGes).map((cible, i) => {
                const valeur = "part" in cible ? cible.part : cible.reduction;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Label className="sr-only" htmlFor={`${cle}-annee-${i}`}>
                      {t("journey.optimizer.form.year")}
                    </Label>
                    <Input
                      id={`${cle}-annee-${i}`}
                      className="w-24"
                      inputMode="numeric"
                      value={cible.annee}
                      onChange={(e) => {
                        const annee = Number(e.target.value) || cible.annee;
                        if (cle === "ciblesZe") maj({ ciblesZe: c.ciblesZe.map((x, j) => (j === i ? { ...x, annee } : x)) });
                        else maj({ ciblesGes: c.ciblesGes.map((x, j) => (j === i ? { ...x, annee } : x)) });
                      }}
                    />
                    <Input
                      aria-label={t(`journey.optimizer.form.${cle}Pct`)}
                      className="w-24"
                      inputMode="decimal"
                      value={Math.round(valeur * 100)}
                      onChange={(e) => {
                        const v = Math.min(Math.max((nombreOuNull(e.target.value) ?? 0) / 100, 0), 1);
                        if (cle === "ciblesZe") maj({ ciblesZe: c.ciblesZe.map((x, j) => (j === i ? { ...x, part: v } : x)) });
                        else maj({ ciblesGes: c.ciblesGes.map((x, j) => (j === i ? { ...x, reduction: v } : x)) });
                      }}
                    />
                    <span className="text-muted-foreground">{t(`journey.optimizer.form.${cle}Pct`)}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("common.delete")}
                      onClick={() =>
                        cle === "ciblesZe"
                          ? maj({ ciblesZe: c.ciblesZe.filter((_, j) => j !== i) })
                          : maj({ ciblesGes: c.ciblesGes.filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </section>
          ))}

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="opt-report">{t("journey.optimizer.form.maxDelay")}</Label>
              <Input
                id="opt-report"
                inputMode="numeric"
                value={c.reportMaxAns}
                onChange={(e) => maj({ reportMaxAns: Math.min(Math.max(Math.round(nombreOuNull(e.target.value) ?? 0), 0), 10) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="opt-avance">{t("journey.optimizer.form.maxAdvance")}</Label>
              <Input
                id="opt-avance"
                inputMode="numeric"
                value={c.avanceMaxAns}
                onChange={(e) => maj({ avanceMaxAns: Math.min(Math.max(Math.round(nombreOuNull(e.target.value) ?? 0), 0), 10) })}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("journey.optimizer.form.advanceHelp")}</p>
          </section>

          <section className="space-y-2">
            <p className="font-medium">{t("journey.optimizer.form.technologies")}</p>
            <div className="rounded-md border border-border divide-y divide-border">
              {categories.map((cat) => (
                <div key={cat} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>{t(`fleet.categories.${cat}`, { defaultValue: cat })}</span>
                  <div className="flex gap-4">
                    {TECHNOS.map((tech) => (
                      <label key={tech} className="flex items-center gap-1.5">
                        <Checkbox
                          checked={technos(cat).includes(tech)}
                          onCheckedChange={(v) => {
                            const actuelles = technos(cat);
                            const suivantes = v ? [...actuelles, tech] : actuelles.filter((x) => x !== tech);
                            maj({ technologiesParCategorie: { ...c.technologiesParCategorie, [cat]: TECHNOS.filter((x) => suivantes.includes(x)) } });
                          }}
                        />
                        {t(`journey.optimizer.technos.${tech}`)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="font-medium">{t("journey.optimizer.form.garages")}</p>
            <p className="text-xs text-muted-foreground">{t("journey.optimizer.form.garagesHelp")}</p>
            <div className="rounded-md border border-border divide-y divide-border">
              {garages.map((g) => {
                const cg = c.garages[g.cle] ?? {};
                const majG = (patch: Partial<NonNullable<ContraintesOptimiseur["garages"][string]>>) =>
                  maj({ garages: { ...c.garages, [g.cle]: { ...cg, ...patch } } });
                return (
                  <div key={g.cle} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_7rem_7rem]">
                    <div>
                      <p className="font-medium">{g.nom ?? t("journey.infra.noDepot")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("journey.optimizer.form.garageKnown", {
                          places: g.placesConnues ?? "—",
                          kw: g.kwDisponibles ?? "—",
                        })}
                      </p>
                    </div>
                    <Input
                      aria-label={t("journey.optimizer.form.capacityKw")}
                      placeholder={t("journey.optimizer.form.capacityKw")}
                      inputMode="decimal"
                      value={cg.capaciteKw ?? ""}
                      onChange={(e) => majG({ capaciteKw: nombreOuNull(e.target.value) })}
                    />
                    <Input
                      aria-label={t("journey.optimizer.form.places")}
                      placeholder={t("journey.optimizer.form.places")}
                      inputMode="numeric"
                      value={cg.places ?? ""}
                      onChange={(e) => {
                        const n = nombreOuNull(e.target.value);
                        majG({ places: n == null ? null : Math.round(n) });
                      }}
                    />
                    <div className="sm:col-span-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{t("journey.optimizer.form.upgrade")}</span>
                      <Input
                        aria-label={t("journey.optimizer.form.upgradeYear")}
                        placeholder={t("journey.optimizer.form.upgradeYear")}
                        className="h-8 w-24"
                        inputMode="numeric"
                        value={cg.augmentation?.annee ?? ""}
                        onChange={(e) => {
                          const annee = nombreOuNull(e.target.value);
                          majG({ augmentation: annee == null ? null : { ...cg.augmentation, annee: Math.round(annee) } });
                        }}
                      />
                      <Input
                        aria-label={t("journey.optimizer.form.capacityKw")}
                        placeholder={t("journey.optimizer.form.capacityKw")}
                        className="h-8 w-24"
                        inputMode="decimal"
                        disabled={!cg.augmentation}
                        value={cg.augmentation?.capaciteKw ?? ""}
                        onChange={(e) =>
                          cg.augmentation && majG({ augmentation: { ...cg.augmentation, capaciteKw: nombreOuNull(e.target.value) } })
                        }
                      />
                      <Input
                        aria-label={t("journey.optimizer.form.places")}
                        placeholder={t("journey.optimizer.form.places")}
                        className="h-8 w-24"
                        inputMode="numeric"
                        disabled={!cg.augmentation}
                        value={cg.augmentation?.places ?? ""}
                        onChange={(e) => {
                          const n = nombreOuNull(e.target.value);
                          if (cg.augmentation) majG({ augmentation: { ...cg.augmentation, places: n == null ? null : Math.round(n) } });
                        }}
                      />
                      {g.placesConnues != null && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => majG({ places: g.placesConnues })}>
                          {t("journey.optimizer.form.useGaragePlaces")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <p className="font-medium">{t("journey.optimizer.form.deadlines")}</p>
            <p className="text-xs text-muted-foreground">{t("journey.optimizer.form.deadlinesHelp")}</p>
            {programmes.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 flex-1">{p.nom}</span>
                <Input
                  type="date"
                  className="w-44"
                  aria-label={t("journey.optimizer.form.deadlineFor", { programme: p.nom })}
                  value={c.echeancesSubventions[p.id] ?? ""}
                  onChange={(e) => {
                    const suivantes = { ...c.echeancesSubventions };
                    if (e.target.value) suivantes[p.id] = e.target.value;
                    else delete suivantes[p.id];
                    maj({ echeancesSubventions: suivantes });
                  }}
                />
                {p.dateFin && (
                  <span className="text-xs text-muted-foreground w-full sm:w-auto">
                    {t("journey.optimizer.form.registryDeadline", { date: p.dateFin })}
                  </span>
                )}
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <p className="font-medium">{t("journey.optimizer.form.kept")}</p>
            <p className="text-xs text-muted-foreground">{t("journey.optimizer.form.keptHelp")}</p>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 grid gap-1 sm:grid-cols-3">
              {vehicules.map((v) => (
                <label key={v.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={c.vehiculesGardes.includes(v.id)}
                    onCheckedChange={(coche) =>
                      maj({
                        vehiculesGardes: coche
                          ? [...c.vehiculesGardes, v.id]
                          : c.vehiculesGardes.filter((x) => x !== v.id),
                      })
                    }
                  />
                  {v.unite}
                </label>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => onSubmit(c)}>{t("journey.optimizer.form.run")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Détail de la stratégie optimisée
// ---------------------------------------------------------------------------

interface DetailProps {
  resultat: ResultatOptimisation;
  argent: Intl.NumberFormat;
  uniteDe: (id: string) => string;
}

export function OptimizedStrategyDetail({ resultat, argent, uniteDe }: DetailProps) {
  const { t } = useTranslation();
  const [tout, setTout] = useState(false);
  const decisions = useMemo(() => {
    // Les décisions qui changent le plan d'abord, puis par unité.
    const change = (d: ResultatOptimisation["decisions"][number]) => d.annee !== d.anneePrevue || d.techno !== d.technoPrevue;
    return [...resultat.decisions].sort(
      (a, b) => Number(change(b)) - Number(change(a)) || (a.unite ?? "").localeCompare(b.unite ?? "", "fr"),
    );
  }, [resultat.decisions]);
  const visibles = tout ? decisions : decisions.slice(0, 12);
  const cibles = [...resultat.contraintes.ciblesZe.map((c) => c.annee), ...resultat.contraintes.ciblesGes.map((c) => c.annee)];

  return (
    <Card data-testid="optimizer-detail">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {resultat.realisable ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          )}
          {resultat.realisable ? t("journey.optimizer.feasible") : t("journey.optimizer.infeasible")}
        </CardTitle>
        <CardDescription>{t(`journey.optimizer.objectiveNote.${resultat.contraintes.objectif}`)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {!resultat.realisable && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2" data-testid="optimizer-violations">
            <p className="font-medium">{t("journey.optimizer.blocking")}</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {resultat.violations.slice(0, 10).map((v, i) => (
                <li key={i}>{texteViolation(t, v, argent, uniteDe)}</li>
              ))}
            </ul>
            {resultat.leviers.length > 0 && (
              <>
                <p className="font-medium pt-1">{t("journey.optimizer.levers")}</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {resultat.leviers.map((l) => (
                    <li key={l.famille}>
                      {l.suffit
                        ? t("journey.optimizer.leverEnough", {
                            family: t(`journey.optimizer.families.${l.famille}`),
                            amount: argent.format(l.van ?? 0),
                          })
                        : t("journey.optimizer.leverNotEnough", {
                            family: t(`journey.optimizer.families.${l.famille}`),
                            count: l.violationsRestantes,
                          })}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {resultat.indicateurs.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("journey.optimizer.table.year")}</TableHead>
                  <TableHead className="text-right">{t("journey.optimizer.table.investment")}</TableHead>
                  <TableHead className="text-right">{t("journey.optimizer.table.remaining")}</TableHead>
                  <TableHead className="text-right">{t("journey.optimizer.table.zeShare")}</TableHead>
                  <TableHead className="text-right">{t("journey.optimizer.table.ghg")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultat.indicateurs.map((l) => (
                  <TableRow key={l.annee} className={cibles.includes(l.annee) ? "bg-primary/5 font-medium" : undefined}>
                    <TableCell>{l.annee}</TableCell>
                    <TableCell className="text-right">{argent.format(l.investissement)}</TableCell>
                    <TableCell className="text-right">{argent.format(l.resteAFinancer)}</TableCell>
                    <TableCell className="text-right">{Math.round(l.partZe * 100)} %</TableCell>
                    <TableCell className="text-right">{Math.round(l.reductionGes * 100)} %</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-medium">{t("journey.optimizer.decisionsTitle")}</p>
          <div className="overflow-x-auto">
            <Table data-testid="optimizer-decisions">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("journey.optimizer.table.unit")}</TableHead>
                  <TableHead>{t("journey.optimizer.table.garage")}</TableHead>
                  <TableHead>{t("journey.optimizer.table.planned")}</TableHead>
                  <TableHead>{t("journey.optimizer.table.optimized")}</TableHead>
                  <TableHead>{t("journey.optimizer.table.why")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((d) => {
                  const change = d.annee !== d.anneePrevue || d.techno !== d.technoPrevue;
                  return (
                    <TableRow key={d.vehiculeId}>
                      <TableCell className="font-medium">{d.unite ?? "?"}</TableCell>
                      <TableCell>{d.garage ?? t("journey.infra.noDepot")}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {d.anneePrevue} · {t(`journey.optimizer.technos.${d.technoPrevue}`)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={change ? "font-semibold text-foreground" : undefined}>
                          {d.annee} · {t(`journey.optimizer.technos.${d.techno}`)}
                        </span>
                        {change && <Badge variant="secondary" className="ml-2">{t("journey.optimizer.changed")}</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground min-w-[16rem]">
                        {d.raisons.map((r) => texteRaison(t, r, argent)).join(" ")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {decisions.length > 12 && (
            <Button variant="ghost" size="sm" onClick={() => setTout((x) => !x)}>
              {tout ? t("journey.optimizer.showLess") : t("journey.optimizer.showAll", { count: decisions.length })}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{t("journey.optimizer.methodNote")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
