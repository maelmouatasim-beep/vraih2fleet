/**
 * Phase 5.3 — IMPORT INTELLIGENT de flotte : n'importe quel inventaire
 * (Excel, CSV, PDF, export d'un logiciel de gestion de flotte).
 * 1. Lecture déterministe du fichier (aucune IA).
 * 2. Correspondance colonnes → modèle : synonymes connus, puis (si la
 *    fonction est activée) proposition de Claude sur les entêtes et
 *    quelques exemples seulement ; chaque choix reste modifiable.
 * 3. Tableau de validation ligne par ligne (doublons, incohérences,
 *    valeurs incertaines laissées VIDES), corrections en ligne.
 * 4. Import après confirmation, aperçu avant → après des mises à jour,
 *    journalisé (qui, quand, quoi).
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useVehicles } from "@/hooks/useVehicles";
import { useGarages } from "@/hooks/useGarages";
import { assurerGarages } from "@/lib/fleet/garages";
import type { VehicleRow } from "@/lib/fleet/vehicles";
import {
  appliquerCorrespondance,
  CHAMPS_IMPORT,
  changementsImport,
  choisirChamp,
  choisirUnite,
  choisirValeur,
  colonnesPourIa,
  correspondanceInitiale,
  fusionnerPropositionIa,
  valeursAAssocier,
  VALEURS_CIBLES,
  type CibleColonne,
  type ChampAChoix,
  type ChampImport,
  type Correspondance,
  type LigneValidation,
  type Signalement,
  type TableauBrut,
  type Unite,
} from "@/lib/fleet/smartImport";
import { lireTableauBrut } from "@/lib/fleet/smartImportFile";
import { exportInventaireDemo, NOM_EXPORT_DEMO } from "@/lib/demoData/exportDemo";
import { appelerFonctionIa, ErreurIa, lireReglagesIa } from "@/lib/supabase/ai";
import { journaliser } from "@/lib/supabase/changeLog";
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, ShieldOff, Sparkles, Upload } from "lucide-react";

const selectCls =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring";

const UNITES_DISTANCE: Unite[] = ["km", "mi"];
const UNITES_CONSO: Unite[] = ["L/100km", "mpg_us", "mpg_imp", "km/L"];

type SortieImport =
  | {
      type: "correspondance";
      correspondance: Parameters<typeof fusionnerPropositionIa>[1];
      rejets: number;
    }
  | { type: "refus" }
  | { type: "invalide" };

type EtatIa = { etat: "inactif" } | { etat: "en_cours" } | { etat: "ok"; rejets: number } | { etat: "erreur"; code: string };

interface SmartImportDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  organizationId: string | null | undefined;
  vehicles: VehicleRow[];
  /** Flotte de démonstration présente : propose l'export fictif de la démo. */
  demo?: boolean;
}

