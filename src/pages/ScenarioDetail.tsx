import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Calculator,
  Download,
  Settings,
  TrendingUp,
  Leaf,
  Zap,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PDFDownloadButton } from "@/components/reports";
import {
  mockScenarios,
  mockVehicleGroups,
  mockScenarioConfigs,
  mockProjects,
} from "@/data/mockData";
import { computeScenarioResults, formatCurrency, formatCO2 } from "@/lib/calculations";
import { toast } from "@/hooks/use-toast";
import type { ScenarioVehicleGroupConfig, TargetPowertrain, ScenarioResults } from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  AreaChart,
  Area,
} from "recharts";

const powertrainOptions: { value: TargetPowertrain; label: string }[] = [
  { value: "keep_diesel", label: "Conserver diesel" },
  { value: "bev", label: "Électrique (BEV)" },
  { value: "fuel_cell_h2", label: "Hydrogène (H₂)" },
  { value: "mixed", label: "Mix BEV + H₂" },
];

const ScenarioDetail = () => {
  const { scenarioId } = useParams();
  const { t } = useTranslation();
  const scenario = mockScenarios.find((s) => s.id === scenarioId);
  const project = scenario ? mockProjects.find((p) => p.id === scenario.projectId) : null;
  const vehicleGroups = project
    ? mockVehicleGroups.filter((vg) => vg.projectId === project.id)
    : [];

  const [configs, setConfigs] = useState<ScenarioVehicleGroupConfig[]>(() => {
    // Initialize configs for each vehicle group
    return vehicleGroups.map((vg) => {
      const existing = mockScenarioConfigs.find(
        (c) => c.scenarioId === scenarioId && c.vehicleGroupId === vg.id
      );
      return (
        existing || {
          id: `cfg-${vg.id}`,
          scenarioId: scenarioId || "",
          vehicleGroupId: vg.id,
          targetPowertrain: "keep_diesel" as TargetPowertrain,
          conversionYear: new Date().getFullYear() + 2,
          newVehicleCapexPerUnit: 200000,
          hydrogenConsumptionKgPer100km: 8,
          electricityConsumptionKwhPer100km: 100,
          hydrogenPricePerKg: 7,
          electricityPricePerKwh: 0.18,
          subsidyPerVehicle: 30000,
          maintenanceCostPerYearPerVehicleNew: 5000,
        }
      );
    });
  });

  const [results, setResults] = useState<ScenarioResults | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleConfigChange = (
    vehicleGroupId: string,
    field: keyof ScenarioVehicleGroupConfig,
    value: string | number
  ) => {
    setConfigs((prev) =>
      prev.map((c) => (c.vehicleGroupId === vehicleGroupId ? { ...c, [field]: value } : c))
    );
    setResults(null); // Clear results when config changes
  };

  const handleCalculate = () => {
    if (!scenario) return;
    setIsCalculating(true);

    // Simulate calculation delay
    setTimeout(() => {
      const calculatedResults = computeScenarioResults({
        scenario,
        vehicleGroups,
        configs,
      });
      setResults(calculatedResults);
      setIsCalculating(false);
      toast({
        title: "Calcul terminé",
        description: "Les résultats du scénario ont été calculés.",
      });
    }, 500);
  };

  // PDF export is now handled by PDFDownloadButton component

  const handleExportCSV = () => {
    if (!results) return;

    // Create CSV content
    const headers = ["Année", "CAPEX", "OPEX", "Coût total", "CO2 (t)", "Véhicules diesel", "Véhicules BEV", "Véhicules H2"];
    const rows = results.yearlyData.map((y) => [
      y.year,
      y.capex.toFixed(0),
      y.opexTotal.toFixed(0),
      y.totalCost.toFixed(0),
      y.co2Tonnes.toFixed(1),
      y.vehiclesDiesel,
      y.vehiclesBev,
      y.vehiclesH2,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scenario?.name || "scenario"}_results.csv`;
    a.click();

    toast({
      title: "Export CSV",
      description: "Le fichier a été téléchargé.",
    });
  };

  if (!scenario || !project) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <h2 className="text-xl font-semibold mb-2">{t('common.scenarioNotFound', 'Scenario not found')}</h2>
          <Button asChild>
            <Link to="/dashboard/projects">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('common.backToHome', 'Back to projects')}
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/dashboard/projects/${project.id}`}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{scenario.name}</h1>
                {scenario.baseCaseFlag && <Badge variant="outline">Référence</Badge>}
              </div>
              <p className="text-muted-foreground">{scenario.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!results}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            {results && scenario && (
              <PDFDownloadButton
                scenario={{
                  id: scenarioId || '',
                  name: scenario.name,
                  region: scenario.countryOrRegion || 'Canada',
                  analysisYears: scenario.analysisHorizonYears || 10,
                  discountRate: scenario.discountRate || 0.04,
                  fleetComposition: {
                    diesel: { count: results.yearlyData[0]?.vehiclesDiesel || 0, annualKm: 50000 },
                    bev: { count: results.yearlyData[0]?.vehiclesBev || 0, annualKm: 50000 },
                    fcev: { count: results.yearlyData[0]?.vehiclesH2 || 0, annualKm: 50000 }
                  }
                }}
                results={{
                  scenarioId: scenarioId || '',
                  scenarioName: scenario.name,
                  tcoTotal: results.totals.totalCost,
                  capex: results.totals.totalCapex,
                  opexTotal: results.totals.totalOpex,
                  co2Total: results.totals.totalCo2Tonnes,
                  co2Savings: results.totals.co2AvoidedVsBaseline,
                  co2SavingsPercent: results.totals.totalCo2Tonnes > 0 
                    ? (results.totals.co2AvoidedVsBaseline / results.totals.totalCo2Tonnes) * 100 
                    : 0,
                  npv: results.totals.npv,
                  paybackPeriodYears: null,
                  tcoPerKm: results.totals.tcoPerKm,
                  residualValue: 0,
                  chargingStations: results.infrastructure.evChargersNeeded,
                  chargingStationsCost: 0,
                  h2Stations: results.infrastructure.h2StationsNeeded,
                  h2StationsCost: 0,
                  totalInfrastructureCost: 0,
                  yearlyBreakdown: results.yearlyData.map((yd, idx) => ({
                    year: yd.year,
                    capex: yd.capex,
                    opex: yd.opexTotal,
                    opexBreakdown: {
                      fuel: 0,
                      maintenance: 0,
                      insurance: 0,
                    },
                    advancedCosts: {
                      downtime: 0,
                      insurance: 0,
                      telematics: 0,
                      gridDemand: 0,
                      fcStackReplacement: 0,
                      carbonCredits: 0,
                    },
                    totalCost: yd.totalCost,
                    cumulativeCost: results.yearlyData.slice(0, idx + 1).reduce((sum, y) => sum + y.totalCost, 0),
                    co2: yd.co2Tonnes,
                    discountedCost: yd.totalCost
                  })),
                  byVehicleType: {
                    diesel: { count: 0, capex: 0, opex: 0, fuelCost: 0, maintenanceCost: 0, insuranceCost: 0, co2: 0 },
                    ev: { count: 0, capex: 0, opex: 0, fuelCost: 0, maintenanceCost: 0, insuranceCost: 0, co2: 0 },
                    hydrogen: { count: 0, capex: 0, opex: 0, fuelCost: 0, maintenanceCost: 0, insuranceCost: 0, co2: 0 }
                  }
                }}
                variant="outline"
                size="sm"
              />
            )}
            <Button onClick={handleCalculate} disabled={isCalculating} className="gap-2">
              <Calculator className="w-4 h-4" />
              {isCalculating ? "Calcul..." : "Calculer"}
            </Button>
          </div>
        </div>

        {/* Scenario parameters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Paramètres globaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Horizon d'analyse</Label>
                <p className="font-semibold">{scenario.analysisHorizonYears} ans</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Taux d'actualisation</Label>
                <p className="font-semibold">{(scenario.discountRate * 100).toFixed(1)}%</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Région</Label>
                <p className="font-semibold">{scenario.countryOrRegion}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Devise</Label>
                <p className="font-semibold">{project.currency}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle group configurations */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Configuration par groupe de véhicules</CardTitle>
            <CardDescription>
              Définissez la stratégie de transition pour chaque groupe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Groupe</TableHead>
                    <TableHead>Véhicules</TableHead>
                    <TableHead>Transition vers</TableHead>
                    <TableHead>Année</TableHead>
                    <TableHead>CAPEX/véh.</TableHead>
                    <TableHead>Subvention</TableHead>
                    <TableHead>Conso. énergie</TableHead>
                    <TableHead>Prix énergie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleGroups.map((vg) => {
                    const config = configs.find((c) => c.vehicleGroupId === vg.id);
                    if (!config) return null;

                    const isConverting = config.targetPowertrain !== "keep_diesel";
                    const isH2 =
                      config.targetPowertrain === "fuel_cell_h2" ||
                      config.targetPowertrain === "mixed";
                    const isBEV =
                      config.targetPowertrain === "bev" || config.targetPowertrain === "mixed";

                    return (
                      <TableRow key={vg.id}>
                        <TableCell className="font-medium">{vg.name}</TableCell>
                        <TableCell>{vg.count}</TableCell>
                        <TableCell>
                          <Select
                            value={config.targetPowertrain}
                            onValueChange={(v) =>
                              handleConfigChange(vg.id, "targetPowertrain", v)
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {powertrainOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-20"
                            min={currentYear}
                            max={currentYear + 20}
                            value={config.conversionYear}
                            onChange={(e) =>
                              handleConfigChange(
                                vg.id,
                                "conversionYear",
                                parseInt(e.target.value)
                              )
                            }
                            disabled={!isConverting}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-24"
                            value={config.newVehicleCapexPerUnit}
                            onChange={(e) =>
                              handleConfigChange(
                                vg.id,
                                "newVehicleCapexPerUnit",
                                parseInt(e.target.value)
                              )
                            }
                            disabled={!isConverting}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-24"
                            value={config.subsidyPerVehicle}
                            onChange={(e) =>
                              handleConfigChange(
                                vg.id,
                                "subsidyPerVehicle",
                                parseInt(e.target.value)
                              )
                            }
                            disabled={!isConverting}
                          />
                        </TableCell>
                        <TableCell>
                          {isH2 && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="w-16"
                                step="0.1"
                                value={config.hydrogenConsumptionKgPer100km || ""}
                                onChange={(e) =>
                                  handleConfigChange(
                                    vg.id,
                                    "hydrogenConsumptionKgPer100km",
                                    parseFloat(e.target.value)
                                  )
                                }
                              />
                              <span className="text-xs text-muted-foreground">kg/100km</span>
                            </div>
                          )}
                          {isBEV && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="w-16"
                                value={config.electricityConsumptionKwhPer100km || ""}
                                onChange={(e) =>
                                  handleConfigChange(
                                    vg.id,
                                    "electricityConsumptionKwhPer100km",
                                    parseFloat(e.target.value)
                                  )
                                }
                              />
                              <span className="text-xs text-muted-foreground">kWh/100km</span>
                            </div>
                          )}
                          {!isConverting && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isH2 && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="w-16"
                                step="0.1"
                                value={config.hydrogenPricePerKg || ""}
                                onChange={(e) =>
                                  handleConfigChange(
                                    vg.id,
                                    "hydrogenPricePerKg",
                                    parseFloat(e.target.value)
                                  )
                                }
                              />
                              <span className="text-xs text-muted-foreground">€/kg</span>
                            </div>
                          )}
                          {isBEV && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="w-16"
                                step="0.01"
                                value={config.electricityPricePerKwh || ""}
                                onChange={(e) =>
                                  handleConfigChange(
                                    vg.id,
                                    "electricityPricePerKwh",
                                    parseFloat(e.target.value)
                                  )
                                }
                              />
                              <span className="text-xs text-muted-foreground">€/kWh</span>
                            </div>
                          )}
                          {!isConverting && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <Tabs defaultValue="costs" className="space-y-4">
            <TabsList>
              <TabsTrigger value="costs" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Coûts & TCO
              </TabsTrigger>
              <TabsTrigger value="co2" className="gap-2">
                <Leaf className="w-4 h-4" />
                CO₂
              </TabsTrigger>
              <TabsTrigger value="energy" className="gap-2">
                <Zap className="w-4 h-4" />
                Énergie & Infra
              </TabsTrigger>
            </TabsList>

            {/* Costs Tab */}
            <TabsContent value="costs" className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">CAPEX total</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(results.totals.totalCapex, project.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">OPEX total</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(results.totals.totalOpex, project.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">NPV</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(results.totals.npv, project.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">TCO/km</p>
                    <p className="text-2xl font-bold">
                      {results.totals.tcoPerKm.toFixed(3)}€
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Cost chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Évolution des coûts annuels</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={results.yearlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number) =>
                            formatCurrency(value, project.currency)
                          }
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="capex"
                          name="CAPEX"
                          stackId="1"
                          fill="hsl(var(--chart-ev))"
                          stroke="hsl(var(--chart-ev))"
                        />
                        <Area
                          type="monotone"
                          dataKey="opexFuel"
                          name="Carburant/Énergie"
                          stackId="1"
                          fill="hsl(var(--chart-diesel))"
                          stroke="hsl(var(--chart-diesel))"
                        />
                        <Area
                          type="monotone"
                          dataKey="opexMaintenance"
                          name="Maintenance"
                          stackId="1"
                          fill="hsl(var(--chart-mixed))"
                          stroke="hsl(var(--chart-mixed))"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CO2 Tab */}
            <TabsContent value="co2" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">CO₂ total</p>
                    <p className="text-2xl font-bold">{formatCO2(results.totals.totalCo2Tonnes)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">CO₂ évité vs baseline</p>
                    <p className="text-2xl font-bold text-accent">
                      {results.totals.co2AvoidedVsBaseline > 0 ? "-" : ""}
                      {formatCO2(Math.abs(results.totals.co2AvoidedVsBaseline))}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Moyenne annuelle</p>
                    <p className="text-2xl font-bold">
                      {formatCO2(results.totals.totalCo2Tonnes / scenario.analysisHorizonYears)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Émissions CO₂ annuelles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={results.yearlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          formatter={(value: number) => `${value.toFixed(0)} tonnes`}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar
                          dataKey="co2Tonnes"
                          name="CO₂ (tonnes)"
                          fill="hsl(var(--chart-h2))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Energy Tab */}
            <TabsContent value="energy" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">H₂ total</p>
                    <p className="text-2xl font-bold">
                      {(results.energyDemand.totalH2Kg / 1000).toFixed(0)}t
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Électricité totale</p>
                    <p className="text-2xl font-bold">
                      {(results.energyDemand.totalKwh / 1000).toFixed(0)} MWh
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Stations H₂ estimées</p>
                    <p className="text-2xl font-bold flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-chart-h2" />
                      {results.infrastructure.h2StationsNeeded}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Bornes EV estimées</p>
                    <p className="text-2xl font-bold flex items-center gap-2">
                      <Zap className="w-5 h-5 text-chart-ev" />
                      {results.infrastructure.evChargersNeeded}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Répartition de la flotte par année</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={results.yearlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="vehiclesDiesel"
                          name="Diesel"
                          stackId="1"
                          fill="hsl(var(--chart-diesel))"
                          stroke="hsl(var(--chart-diesel))"
                        />
                        <Area
                          type="monotone"
                          dataKey="vehiclesBev"
                          name="Électrique"
                          stackId="1"
                          fill="hsl(var(--chart-ev))"
                          stroke="hsl(var(--chart-ev))"
                        />
                        <Area
                          type="monotone"
                          dataKey="vehiclesH2"
                          name="Hydrogène"
                          stackId="1"
                          fill="hsl(var(--chart-h2))"
                          stroke="hsl(var(--chart-h2))"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* No results message */}
        {!results && (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center text-center">
              <Calculator className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Configurez et calculez</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Définissez la stratégie de transition pour chaque groupe de véhicules,
                puis cliquez sur "Calculer" pour voir les résultats.
              </p>
              <Button onClick={handleCalculate} className="gap-2">
                <Calculator className="w-4 h-4" />
                Calculer les résultats
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ScenarioDetail;
