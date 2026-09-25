import { useState } from "react";
import {
  Truck,
  Zap,
  Leaf,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  refVehicleProfiles,
  refEnergyPrices,
  refEmissionFactors,
  availableRegions,
} from "@/data/mockData";
import { toast } from "@/hooks/use-toast";
import type { RefVehicleProfile, RefEnergyPrice, RefEmissionFactor, VehicleType, PowertrainType, EnergyType } from "@/types";

const vehicleTypeLabels: Record<VehicleType, string> = {
  truck: "Camion",
  bus: "Bus",
  van: "Fourgon",
  other: "Autre",
};

const powertrainLabels: Record<PowertrainType, string> = {
  diesel: "Diesel",
  gasoline: "Essence",
  cng: "GNV",
  bev: "Électrique",
  fuel_cell_h2: "Hydrogène",
  other: "Autre",
};

const energyTypeLabels: Record<EnergyType, string> = {
  diesel: "Diesel",
  electricity: "Électricité",
  hydrogen: "Hydrogène",
  hydrogen_green: "H₂ Vert",
  hydrogen_grey: "H₂ Gris",
};

// Ligne d'édition extraite : un hook d'état par ligne éditée doit vivre dans
// son propre composant, pas dans le map() du tableau (rules-of-hooks).
const VehicleProfileEditRow = ({
  profile,
  onSave,
  onCancel,
}: {
  profile: RefVehicleProfile;
  onSave: (profile: RefVehicleProfile) => void;
  onCancel: () => void;
}) => {
  const [editedProfile, setEditedProfile] = useState(profile);

  return (
      <TableRow>
        <TableCell>
          <Input
            value={editedProfile.name}
            onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
            className="w-36"
          />
        </TableCell>
        <TableCell>
          <Select
            value={editedProfile.vehicleType}
            onValueChange={(v) => setEditedProfile({ ...editedProfile, vehicleType: v as VehicleType })}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(vehicleTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select
            value={editedProfile.powertrain}
            onValueChange={(v) => setEditedProfile({ ...editedProfile, powertrain: v as PowertrainType })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(powertrainLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={editedProfile.defaultCapex}
            onChange={(e) => setEditedProfile({ ...editedProfile, defaultCapex: parseInt(e.target.value) })}
            className="w-24 text-right"
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={editedProfile.defaultConsumptionLPer100km || ""}
            onChange={(e) => setEditedProfile({ ...editedProfile, defaultConsumptionLPer100km: parseFloat(e.target.value) || null })}
            className="w-20 text-right"
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={editedProfile.defaultConsumptionKgH2Per100km || ""}
            onChange={(e) => setEditedProfile({ ...editedProfile, defaultConsumptionKgH2Per100km: parseFloat(e.target.value) || null })}
            className="w-20 text-right"
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={editedProfile.defaultConsumptionKwhPer100km || ""}
            onChange={(e) => setEditedProfile({ ...editedProfile, defaultConsumptionKwhPer100km: parseFloat(e.target.value) || null })}
            className="w-20 text-right"
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={editedProfile.defaultMaintenanceCostPerYear}
            onChange={(e) => setEditedProfile({ ...editedProfile, defaultMaintenanceCostPerYear: parseInt(e.target.value) })}
            className="w-20 text-right"
          />
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-accent" onClick={() => onSave(editedProfile)}>
              <Save className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
  );
};

const Admin = () => {
  const [vehicleProfiles, setVehicleProfiles] = useState<RefVehicleProfile[]>(refVehicleProfiles);
  const [energyPrices, setEnergyPrices] = useState<RefEnergyPrice[]>(refEnergyPrices);
  const [emissionFactors, setEmissionFactors] = useState<RefEmissionFactor[]>(refEmissionFactors);

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingFactorId, setEditingFactorId] = useState<string | null>(null);

  // Vehicle Profiles
  const handleSaveProfile = (profile: RefVehicleProfile) => {
    setVehicleProfiles(prev => prev.map(p => p.id === profile.id ? profile : p));
    setEditingProfileId(null);
    toast({ title: "Profil mis à jour", description: `${profile.name} a été modifié.` });
  };

  const handleDeleteProfile = (id: string) => {
    const profile = vehicleProfiles.find(p => p.id === id);
    setVehicleProfiles(prev => prev.filter(p => p.id !== id));
    toast({ title: "Profil supprimé", description: `${profile?.name} a été supprimé.`, variant: "destructive" });
  };

  // Energy Prices
  const handleSavePrice = (price: RefEnergyPrice) => {
    setEnergyPrices(prev => prev.map(p => p.id === price.id ? price : p));
    setEditingPriceId(null);
    toast({ title: "Prix mis à jour" });
  };

  const handleDeletePrice = (id: string) => {
    setEnergyPrices(prev => prev.filter(p => p.id !== id));
    toast({ title: "Prix supprimé", variant: "destructive" });
  };

  // Emission Factors
  const handleSaveFactor = (factor: RefEmissionFactor) => {
    setEmissionFactors(prev => prev.map(f => f.id === factor.id ? factor : f));
    setEditingFactorId(null);
    toast({ title: "Facteur d'émission mis à jour" });
  };

  const handleDeleteFactor = (id: string) => {
    setEmissionFactors(prev => prev.filter(f => f.id !== id));
    toast({ title: "Facteur supprimé", variant: "destructive" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Données de référence</h1>
          <p className="text-muted-foreground">
            Gérez les profils de véhicules, prix de l'énergie et facteurs d'émission par défaut
          </p>
        </div>

        <Tabs defaultValue="vehicles" className="space-y-6">
          <TabsList>
            <TabsTrigger value="vehicles" className="gap-2">
              <Truck className="w-4 h-4" />
              Profils véhicules
            </TabsTrigger>
            <TabsTrigger value="energy" className="gap-2">
              <Zap className="w-4 h-4" />
              Prix énergie
            </TabsTrigger>
            <TabsTrigger value="emissions" className="gap-2">
              <Leaf className="w-4 h-4" />
              Facteurs CO₂
            </TabsTrigger>
          </TabsList>

          {/* Vehicle Profiles Tab */}
          <TabsContent value="vehicles">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Profils de véhicules</CardTitle>
                  <CardDescription>
                    Valeurs par défaut pour différents types de véhicules et motorisations
                  </CardDescription>
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Ajouter
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Motorisation</TableHead>
                      <TableHead className="text-right">CAPEX (€)</TableHead>
                      <TableHead className="text-right">Conso. diesel</TableHead>
                      <TableHead className="text-right">Conso. H₂</TableHead>
                      <TableHead className="text-right">Conso. élec.</TableHead>
                      <TableHead className="text-right">Maintenance</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicleProfiles.map((profile) => {
                      if (editingProfileId === profile.id) {
                        return (
                          <VehicleProfileEditRow
                            key={profile.id}
                            profile={profile}
                            onSave={handleSaveProfile}
                            onCancel={() => setEditingProfileId(null)}
                          />
                        );
                      }

                      return (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">{profile.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{vehicleTypeLabels[profile.vehicleType]}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{powertrainLabels[profile.powertrain]}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{profile.defaultCapex.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {profile.defaultConsumptionLPer100km ? `${profile.defaultConsumptionLPer100km} L` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {profile.defaultConsumptionKgH2Per100km ? `${profile.defaultConsumptionKgH2Per100km} kg` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {profile.defaultConsumptionKwhPer100km ? `${profile.defaultConsumptionKwhPer100km} kWh` : "—"}
                          </TableCell>
                          <TableCell className="text-right">{profile.defaultMaintenanceCostPerYear.toLocaleString()}€</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingProfileId(profile.id)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteProfile(profile.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Energy Prices Tab */}
          <TabsContent value="energy">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Prix de l'énergie</CardTitle>
                  <CardDescription>
                    Prix par défaut du diesel, électricité et hydrogène par région
                  </CardDescription>
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Ajouter
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Région</TableHead>
                      <TableHead>Type d'énergie</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead className="text-right">Prix</TableHead>
                      <TableHead>Année</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {energyPrices.map((price) => (
                      <TableRow key={price.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {availableRegions.find(r => r.value === price.countryOrRegion)?.label || price.countryOrRegion}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{energyTypeLabels[price.energyType] || price.energyType}</Badge>
                        </TableCell>
                        <TableCell>{price.unit}</TableCell>
                        <TableCell className="text-right font-medium">{price.pricePerUnit.toFixed(2)}€</TableCell>
                        <TableCell>{price.year}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingPriceId(price.id)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeletePrice(price.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Emission Factors Tab */}
          <TabsContent value="emissions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Facteurs d'émission CO₂</CardTitle>
                  <CardDescription>
                    Émissions de CO₂ par unité d'énergie consommée
                  </CardDescription>
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Ajouter
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Région</TableHead>
                      <TableHead>Type d'énergie</TableHead>
                      <TableHead className="text-right">kg CO₂ / unité</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emissionFactors.map((factor) => (
                      <TableRow key={factor.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {availableRegions.find(r => r.value === factor.countryOrRegion)?.label || factor.countryOrRegion}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{energyTypeLabels[factor.energyType] || factor.energyType}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{factor.co2PerUnitKg}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingFactorId(factor.id)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteFactor(factor.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Admin;
