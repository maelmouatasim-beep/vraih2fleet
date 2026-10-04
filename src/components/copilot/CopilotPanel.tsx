/**
 * Phase 5.2 — Copilote de projet : panneau latéral du parcours. Réponses
 * dont chaque nombre a été VÉRIFIÉ contre le moteur TCO, sources citées,
 * historique visible par l'équipe, propositions appliquées seulement après
 * aperçu avant → après et confirmation (journalisées).
 */
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import MarkdownDoc from "@/components/help/MarkdownDoc";
import { toast } from "@/hooks/use-toast";
import { useCopilot } from "@/hooks/useCopilot";
import type { PropositionCopilote } from "@/lib/copilot/outils";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { CheckCircle2, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";

interface CopilotPanelProps {
  projectId: string;
  project: ProjectDTO | null | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const SUGGESTIONS = ["diesel", "buses", "budget", "subsidies"] as const;

export default function CopilotPanel({ projectId, project, open, onOpenChange }: CopilotPanelProps) {
  const { t, i18n } = useTranslation();
  const copilote = useCopilot(projectId, project);
  const [question, setQuestion] = useState("");
  const [aConfirmer, setAConfirmer] = useState<PropositionCopilote | null>(null);
  const [application, setApplication] = useState(false);
  const enCours = copilote.etat.etat === "en_cours";
  const locale = i18n.language.startsWith("en") ? "en-CA" : "fr-CA";

  const envoyer = (q: string) => {
    const texte = q.trim();
    if (!texte || enCours) return;
    setQuestion("");
    void copilote.poser(texte);
  };
  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    envoyer(question);
  };

  const confirmer = async () => {
    if (!aConfirmer) return;
    setApplication(true);
    try {
      await copilote.appliquer(aConfirmer);
      toast({ title: t("copilot.applied", { count: aConfirmer.changements.length }) });
      setAConfirmer(null);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setApplication(false);
    }
  };

  const cible = (c: string | null) => (c ? t(`journey.fleet.targets.${c}`) : t("journey.strategies.apply.none"));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-3 p-4" data-testid="copilot-panel">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {t("copilot.title")}
          </SheetTitle>
          <SheetDescription>{t("copilot.subtitle")}</SheetDescription>
        </SheetHeader>

        {!copilote.reglagesLoading && !copilote.actif ? (
          <div className="rounded-lg border border-border p-4 text-sm space-y-2" data-testid="copilot-disabled">
            <p className="font-medium">{t("copilot.disabled.title")}</p>
            <p className="text-muted-foreground">{t("copilot.disabled.body")}</p>
            <Button asChild size="sm" variant="outline">
              <Link to="/dashboard/organization">{t("copilot.disabled.link")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1" data-testid="copilot-history">
              {copilote.historique.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("copilot.empty")}</p>
              )}
              {copilote.historique.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm">
                    {m.content}
                  </div>
                ) : (
                  <div key={m.id} className="mr-4 rounded-lg border border-border px-3 py-2 text-sm space-y-2" data-testid="copilot-answer">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <MarkdownDoc source={m.content} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {t("copilot.verified", { count: m.verified_numbers ?? 0 })}
                      </Badge>
                      <span>{new Date(m.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    {Array.isArray(m.sources) && m.sources.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">{t("copilot.sources", { count: m.sources.length })}</summary>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {(m.sources as string[]).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {copilote.propositionsActives[m.id] && (
                      <div className="rounded-md bg-primary/5 border border-primary/30 p-2 flex flex-wrap items-center justify-between gap-2" data-testid="copilot-proposal">
                        <span className="text-xs">
                          {t("copilot.proposal", { count: copilote.propositionsActives[m.id].changements.length })}
                        </span>
                        <Button size="sm" onClick={() => setAConfirmer(copilote.propositionsActives[m.id])}>
                          {t("copilot.applyButton")}
                        </Button>
                      </div>
                    )}
                    {!copilote.propositionsActives[m.id] && m.proposal && (
                      <p className="text-xs text-muted-foreground">{t("copilot.proposalExpired")}</p>
                    )}
                  </div>
                ),
              )}
              {enCours && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="copilot-running">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {copilote.etat.etat === "en_cours" && copilote.etat.outils.length > 0
                    ? t("copilot.runningTools", {
                        tools: copilote.etat.outils.map((o) => t(`copilot.tools.${o}`, { defaultValue: o })).join(", "),
                      })
                    : t("copilot.running")}
                </div>
              )}
              {copilote.etat.etat === "erreur" && (
                <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-2 text-sm" data-testid="copilot-error">
                  {t(`copilot.errors.${copilote.etat.code}`)}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <Button key={s} type="button" size="sm" variant="outline" className="h-auto py-1 text-xs whitespace-normal text-left" disabled={enCours || !copilote.pret} onClick={() => envoyer(t(`copilot.suggestions.${s}`))}>
                  {t(`copilot.suggestions.${s}`)}
                </Button>
              ))}
            </div>
            <form onSubmit={soumettre} className="flex gap-2 items-end">
              <Textarea
                aria-label={t("copilot.placeholder")}
                placeholder={t("copilot.placeholder")}
                value={question}
                maxLength={2000}
                rows={2}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    envoyer(question);
                  }
                }}
              />
              <Button type="submit" size="icon" aria-label={t("copilot.send")} disabled={enCours || !question.trim() || !copilote.pret}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground">{t("copilot.privacy")}</p>
          </>
        )}

        <Dialog open={!!aConfirmer} onOpenChange={(o) => !application && !o && setAConfirmer(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("copilot.confirmTitle")}</DialogTitle>
              <DialogDescription>{aConfirmer ? t(`copilot.kinds.${aConfirmer.type}`, { count: aConfirmer.changements.length }) : ""}</DialogDescription>
            </DialogHeader>
            <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border text-sm" data-testid="copilot-preview">
              {aConfirmer?.changements.map((c) => (
                <div key={c.vehiculeId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="font-medium">{c.unite}</span>
                  <span className="text-muted-foreground text-right">
                    {c.anneeAvant !== c.anneeApres && (
                      <>
                        {c.anneeAvant ?? "—"} → <span className="text-foreground font-medium">{c.anneeApres}</span>
                      </>
                    )}
                    {c.anneeAvant !== c.anneeApres && (c.cibleAvant ?? null) !== c.cibleApres && " · "}
                    {(c.cibleAvant ?? null) !== c.cibleApres && (
                      <>
                        {cible(c.cibleAvant)} → <span className="text-foreground font-medium">{cible(c.cibleApres)}</span>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("journey.strategies.apply.logged")}</p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAConfirmer(null)} disabled={application}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void confirmer()} disabled={application}>
                {application ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {t("copilot.confirm", { count: aConfirmer?.changements.length ?? 0 })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
