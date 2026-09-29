/**
 * Subventions CONFIRMÉES par le client (étape Financement) : pour les
 * programmes non chiffrables automatiquement (PAGTCP, FTCZE, % à
 * valider…), le client saisit le montant confirmé AVEC la référence du
 * document. Le moteur l'utilise en priorité (remplace la subvention
 * résolue du même programme) et le rapport la marque « confirmée par
 * le client (réf. …) ».
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useConfirmedSubsidies } from "@/hooks/useConfirmedSubsidies";
import { libelleCourtProgramme } from "@/lib/confirmedSubsidies";
import { PROGRAMMES } from "@/lib/tco";
import { BadgeCheck, Loader2, Trash2 } from "lucide-react";

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface ConfirmedSubsidiesCardProps {
  projectId: string;
  vehicules: { vehicleId: string; unite: string }[];
}

export default function ConfirmedSubsidiesCard({ projectId, vehicules }: ConfirmedSubsidiesCardProps) {
  const { t, i18n } = useTranslation();
  const { lignes, ajouter, retirer } = useConfirmedSubsidies(projectId);
  const uniteParId = new Map(vehicules.map((v) => [v.vehicleId, v.unite]));

  const [forme, setForme] = useState({
    vehicleId: "",
    programId: "pagtcp",
    label: "",
    montant: "",
    annee: "",
    reference: "",
  });

  const programmesVehicule = PROGRAMMES.filter((p) => p.cible === "vehicule");

  const enregistrer = async () => {
    const montant = Number(forme.montant.replace(",", "."));
    const annee = forme.annee.trim() === "" ? null : Number(forme.annee);
    if (!forme.vehicleId || !Number.isFinite(montant) || montant <= 0 || !forme.reference.trim()) {
      toast({ title: t("confirmedSubsidies.invalid"), variant: "destructive" });
      return;
    }
    if (annee !== null && (!Number.isInteger(annee) || annee < 2000 || annee > 2100)) {
      toast({ title: t("confirmedSubsidies.invalidYear"), variant: "destructive" });
      return;
    }
    try {
      await ajouter.mutateAsync({
        project_id: projectId,
        vehicle_id: forme.vehicleId,
        program_id: forme.programId,
        label: forme.programId === "autre" ? forme.label.trim() || null : null,
        amount: montant,
        payment_year: annee,
        document_reference: forme.reference.trim(),
      });
      setForme({ ...forme, montant: "", annee: "", reference: "", label: "" });
      toast({ title: t("confirmedSubsidies.saved") });
    } catch (e) {
      toast({
        title: t("common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BadgeCheck className="w-5 h-5" /> {t("confirmedSubsidies.title")}
        </CardTitle>
        <CardDescription>{t("confirmedSubsidies.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lignes.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("fleet.columns.unit")}</TableHead>
                <TableHead>{t("confirmedSubsidies.columns.program")}</TableHead>
                <TableHead className="text-right">{t("confirmedSubsidies.columns.amount")}</TableHead>
                <TableHead>{t("confirmedSubsidies.columns.year")}</TableHead>
                <TableHead>{t("confirmedSubsidies.columns.reference")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{uniteParId.get(l.vehicle_id) ?? "—"}</TableCell>
                  <TableCell>
                    {libelleCourtProgramme(l.program_id, l.label)}{" "}
                    <Badge variant="secondary">{t("confirmedSubsidies.confirmed")}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {l.amount.toLocaleString(i18n.language.startsWith("fr") ? "fr-CA" : "en-CA", {
                      style: "currency",
                      currency: "CAD",
                      maximumFractionDigits: 0,
                    })}
                  </TableCell>
                  <TableCell>{l.payment_year ?? t("confirmedSubsidies.purchaseYear")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.document_reference}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("common.delete")}
                      onClick={() => retirer.mutate(l.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cs-vehicule">{t("confirmedSubsidies.form.vehicle")}</Label>
            <select
              id="cs-vehicule"
              className={selectCls}
              value={forme.vehicleId}
              onChange={(e) => setForme({ ...forme, vehicleId: e.target.value })}
            >
              <option value="">—</option>
              {vehicules.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>
                  {v.unite}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-programme">{t("confirmedSubsidies.form.program")}</Label>
            <select
              id="cs-programme"
              className={selectCls}
              value={forme.programId}
              onChange={(e) => setForme({ ...forme, programId: e.target.value })}
            >
              {programmesVehicule.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom.split("—")[0].trim()}
                </option>
              ))}
              <option value="autre">{t("confirmedSubsidies.form.other")}</option>
            </select>
          </div>
          {forme.programId === "autre" && (
            <div className="space-y-1.5">
              <Label htmlFor="cs-libelle">{t("confirmedSubsidies.form.label")}</Label>
              <Input
                id="cs-libelle"
                value={forme.label}
                onChange={(e) => setForme({ ...forme, label: e.target.value })}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cs-montant">{t("confirmedSubsidies.form.amount")}</Label>
            <Input
              id="cs-montant"
              inputMode="decimal"
              value={forme.montant}
              onChange={(e) => setForme({ ...forme, montant: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-annee">{t("confirmedSubsidies.form.year")}</Label>
            <Input
              id="cs-annee"
              inputMode="numeric"
              placeholder={t("confirmedSubsidies.purchaseYear")}
              value={forme.annee}
              onChange={(e) => setForme({ ...forme, annee: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-reference">{t("confirmedSubsidies.form.reference")}</Label>
            <Input
              id="cs-reference"
              placeholder={t("confirmedSubsidies.form.referencePlaceholder")}
              value={forme.reference}
              onChange={(e) => setForme({ ...forme, reference: e.target.value })}
            />
          </div>
        </div>
        <Button onClick={enregistrer} disabled={ajouter.isPending} size="sm">
          {ajouter.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {t("confirmedSubsidies.form.save")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("confirmedSubsidies.priorityNote")}</p>
      </CardContent>
    </Card>
  );
}
