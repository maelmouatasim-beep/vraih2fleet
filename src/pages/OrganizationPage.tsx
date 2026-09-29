import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
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
import EnergyClientDataCard from "@/components/organization/EnergyClientDataCard";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import {
  deleteOrganization,
  getOrganizationDeletionEffects,
  listOrganizationMembers,
  updateOrganization,
} from "@/lib/supabase/organizations";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Building2, Loader2, Users } from "lucide-react";

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Organisation (menu 6 entrées) : identité de l'organisme (le type
 *  pilote les taxes récupérables du moteur TCO) et liste des membres.
 *  Invitations et gestion fine des rôles : Phase 3. */
export default function OrganizationPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { organization, organizations, changerOrganisation, isLoading, refetch } = useOrganization();
  const estAdmin = organization?.myRole === "admin";

  const [forme, setForme] = useState({ name: "", orgType: "municipalite", region: "CA_QC" });
  const [enregistrement, setEnregistrement] = useState(false);
  const [nomConfirme, setNomConfirme] = useState("");
  const [effets, setEffets] = useState<{ vehicules: number; projets: number; membres: number } | null>(null);
  const [suppression, setSuppression] = useState(false);

  useEffect(() => {
    if (organization) {
      setForme({ name: organization.name, orgType: organization.orgType, region: organization.region });
    }
  }, [organization]);

  const { data: membres = [] } = useQuery({
    queryKey: ["organization-members", organization?.id],
    queryFn: () => listOrganizationMembers(organization!.id),
    enabled: !!organization?.id,
  });

  const chargerEffets = async () => {
    if (!organization) return;
    try {
      setEffets(await getOrganizationDeletionEffects(organization.id));
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const supprimerOrganisation = async () => {
    if (!organization || !user || nomConfirme.trim() !== organization.name) return;
    setSuppression(true);
    try {
      await deleteOrganization(organization.id);
      // B6 : un utilisateur a toujours une organisation — on en recrée
      // une vide immédiatement (le trigger le rend admin).
      await supabase.from("organizations").insert({ name: t("organization.danger.newOrgName"), created_by: user.id });
      setNomConfirme("");
      setEffets(null);
      await refetch();
      toast({ title: t("organization.danger.deleted") });
    } catch (e) {
      toast({
        title: t("common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setSuppression(false);
    }
  };

  const enregistrer = async () => {
    if (!organization) return;
    setEnregistrement(true);
    try {
      await updateOrganization(organization.id, {
        name: forme.name.trim() || organization.name,
        orgType: forme.orgType as "municipalite" | "societe_transport" | "entreprise",
        region: forme.region,
      });
      await refetch();
      toast({ title: t("organization.toast.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6" /> {t("organization.title")}
          </h1>
          <p className="text-muted-foreground">{t("organization.subtitle")}</p>
        </div>

        {organizations.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("organization.switcher.title")}</CardTitle>
              <CardDescription>{t("organization.switcher.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <select
                aria-label={t("organization.switcher.title")}
                className={selectCls + " max-w-md"}
                value={organization?.id ?? ""}
                onChange={(e) => changerOrganisation.mutate(e.target.value)}
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({t(`organization.roles.${o.myRole}`)})
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("organization.identity.title")}</CardTitle>
            <CardDescription>{t("organization.identity.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">{t("organization.identity.name")}</Label>
                    <Input
                      id="org-name"
                      value={forme.name}
                      disabled={!estAdmin}
                      onChange={(e) => setForme({ ...forme, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-type">{t("organization.identity.type")}</Label>
                    <select
                      id="org-type"
                      className={selectCls}
                      value={forme.orgType}
                      disabled={!estAdmin}
                      onChange={(e) => setForme({ ...forme, orgType: e.target.value })}
                    >
                      <option value="municipalite">{t("organization.types.municipalite")}</option>
                      <option value="societe_transport">{t("organization.types.societe_transport")}</option>
                      <option value="entreprise">{t("organization.types.entreprise")}</option>
                    </select>
                    <p className="text-xs text-muted-foreground">{t("organization.identity.typeHint")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-region">{t("organization.identity.region")}</Label>
                    <select
                      id="org-region"
                      className={selectCls}
                      value={forme.region}
                      disabled={!estAdmin}
                      onChange={(e) => setForme({ ...forme, region: e.target.value })}
                    >
                      <option value="CA_QC">{t("settings.regions.ca_qc")}</option>
                      <option value="CA_ON">{t("settings.regions.ca_on")}</option>
                      <option value="CA_BC">{t("settings.regions.ca_bc")}</option>
                      <option value="CA_AB">{t("settings.regions.ca_ab")}</option>
                      <option value="CA">{t("settings.regions.ca")}</option>
                    </select>
                  </div>
                </div>
                {estAdmin && (
                  <Button onClick={enregistrer} disabled={enregistrement}>
                    {enregistrement ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {t("organization.identity.save")}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <EnergyClientDataCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> {t("organization.members.title")}
            </CardTitle>
            <CardDescription>{t("organization.members.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("organization.members.member")}</TableHead>
                  <TableHead>{t("organization.members.role")}</TableHead>
                  <TableHead>{t("organization.members.since")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membres.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.userId}</TableCell>
                    <TableCell>
                      <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                        {t(`organization.roles.${m.role}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(m.createdAt).toLocaleDateString("fr-CA")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {estAdmin && organization && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="w-5 h-5" /> {t("organization.danger.title")}
              </CardTitle>
              <CardDescription>{t("organization.danger.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {effets === null ? (
                <Button variant="outline" size="sm" onClick={chargerEffets}>
                  {t("organization.danger.showEffects")}
                </Button>
              ) : (
                <>
                  <p className="text-sm font-medium text-destructive">
                    {t("organization.danger.effects", {
                      vehicules: effets.vehicules,
                      projets: effets.projets,
                      membres: effets.membres,
                    })}
                  </p>
                  <div className="space-y-2 max-w-md">
                    <Label htmlFor="org-delete-confirm">
                      {t("organization.danger.typeName", { name: organization.name })}
                    </Label>
                    <Input
                      id="org-delete-confirm"
                      value={nomConfirme}
                      onChange={(e) => setNomConfirme(e.target.value)}
                      placeholder={organization.name}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={nomConfirme.trim() !== organization.name || suppression}
                    onClick={supprimerOrganisation}
                  >
                    {suppression ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {t("organization.danger.confirm")}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
