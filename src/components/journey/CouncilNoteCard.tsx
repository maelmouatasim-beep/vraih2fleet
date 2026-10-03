/**
 * Phase 5.7 — Carte « Note au conseil » (étape Rapports) :
 * 1. faits du moteur calculés pour le plan courant ;
 * 2. rédaction par l'IA (jetons {{fait}}, aucun chiffre écrit par l'IA) ou
 *    par le modèle sans IA ;
 * 3. édition libre, chaque nombre vérifié contre les faits (export bloqué
 *    sinon) ;
 * 4. export PDF ou Word : le plan est figé dans un snapshot de rapport,
 *    auquel la note enregistrée est liée.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { pdf } from "@react-pdf/renderer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";
import { analyserSensibilite, ENGINE_VERSION } from "@/lib/tco";
import {
  brouillonModele,
  faitsNote,
  faitsTransmis,
  rendreSections,
  SECTIONS_NOTE,
  verifierNote,
  type FaitNote,
  type SectionsNote,
} from "@/lib/journey/councilNote";
import { libelleStrategieRetenue, type StrategieConstruite, type StrategieRetenue } from "@/lib/journey/strategies";
import type { DiagnosticHiver } from "@/lib/journey/winter";
import { ErreurIa, lireReglagesIa } from "@/lib/supabase/ai";
import { derniereNote, enregistrerNote, redigerNoteIa, type NoteConseilRow } from "@/lib/supabase/councilNotes";
import { insererSnapshotRapport } from "@/lib/supabase/reportSnapshots";
import { AlertTriangle, CheckCircle2, FileText, Landmark, Loader2, Save, Sparkles, Wand2 } from "lucide-react";
import CouncilNotePDF from "./CouncilNotePDF";

interface Props {
  projectId: string;
  organizationId: string | null | undefined;
  organisation: string;
  projet: string;
  anneeReference: number;
  horizonAns: number;
  tauxActualisationNominal: number;
  strategie: StrategieConstruite;
  retenue: StrategieRetenue;
  hiver: (DiagnosticHiver | null)[];
}

interface Brouillon {
  id?: string;
  langue: "fr" | "en";
  sections: SectionsNote;
  faits: FaitNote[];
  source: "ia" | "modele";
  fingerprint: string;
}

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CouncilNoteCard(p: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [langue, setLangue] = useState<"fr" | "en">(i18n.language === "en" ? "en" : "fr");
  // Le brouillon en cours survit à un remontage de l'étape (navigation,
  // rafraîchissement des données) : il est gardé dans le cache de session.
  const cleBrouillon = useMemo(() => ["council-note-draft", p.projectId], [p.projectId]);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(() => queryClient.getQueryData<Brouillon>(cleBrouillon) ?? null);
  useEffect(() => {
    queryClient.setQueryData(cleBrouillon, brouillon);
  }, [brouillon, cleBrouillon, queryClient]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [voirFaits, setVoirFaits] = useState(false);
  const empreinte = p.strategie.resultat!.empreinteEntree;
  const sensibilite = useMemo(() => analyserSensibilite(p.strategie.plan!), [p.strategie]);
  const faitsCourants = useMemo(
    () =>
      faitsNote({
        organisation: p.organisation,
        projet: p.projet,
        dateIso: new Date().toISOString().slice(0, 10),
        anneeReference: p.anneeReference,
        horizonAns: p.horizonAns,
        tauxActualisationNominal: p.tauxActualisationNominal,
        strategie: p.strategie,
        retenue: p.retenue,
        sensibilite,
        hiver: p.hiver,
      }),
    [p, sensibilite],
  );
  const { data: reglages } = useQuery({
    queryKey: ["ai-settings", p.organizationId],
    queryFn: () => lireReglagesIa(p.organizationId!),
    enabled: !!p.organizationId,
  });
  const { data: note } = useQuery({ queryKey: ["council-note", p.projectId], queryFn: () => derniereNote(p.projectId) });
  const iaActive = reglages?.council_note_enabled === true;

  const verification = useMemo(
    () => (brouillon ? verifierNote(brouillon.sections, brouillon.faits, brouillon.langue) : null),
    [brouillon],
  );
  const perimee = !!brouillon && brouillon.fingerprint !== empreinte;

  const depuisModele = () => {
    setBrouillon({ langue, faits: faitsCourants, source: "modele", fingerprint: empreinte, sections: rendreSections(brouillonModele(faitsCourants, langue), faitsCourants, langue), id: brouillon?.id });
  };

  const depuisIa = async () => {
    setEnCours("ia");
    try {
      const r = await redigerNoteIa(p.projectId, langue, faitsTransmis(faitsCourants, langue));
      if (r.type === "note") {
        setBrouillon({ langue, faits: faitsCourants, source: "ia", fingerprint: empreinte, sections: rendreSections(r.sections, faitsCourants, langue), id: brouillon?.id });
        if (r.ecartsRejetes > 0) toast({ title: t("journey.reports.councilNote.aiRetried", { count: r.ecartsRejetes }) });
      } else {
        toast({ title: t(r.type === "refus" ? "journey.reports.councilNote.aiRefused" : "journey.reports.councilNote.aiRejected"), variant: "destructive" });
      }
    } catch (e) {
      const code = e instanceof ErreurIa ? e.code : "erreur_service";
      toast({ title: t(`journey.reports.councilNote.errors.${code}`), variant: "destructive" });
    } finally {
      setEnCours(null);
    }
  };

  const ouvrir = (n: NoteConseilRow) => {
    setBrouillon({
      id: n.id,
      langue: n.language === "en" ? "en" : "fr",
      sections: n.sections as unknown as SectionsNote,
      faits: n.facts as unknown as FaitNote[],
      source: n.source === "ia" ? "ia" : "modele",
      fingerprint: n.fingerprint,
    });
  };

  const enregistrer = async (snapshot?: { id: string }) => {
    const ligne = await enregistrerNote({
      id: brouillon!.id,
      projectId: p.projectId,
      langue: brouillon!.langue,
      sections: brouillon!.sections,
      faits: brouillon!.faits,
      source: brouillon!.source,
      engineVersion: ENGINE_VERSION,
      fingerprint: brouillon!.fingerprint,
      ...(snapshot ? { reportSnapshotId: snapshot.id, exportee: true } : {}),
    });
    setBrouillon((b) => (b ? { ...b, id: ligne.id } : b));
    await queryClient.invalidateQueries({ queryKey: ["council-note", p.projectId] });
  };

  const sauver = async () => {
    setEnCours("save");
    try {
      await enregistrer();
      toast({ title: t("journey.reports.councilNote.saved") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setEnCours(null);
    }
  };

  const exporter = async (format: "pdf" | "docx") => {
    if (!brouillon || !verification?.ok || perimee) return;
    setEnCours(format);
    try {
      const r = p.strategie.resultat!;
      // Le plan est FIGÉ à l'export : snapshot immuable lié à la note.
      const snapshot = await insererSnapshotRapport({
        projectId: p.projectId,
        strategyKey: p.retenue.cle ?? "plan_actuel",
        reportKind: format === "pdf" ? "note_pdf" : "note_docx",
        engineVersion: ENGINE_VERSION,
        fingerprint: r.empreinteEntree,
        parameters: { parametres: p.strategie.plan!.parametres } as unknown as Json,
        van: r.vanDifferentielle,
        tcoAlt: r.alternative.tcoActualise,
        tcoRef: r.reference.tcoActualise,
      });
      const meta = {
        organisation: p.organisation,
        projet: p.projet,
        dateIso: new Date().toISOString().slice(0, 10),
        strategie: libelleStrategieRetenue(p.retenue, brouillon.langue),
        snapshotDate: snapshot.created_at.slice(0, 10),
        moteur: ENGINE_VERSION,
        empreinte: r.empreinteEntree,
      };
      const props = { langue: brouillon.langue, sections: brouillon.sections, faits: brouillon.faits, meta, strategie: p.strategie, sensibilite };
      const nom = `h2fleet-note-conseil-${meta.dateIso}-${brouillon.langue}`;
      if (format === "pdf") {
        telecharger(await pdf(<CouncilNotePDF {...props} />).toBlob(), `${nom}.pdf`);
      } else {
        const { construireNoteDocx } = await import("@/lib/journey/councilNoteDocx");
        telecharger(await construireNoteDocx(props), `${nom}.docx`);
      }
      await enregistrer(snapshot);
      await queryClient.invalidateQueries({ queryKey: ["report-snapshot", p.projectId] });
      toast({ title: t("journey.reports.councilNote.exported", { date: meta.snapshotDate }) });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setEnCours(null);
    }
  };

  const k = "journey.reports.councilNote";
  return (
    <Card data-testid="council-note-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Landmark className="w-5 h-5" /> {t(`${k}.title`)}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t(`${k}.subtitle`)}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="council-note-language" className="text-xs">
              {t(`${k}.language`)}
            </Label>
            <select
              id="council-note-language"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={langue}
              onChange={(e) => setLangue(e.target.value === "en" ? "en" : "fr")}
            >
              <option value="fr">{t(`${k}.languages.fr`)}</option>
              <option value="en">{t(`${k}.languages.en`)}</option>
            </select>
          </div>
          <Button onClick={() => void depuisIa()} disabled={!iaActive || enCours !== null} data-testid="council-note-ai">
            {enCours === "ia" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {enCours === "ia" ? t(`${k}.drafting`) : t(`${k}.draftAi`)}
          </Button>
          <Button variant="outline" onClick={depuisModele} disabled={enCours !== null} data-testid="council-note-template">
            <Wand2 className="w-4 h-4 mr-2" /> {t(`${k}.draftTemplate`)}
          </Button>
          {note && !brouillon && (
            <Button variant="ghost" onClick={() => ouvrir(note)} data-testid="council-note-open">
              {t(`${k}.open`)}
            </Button>
          )}
        </div>
        {!iaActive && <p className="text-xs text-muted-foreground">{t(`${k}.aiDisabled`)}</p>}
        {note && (
          <p className="text-xs text-muted-foreground">
            {t(`${k}.lastNote`, {
              date: note.updated_at.slice(0, 10),
              source: t(`${k}.sources.${note.source}`),
              export: note.exported_at ? t(`${k}.lastNoteExport`, { date: note.exported_at.slice(0, 10) }) : "",
            })}
          </p>
        )}

        {brouillon && (
          <div className="space-y-4 border-t pt-4" data-testid="council-note-editor">
            {perimee && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t(`${k}.staleTitle`)}</AlertTitle>
                <AlertDescription>{t(`${k}.staleBody`)}</AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">{t(`${k}.editHint`)}</p>
            {SECTIONS_NOTE.map((s) => {
              const ko = verification?.nonVerifies.find((x) => x.section === s);
              return (
                <div key={s} className="space-y-1">
                  <Label htmlFor={`note-${s}`} className="font-medium">
                    {t(`${k}.sections.${s}`)}
                  </Label>
                  <Textarea
                    id={`note-${s}`}
                    data-testid={`council-note-section-${s}`}
                    value={brouillon.sections[s]}
                    rows={s === "prochaines_etapes" ? 6 : 4}
                    className={ko ? "border-destructive" : ""}
                    onChange={(e) => setBrouillon((b) => (b ? { ...b, sections: { ...b.sections, [s]: e.target.value } } : b))}
                  />
                </div>
              );
            })}
            {verification?.ok ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5" data-testid="council-note-verified">
                <CheckCircle2 className="w-4 h-4" /> {t(`${k}.verifiedOk`)}
              </p>
            ) : (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-1" data-testid="council-note-unverified">
                <p className="font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> {t(`${k}.verifiedKo`)}
                </p>
                {verification?.nonVerifies.map((x) => (
                  <p key={x.section}>
                    {t(`${k}.sections.${x.section}`)} : {x.nombres.join(", ")}
                  </p>
                ))}
                {(verification?.jetonsRestants.length ?? 0) > 0 && <p>{t(`${k}.tokensLeft`, { liste: verification!.jetonsRestants.join(", ") })}</p>}
              </div>
            )}
            <div>
              <Button variant="link" size="sm" className="px-0" onClick={() => setVoirFaits((v) => !v)}>
                {t(`${k}.facts`, { count: brouillon.faits.length })}
              </Button>
              {voirFaits && (
                <ul className="mt-1 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2" data-testid="council-note-facts">
                  {brouillon.faits.map((f) => (
                    <li key={f.id} className="flex justify-between gap-2 border-b border-border/60 py-0.5">
                      <span className="text-muted-foreground">{f.libelle[brouillon.langue]}</span>
                      <span className="font-medium text-right">{f.rendu[brouillon.langue]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t(`${k}.sources.${brouillon.source}`)}</Badge>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => void sauver()} disabled={enCours !== null} data-testid="council-note-save">
                {enCours === "save" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {t(`${k}.save`)}
              </Button>
              {(["pdf", "docx"] as const).map((f) => (
                <Button
                  key={f}
                  onClick={() => void exporter(f)}
                  disabled={enCours !== null || !verification?.ok || perimee}
                  data-testid={`council-note-export-${f}`}
                >
                  {enCours === f ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  {t(f === "pdf" ? `${k}.exportPdf` : `${k}.exportWord`)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
