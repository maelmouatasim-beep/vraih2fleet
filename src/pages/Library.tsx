/**
 * Bibliothèque (D2) : le registre COMPLET de ce que le moteur TCO utilise
 * réellement — hypothèses (valeur, plage, statut, source, date),
 * programmes de subvention (statut CALCULÉ), historique des prix
 * collectés — et les seules surcharges réellement lues par le moteur
 * (données client énergie/raccordement, subventions confirmées).
 * L'ancienne « Données personnalisées » n'était lue par aucun calcul :
 * elle est retirée du menu (route redirigée, aucune donnée supprimée).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Page, PageHeader } from "@/components/layout/Page";
import SubsidyWatchCard from "@/components/library/SubsidyWatchCard";
import CategoryDefaultsTab from "@/components/library/CategoryDefaultsTab";
import { lireCibleBibliotheque, type OngletBibliotheque } from "@/lib/library/liens";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LISTE_HYPOTHESES, PROGRAMMES, statutEffectif, type StatutHypothese } from "@/lib/tco";
import {
  filtrerHypotheses,
  formaterValeur,
  historiqueDiesel,
  resumeStatuts,
} from "@/lib/library/registry";
import { formateurCad, formateurNombre } from "@/lib/format";
import { ArrowRight, ExternalLink, Plug } from "lucide-react";
import { cumulProgramme, descriptionHypothese, nomProgramme } from "@/lib/tco/translations-en";
import { StatusBadge } from "@/components/layout/States";
import { ton, TON_PROGRAMME, TON_VERIFICATION } from "@/components/layout/tons";
import { StatCard, StatGrid } from "@/components/layout/StatCard";

const selectCls =
  "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

export default function Library() {
  const { t, i18n } = useTranslation();
  const langue = i18n.language.startsWith("en") ? "en" : "fr";
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState<StatutHypothese | "tous">("tous");
  // Lien profond depuis un chiffre (VAN, infrastructure, Faisabilité…) :
  // onglet, hypothèses ciblées (filtrées et surlignées), catégorie.
  const location = useLocation();
  const navigate = useNavigate();
  const cible = useMemo(() => lireCibleBibliotheque(location.search), [location.search]);
  const [onglet, setOnglet] = useState<OngletBibliotheque>(cible.onglet);
  useEffect(() => setOnglet(cible.onglet), [cible.onglet]);
  const ciblees = useMemo(() => new Set<string>(cible.ids), [cible.ids]);
  const premiereCible = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    if (cible.ids.length) premiereCible.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [cible.ids]);

  const resume = useMemo(() => resumeStatuts(LISTE_HYPOTHESES), []);
  const hypotheses = useMemo(() => {
    const filtrees = filtrerHypotheses(LISTE_HYPOTHESES, recherche, statut);
    return ciblees.size ? filtrees.filter((h) => ciblees.has(h.id)) : filtrees;
  }, [recherche, statut, ciblees]);
  const historique = useMemo(() => historiqueDiesel(), []);
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);
  const aujourdHui = new Date().toISOString().slice(0, 10);

  const badgeStatut = (s: StatutHypothese) => (
    <StatusBadge ton={ton(TON_VERIFICATION, s)}>{t(`library.status.${s}`)}</StatusBadge>
  );

  return (
    <DashboardLayout>
      <Page>
        <PageHeader titre={t("library.title")} sousTitre={t("library.subtitleRegistry")} />

        <StatGrid>
          {(
            [
              ["total", resume.total],
              ["verifie", resume.verifie],
              ["estimation", resume.estimation],
              ["a_valider", resume.a_valider],
            ] as const
          ).map(([cle, valeur]) => (
          <StatCard key={cle} libelle={t(`library.counts.${cle}`)} valeur={valeur} />
          ))}
        </StatGrid>

        <Tabs value={onglet} onValueChange={(v) => setOnglet(v as OngletBibliotheque)}>
          <TabsList>
            <TabsTrigger value="hypotheses">{t("library.tabs.hypotheses")}</TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">{t("library.tabs.categories")}</TabsTrigger>
            <TabsTrigger value="programmes">{t("library.tabs.programs")}</TabsTrigger>
            <TabsTrigger value="historique">{t("library.tabs.history")}</TabsTrigger>
            <TabsTrigger value="surcharges">{t("library.tabs.overrides")}</TabsTrigger>
            <TabsTrigger value="veille" data-testid="tab-watch">{t("library.tabs.watch")}</TabsTrigger>
          </TabsList>

          <TabsContent value="hypotheses" className="space-y-3">
            {ciblees.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm" data-testid="library-target">
                <span>{t("library.target.shown", { count: ciblees.size })}</span>
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/library")}>
                  {t("library.target.showAll")}
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-xs"
                placeholder={t("library.search")}
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
              <select
                className={selectCls}
                aria-label={t("library.filterStatus")}
                value={statut}
                onChange={(e) => setStatut(e.target.value as StatutHypothese | "tous")}
              >
                <option value="tous">{t("library.allStatuses")}</option>
                <option value="verifie">{t("library.status.verifie")}</option>
                <option value="estimation">{t("library.status.estimation")}</option>
                <option value="a_valider">{t("library.status.a_valider")}</option>
              </select>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("library.columns.hypothesis")}</TableHead>
                      <TableHead className="text-right">{t("library.columns.value")}</TableHead>
                      <TableHead className="text-right">{t("library.columns.range")}</TableHead>
                      <TableHead>{t("library.columns.status")}</TableHead>
                      <TableHead>{t("library.columns.source")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hypotheses.map((h, i) => (
                      <TableRow
                        key={h.id}
                        id={`hyp-${h.id}`}
                        ref={i === 0 && ciblees.has(h.id) ? premiereCible : undefined}
                        data-testid={`library-hypothesis-${h.id}`}
                        className={cn(ciblees.has(h.id) && "bg-primary/5")}
                      >
                        <TableCell className="max-w-md">
                          <p className="font-medium text-sm">{descriptionHypothese(h.id, langue)}</p>
                          <p className="text-xs text-muted-foreground font-mono">{h.id}</p>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formaterValeur(h.valeur, h.unite, i18n.language)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap text-xs text-muted-foreground">
                          {formaterValeur(h.plage.basse, h.unite, i18n.language)} –{" "}
                          {formaterValeur(h.plage.haute, h.unite, i18n.language)}
                        </TableCell>
                        <TableCell>{badgeStatut(h.statut)}</TableCell>
                        <TableCell className="text-xs">
                          <a
                            href={h.source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
                          >
                            {h.source.organisme} <ExternalLink className="w-3 h-3" />
                          </a>
                          <p className="text-muted-foreground">
                            {t("library.checkedOn", { date: h.dateVerification })}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {hypotheses.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("library.noMatch")}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <CategoryDefaultsTab categorie={cible.categorie} colonne={cible.colonne} />
          </TabsContent>

          <TabsContent value="programmes" className="space-y-3">
            {PROGRAMMES.map((prog) => {
              const statutProg = statutEffectif(prog, aujourdHui);
              const plafondMax = Math.max(...prog.baremes.map((b) => b.plafondParVehicule), 0);
              return (
                <Card key={prog.id}>
                  <CardContent className="py-4 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">{nomProgramme(prog.id, langue)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge ton={ton(TON_PROGRAMME, statutProg)}>
                          {t(`journey.financing.status.${statutProg}`, { date: prog.dateFin })}
                        </StatusBadge>
                        {badgeStatut(prog.statutVerification)}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {plafondMax > 0 && (
                        <p>{t("journey.financing.maxPerVehicle", { amount: argent.format(plafondMax) })}</p>
                      )}
                      <p>{cumulProgramme(prog.id, langue)}</p>
                      {prog.dateFin && <p>{t("journey.financing.until", { date: prog.dateFin })}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{t("library.checkedOn", { date: prog.dateVerification })}</span>
                      <a
                        href={prog.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
                      >
                        {prog.source.organisme} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="veille">
            <SubsidyWatchCard />
          </TabsContent>

          <TabsContent value="historique">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("library.history.title")}</CardTitle>
                <CardDescription>
                  {t("library.history.subtitle", {
                    version: historique.versionDonnees,
                    date: historique.dateVerification,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("library.history.month")}</TableHead>
                      <TableHead className="text-right">{t("library.history.quebec")}</TableHead>
                      <TableHead className="text-right">{t("library.history.montreal")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historique.points.map((p) => (
                      <TableRow key={p.mois}>
                        <TableCell>{p.mois}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formateurNombre(i18n.language, 1).format(p.quebec)}{"\u00a0¢"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formateurNombre(i18n.language, 1).format(p.montreal)}{"\u00a0¢"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-6 py-3 text-xs text-muted-foreground space-y-1 border-t border-border">
                  <p>
                    <a
                      href={historique.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      {historique.source.organisme} <ExternalLink className="w-3 h-3" />
                    </a>{" "}
                    — {t("library.history.archive", { path: historique.source.archive })}
                  </p>
                  <p>{t("library.history.note")}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="surcharges" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("library.overrides.title")}</CardTitle>
                <CardDescription>{t("library.overrides.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                  <div>
                    <p className="font-medium">{t("library.overrides.energy.title")}</p>
                    <p className="text-muted-foreground">{t("library.overrides.energy.description")}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dashboard/organization">
                      {t("library.overrides.energy.action")} <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                  <div>
                    <p className="font-medium">{t("library.overrides.subsidies.title")}</p>
                    <p className="text-muted-foreground">{t("library.overrides.subsidies.description")}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dashboard/projects">
                      {t("library.overrides.subsidies.action")} <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                  <div>
                    <p className="font-medium flex items-center gap-1">
                      <Plug className="w-4 h-4" /> {t("library.overrides.telematics.title")}
                    </p>
                    <p className="text-muted-foreground">{t("library.overrides.telematics.description")}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dashboard/telematics">
                      {t("library.overrides.telematics.action")} <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Page>
    </DashboardLayout>
  );
}
