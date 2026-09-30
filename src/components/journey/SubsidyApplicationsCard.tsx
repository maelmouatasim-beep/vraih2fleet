/**
 * C5 — Suivi des demandes de subvention par programme : statut
 * (à préparer → déposée → accordée → reçue), montants, dates, et
 * échéance reliée à la tâche générée du plan (sinon date de fin du
 * programme du registre).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useSubsidyApplications } from "@/hooks/useSubsidyApplications";
import {
  STATUTS_DEMANDE,
  echeancesDemandes,
  nomProgramme,
  type StatutDemande,
} from "@/lib/journey/financing";
import type { SubsidyApplicationRow } from "@/lib/supabase/subsidyApplications";
import { PROGRAMMES } from "@/lib/tco";
import { formateurCad } from "@/lib/format";
import { CalendarClock, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { nomCourtProgramme } from "@/lib/tco/translations-en";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface SubsidyApplicationsCardProps {
  projectId: string;
  vehicules: { vehicleId: string; unite: string }[];
}

const BADGE_STATUT: Record<StatutDemande, "outline" | "secondary" | "default"> = {
  a_preparer: "outline",
  deposee: "secondary",
  accordee: "default",
  recue: "default",
};

interface FormulaireDemande {
  programId: string;
  label: string;
  vehicleId: string;
  amountRequested: string;
}

interface EditionDemande {
  id: string;
  amountRequested: string;
  amountAwarded: string;
  submittedDate: string;
  decisionDate: string;
  receivedDate: string;
  notes: string;
}

const FORME_VIDE: FormulaireDemande = { programId: "", label: "", vehicleId: "", amountRequested: "" };

export default function SubsidyApplicationsCard({ projectId, vehicules }: SubsidyApplicationsCardProps) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language === "en" ? "en" : "fr";
  const { applications, tachesSubvention, isLoading, creer, modifier, supprimer } =
    useSubsidyApplications(projectId);
  const [forme, setForme] = useState<FormulaireDemande>({ ...FORME_VIDE });
  const [edition, setEdition] = useState<EditionDemande | null>(null);

  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);
  const uniteDe = useMemo(
    () => new Map(vehicules.map((v) => [v.vehicleId, v.unite])),
    [vehicules],
  );

  const echeances = useMemo(
    () =>
      echeancesDemandes(
        applications.map((a) => ({
          id: a.id,
          program_id: a.program_id,
          label: a.label,
          vehicle_id: a.vehicle_id,
          status: a.status as StatutDemande,
        })),
        tachesSubvention,
      ),
    [applications, tachesSubvention],
  );

  const nombre = (s: string): number | null => {
    if (!s.trim()) return null;
    const n = Number(s.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };

  const ajouter = async () => {
    const montant = nombre(forme.amountRequested);
    if (Number.isNaN(montant)) {
      toast({ title: t("journey.applications.invalidAmount"), variant: "destructive" });
      return;
    }
    try {
      await creer.mutateAsync({
        project_id: projectId,
        program_id: forme.programId,
        label: forme.programId === "autre" ? forme.label.trim() || null : null,
        vehicle_id: forme.vehicleId || null,
        amount_requested: montant,
      });
      toast({ title: t("journey.applications.toast.added") });
      setForme({ ...FORME_VIDE });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const changerStatut = async (a: SubsidyApplicationRow, statut: StatutDemande) => {
    // les dates suivent le statut si elles sont encore vides
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const patch: Record<string, unknown> = { status: statut };
    if (statut === "deposee" && !a.submitted_date) patch.submitted_date = aujourdHui;
    if (statut === "accordee" && !a.decision_date) patch.decision_date = aujourdHui;
    if (statut === "recue" && !a.received_date) patch.received_date = aujourdHui;
    try {
      await modifier.mutateAsync({ id: a.id, patch });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const ouvrirEdition = (a: SubsidyApplicationRow) => {
    setEdition({
      id: a.id,
      amountRequested: a.amount_requested != null ? String(a.amount_requested) : "",
      amountAwarded: a.amount_awarded != null ? String(a.amount_awarded) : "",
      submittedDate: a.submitted_date ?? "",
      decisionDate: a.decision_date ?? "",
      receivedDate: a.received_date ?? "",
      notes: a.notes ?? "",
    });
  };

  const enregistrerEdition = async () => {
    if (!edition) return;
    const demande = nombre(edition.amountRequested);
    const accorde = nombre(edition.amountAwarded);
    if (Number.isNaN(demande) || Number.isNaN(accorde)) {
      toast({ title: t("journey.applications.invalidAmount"), variant: "destructive" });
      return;
    }
    try {
      await modifier.mutateAsync({
        id: edition.id,
        patch: {
          amount_requested: demande,
          amount_awarded: accorde,
          submitted_date: edition.submittedDate || null,
          decision_date: edition.decisionDate || null,
          received_date: edition.receivedDate || null,
          notes: edition.notes.trim() || null,
        },
      });
      toast({ title: t("journey.applications.toast.updated") });
      setEdition(null);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const totalAccorde = applications.reduce((s, a) => s + (a.amount_awarded ?? 0), 0);
  const totalRecu = applications
    .filter((a) => a.status === "recue")
    .reduce((s, a) => s + (a.amount_awarded ?? a.amount_requested ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="w-5 h-5" /> {t("journey.applications.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("journey.applications.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ajout d'une demande */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end rounded-md border border-border p-3">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="ap-prog" className="text-xs">{t("journey.applications.form.program")}</Label>
            <select
              id="ap-prog"
              className={selectCls}
              value={forme.programId}
              onChange={(e) => setForme({ ...forme, programId: e.target.value })}
            >
              <option value="">{t("journey.applications.form.chooseProgram")}</option>
              {PROGRAMMES.map((p) => (
                <option key={p.id} value={p.id}>{nomCourtProgramme(p.id, langue)}</option>
              ))}
              <option value="autre">{t("journey.applications.form.other")}</option>
            </select>
          </div>
          {forme.programId === "autre" && (
            <div className="space-y-1">
              <Label htmlFor="ap-label" className="text-xs">{t("journey.applications.form.label")}</Label>
              <Input
                id="ap-label"
                className="h-9"
                value={forme.label}
                onChange={(e) => setForme({ ...forme, label: e.target.value })}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="ap-veh" className="text-xs">{t("journey.applications.form.vehicle")}</Label>
            <select
              id="ap-veh"
              className={selectCls}
              value={forme.vehicleId}
              onChange={(e) => setForme({ ...forme, vehicleId: e.target.value })}
            >
              <option value="">{t("journey.applications.form.wholeProject")}</option>
              {vehicules.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>{v.unite}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ap-montant" className="text-xs">{t("journey.applications.form.amount")}</Label>
            <Input
              id="ap-montant"
              className="h-9"
              inputMode="decimal"
              value={forme.amountRequested}
              onChange={(e) => setForme({ ...forme, amountRequested: e.target.value })}
            />
          </div>
          <Button
            onClick={() => void ajouter()}
            disabled={creer.isPending || !forme.programId || (forme.programId === "autre" && !forme.label.trim())}
          >
            {creer.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {t("journey.applications.form.add")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("journey.applications.empty")}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("journey.applications.columns.program")}</TableHead>
                  <TableHead>{t("journey.applications.columns.vehicle")}</TableHead>
                  <TableHead>{t("journey.applications.columns.status")}</TableHead>
                  <TableHead className="text-right">{t("journey.applications.columns.requested")}</TableHead>
                  <TableHead className="text-right">{t("journey.applications.columns.awarded")}</TableHead>
                  <TableHead>{t("journey.applications.columns.deadline")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((a) => {
                  const echeance = echeances.get(a.id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {nomProgramme(a.program_id, a.label, langue)}
                        {(a.submitted_date || a.decision_date || a.received_date) && (
                          <p className="text-xs text-muted-foreground font-normal">
                            {[
                              a.submitted_date &&
                                t("journey.applications.dates.submitted", { date: a.submitted_date }),
                              a.decision_date &&
                                t("journey.applications.dates.decided", { date: a.decision_date }),
                              a.received_date &&
                                t("journey.applications.dates.received", { date: a.received_date }),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {a.vehicle_id
                          ? uniteDe.get(a.vehicle_id) ?? "?"
                          : t("journey.applications.wholeProjectShort")}
                      </TableCell>
                      <TableCell>
                        <select
                          className={selectCls}
                          aria-label={t("journey.applications.columns.status")}
                          value={a.status}
                          onChange={(e) => void changerStatut(a, e.target.value as StatutDemande)}
                        >
                          {STATUTS_DEMANDE.map((s) => (
                            <option key={s} value={s}>{t(`journey.applications.statuses.${s}`)}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-right">
                        {a.amount_requested != null ? argent.format(a.amount_requested) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.amount_awarded != null ? argent.format(a.amount_awarded) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {echeance?.date ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                            {echeance.date}
                            <Badge variant="outline" className="ml-1">
                              {t(`journey.applications.deadlineSource.${echeance.source}`)}
                            </Badge>
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => ouvrirEdition(a)}>
                            {t("common.edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void supprimer.mutateAsync(a.id)}
                            disabled={supprimer.isPending}
                            aria-label={t("common.delete")}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground">
              {t("journey.applications.totals", {
                awarded: argent.format(totalAccorde),
                received: argent.format(totalRecu),
              })}
            </p>
          </>
        )}
      </CardContent>

      {/* Édition des montants et des dates */}
      <Dialog open={edition !== null} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("journey.applications.edit.title")}</DialogTitle>
            <DialogDescription>{t("journey.applications.edit.subtitle")}</DialogDescription>
          </DialogHeader>
          {edition && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="ed-demande">{t("journey.applications.columns.requested")}</Label>
                <Input
                  id="ed-demande"
                  inputMode="decimal"
                  value={edition.amountRequested}
                  onChange={(e) => setEdition({ ...edition, amountRequested: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-accorde">{t("journey.applications.columns.awarded")}</Label>
                <Input
                  id="ed-accorde"
                  inputMode="decimal"
                  value={edition.amountAwarded}
                  onChange={(e) => setEdition({ ...edition, amountAwarded: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-depot">{t("journey.applications.edit.submittedDate")}</Label>
                <Input
                  id="ed-depot"
                  type="date"
                  value={edition.submittedDate}
                  onChange={(e) => setEdition({ ...edition, submittedDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-decision">{t("journey.applications.edit.decisionDate")}</Label>
                <Input
                  id="ed-decision"
                  type="date"
                  value={edition.decisionDate}
                  onChange={(e) => setEdition({ ...edition, decisionDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-recu">{t("journey.applications.edit.receivedDate")}</Label>
                <Input
                  id="ed-recu"
                  type="date"
                  value={edition.receivedDate}
                  onChange={(e) => setEdition({ ...edition, receivedDate: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="ed-notes">{t("journey.applications.edit.notes")}</Label>
                <Input
                  id="ed-notes"
                  value={edition.notes}
                  onChange={(e) => setEdition({ ...edition, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdition(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => void enregistrerEdition()} disabled={modifier.isPending}>
              {modifier.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
