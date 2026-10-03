/**
 * Garages de l'organisation (test terrain, bloc 2.1) — page « Ma flotte ».
 * Puissance disponible, tarif HQ, fenêtre de recharge et devis alimentent
 * le dimensionnement des bornes et du raccordement du parcours.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useGarages } from "@/hooks/useGarages";
import { heuresFenetre, TARIFS_HQ, type GarageRow } from "@/lib/fleet/garages";
import { cleGarage } from "@/lib/journey/infrastructure";
import { formateurCad } from "@/lib/format";
import { Plus, Pencil, Trash2, Warehouse } from "lucide-react";

interface GaragesCardProps {
  organizationId: string | undefined;
  /** Dépôts des véhicules (pour compter les véhicules par garage). */
  depots: (string | null)[];
}

const VIDE = {
  name: "",
  address: "",
  available_power_kw: "",
  hq_rate: "",
  return_time: "",
  departure_time: "",
  parking_spots: "",
  grid_connection_quote: "",
};

const nombre = (s: string): number | null => {
  const v = s.replace(/\s/g, "").replace(",", ".");
  return v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
};

export default function GaragesCard({ organizationId, depots }: GaragesCardProps) {
  const { t, i18n } = useTranslation();
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);
  const { garages, creer, modifier, supprimer } = useGarages(organizationId);
  const [edition, setEdition] = useState<GarageRow | "nouveau" | null>(null);
  const [forme, setForme] = useState({ ...VIDE });
  const [suppression, setSuppression] = useState<GarageRow | null>(null);

  const vehiculesParGarage = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of depots) if (d) m.set(cleGarage(d), (m.get(cleGarage(d)) ?? 0) + 1);
    return m;
  }, [depots]);

  const ouvrir = (g: GarageRow | "nouveau") => {
    setForme(
      g === "nouveau"
        ? { ...VIDE }
        : {
            name: g.name,
            address: g.address ?? "",
            available_power_kw: g.available_power_kw != null ? String(g.available_power_kw) : "",
            hq_rate: g.hq_rate ?? "",
            return_time: g.return_time?.slice(0, 5) ?? "",
            departure_time: g.departure_time?.slice(0, 5) ?? "",
            parking_spots: g.parking_spots != null ? String(g.parking_spots) : "",
            grid_connection_quote: g.grid_connection_quote != null ? String(g.grid_connection_quote) : "",
          },
    );
    setEdition(g);
  };

  const enregistrer = async () => {
    if (!organizationId || !forme.name.trim()) return;
    const valeurs = {
      name: forme.name.trim(),
      address: forme.address.trim() || null,
      available_power_kw: nombre(forme.available_power_kw),
      hq_rate: forme.hq_rate || null,
      return_time: forme.return_time || null,
      departure_time: forme.departure_time || null,
      parking_spots: nombre(forme.parking_spots),
      grid_connection_quote: nombre(forme.grid_connection_quote),
    };
    try {
      if (edition === "nouveau") await creer.mutateAsync({ ...valeurs, organization_id: organizationId });
      else if (edition) await modifier.mutateAsync({ id: edition.id, patch: valeurs });
      toast({ title: t("fleet.garages.saved") });
      setEdition(null);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const confirmerSuppression = async () => {
    if (!suppression) return;
    try {
      await supprimer.mutateAsync(suppression.id);
      toast({ title: t("fleet.garages.deleted") });
      setSuppression(null);
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const champ = (cle: keyof typeof VIDE, type = "text", placeholder?: string) => (
    <div className="space-y-1">
      <Label htmlFor={`garage-${cle}`}>{t(`fleet.garages.fields.${cle}`)}</Label>
      <Input
        id={`garage-${cle}`}
        type={type}
        inputMode={type === "text" && placeholder ? "decimal" : undefined}
        placeholder={placeholder}
        value={forme[cle]}
        onChange={(e) => setForme({ ...forme, [cle]: e.target.value })}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Warehouse className="w-5 h-5" /> {t("fleet.garages.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("fleet.garages.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => ouvrir("nouveau")} disabled={!organizationId}>
          <Plus className="w-4 h-4 mr-1" /> {t("fleet.garages.add")}
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {garages.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 pb-6">{t("fleet.garages.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("fleet.garages.fields.name")}</TableHead>
                <TableHead className="text-right">{t("fleet.garages.columns.vehicles")}</TableHead>
                <TableHead className="text-right">{t("fleet.garages.fields.available_power_kw")}</TableHead>
                <TableHead>{t("fleet.garages.fields.hq_rate")}</TableHead>
                <TableHead>{t("fleet.garages.columns.window")}</TableHead>
                <TableHead className="text-right">{t("fleet.garages.fields.parking_spots")}</TableHead>
                <TableHead className="text-right">{t("fleet.garages.fields.grid_connection_quote")}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {garages.map((g) => {
                const h = heuresFenetre(g.return_time, g.departure_time);
                return (
                  <TableRow key={g.id}>
                    <TableCell>
                      <p className="font-medium">{g.name}</p>
                      {g.address && <p className="text-xs text-muted-foreground">{g.address}</p>}
                    </TableCell>
                    <TableCell className="text-right">{vehiculesParGarage.get(cleGarage(g.name)) ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {g.available_power_kw != null ? (
                        `${g.available_power_kw} kW`
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">{t("fleet.garages.unknownPower")}</span>
                      )}
                    </TableCell>
                    <TableCell>{g.hq_rate ? t(`fleet.garages.rates.${g.hq_rate}`) : "—"}</TableCell>
                    <TableCell>
                      {h != null
                        ? t("fleet.garages.windowValue", {
                            retour: g.return_time!.slice(0, 5),
                            depart: g.departure_time!.slice(0, 5),
                            heures: h,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">{g.parking_spots ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {g.grid_connection_quote != null ? argent.format(g.grid_connection_quote) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => ouvrir(g)} aria-label={t("common.edit")}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setSuppression(g)} aria-label={t("common.delete")}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={edition !== null} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{edition === "nouveau" ? t("fleet.garages.add") : t("fleet.garages.edit")}</DialogTitle>
            <DialogDescription>{t("fleet.garages.dialogSubtitle")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div className="sm:col-span-2">{champ("name")}</div>
            <div className="sm:col-span-2">{champ("address")}</div>
            {champ("available_power_kw", "text", "kW")}
            <div className="space-y-1">
              <Label>{t("fleet.garages.fields.hq_rate")}</Label>
              <Select value={forme.hq_rate} onValueChange={(v) => setForme({ ...forme, hq_rate: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {TARIFS_HQ.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`fleet.garages.rates.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {champ("return_time", "time")}
            {champ("departure_time", "time")}
            {champ("parking_spots", "text", "0")}
            {champ("grid_connection_quote", "text", "$")}
          </div>
          <p className="text-xs text-muted-foreground">{t("fleet.garages.powerHelp")}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdition(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void enregistrer()} disabled={!forme.name.trim()}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suppression !== null} onOpenChange={(o) => !o && setSuppression(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("fleet.garages.deleteTitle", { name: suppression?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("fleet.garages.deleteSubtitle")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuppression(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void confirmerSuppression()}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
