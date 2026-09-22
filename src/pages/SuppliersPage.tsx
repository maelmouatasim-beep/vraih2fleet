import React from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { SuppliersDirectory } from '@/components/suppliers/SuppliersDirectory';
import { SuppliersMap } from '@/components/suppliers/SuppliersMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Truck, Factory, Zap, Leaf } from 'lucide-react';
import { useSuppliers } from '@/hooks/useSuppliers';

export default function SuppliersPage() {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { allSuppliers, groupedByType, loading } = useSuppliers();

  const categoryCards = [
    {
      labelEn: 'Vehicle Manufacturers',
      labelFr: 'Fabricants de Véhicules',
      icon: Truck,
      iconColor: 'text-blue-600',
      count: groupedByType.vehicle_manufacturer.length,
      examples: groupedByType.vehicle_manufacturer.slice(0, 3).map(s => s.company_name).join(', ') || '-'
    },
    {
      labelEn: 'H₂ Infrastructure',
      labelFr: 'Infrastructure H₂',
      icon: Factory,
      iconColor: 'text-purple-600',
      count: groupedByType.infrastructure.length,
      examples: groupedByType.infrastructure.slice(0, 3).map(s => s.company_name).join(', ') || '-'
    },
    {
      labelEn: 'EV Charging',
      labelFr: 'Recharge VE',
      icon: Zap,
      iconColor: 'text-yellow-600',
      count: groupedByType.charging_infrastructure.length,
      examples: groupedByType.charging_infrastructure.slice(0, 3).map(s => s.company_name).join(', ') || '-'
    },
    {
      labelEn: 'Biomethane',
      labelFr: 'Biométhane',
      icon: Leaf,
      iconColor: 'text-emerald-600',
      count: groupedByType.biomethane.length,
      examples: groupedByType.biomethane.slice(0, 3).map(s => s.company_name).join(', ') || '-'
    },
  ];

  // Prepare suppliers for map (only those with coordinates)
  const suppliersForMap = allSuppliers
    .filter(s => s.latitude != null && s.longitude != null)
    .map(s => ({
      id: s.id,
      company_name: s.company_name,
      supplier_type: s.supplier_type,
      latitude: s.latitude as number,
      longitude: s.longitude as number,
      website_url: s.website_url,
      description_en: s.description_en,
      description_fr: s.description_fr,
      country: s.country,
      province_state: s.province_state,
    }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              <Building2 className="h-3 w-3 mr-1" />
              {isEnglish ? 'Verified Partners' : 'Partenaires Vérifiés'}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('suppliers.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('suppliers.subtitle')}
          </p>
        </div>

        {/* Category Overview */}
        {!loading && (
          <div className="grid gap-4 md:grid-cols-4">
            {categoryCards.map((cat, idx) => (
              <Card key={idx}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {isEnglish ? cat.labelEn : cat.labelFr}
                  </CardTitle>
                  <cat.icon className={`h-4 w-4 ${cat.iconColor}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cat.count}</div>
                  <p className="text-xs text-muted-foreground truncate">
                    {cat.examples}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Interactive Map */}
        {!loading && suppliersForMap.length > 0 && (
          <SuppliersMap suppliers={suppliersForMap} />
        )}

        {/* Main Directory */}
        <SuppliersDirectory showExport={true} />
      </div>
    </DashboardLayout>
  );
}
