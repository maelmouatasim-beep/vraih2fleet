/**
 * Phase 5.4 — FACTURES ET DEVIS : dépôt d'une pièce, lecture (IA si la
 * fonction est activée, sinon saisie), revue à côté du document (chaque
 * valeur avec l'extrait où elle a été lue et sa vérification dans le
 * texte), valeurs dérivées avec leur formule, aperçu avant → après, puis
 * CONFIRMATION explicite. La pièce reste jointe comme preuve (rapport).
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useGarages } from "@/hooks/useGarages";
import { getEnergyInputs } from "@/lib/supabase/energyInputs";
import { appelerFonctionIa, ErreurIa, lireReglagesIa } from "@/lib/supabase/ai";
import {
  confirmerDocument,
  deposerDocument,
  enregistrerExtraction,
  lienDocument,
  listerDocuments,
  rejeterDocument,
  TAILLE_MAX_DOCUMENT,
  type ClientDocumentRow,
} from "@/lib/supabase/clientDocuments";
import { lireTexteDocument } from "@/lib/documents/texteDocument";
import { fichierPieceDemo } from "@/lib/demoData/piecesDemo";
import PdfApercu from "./PdfApercu";
import { deriverValeurs, typeBorneDepuisPuissance, type CibleDerivee, type Formule } from "@/lib/documents/derivation";
import { planifierEcritures, type Ecriture } from "@/lib/documents/application";
import { lireDevisBornes } from "@/lib/fleet/garagesModel";
import { TYPES_BORNE, type TypeBorne } from "@/lib/journey/infrastructure";
import type { ProjectVehicleWithVehicle } from "@/lib/fleet/projectVehicles";
import type { Json } from "@/integrations/supabase/types";
import {
  CHAMPS_DOCUMENT,
  type ChampExtrait,
  type ExtractionDocument,
  type TypeDocument,
} from "../../../supabase/functions/_shared/documentSchema";
import { AlertTriangle, CheckCircle2, FileCheck2, FileText, Loader2, Sparkles, Upload, XCircle } from "lucide-react";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const TYPES_ORGANISATION: TypeDocument[] = ["fuel_invoice", "electricity_invoice", "charger_quote", "grid_quote"];
const TYPES_PROJET: TypeDocument[] = ["vehicle_quote", "fuel_invoice", "electricity_invoice", "charger_quote", "grid_quote"];

type SortieDocument =
  | { type: "extraction"; extraction: ExtractionDocument; rejets: number; mode: "texte" | "fichier" }
  | { type: "refus" }
  | { type: "invalide" };

interface Props {
  organizationId: string | null | undefined;
  /** Présent : pièces du projet (devis de véhicules inclus). */
  projectId?: string | null;
  projectVehicles?: ProjectVehicleWithVehicle[];
  peutModifier?: boolean;
  /** Démo Rivière-Claire : propose des pièces FICTIVES à essayer. */
  demo?: boolean;
}

interface Revue {
  document: ClientDocumentRow;
  url: string | null;
  extraction: ExtractionDocument | null;
  modeIa: "texte" | "fichier" | null;
  rejets: number;
}

