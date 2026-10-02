/**
 * Phase 5.5 — Veille des subventions (Bibliothèque) :
 * - pour tous : changements de programmes VALIDÉS (résumé, date, source) ;
 * - pour les administrateurs H2Fleet : la FILE DE VALIDATION des
 *   changements détectés chaque semaine (extraits avant → après, texte
 *   archivé, source), avec un résumé à corriger avant de valider.
 * Rien n'est appliqué automatiquement.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  ARCHIVE_VEILLE,
  listerEvenementsProgrammes,
  listerFileVeille,
  rejeterChangement,
  validerChangement,
  type ChangementVeille,
} from "@/lib/supabase/subsidyWatch";
import { brouillonResume, type FaitVeille } from "@/lib/veille/brouillon";
import { nomProgramme } from "@/lib/tco/translations-en";
import { CheckCircle2, ExternalLink, Radar, XCircle } from "lucide-react";

function Revue({ c, onFini }: { c: ChangementVeille; onFini: () => void }) {
  const { t } = useTranslation();
  const retires = (Array.isArray(c.facts_removed) ? c.facts_removed : []) as unknown as FaitVeille[];
  const ajoutes = (Array.isArray(c.facts_added) ? c.facts_added : []) as unknown as FaitVeille[];
  const kind = c.change_kind as FaitVeille["type"];
  const [fr, setFr] = useState(brouillonResume(nomProgramme(c.program_id, "fr").split("—")[0].trim(), kind, retires, ajoutes, "fr"));
  const [en, setEn] = useState(brouillonResume(nomProgramme(c.program_id, "en").split("—")[0].trim(), kind, retires, ajoutes, "en"));
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);

  const agir = async (action: "valider" | "rejeter") => {
    setEnCours(true);
    try {
      if (action === "valider") await validerChangement(c.id, fr, en, note.trim() || null);
      else await rejeterChangement(c.id, note.trim() || null);
      toast({ title: t(action === "valider" ? "library.watch.validated" : "library.watch.rejected") });
      onFini();
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <li className="py-3 space-y-2" data-testid="watch-change">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t(`library.watch.kinds.${c.change_kind}`)}</Badge>
        <span className="font-medium">{nomProgramme(c.program_id, "fr").split("—")[0].trim()}</span>
        <span className="text-xs text-muted-foreground">{c.detected_at.slice(0, 10)}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 text-xs">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 whitespace-pre-wrap">
          <p className="font-semibold mb-1">{t("library.watch.before")}</p>
          {c.excerpt_before || "—"}
        </div>
        <div className="rounded-md border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-2 whitespace-pre-wrap">
          <p className="font-semibold mb-1">{t("library.watch.after")}</p>
          {c.excerpt_after || "—"}
        </div>
      </div>
      <p className="text-xs text-muted-foreground flex flex-wrap gap-3">
        <a href={c.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
          {t("library.watch.source")} <ExternalLink className="w-3 h-3" />
        </a>
        {c.archive_path && (
          <a href={`${ARCHIVE_VEILLE}${c.archive_path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
            {t("library.watch.archive")} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">{t("library.watch.summaryFr")}</Label>
          <Textarea rows={2} value={fr} onChange={(e) => setFr(e.target.value)} className="text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("library.watch.summaryEn")}</Label>
          <Textarea rows={2} value={en} onChange={(e) => setEn(e.target.value)} className="text-xs" />
        </div>
      </div>
      <Textarea rows={1} placeholder={t("library.watch.note")} value={note} onChange={(e) => setNote(e.target.value)} className="text-xs" />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" disabled={enCours} onClick={() => void agir("rejeter")} data-testid="watch-reject">
          <XCircle className="w-4 h-4 mr-1" /> {t("library.watch.reject")}
        </Button>
        <Button size="sm" disabled={enCours || fr.trim().length < 5 || en.trim().length < 5} onClick={() => void agir("valider")} data-testid="watch-validate">
          <CheckCircle2 className="w-4 h-4 mr-1" /> {t("library.watch.validate")}
        </Button>
      </div>
    </li>
  );
}

export default function SubsidyWatchCard() {
  const { t, i18n } = useTranslation();
  const langue = i18n.language === "en" ? "en" : "fr";
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const { data: evenements = [] } = useQuery({ queryKey: ["subsidy-events"], queryFn: () => listerEvenementsProgrammes() });
  const { data: file = [] } = useQuery({ queryKey: ["subsidy-watch-queue"], queryFn: () => listerFileVeille("pending"), enabled: isAdmin });
  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["subsidy-watch-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["subsidy-events"] });
  };

  return (
    <div className="space-y-4">
      <Card data-testid="watch-events">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Radar className="w-5 h-5 text-muted-foreground" /> {t("library.watch.title")}
          </CardTitle>
          <CardDescription>{t("library.watch.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {evenements.length === 0 ? (
            <p className="text-muted-foreground">{t("library.watch.noEvents")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {evenements.map((e) => (
                <li key={e.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t(`library.watch.kinds.${e.change_kind}`)}</Badge>
                    <span className="text-xs text-muted-foreground">{t("library.watch.validatedOn", { date: e.validated_at.slice(0, 10) })}</span>
                  </div>
                  <p className="mt-1">{langue === "en" ? e.summary_en : e.summary_fr}</p>
                  <a href={e.source_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground inline-flex items-center gap-1 underline">
                    {t("library.watch.source")} <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card data-testid="watch-queue">
          <CardHeader>
            <CardTitle className="text-lg">{t("library.watch.queueTitle", { count: file.length })}</CardTitle>
            <CardDescription>{t("library.watch.queueSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {file.length === 0 ? (
              <p className="text-muted-foreground">{t("library.watch.queueEmpty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {file.map((c) => (
                  <Revue key={c.id} c={c} onFini={rafraichir} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