export default function SmartImportDialog({ open, onOpenChange, organizationId, vehicles, demo }: SmartImportDialogProps) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language.startsWith("en") ? "en" : "fr";
  const queryClient = useQueryClient();
  const { importer, modifier } = useVehicles(organizationId);
  const { garages, rafraichir: rafraichirGarages } = useGarages(organizationId);
  const { data: reglages } = useQuery({
    queryKey: ["ai-settings", organizationId],
    queryFn: () => lireReglagesIa(organizationId!),
    enabled: !!organizationId && open,
  });
  const iaActive = reglages?.smart_import_enabled === true;

  const fichierRef = useRef<HTMLInputElement>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [lecture, setLecture] = useState(false);
  const [tableau, setTableau] = useState<TableauBrut | null>(null);
  const [correspondance, setCorrespondance] = useState<Correspondance | null>(null);
  const [surcharges, setSurcharges] = useState<Record<number, Partial<Record<ChampImport, string>>>>({});
  const [choixLignes, setChoixLignes] = useState<Record<number, boolean>>({});
  const [etatIa, setEtatIa] = useState<EtatIa>({ etat: "inactif" });
  const [aVerifierSeulement, setAVerifierSeulement] = useState(false);
  const [application, setApplication] = useState(false);

  const reinitialiser = () => {
    setNomFichier("");
    setTableau(null);
    setCorrespondance(null);
    setSurcharges({});
    setChoixLignes({});
    setEtatIa({ etat: "inactif" });
    setAVerifierSeulement(false);
  };

  const choisirFichier = async (f: File) => {
    reinitialiser();
    setNomFichier(f.name);
    setLecture(true);
    try {
      const tb = await lireTableauBrut(f);
      if (tb.entetes.length === 0 || tb.lignes.length === 0) throw new Error(t("smartImport.emptyFile"));
      setTableau(tb);
      setCorrespondance(correspondanceInitiale(tb));
    } catch (e) {
      toast({ title: t("fleet.import.readError"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLecture(false);
    }
  };

  const analyserIa = async () => {
    if (!tableau || !correspondance || !organizationId) return;
    setEtatIa({ etat: "en_cours" });
    try {
      const sortie = await appelerFonctionIa<SortieImport>("fleet-import", {
        organizationId,
        langue,
        colonnes: colonnesPourIa(tableau, correspondance).slice(0, 80),
      });
      if (sortie.type !== "correspondance") {
        setEtatIa({ etat: "erreur", code: sortie.type });
        return;
      }
      setCorrespondance((c) => (c ? fusionnerPropositionIa(c, sortie.correspondance) : c));
      setEtatIa({ etat: "ok", rejets: sortie.rejets });
    } catch (e) {
      setEtatIa({ etat: "erreur", code: e instanceof ErreurIa ? e.code : "erreur_service" });
    }
  };

  const resultat = useMemo(() => {
    if (!tableau || !correspondance || !organizationId) return null;
    return appliquerCorrespondance(tableau, correspondance, {
      organizationId,
      existants: vehicles.map((v) => ({ id: v.id, unit_number: v.unit_number, vin: v.vin })),
      // garages de la table ET dépôts déjà portés par les véhicules
      garagesExistants: [...garages.map((g) => g.name), ...vehicles.map((v) => v.depot ?? "").filter(Boolean)],
      anneeCourante: new Date().getFullYear(),
      surcharges,
      choixLignes,
    });
  }, [tableau, correspondance, organizationId, vehicles, garages, surcharges, choixLignes]);

  const changements = useMemo(
    () => (resultat ? changementsImport(resultat.import, vehicles as unknown as Parameters<typeof changementsImport>[1]) : []),
    [resultat, vehicles],
  );
  const changementsParUnite = useMemo(() => {
    const m = new Map<string, typeof changements>();
    for (const c of changements) m.set(c.cible, [...(m.get(c.cible) ?? []), c]);
    return m;
  }, [changements]);
  // Mises à jour sans aucun changement réel : rien à écrire.
  const misesAJourUtiles = resultat ? resultat.import.misesAJour.filter((m) => changementsParUnite.has(m.unit_number)) : [];
  const nbAImporter = (resultat?.import.valides.length ?? 0) + misesAJourUtiles.length;
  const libellesAAssocier = tableau && correspondance ? valeursAAssocier(tableau, correspondance) : [];

  const locale = langue === "en" ? "en-CA" : "fr-CA";
  /** Affichage seulement : nombre du fichier (converti) au format local. */
  const nombre = (v: string | number | null | undefined) => {
    if (v == null || v === "") return "—";
    const n = typeof v === "number" ? v : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
    return Number.isFinite(n) ? n.toLocaleString(locale, { maximumFractionDigits: 2 }) : String(v);
  };
  const libelleChamp = (c: string) => t(`smartImport.fields.${c}`, { defaultValue: c });
  const libelleValeur = (champ: ChampAChoix, v: string) => {
    if (champ === "category") return t(`fleet.categories.${v}`, { defaultValue: v });
    if (champ === "fuel_type") return t(`fleet.fuels.${v}`, { defaultValue: v });
    if (champ === "status") return t(`fleet.statuses.${v}`, { defaultValue: v });
    if (champ === "gvwr_class") return t("smartImport.gvwrValue", { value: v });
    return t(`smartImport.usage.${v}`, { defaultValue: v });
  };
  const texteSignalement = (s: Signalement) => {
    switch (s.code) {
      case "valeur_incertaine":
        return t("smartImport.flags.valeur_incertaine", { field: libelleChamp(s.champ), value: s.valeur });
      case "unite_convertie":
        return t("smartImport.flags.unite_convertie", { field: libelleChamp(s.champ), unit: t(`smartImport.units.${s.unite}`) });
      case "colonne_incertaine":
      case "colonne_personnelle":
        return t(`smartImport.flags.${s.code}`, { header: s.entete });
      case "doublon_probable":
      case "niv_double":
        return t(`smartImport.flags.${s.code}`, { other: s.avec });
      case "annee_future":
        return t("smartImport.flags.annee_future", { year: s.annee });
      case "mise_en_service_avant_modele":
        return t("smartImport.flags.mise_en_service_avant_modele", { year: s.annee, model: s.modele });
      case "km_incoherents":
        return t("smartImport.flags.km_incoherents", { annual: s.kmAn, daily: s.kmJourMax });
      case "conso_a_verifier":
        return t("smartImport.flags.conso_a_verifier", { value: s.conso, reference: s.reference });
      case "garage_nouveau":
        return t("smartImport.flags.garage_nouveau", { garage: s.garage });
    }
  };

  const surcharger = (ligne: number, champ: ChampImport, valeur: string) =>
    setSurcharges((s) => ({ ...s, [ligne]: { ...s[ligne], [champ]: valeur } }));

  const lignesAffichees = (resultat?.lignes ?? []).filter(
    (l) => !aVerifierSeulement || l.statut === "erreur" || l.signalements.length > 0,
  );

  const confirmer = async () => {
    if (!resultat || !organizationId || nbAImporter === 0) return;
    setApplication(true);
    try {
      const { valides } = resultat.import;
      await assurerGarages(organizationId, [...valides.map((v) => v.depot), ...misesAJourUtiles.map((m) => m.patch.depot)]);
      if (valides.length > 0) await importer.mutateAsync(valides);
      for (const m of misesAJourUtiles) await modifier.mutateAsync({ id: m.id, patch: m.patch });
      rafraichirGarages();
      await journaliser({
        organizationId,
        projectId: null,
        source: "import",
        action: etatIa.etat === "ok" ? "import:intelligent:ia" : "import:intelligent",
        resume: t("smartImport.journalSummary", { count: valides.length, updated: misesAJourUtiles.length }),
        changements,
      });
      await queryClient.invalidateQueries({ queryKey: ["change-log-fleet", organizationId] });
      toast({ title: t("fleet.import.done", { count: valides.length, updated: misesAJourUtiles.length }) });
      reinitialiser();
      onOpenChange(false);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setApplication(false);
    }
  };

  const badgeCertitude = (certitude: string, origine: string) => (
    <Badge variant={certitude === "sure" ? "secondary" : "outline"} className={certitude === "incertaine" ? "border-amber-400 text-amber-700 dark:text-amber-300" : ""}>
      {t(`smartImport.certainty.${certitude}`)} · {t(`smartImport.origin.${origine}`)}
    </Badge>
  );

  const badgeStatut = (l: LigneValidation) =>
    l.statut === "exclue" ? (
      <Badge variant="outline">{t("smartImport.status.exclue")}</Badge>
    ) : l.statut === "erreur" ? (
      <Badge variant="destructive">{t("smartImport.status.erreur")}</Badge>
    ) : l.statut === "mise_a_jour" ? (
      <Badge variant="secondary">{t(changementsParUnite.has(l.unite) ? "smartImport.status.mise_a_jour" : "smartImport.status.inchange")}</Badge>
    ) : (
      <Badge>{t("smartImport.status.nouveau")}</Badge>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (application) return;
        onOpenChange(o);
        if (!o) reinitialiser();
      }}
    >
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="smart-import">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-primary" />
            {t("smartImport.title")}
          </DialogTitle>
          <DialogDescription>{t("smartImport.subtitle")}</DialogDescription>
        </DialogHeader>

        <input
          ref={fichierRef}
          type="file"
          accept=".csv,.txt,.xlsx,.pdf"
          className="hidden"
          data-testid="smart-import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void choisirFichier(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" className="w-full" onClick={() => fichierRef.current?.click()} disabled={lecture || application}>
          {lecture ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {nomFichier || t("smartImport.choose")}
        </Button>
        {demo && !tableau && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            data-testid="smart-import-demo"
            disabled={lecture}
            onClick={() => void choisirFichier(new File([exportInventaireDemo()], NOM_EXPORT_DEMO, { type: "text/csv" }))}
          >
            {t("smartImport.demoExport")}
          </Button>
        )}

        {tableau && correspondance && resultat && (
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground" data-testid="smart-import-read">
              {t("smartImport.read", { rows: tableau.lignes.length, columns: tableau.entetes.length, format: tableau.source.toUpperCase() })}
              {tableau.lignesNonReconnues > 0 && ` ${t("smartImport.unreadLines", { count: tableau.lignesNonReconnues })}`}
            </p>

            {/* 1. Correspondance des colonnes */}
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t("smartImport.mappingTitle")}</h3>
                {iaActive ? (
                  <Button size="sm" onClick={() => void analyserIa()} disabled={etatIa.etat === "en_cours"} data-testid="smart-import-ai">
                    {etatIa.etat === "en_cours" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {t("smartImport.analyze")}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground" data-testid="smart-import-ai-off">
                    {t("smartImport.aiOff")}{" "}
                    <Link to="/dashboard/organization" className="underline">
                      {t("smartImport.aiOffLink")}
                    </Link>
                  </span>
                )}
              </div>
              {etatIa.etat === "ok" && (
                <p className="text-xs text-muted-foreground" data-testid="smart-import-ai-done">
                  {t("smartImport.aiDone")} {etatIa.rejets > 0 && t("smartImport.aiRejected", { count: etatIa.rejets })}
                </p>
              )}
              {etatIa.etat === "erreur" && (
                <p className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs" data-testid="smart-import-ai-error">
                  {t(`smartImport.errors.${etatIa.code}`, { defaultValue: t("smartImport.errors.erreur_service") })}
                </p>
              )}
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-xs" data-testid="smart-import-mapping">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">{t("smartImport.columns.header")}</th>
                      <th className="text-left p-2">{t("smartImport.columns.examples")}</th>
                      <th className="text-left p-2 w-48">{t("smartImport.columns.field")}</th>
                      <th className="text-left p-2 w-32">{t("smartImport.columns.unit")}</th>
                      <th className="text-left p-2">{t("smartImport.columns.certainty")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {correspondance.colonnes.map((col) => {
                      const exemples = [...new Set(tableau.lignes.map((l) => l[col.index]).filter(Boolean))].slice(0, 2);
                      const unites = col.champ === "consumption_per_100km" ? UNITES_CONSO : col.champ === "annual_km" || col.champ === "max_daily_km" ? UNITES_DISTANCE : null;
                      return (
                        <tr key={col.index} data-testid={`mapping-${col.index}`}>
                          <td className="p-2 font-medium">{col.entete}</td>
                          <td className="p-2 text-muted-foreground">{col.personnelle ? t("smartImport.hidden") : exemples.join(" · ")}</td>
                          <td className="p-2">
                            {col.personnelle ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <ShieldOff className="w-3 h-3" /> {t("smartImport.personal")}
                              </span>
                            ) : (
                              <select
                                className={selectCls}
                                aria-label={t("smartImport.columns.field")}
                                value={col.champ}
                                onChange={(e) => setCorrespondance((c) => (c ? choisirChamp(c, col.index, e.target.value as CibleColonne) : c))}
                              >
                                <option value="ignorer">{t("smartImport.ignore")}</option>
                                {CHAMPS_IMPORT.map((ch) => (
                                  <option key={ch} value={ch}>
                                    {libelleChamp(ch)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-2">
                            {unites && (
                              <select
                                className={selectCls}
                                aria-label={t("smartImport.columns.unit")}
                                value={col.unite ?? ""}
                                onChange={(e) => setCorrespondance((c) => (c ? choisirUnite(c, col.index, (e.target.value || undefined) as Unite | undefined) : c))}
                              >
                                <option value="">{t("smartImport.unitDefault")}</option>
                                {unites.map((u) => (
                                  <option key={u} value={u}>
                                    {t(`smartImport.units.${u}`)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-2">{col.personnelle ? null : badgeCertitude(col.champ === "ignorer" && col.certitude !== "incertaine" ? "sure" : col.certitude, col.origine)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 2. Libellés à associer (catégories, carburants, classes, statuts) */}
            {libellesAAssocier.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">{t("smartImport.valuesTitle")}</h3>
                <p className="text-xs text-muted-foreground">{t("smartImport.valuesHint")}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="smart-import-values">
                  {libellesAAssocier.map((v) => (
                    <label key={`${v.champ}:${v.source}`} className="flex flex-col gap-1.5 rounded-md border border-border p-2 text-xs">
                      <span className="flex items-start justify-between gap-2">
                        <span>
                          <span className="text-muted-foreground">{libelleChamp(v.champ)} · </span>
                          <span className="font-medium">« {v.source} »</span>
                        </span>
                        {v.cible ? badgeCertitude(v.certitude, v.origine) : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                      </span>
                      <select
                        className={selectCls}
                        value={v.cible}
                        onChange={(e) => setCorrespondance((c) => (c ? choisirValeur(c, v.champ, v.source, e.target.value) : c))}
                      >
                        <option value="">{t("smartImport.leaveEmpty")}</option>
                        {VALEURS_CIBLES[v.champ].map((x) => (
                          <option key={x} value={x}>
                            {libelleValeur(v.champ, x)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Validation ligne par ligne */}
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t("smartImport.validationTitle")}</h3>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={aVerifierSeulement} onChange={(e) => setAVerifierSeulement(e.target.checked)} />
                  {t("smartImport.onlyToCheck")}
                </label>
              </div>
              <p className="text-sm" data-testid="smart-import-summary">
                {t("smartImport.summary", {
                  created: resultat.import.valides.length,
                  updated: misesAJourUtiles.length,
                  errors: resultat.lignes.filter((l) => l.statut === "erreur").length,
                  flagged: resultat.lignes.filter((l) => l.signalements.length > 0).length,
                  excluded: resultat.lignes.filter((l) => l.statut === "exclue").length,
                })}
              </p>
              {resultat.signalementsGlobaux.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc pl-4" data-testid="smart-import-global-flags">
                  {resultat.signalementsGlobaux.map((s, i) => (
                    <li key={i}>{texteSignalement(s)}</li>
                  ))}
                  {resultat.garagesNouveaux.length > 0 && <li>{t("smartImport.newGarages", { garages: resultat.garagesNouveaux.join(", ") })}</li>}
                </ul>
              )}
              <div className="overflow-x-auto rounded-md border border-border max-h-[45vh] overflow-y-auto">
                <table className="w-full text-xs" data-testid="smart-import-rows">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left p-2">{t("smartImport.columns.include")}</th>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">{t("smartImport.fields.unit_number")}</th>
                      <th className="text-left p-2">{t("smartImport.columns.status")}</th>
                      <th className="text-left p-2 w-40">{t("smartImport.fields.category")}</th>
                      <th className="text-left p-2 w-36">{t("smartImport.fields.fuel_type")}</th>
                      <th className="text-right p-2">{t("smartImport.fields.annual_km")}</th>
                      <th className="text-right p-2">{t("smartImport.fields.consumption_per_100km")}</th>
                      <th className="text-left p-2">{t("smartImport.fields.depot")}</th>
                      <th className="text-left p-2">{t("smartImport.columns.notes")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lignesAffichees.map((l) => {
                      const enErreur = l.statut === "erreur";
                      const diffs = l.statut === "mise_a_jour" ? changementsParUnite.get(l.unite) ?? [] : [];
                      const cellChoix = (champ: "category" | "fuel_type") =>
                        enErreur || !l.valeurs[champ] ? (
                          <select
                            className={selectCls}
                            aria-label={`${libelleChamp(champ)} ${l.unite}`}
                            data-testid={`fix-${champ}-${l.ligne}`}
                            value={surcharges[l.ligne]?.[champ] ?? l.valeurs[champ] ?? ""}
                            onChange={(e) => surcharger(l.ligne, champ, e.target.value)}
                          >
                            <option value="">—</option>
                            {VALEURS_CIBLES[champ].map((x) => (
                              <option key={x} value={x}>
                                {libelleValeur(champ, x)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          libelleValeur(champ, l.valeurs[champ]!)
                        );
                      return (
                        <tr key={l.ligne} data-testid={`row-${l.ligne}`} className={l.statut === "exclue" ? "opacity-60" : enErreur ? "bg-destructive/5" : l.signalements.length > 0 ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                          <td className="p-2">
                            <input
                              type="checkbox"
                              aria-label={t("smartImport.includeRow", { line: l.ligne })}
                              data-testid={`include-${l.ligne}`}
                              checked={l.statut !== "exclue"}
                              onChange={(e) => setChoixLignes((c) => ({ ...c, [l.ligne]: e.target.checked }))}
                            />
                          </td>
                          <td className="p-2 text-muted-foreground">{l.ligne}</td>
                          <td className="p-2 font-medium whitespace-nowrap">{l.unite || "—"}</td>
                          <td className="p-2 whitespace-nowrap">{badgeStatut(l)}</td>
                          <td className="p-2">{cellChoix("category")}</td>
                          <td className="p-2">{cellChoix("fuel_type")}</td>
                          <td className="p-2 text-right whitespace-nowrap">{nombre(l.valeurs.annual_km)}</td>
                          <td className="p-2 text-right whitespace-nowrap">{nombre(l.valeurs.consumption_per_100km)}</td>
                          <td className="p-2">{l.valeurs.depot ?? "—"}</td>
                          <td className="p-2 space-y-0.5">
                            {l.erreurs.map((e, i) => (
                              <p key={`e${i}`} className="text-destructive">
                                {e.message}
                              </p>
                            ))}
                            {l.signalements.map((s, i) => (
                              <p key={`s${i}`} className="text-amber-700 dark:text-amber-300">
                                {texteSignalement(s)}
                              </p>
                            ))}
                            {diffs.map((c, i) => (
                              <p key={`d${i}`} className="text-muted-foreground" data-testid="smart-import-diff">
                                {libelleChamp(c.champ)} : {nombre(c.avant)} → <span className="text-foreground font-medium">{nombre(c.apres)}</span>
                              </p>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("smartImport.privacy")}</p>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={application}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void confirmer()} disabled={!resultat || nbAImporter === 0 || application} data-testid="smart-import-confirm">
            {application ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {t("smartImport.confirm", { count: nbAImporter })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
