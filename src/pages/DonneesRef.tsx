import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Fuel, Zap, Flame, Truck, Factory, AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { useReferenceData, useReferenceDataStats } from '@/hooks/useReferenceData';
import { ReferenceCategory, categoryLabels } from '@/types/referenceData';
import ReferenceDataTable from '@/components/reference-data/ReferenceDataTable';
import ReferenceDataImportExport from '@/components/reference-data/ReferenceDataImportExport';

const categoryIcons: Record<ReferenceCategory, React.ElementType> = {
  fuel_prices: Fuel,
  electricity: Zap,
  hydrogen: Flame,
  vehicles: Truck,
  co2_factors: Factory,
};

const categoryDescriptions: Record<ReferenceCategory, { en: string; fr: string }> = {
  fuel_prices: {
    en: 'Diesel and gasoline prices by region with min/mid/max ranges.',
    fr: 'Prix du diesel et de l\'essence par région avec plages min/moy/max.',
  },
  electricity: {
    en: 'Electricity grid prices and related costs by region.',
    fr: 'Prix de l\'électricité et coûts associés par région.',
  },
  hydrogen: {
    en: 'Hydrogen retail and production costs, including future projections.',
    fr: 'Coûts de l\'hydrogène (détail et production), incluant projections futures.',
  },
  vehicles: {
    en: 'Vehicle acquisition costs for diesel, EV, and hydrogen trucks/buses.',
    fr: 'Coûts d\'acquisition de véhicules diesel, électriques et hydrogène.',
  },
  co2_factors: {
    en: 'CO₂ emission factors for different energy sources by region.',
    fr: 'Facteurs d\'émission CO₂ par source d\'énergie et par région.',
  },
};

export default function DonneesRef() {
  const { t, i18n } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<ReferenceCategory>('fuel_prices');
  const { data: referenceData, isLoading } = useReferenceData(activeCategory);
  const { data: stats } = useReferenceDataStats();
  
  useEffect(() => {
    document.title = i18n.language === 'fr' ? 'Données de référence | H2Fleet Planner' : 'Reference Data | H2Fleet Planner';
  }, [i18n.language]);
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('referenceData.title', 'Données de référence')}
            </h1>
            <p className="text-muted-foreground">
              {t('referenceData.subtitle', 'Moyennes industrielles et projections pour planifier vos scénarios.')}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span><strong>{stats?.totalRecords || 0}</strong> {t('referenceData.records', 'enregistrements')}</span>
            <span><strong>{stats?.regionCount || 0}</strong> {t('referenceData.regions', 'régions')}</span>
          </div>
        </div>
        
        {/* MAJOR DISCLAIMER */}
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200 font-bold">
            {t('referenceData.disclaimer.title', '⚠️ Ces données sont des MOYENNES INDUSTRIELLES')}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300 space-y-3 mt-2">
            <p>
              {t('referenceData.disclaimer.sources', 'Basées sur : programmes pilotes et early adopters (2024-2025), études académiques et gouvernementales, constructeurs et fournisseurs d\'énergie, programmes de subventions en vigueur (janvier 2026).')}
            </p>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-md">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                {t('referenceData.disclaimer.yourCosts', '⚠️ VOS coûts réels dépendent de :')}
              </p>
              <ul className="list-disc list-inside text-sm mt-1 text-amber-800 dark:text-amber-200">
                <li>{t('referenceData.disclaimer.factor1', 'Votre région et fournisseurs locaux')}</li>
                <li>{t('referenceData.disclaimer.factor2', 'Vos contrats négociés')}</li>
                <li>{t('referenceData.disclaimer.factor3', 'Votre utilisation réelle (routes, charge, conduite)')}</li>
                <li>{t('referenceData.disclaimer.factor4', 'L\'évolution rapide du marché (surtout H₂ et électrique)')}</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        {/* Recommended Usage */}
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/30">
          <Lightbulb className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-800 dark:text-blue-200 font-semibold">
            {t('referenceData.usage.title', '💡 Utilisation recommandée')}
          </AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300 mt-2">
            <ol className="list-decimal list-inside space-y-1">
              <li>{t('referenceData.usage.step1', 'Consultez ces références pour vous informer sur les ordres de grandeur')}</li>
              <li>{t('referenceData.usage.step2', 'Obtenez VOS devis et données réels (constructeurs, fournisseurs, télématique)')}</li>
              <li>{t('referenceData.usage.step3', 'Ajustez les références selon votre contexte spécifique')}</li>
              <li>{t('referenceData.usage.step4', 'Documentez vos hypothèses pour défendre votre business case')}</li>
            </ol>
          </AlertDescription>
        </Alert>
          
        {/* Tabs */}
        <Tabs 
          value={activeCategory} 
          onValueChange={(v) => setActiveCategory(v as ReferenceCategory)}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            {(Object.keys(categoryLabels) as ReferenceCategory[]).map((category) => {
              const Icon = categoryIcons[category];
              return (
                <TabsTrigger 
                  key={category} 
                  value={category}
                  className="gap-2"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{categoryLabels[category]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {(Object.keys(categoryLabels) as ReferenceCategory[]).map((category) => (
            <TabsContent key={category} value={category}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {(() => {
                        const Icon = categoryIcons[category];
                        return <Icon className="w-5 h-5 text-primary" />;
                      })()}
                      {categoryLabels[category]}
                    </CardTitle>
                    <CardDescription>
                      {i18n.language === 'fr' 
                        ? categoryDescriptions[category].fr 
                        : categoryDescriptions[category].en}
                    </CardDescription>
                  </div>
                  <ReferenceDataImportExport 
                    data={referenceData || []}
                    category={category}
                  />
                </CardHeader>
                <CardContent>
                  <ReferenceDataTable 
                    data={referenceData || []}
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
