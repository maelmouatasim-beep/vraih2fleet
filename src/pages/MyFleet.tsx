import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useVehicles } from "@/hooks/useVehicles";
import {
  CARBURANTS,
  CATEGORIES_VEHICULE,
  STATUTS_VEHICULE,
  countVehicleProjectLinks,
  type VehicleInsert,
  type VehicleRow,
} from "@/lib/fleet/vehicles";
import { lireFichier, validerLignes, type ResultatImport } from "@/lib/fleet/importVehicles";
import { estVehiculeDemo } from "@/lib/demoData/villeDemo";
import { Loader2, Pencil, Plus, Trash2, Truck, Upload } from "lucide-react";
import GaragesCard from "@/components/fleet/GaragesCard";
import { useGarages } from "@/hooks/useGarages";
import { assurerGarages } from "@/lib/fleet/garages";
import { CLASSES_PNBV, proposerClasse } from "@/lib/fleet/gvwr";

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const FORME_VIDE = {
  unit_number: "",
  make: "",
  model: "",
  model_year: "",
  category: "camionnette",
  fuel_type: "diesel",
  annual_km: "",
  consumption_per_100km: "",
  depot: "",
  gvwr_class: "",
  max_daily_km: "",
  status: "actif",
};

export default function MyFleet() {
  const { t } = useTranslation();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { vehicles, isLoading, creer, importer, modifier, supprimer } = useVehicles(organization?.id);
  const { garages } = useGarages(organization?.id);

  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [edition, setEdition] = useState<VehicleRow | null>(null);
  const [suppression, setSuppression] = useState<{ vehicule: VehicleRow; projets: number | null } | null>(null);
  const [importOuvert, setImportOuvert] = useState(false);
  const [apercu, setApercu] = useState<ResultatImport | null>(null);
  const [nomFichier, setNomFichier] = useState<string>("");
  const fichierRef = useRef<HTMLInputElement>(null);

  const [forme, setForme] = useState({ ...FORME_VIDE });

  const stats = useMemo(() => {
    const actifs = vehicles.filter((v) => v.status === "actif").length;
    const zeroEmission = vehicles.filter((v) => v.fuel_type === "bev" || v.fuel_type === "fcev").length;
    const estimations = vehicles.filter((v) => v.consumption_source === "estimation").length;
    return { total: vehicles.length, actifs, zeroEmission, estimations };
  }, [vehicles]);

  const dialogueFormulaireOuvert = ajoutOuvert || edition !== null;
  const proposition = proposerClasse({ category: forme.category, model: forme.model });

  const ouvrirEdition = (v: VehicleRow) => {
    setForme({
      unit_number: v.unit_number,
      make: v.make ?? "",
      model: v.model ?? "",
      model_year: v.model_year != null ? String(v.model_year) : "",
      category: v.category,
      fuel_type: v.fuel_type,
      annual_km: v.annual_km != null ? String(v.annual_km) : "",
      consumption_per_100km: v.consumption_per_100km != null ? String(v.consumption_per_100km) : "",
      depot: v.depot ?? "",
      gvwr_class: v.gvwr_class ?? "",
      max_daily_km: v.max_daily_km != null ? String(v.max_daily_km) : "",
      status: v.status,
    });
    setEdition(v);
  };

  const fermerFormulaire = () => {
    setAjoutOuvert(false);
    setEdition(null);
    setForme({ ...FORME_VIDE });
  };

  const enregistrer = async () => {
    if (!organization) return;
    const conso = forme.consumption_per_100km ? Number(forme.consumption_per_100km.replace(",", ".")) : null;
    const commun = {
      unit_number: forme.unit_number.trim(),
      make: forme.make.trim() || null,
      model: forme.model.trim() || null,
      model_year: forme.model_year ? Number(forme.model_year) : null,
      category: forme.category,
      fuel_type: forme.fuel_type,
      annual_km: forme.annual_km ? Number(forme.annual_km.replace(/\s/g, "")) : null,
      consumption_per_100km: conso,
      consumption_source: conso != null ? "saisie" : "estimation",
      depot: forme.depot.trim() || null,
      gvwr_class: forme.gvwr_class || null,
      max_daily_km: forme.max_daily_km ? Number(forme.max_daily_km.replace(/\s/g, "").replace(",", ".")) : null,
      status: forme.status,
    };
    try {
      if (commun.depot) await assurerGarages(organization.id, [commun.depot]);
      if (edition) {
        // la source « télématique » d'un véhicule existant n'est pas
        // écrasée si la consommation n'a pas changé
        const patch = { ...commun } as Partial<VehicleInsert>;
        if (conso === edition.consumption_per_100km) delete patch.consumption_source;
        await modifier.mutateAsync({ id: edition.id, patch });
        toast({ title: t("fleet.toast.updated") });
      } else {
        await creer.mutateAsync({ ...commun, organization_id: organization.id } as VehicleInsert);
        toast({ title: t("fleet.toast.added") });
      }
      fermerFormulaire();
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const ouvrirSuppression = async (v: VehicleRow) => {
    setSuppression({ vehicule: v, projets: null });
    try {
      const n = await countVehicleProjectLinks(v.id);
      setSuppression((s) => (s && s.vehicule.id === v.id ? { ...s, projets: n } : s));
    } catch {
      setSuppression((s) => (s && s.vehicule.id === v.id ? { ...s, projets: 0 } : s));
    }
  };

  const confirmerSuppression = async () => {
    if (!suppression) return;
    try {
      await supprimer.mutateAsync(suppression.vehicule.id);
      toast({ title: t("fleet.toast.deleted") });
      setSuppression(null);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const choisirFichier = async (file: File) => {
    if (!organization) return;
    setNomFichier(file.name);
    try {
      const lignes = await lireFichier(file);
      const existantes = new Map(vehicles.map((v) => [v.unit_number, v.id]));
      setApercu(validerLignes(lignes, organization.id, existantes));
    } catch (e) {
      toast({ title: t("fleet.import.readError"), description: e instanceof Error ? e.message : "", variant: "destructive" });
      setApercu(null);
    }
  };

  const confirmerImport = async () => {
    if (!apercu || (apercu.valides.length === 0 && apercu.misesAJour.length === 0)) return;
    try {
      // Colonne « garage » : les garages manquants sont créés AVANT les
      // véhicules, qui y sont rattachés par le trigger de synchronisation.
      if (organization) {
        await assurerGarages(organization.id, [
          ...apercu.valides.map((v) => v.depot),
          ...apercu.misesAJour.map((m) => m.patch.depot),
        ]);
      }
      const n = apercu.valides.length > 0 ? await importer.mutateAsync(apercu.valides) : 0;
      for (const m of apercu.misesAJour) {
        await modifier.mutateAsync({ id: m.id, patch: m.patch });
      }
      toast({ title: t("fleet.import.done", { count: n, updated: apercu.misesAJour.length }) });
      setImportOuvert(false);
      setApercu(null);
      setNomFichier("");
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const sourceBadge = (source: string) => {
    if (source === "telematique") return <Badge variant="default">{t("fleet.source.telematique")}</Badge>;
    if (source === "saisie") return <Badge variant="secondary">{t("fleet.source.saisie")}</Badge>;
    return <Badge variant="outline">{t("fleet.source.estimation")}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Truck className="w-6 h-6" /> {t("fleet.title")}
            </h1>
            <p className="text-muted-foreground">{t("fleet.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOuvert(true)}>
              <Upload className="w-4 h-4 mr-2" /> {t("fleet.import.button")}
            </Button>
            <Button onClick={() => setAjoutOuvert(true)}>
              <Plus className="w-4 h-4 mr-2" /> {t("fleet.add.button")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              ["total", stats.total],
              ["active", stats.actifs],
              ["zeroEmission", stats.zeroEmission],
              ["estimated", stats.estimations],
            ] as const
          ).map(([cle, valeur]) => (
            <Card key={cle}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  {t(`fleet.stats.${cle}`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{valeur}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {orgLoading || isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-16 px-6">
                <Truck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">{t("fleet.empty.title")}</p>
                <p className="text-sm text-muted-foreground">{t("fleet.empty.subtitle")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("fleet.columns.unit")}</TableHead>
                    <TableHead>{t("fleet.columns.vehicle")}</TableHead>
                    <TableHead>{t("fleet.columns.category")}</TableHead>
                    <TableHead>{t("fleet.columns.fuel")}</TableHead>
                    <TableHead className="text-right">{t("fleet.columns.annualKm")}</TableHead>
                    <TableHead className="text-right">{t("fleet.columns.consumption")}</TableHead>
                    <TableHead>{t("fleet.columns.source")}</TableHead>
                    <TableHead>{t("fleet.columns.depot")}</TableHead>
                    <TableHead>{t("fleet.columns.status")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">
                        {v.unit_number}
                        {estVehiculeDemo(v.notes) && (
                          <Badge variant="outline" className="ml-2">{t("fleet.demoBadge")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {[v.make, v.model, v.model_year].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell>{t(`fleet.categories.${v.category}`)}</TableCell>
                      <TableCell>{t(`fleet.fuels.${v.fuel_type}`)}</TableCell>
                      <TableCell className="text-right">
                        {v.annual_km != null ? v.annual_km.toLocaleString("fr-CA") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.consumption_per_100km != null ? v.consumption_per_100km : "—"}
                      </TableCell>
                      <TableCell>{sourceBadge(v.consumption_source)}</TableCell>
                      <TableCell>{v.depot ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={v.status === "actif" ? "default" : "outline"}>
                          {t(`fleet.statuses.${v.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => ouvrirEdition(v)} aria-label={t("common.edit")}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void ouvrirSuppression(v)}
                            aria-label={t("common.delete")}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <GaragesCard organizationId={organization?.id} depots={vehicles.map((v) => v.depot)} />
      </div>

      {/* Ajout / modification */}
      <Dialog open={dialogueFormulaireOuvert} onOpenChange={(o) => !o && fermerFormulaire()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{edition ? t("fleet.edit.title", { unit: edition.unit_number }) : t("fleet.add.title")}</DialogTitle>
            <DialogDescription>{edition ? t("fleet.edit.subtitle") : t("fleet.add.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fl-unit">{t("fleet.columns.unit")} *</Label>
              <Input id="fl-unit" value={forme.unit_number} onChange={(e) => setForme({ ...forme, unit_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-cat">{t("fleet.columns.category")} *</Label>
              <select id="fl-cat" className={selectCls} value={forme.category} onChange={(e) => setForme({ ...forme, category: e.target.value })}>
                {CATEGORIES_VEHICULE.map((c) => (
                  <option key={c} value={c}>{t(`fleet.categories.${c}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-make">{t("fleet.columns.make")}</Label>
              <Input id="fl-make" value={forme.make} onChange={(e) => setForme({ ...forme, make: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-model">{t("fleet.columns.model")}</Label>
              <Input id="fl-model" value={forme.model} onChange={(e) => setForme({ ...forme, model: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-year">{t("fleet.columns.year")}</Label>
              <Input id="fl-year" inputMode="numeric" value={forme.model_year} onChange={(e) => setForme({ ...forme, model_year: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-fuel">{t("fleet.columns.fuel")}</Label>
              <select id="fl-fuel" className={selectCls} value={forme.fuel_type} onChange={(e) => setForme({ ...forme, fuel_type: e.target.value })}>
                {CARBURANTS.map((f) => (
                  <option key={f} value={f}>{t(`fleet.fuels.${f}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-km">{t("fleet.columns.annualKm")}</Label>
              <Input id="fl-km" inputMode="numeric" value={forme.annual_km} onChange={(e) => setForme({ ...forme, annual_km: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-conso">{t("fleet.add.consumption")}</Label>
              <Input id="fl-conso" inputMode="decimal" placeholder={t("fleet.add.consumptionHint")} value={forme.consumption_per_100km} onChange={(e) => setForme({ ...forme, consumption_per_100km: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-depot">{t("fleet.columns.depot")}</Label>
              <Input
                id="fl-depot"
                list="fl-garages"
                value={forme.depot}
                onChange={(e) => setForme({ ...forme, depot: e.target.value })}
              />
              <datalist id="fl-garages">
                {garages.map((g) => (
                  <option key={g.id} value={g.name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-kmj">{t("fleet.add.maxDailyKm")}</Label>
              <Input id="fl-kmj" inputMode="numeric" value={forme.max_daily_km} onChange={(e) => setForme({ ...forme, max_daily_km: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-pnbv">{t("fleet.gvwr.label")}</Label>
              <select id="fl-pnbv" className={selectCls} value={forme.gvwr_class} onChange={(e) => setForme({ ...forme, gvwr_class: e.target.value })}>
                <option value="">{t("fleet.gvwr.unknown")}</option>
                {CLASSES_PNBV.map((c) => (
                  <option key={c} value={c}>{t("fleet.gvwr.option", { classe: c })}</option>
                ))}
              </select>
              {!forme.gvwr_class && proposition && (
                <p className="text-xs text-muted-foreground">
                  {t(`fleet.gvwr.proposal.${proposition.motif}`, { classe: proposition.classe })}{" "}
                  <button
                    type="button"
                    className="underline text-primary"
                    onClick={() => setForme({ ...forme, gvwr_class: proposition.classe })}
                  >
                    {t("fleet.gvwr.use")}
                  </button>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-statut">{t("fleet.columns.status")}</Label>
              <select id="fl-statut" className={selectCls} value={forme.status} onChange={(e) => setForme({ ...forme, status: e.target.value })}>
                {STATUTS_VEHICULE.map((s) => (
                  <option key={s} value={s}>{t(`fleet.statuses.${s}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={fermerFormulaire}>{t("common.cancel")}</Button>
            <Button
              onClick={enregistrer}
              disabled={creer.isPending || modifier.isPending || !forme.unit_number.trim()}
            >
              {creer.isPending || modifier.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {edition ? t("fleet.edit.confirm") : t("fleet.add.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression (effet sur les projets affiché) */}
      <Dialog open={suppression !== null} onOpenChange={(o) => !o && setSuppression(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("fleet.delete.title", { unit: suppression?.vehicule.unit_number ?? "" })}</DialogTitle>
            <DialogDescription>{t("fleet.delete.subtitle")}</DialogDescription>
          </DialogHeader>
          {suppression && (
            <div className="py-2 text-sm">
              {suppression.projets === null ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("fleet.delete.checking")}
                </p>
              ) : suppression.projets > 0 ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  {t("fleet.delete.projectImpact", { count: suppression.projets })}
                </p>
              ) : (
                <p className="text-muted-foreground">{t("fleet.delete.noProject")}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuppression(null)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={confirmerSuppression}
              disabled={supprimer.isPending || suppression?.projets === null}
            >
              {supprimer.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("fleet.delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV / Excel */}
      <Dialog
        open={importOuvert}
        onOpenChange={(o) => {
          setImportOuvert(o);
          if (!o) {
            setApercu(null);
            setNomFichier("");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("fleet.import.title")}</DialogTitle>
            <DialogDescription>{t("fleet.import.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <input
              ref={fichierRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void choisirFichier(f);
              }}
            />
            <Button variant="outline" className="w-full" onClick={() => fichierRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              {nomFichier || t("fleet.import.choose")}
            </Button>
            {apercu && (
              <div className="space-y-3">
                <p className="text-sm">
                  {t("fleet.import.preview", {
                    valid: apercu.valides.length,
                    updates: apercu.misesAJour.length,
                    errors: apercu.erreurs.length,
                  })}
                </p>
                {apercu.misesAJour.length > 0 && (
                  <div className="max-h-24 overflow-y-auto rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1">
                    <p className="font-medium">{t("fleet.import.updatesTitle")}</p>
                    <p className="text-muted-foreground">
                      {apercu.misesAJour.map((m) => m.unit_number).join(", ")}
                    </p>
                  </div>
                )}
                {apercu.erreurs.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1">
                    {apercu.erreurs.slice(0, 50).map((e, i) => (
                      <p key={i}>
                        {t("fleet.import.errorLine", { line: e.ligne, field: e.champ })} — {e.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOuvert(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={confirmerImport}
              disabled={
                !apercu ||
                (apercu.valides.length === 0 && apercu.misesAJour.length === 0) ||
                importer.isPending ||
                modifier.isPending
              }
            >
              {importer.isPending || modifier.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("fleet.import.confirm", {
                count: (apercu?.valides.length ?? 0) + (apercu?.misesAJour.length ?? 0),
              })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