const parseNombre = (s: string): number | null => {
  const t = s.replace(/[\s\u00a0\u202f$]/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export default function ClientDocumentsCard({ organizationId, projectId = null, projectVehicles = [], peutModifier = true, demo = false }: Props) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language.startsWith("en") ? "en" : "fr";
  const locale = langue === "en" ? "en-CA" : "fr-CA";
  const queryClient = useQueryClient();
  const { garages } = useGarages(organizationId);
  const fichierRef = useRef<HTMLInputElement>(null);

  const cleListe = ["client-documents", organizationId, projectId];
  const { data: documents = [] } = useQuery({
    queryKey: cleListe,
    queryFn: () => listerDocuments(organizationId!, projectId),
    enabled: !!organizationId,
  });
  const { data: reglages } = useQuery({
    queryKey: ["ai-settings", organizationId],
    queryFn: () => lireReglagesIa(organizationId!),
    enabled: !!organizationId,
  });
  const iaActive = reglages?.document_reading_enabled === true;

  const [ouvert, setOuvert] = useState(false);
  const [kind, setKind] = useState<TypeDocument>(projectId ? "vehicle_quote" : "fuel_invoice");
  const [lecture, setLecture] = useState<"depot" | "ia" | null>(null);
  const [erreurIa, setErreurIa] = useState<string | null>(null);
  const [revue, setRevue] = useState<Revue | null>(null);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [fournisseur, setFournisseur] = useState("");
  const [dateDocument, setDateDocument] = useState("");
  const [garageId, setGarageId] = useState("");
  const [typeBorne, setTypeBorne] = useState<TypeBorne | "">("");
  const [portee, setPortee] = useState<"organisation" | "projet">("organisation");
  const [vehiculesChoisis, setVehiculesChoisis] = useState<Set<string>>(new Set());
  const [application, setApplication] = useState(false);

  const { data: energie } = useQuery({
    queryKey: ["energy-client-inputs", organizationId, projectId ?? null, "documents"],
    queryFn: () => getEnergyInputs(organizationId!, projectId ?? undefined),
    enabled: !!organizationId && !!revue,
  });

  const reinitialiser = () => {
    setRevue(null);
    setValeurs({});
    setFournisseur("");
    setDateDocument("");
    setGarageId("");
    setTypeBorne("");
    setPortee("organisation");
    setVehiculesChoisis(new Set());
    setErreurIa(null);
    setLecture(null);
  };

  const choisirFichier = async (file: File, typePiece: TypeDocument = kind) => {
    if (!organizationId) return;
    if (file.size > TAILLE_MAX_DOCUMENT) {
      toast({ title: t("documents.errors.fichier_trop_volumineux"), variant: "destructive" });
      return;
    }
    reinitialiser();
    setLecture("depot");
    try {
      const document = await deposerDocument({ file, organizationId, projectId, kind: typePiece });
      await queryClient.invalidateQueries({ queryKey: cleListe });
      const url = await lienDocument(document.storage_path).catch(() => null);
      let extraction: ExtractionDocument | null = null;
      let modeIa: Revue["modeIa"] = null;
      let rejets = 0;
      if (iaActive) {
        setLecture("ia");
        try {
          const texte = await lireTexteDocument(file).catch(() => null);
          const sortie = await appelerFonctionIa<SortieDocument>("document-reader", {
            organizationId,
            documentId: document.id,
            langue,
            texte,
            garages: garages.map((g) => g.name),
          });
          if (sortie.type === "extraction") {
            extraction = sortie.extraction;
            modeIa = sortie.mode;
            rejets = sortie.rejets;
            await enregistrerExtraction(document.id, { mode: "ia", lecture: sortie.mode, extraction } as unknown as Json).catch(() => undefined);
          } else setErreurIa(sortie.type);
        } catch (e) {
          setErreurIa(e instanceof ErreurIa ? e.code : "erreur_service");
        }
      }
      ouvrirRevue({ document, url, extraction, modeIa, rejets });
    } catch (e) {
      toast({ title: t("common.error"), description: t(`documents.errors.${e instanceof Error ? e.message : ""}`, { defaultValue: e instanceof Error ? e.message : "" }), variant: "destructive" });
    } finally {
      setLecture(null);
    }
  };

  const ouvrirRevue = (r: Revue) => {
    setRevue(r);
    const v: Record<string, string> = {};
    for (const c of r.extraction?.champs ?? []) {
      v[c.champ] = c.valeur_nombre != null ? String(c.valeur_nombre) : c.valeur_texte;
    }
    setValeurs(v);
    setFournisseur(r.extraction?.fournisseur ?? "");
    setDateDocument(r.extraction?.date_document ?? "");
    const g = garages.find((x) => x.name === r.extraction?.garage_propose);
    setGarageId(g?.id ?? "");
    const kw = r.extraction?.champs.find((c) => c.champ === "puissance_kw_par_borne")?.valeur_nombre;
    setTypeBorne(kw != null && kw > 0 ? typeBorneDepuisPuissance(kw) : "");
    setPortee(r.document.project_id ? "projet" : "organisation");
  };

  const reprendre = async (d: ClientDocumentRow) => {
    const url = await lienDocument(d.storage_path).catch(() => null);
    const ext = (d.extraction as { extraction?: ExtractionDocument } | null)?.extraction ?? null;
    setKind(d.kind as TypeDocument);
    ouvrirRevue({ document: d, url, extraction: ext, modeIa: null, rejets: 0 });
    setOuvert(true);
  };

  const type = (revue?.document.kind ?? kind) as TypeDocument;
  const definitions = CHAMPS_DOCUMENT[type];
  const extraitPar = useMemo(() => new Map((revue?.extraction?.champs ?? []).map((c) => [c.champ, c])), [revue]);

  const valeursConfirmees = useMemo(() => {
    const out: Record<string, number | string | null> = {};
    for (const d of definitions) {
      const brut = (valeurs[d.cle] ?? "").trim();
      out[d.cle] = d.nature === "nombre" ? parseNombre(brut) : brut || null;
    }
    return out;
  }, [definitions, valeurs]);

  const derivation = useMemo(
    () => deriverValeurs(type, valeursConfirmees, { typeBorne: typeBorne || null }),
    [type, valeursConfirmees, typeBorne],
  );

  const garage = garages.find((g) => g.id === garageId) ?? null;
  const vehiculesDuDevis = projectVehicles.filter((pv) => vehiculesChoisis.has(pv.id));
  const planification = useMemo(() => {
    const energieActuelle = portee === "projet" ? energie?.projet : energie?.organisation;
    return planifierEcritures(derivation.cibles, {
      portee,
      energieActuelle: {
        diesel_price_per_l: energieActuelle?.diesel_price_per_l ?? null,
        electricity_cost_per_kwh: energieActuelle?.electricity_cost_per_kwh ?? null,
      },
      garage: garage
        ? {
            id: garage.id,
            name: garage.name,
            hq_rate: garage.hq_rate,
            grid_connection_quote: garage.grid_connection_quote,
            charger_unit_quote: lireDevisBornes(garage.charger_unit_quote) ?? {},
          }
        : null,
      vehicules: vehiculesDuDevis.map((pv) => ({
        id: pv.id,
        unite: pv.vehicles.unit_number,
        quote_price: pv.quote_price,
        quote_technology: pv.quote_technology,
      })),
    });
  }, [derivation, portee, energie, garage, vehiculesDuDevis]);

  const argent = (n: number, d = 2) => n.toLocaleString(locale, { style: "currency", currency: "CAD", maximumFractionDigits: d });
  const nombre = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 4 });
  const valeurCible = (c: { cible: string; valeur: number | string }) => {
    if (typeof c.valeur === "string") return c.valeur;
    if (c.cible === "diesel_price_per_l") return `${nombre(c.valeur)} $/L`;
    if (c.cible === "electricity_cost_per_kwh") return `${nombre(c.valeur)} $/kWh`;
    return argent(c.valeur);
  };
  const texteFormule = (f: Formule) => {
    const op = f.operandes.map((o) => `${nombre(o.valeur)} (${t(`documents.fields.${o.champ}`)})`);
    if (f.operation === "valeur") return op[0];
    if (f.operation === "division") return `${op[0]} ÷ ${op[1]}`;
    return op.length === 4 ? `(${op[0]} − ${op[1]} − ${op[2]}) ÷ ${op[3]}` : `${op[0]} − ${op[1]} − ${op[2]}`;
  };
  const valeurEcriture = (e: Ecriture, v: number | string | null) => {
    if (v == null) return "—";
    if (typeof v === "string") return v;
    if (e.champ === "diesel_price_per_l") return `${nombre(v)} $/L`;
    if (e.champ === "electricity_cost_per_kwh") return `${nombre(v)} $/kWh`;
    return argent(v);
  };

  const badgeVerif = (c: ChampExtrait | undefined, modifie: boolean) => {
    if (modifie) return <Badge variant="outline">{t("documents.verify.edited")}</Badge>;
    if (!c) return <Badge variant="outline">{t("documents.verify.manual")}</Badge>;
    if (c.retrouve === true) return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="w-3 h-3" />{t("documents.verify.found")}</Badge>;
    if (c.retrouve === false)
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{t("documents.verify.notFound")}</Badge>;
    return <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">{t("documents.verify.visual")}</Badge>;
  };

  const bloque = planification.blocages.length > 0 || planification.ecritures.length === 0;
  const introuvables = (revue?.extraction?.champs ?? []).filter(
    (c) => c.retrouve === false && (valeurs[c.champ] ?? "") === (c.valeur_nombre != null ? String(c.valeur_nombre) : c.valeur_texte),
  );

  const confirmer = async () => {
    if (!revue || bloque) return;
    setApplication(true);
    try {
      const extraction = {
        mode: revue.modeIa ? "ia" : "manuel",
        extraction: revue.extraction,
        champs: definitions
          .filter((d) => valeursConfirmees[d.cle] != null)
          .map((d) => {
            const lu = extraitPar.get(d.cle);
            const v = valeursConfirmees[d.cle];
            const original = lu ? (lu.valeur_nombre ?? lu.valeur_texte) : null;
            return { champ: d.cle, valeur: v, origine: lu ? (String(original) === String(v) ? "ia" : "utilisateur") : "utilisateur", retrouve: lu?.retrouve ?? null, extrait: lu?.extrait ?? null };
          }),
        derivees: derivation.cibles,
      };
      await confirmerDocument({
        document: revue.document,
        projectId: projectId ?? null,
        ecritures: planification.ecritures,
        extraction: extraction as unknown as Json,
        supplier: fournisseur.trim() || null,
        documentDate: /^\d{4}-\d{2}-\d{2}$/.test(dateDocument) ? dateDocument : null,
        resume: t("documents.journalSummary", { kind: t(`documents.kinds.${type}`), count: planification.ecritures.length }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cleListe }),
        queryClient.invalidateQueries({ queryKey: ["energy-client-inputs"] }),
        queryClient.invalidateQueries({ queryKey: ["garages", organizationId] }),
        queryClient.invalidateQueries({ queryKey: ["project-vehicles"] }),
        queryClient.invalidateQueries({ queryKey: ["change-log"] }),
        queryClient.invalidateQueries({ queryKey: ["change-log-fleet", organizationId] }),
      ]);
      toast({ title: t("documents.confirmed", { count: planification.ecritures.length }) });
      setOuvert(false);
      reinitialiser();
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setApplication(false);
    }
  };

  const rejeter = async () => {
    if (!revue) return;
    try {
      await rejeterDocument(revue.document.id);
      await queryClient.invalidateQueries({ queryKey: cleListe });
      setOuvert(false);
      reinitialiser();
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const types = projectId ? TYPES_PROJET : TYPES_ORGANISATION;
  const resumeApplique = (d: ClientDocumentRow) => {
    const a = Array.isArray(d.applied) ? (d.applied as { cible: string; champ: string }[]) : [];
    return a.length > 0 ? t("documents.appliedCount", { count: a.length }) : "";
  };

  return (
    <Card data-testid={projectId ? "project-documents" : "org-documents"}>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-muted-foreground" />
            {t("documents.title")}
          </CardTitle>
          <CardDescription>{t(projectId ? "documents.subtitleProject" : "documents.subtitleOrg")}</CardDescription>
        </div>
        {peutModifier && (
          <Button size="sm" onClick={() => { reinitialiser(); setOuvert(true); }} data-testid="add-document">
            <Upload className="w-4 h-4 mr-2" /> {t("documents.add")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {documents.length === 0 ? (
          <p className="text-muted-foreground">{t("documents.empty")}</p>
        ) : (
          <ul className="divide-y divide-border" data-testid="documents-list">
            {documents.map((d) => (
              <li key={d.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{t(`documents.kinds.${d.kind}`)}</Badge>
                    <span className="font-medium truncate">{d.supplier || d.file_name}</span>
                    {d.document_date && <span className="text-muted-foreground text-xs">{d.document_date}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.file_name} · SHA-256 {d.sha256.slice(0, 12)}… {resumeApplique(d) && `· ${resumeApplique(d)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={d.status === "confirmed" ? "secondary" : d.status === "rejected" ? "outline" : "default"}>
                    {t(`documents.status.${d.status}`)}
                  </Badge>
                  {d.status === "pending" && peutModifier && (
                    <Button size="sm" variant="outline" onClick={() => void reprendre(d)}>
                      {t("documents.review")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">{t("documents.privacy")}</p>
      </CardContent>

      <Dialog open={ouvert} onOpenChange={(o) => { if (application || lecture) return; setOuvert(o); if (!o) reinitialiser(); }}>
        <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto" data-testid="document-dialog">
          <DialogHeader>
            <DialogTitle>{revue ? t("documents.reviewTitle", { kind: t(`documents.kinds.${type}`) }) : t("documents.addTitle")}</DialogTitle>
            <DialogDescription>{revue ? t("documents.reviewSubtitle") : t("documents.addSubtitle")}</DialogDescription>
          </DialogHeader>

          {!revue ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="document-kind">{t("documents.kindLabel")}</Label>
                <select id="document-kind" className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as TypeDocument)}>
                  {types.map((k) => (
                    <option key={k} value={k}>
                      {t(`documents.kinds.${k}`)}
                    </option>
                  ))}
                </select>
              </div>
              <input
                ref={fichierRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                data-testid="document-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void choisirFichier(f);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" className="w-full" disabled={!!lecture} onClick={() => fichierRef.current?.click()}>
                {lecture ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {lecture === "ia" ? t("documents.reading") : lecture === "depot" ? t("documents.uploading") : t("documents.choose")}
              </Button>
              {demo && (
                <div className="flex flex-wrap gap-2" data-testid="document-demo">
                  {(["fuel_invoice", "vehicle_quote"] as const).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant="ghost"
                      disabled={!!lecture}
                      onClick={async () => {
                        setKind(k);
                        void choisirFichier(await fichierPieceDemo(k), k);
                      }}
                    >
                      {t(`documents.demo.${k}`)}
                    </Button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {iaActive ? <Sparkles className="w-3.5 h-3.5" /> : null}
                {iaActive ? t("documents.aiOn") : t("documents.aiOff")}{" "}
                {!iaActive && (
                  <Link to="/dashboard/organization" className="underline">
                    {t("documents.aiOffLink")}
                  </Link>
                )}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Document à côté des valeurs */}
              <div className="rounded-md border border-border bg-muted/40 min-h-[420px] overflow-hidden" data-testid="document-preview">
                {revue.url ? (
                  revue.document.mime_type === "application/pdf" ? (
                    <PdfApercu url={revue.url} />
                  ) : (
                    <img src={revue.url} alt={revue.document.file_name} className="w-full h-auto" />
                  )
                ) : (
                  <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" /> {revue.document.file_name}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {erreurIa && (
                  <p className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs" data-testid="document-ai-error">
                    {t(`documents.aiErrors.${erreurIa}`, { defaultValue: t("documents.aiErrors.erreur_service") })}
                  </p>
                )}
                {revue.extraction && (
                  <p className="text-xs text-muted-foreground" data-testid="document-ai-done">
                    {t(revue.modeIa === "fichier" ? "documents.readFile" : "documents.readText")}
                    {revue.rejets > 0 && ` ${t("documents.rejected", { count: revue.rejets })}`}
                    {revue.extraction.type_detecte !== type && ` ${t("documents.typeMismatch")}`}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="doc-supplier" className="text-xs">{t("documents.supplier")}</Label>
                    <Input id="doc-supplier" value={fournisseur} maxLength={200} onChange={(e) => setFournisseur(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="doc-date" className="text-xs">{t("documents.date")}</Label>
                    <Input id="doc-date" type="date" value={dateDocument} onChange={(e) => setDateDocument(e.target.value)} />
                  </div>
                </div>

                <table className="w-full text-xs" data-testid="document-fields">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left py-1">{t("documents.field")}</th>
                      <th className="text-left py-1 w-40">{t("documents.value")}</th>
                      <th className="text-left py-1">{t("documents.check")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {definitions.map((d) => {
                      const lu = extraitPar.get(d.cle);
                      const original = lu ? String(lu.valeur_nombre ?? lu.valeur_texte) : "";
                      const actuel = valeurs[d.cle] ?? "";
                      return (
                        <tr key={d.cle} data-testid={`field-${d.cle}`}>
                          <td className="py-1.5 pr-2 align-top">
                            <span className="font-medium">{t(`documents.fields.${d.cle}`)}</span>
                            {d.unite && <span className="text-muted-foreground"> ({d.unite})</span>}
                            {lu?.extrait && <p className="text-[11px] text-muted-foreground italic">« {lu.extrait} »</p>}
                          </td>
                          <td className="py-1.5 pr-2 align-top">
                            <Input
                              aria-label={t(`documents.fields.${d.cle}`)}
                              className="h-8 text-xs"
                              type={d.nature === "date" ? "date" : "text"}
                              inputMode={d.nature === "nombre" ? "decimal" : undefined}
                              value={actuel}
                              onChange={(e) => setValeurs((v) => ({ ...v, [d.cle]: e.target.value }))}
                            />
                          </td>
                          <td className="py-1.5 align-top">{actuel ? badgeVerif(lu, !!lu && actuel !== original) : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Cibles */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(type === "fuel_invoice" || type === "electricity_invoice") && projectId && (
                    <div className="space-y-1">
                      <Label htmlFor="doc-scope" className="text-xs">{t("documents.scope")}</Label>
                      <select id="doc-scope" className={selectCls} value={portee} onChange={(e) => setPortee(e.target.value as "organisation" | "projet")}>
                        <option value="organisation">{t("documents.scopes.organisation")}</option>
                        <option value="projet">{t("documents.scopes.projet")}</option>
                      </select>
                    </div>
                  )}
                  {(type === "electricity_invoice" || type === "charger_quote" || type === "grid_quote") && (
                    <div className="space-y-1">
                      <Label htmlFor="doc-garage" className="text-xs">{t("documents.garage")}</Label>
                      <select id="doc-garage" className={selectCls} value={garageId} onChange={(e) => setGarageId(e.target.value)} data-testid="document-garage">
                        <option value="">{t("documents.garageNone")}</option>
                        {garages.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {type === "charger_quote" && (
                    <div className="space-y-1">
                      <Label htmlFor="doc-charger" className="text-xs">{t("documents.chargerType")}</Label>
                      <select id="doc-charger" className={selectCls} value={typeBorne} onChange={(e) => setTypeBorne(e.target.value as TypeBorne)}>
                        <option value="">—</option>
                        {TYPES_BORNE.map((b) => (
                          <option key={b} value={b}>
                            {t(`documents.chargers.${b}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {type === "vehicle_quote" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("documents.vehicles")}</Label>
                    <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 grid grid-cols-2 gap-1" data-testid="document-vehicles">
                      {projectVehicles.map((pv) => (
                        <label key={pv.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={vehiculesChoisis.has(pv.id)}
                            onChange={(e) =>
                              setVehiculesChoisis((s) => {
                                const n = new Set(s);
                                if (e.target.checked) n.add(pv.id);
                                else n.delete(pv.id);
                                return n;
                              })
                            }
                          />
                          <span className="font-medium">{pv.vehicles.unit_number}</span>
                          <span className="text-muted-foreground truncate">
                            {[pv.vehicles.make, pv.vehicles.model].filter(Boolean).join(" ")}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Valeurs dérivées (formule) et aperçu avant → après */}
                <div className="rounded-md border border-border p-3 space-y-2" data-testid="document-derived">
                  <p className="text-xs font-semibold">{t("documents.derivedTitle")}</p>
                  {derivation.cibles.map((c: CibleDerivee, i) => (
                    <p key={i} className="text-xs">
                      <span className="font-medium">{t(`documents.targets.${c.cible}`)}</span> : {valeurCible(c)}
                      {c.formule && <span className="text-muted-foreground"> = {texteFormule(c.formule)}</span>}
                    </p>
                  ))}
                  {derivation.nonDerivees.map((n, i) => (
                    <p key={`n${i}`} className="text-xs text-amber-700 dark:text-amber-300">
                      {t(`documents.targets.${n.cible}`)} : {t(`documents.reasons.${n.raison}`)}
                    </p>
                  ))}
                </div>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1" data-testid="document-apply-preview">
                  <p className="text-xs font-semibold">{t("documents.previewTitle")}</p>
                  {planification.ecritures.length === 0 && <p className="text-xs text-muted-foreground">{t("documents.previewEmpty")}</p>}
                  {planification.ecritures.map((e, i) => (
                    <p key={i} className="text-xs">
                      {e.libelleCible} · {t(`documents.writeFields.${e.champ}`)}
                      {e.champ === "charger_unit_quote" && ` (${t(`documents.chargers.${e.typeBorne}`)})`} : {valeurEcriture(e, e.avant)} →{" "}
                      <span className="font-medium">{valeurEcriture(e, e.apres)}</span>
                    </p>
                  ))}
                  {planification.blocages.map((b) => (
                    <p key={b} className="text-xs text-destructive">
                      {t(`documents.blocks.${b}`)}
                    </p>
                  ))}
                  {introuvables.length > 0 && (
                    <p className="text-xs text-destructive" data-testid="document-not-found-warning">
                      {t("documents.notFoundWarning", { fields: introuvables.map((c) => t(`documents.fields.${c.champ}`)).join(", ") })}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{t("journey.strategies.apply.logged")}</p>
                </div>
              </div>
            </div>
          )}

          {revue && (
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => void rejeter()} disabled={application}>
                <XCircle className="w-4 h-4 mr-2" /> {t("documents.reject")}
              </Button>
              <Button onClick={() => void confirmer()} disabled={application || bloque} data-testid="document-confirm">
                {application ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {t("documents.confirm", { count: planification.ecritures.length })}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
