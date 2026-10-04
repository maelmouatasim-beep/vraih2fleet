import { useEffect, useState } from 'react';
import DemoRequestModal from '@/components/landing/DemoRequestModal';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Truck, 
  Building2, 
  Fuel, 
  Wrench, 
  ArrowRight, 
  MapPin, 
  DollarSign, 
  Leaf, 
  ExternalLink,
  ChevronRight,
  Globe,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Types
interface Supplier {
  id: string;
  company_name: string;
  supplier_type: 'vehicle_manufacturer' | 'infrastructure' | 'fuel_provider' | 'maintenance' | 'charging_infrastructure' | 'biomethane' | 'diesel_biodiesel' | 'retrofit_services' | 'other';
  country: string;
  province_state: string | null;
  website_url: string | null;
  description_en: string | null;
  description_fr: string | null;
  logo_url: string | null;
  is_verified: boolean;
}

interface IncentiveProgram {
  id: string;
  program_name_en: string;
  program_name_fr: string;
  level: 'federal' | 'provincial' | 'municipal';
  amount_cad: number;
  amount_max_cad: number | null;
  province: string | null;
  status: 'active' | 'expired' | 'coming_soon';
}

// Province data for the map
const PROVINCE_DATA: Record<string, { name: string; nameFr: string; x: number; y: number }> = {
  'BC': { name: 'British Columbia', nameFr: 'Colombie-Britannique', x: 80, y: 180 },
  'AB': { name: 'Alberta', nameFr: 'Alberta', x: 160, y: 200 },
  'SK': { name: 'Saskatchewan', nameFr: 'Saskatchewan', x: 230, y: 210 },
  'MB': { name: 'Manitoba', nameFr: 'Manitoba', x: 300, y: 220 },
  'ON': { name: 'Ontario', nameFr: 'Ontario', x: 420, y: 280 },
  'QC': { name: 'Quebec', nameFr: 'Québec', x: 520, y: 220 },
  'NB': { name: 'New Brunswick', nameFr: 'Nouveau-Brunswick', x: 590, y: 250 },
  'NS': { name: 'Nova Scotia', nameFr: 'Nouvelle-Écosse', x: 620, y: 270 },
  'PE': { name: 'Prince Edward Island', nameFr: 'Île-du-Prince-Édouard', x: 610, y: 240 },
  'NL': { name: 'Newfoundland', nameFr: 'Terre-Neuve', x: 660, y: 200 },
};

// Static infrastructure data
const INFRASTRUCTURE_STATS = {
  operationalStations: 12,
  plannedStations: 25,
  corridors: 3,
  investmentBillions: 1.5,
};

const supplierTypeIcons = {
  vehicle_manufacturer: Truck,
  infrastructure: Building2,
  fuel_provider: Fuel,
  maintenance: Wrench,
};

const Ecosystem = () => {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language.startsWith("en");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [incentives, setIncentives] = useState<IncentiveProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch suppliers
        const { data: suppliersData } = await supabase
          .from('hydrogen_suppliers')
          .select('id, company_name, supplier_type, country, province_state, website_url, description_en, description_fr, logo_url, is_verified')
          .eq('is_verified', true)
          .limit(20);

        // Fetch active incentives
        const { data: incentivesData } = await supabase
          .from('incentives_programs')
          .select('id, program_name_en, program_name_fr, level, amount_cad, amount_max_cad, province, status')
          .eq('status', 'active');

        setSuppliers(suppliersData || []);
        setIncentives(incentivesData || []);
      } catch (error) {
        console.error('Error fetching ecosystem data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Group suppliers by type
  const suppliersByType = suppliers.reduce((acc, supplier) => {
    if (!acc[supplier.supplier_type]) {
      acc[supplier.supplier_type] = [];
    }
    acc[supplier.supplier_type].push(supplier);
    return acc;
  }, {} as Record<string, Supplier[]>);

  // Calculate incentives by province
  const incentivesByProvince = incentives.reduce((acc, incentive) => {
    const key = incentive.province || 'federal';
    if (!acc[key]) {
      acc[key] = { total: 0, count: 0 };
    }
    acc[key].total += incentive.amount_max_cad || incentive.amount_cad;
    acc[key].count++;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const federalIncentives = incentives.filter(i => i.level === 'federal');
  const maxFederalAmount = Math.max(...federalIncentives.map(i => i.amount_max_cad || i.amount_cad), 0);

  const supplierTypeLabels = {
    vehicle_manufacturer: isEnglish ? 'Vehicle Manufacturers' : 'Fabricants de véhicules',
    infrastructure: isEnglish ? 'Infrastructure Providers' : 'Fournisseurs d\'infrastructure',
    fuel_provider: isEnglish ? 'Fuel Providers' : 'Fournisseurs de carburant',
    maintenance: isEnglish ? 'Maintenance Services' : 'Services de maintenance',
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-transparent to-transparent" />
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-6 bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/30">
              <Leaf className="w-3 h-3 mr-1" />
              {isEnglish ? 'Canada 2025' : 'Canada 2025'}
            </Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight">
              {isEnglish 
                ? "Canada's Hydrogen Ecosystem" 
                : "L'Écosystème Hydrogène au Canada"
              }
            </h1>
            
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-8 max-w-3xl mx-auto">
              {isEnglish
                ? "Discover the key players, incentives and infrastructure for your fleet transition to hydrogen"
                : "Découvrez les acteurs clés, subventions et infrastructures pour votre transition vers l'hydrogène"
              }
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="heroOutline" asChild>
                <Link to="/signup">
                  <DollarSign className="w-5 h-5 mr-2" />
                  {isEnglish ? 'Plan My Transition' : 'Planifier ma transition'}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Section fournisseurs retirée (refonte 2f) : module annuaire supprimé */}

      {/* Incentives Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 bg-accent/10 text-accent border-accent/30">
              <DollarSign className="w-3 h-3 mr-1" />
              {isEnglish ? 'Incentives' : 'Subventions'}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {isEnglish ? 'Available Incentives Across Canada' : 'Subventions Disponibles au Canada'}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {isEnglish
                ? 'Federal and provincial programs to support your hydrogen fleet transition'
                : 'Programmes fédéraux et provinciaux pour soutenir votre transition hydrogène'
              }
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 items-start">
            {/* Simple Canada Map Visualization */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  {isEnglish ? 'Incentives by Province' : 'Subventions par province'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-muted to-muted/50 rounded-lg overflow-hidden">
                  {/* Simplified Canada outline */}
                  <svg viewBox="0 0 700 400" className="w-full h-full">
                    {/* Province dots with incentive amounts */}
                    {Object.entries(PROVINCE_DATA).map(([code, data]) => {
                      const incentiveData = incentivesByProvince[code];
                      const hasIncentives = incentiveData && incentiveData.total > 0;
                      
                      return (
                        <g key={code}>
                          <circle
                            cx={data.x}
                            cy={data.y}
                            r={hasIncentives ? 20 : 12}
                            className={`${hasIncentives ? 'fill-primary' : 'fill-muted-foreground/30'} transition-all duration-300`}
                          />
                          <text
                            x={data.x}
                            y={data.y + 4}
                            textAnchor="middle"
                            className="fill-primary-foreground text-xs font-bold"
                          >
                            {code}
                          </text>
                          {hasIncentives && (
                            <text
                              x={data.x}
                              y={data.y + 35}
                              textAnchor="middle"
                              className="fill-foreground text-xs font-medium"
                            >
                              ${Math.round(incentiveData.total / 1000)}K
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
                
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isEnglish ? 'Click on a province to see details' : 'Cliquez sur une province pour les détails'}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-muted-foreground">
                      {isEnglish ? 'Has incentives' : 'Avec subventions'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Federal Programs Highlight */}
            <div className="space-y-6">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-primary-foreground">
                      {isEnglish ? 'Federal' : 'Fédéral'}
                    </Badge>
                    <CardTitle className="text-lg">
                      {isEnglish ? 'Federal Programs' : 'Programmes Fédéraux'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {federalIncentives.slice(0, 3).map((incentive) => (
                      <div key={incentive.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                        <div>
                          <p className="font-medium text-sm">
                            {isEnglish ? incentive.program_name_en : incentive.program_name_fr}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isEnglish ? 'Per vehicle' : 'Par véhicule'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">
                            ${(incentive.amount_max_cad || incentive.amount_cad).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">CAD</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Max incentive highlight */}
              <Card className="gradient-hero text-primary-foreground">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-primary-foreground/80 text-sm mb-1">
                        {isEnglish ? 'Maximum stackable incentives' : 'Subventions cumulables max'}
                      </p>
                      <p className="text-4xl font-bold">$300,000</p>
                      <p className="text-primary-foreground/80 text-sm mt-1">
                        {isEnglish ? 'Federal + Provincial (QC)' : 'Fédéral + Provincial (QC)'}
                      </p>
                    </div>
                    <div className="p-4 bg-primary-foreground/20 rounded-full">
                      <DollarSign className="w-8 h-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button asChild size="lg" className="w-full">
                <Link to="/signup">
                  {isEnglish ? 'Plan My Transition' : 'Planifier ma transition'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">
              <Zap className="w-3 h-3 mr-1" />
              {isEnglish ? 'Infrastructure' : 'Infrastructure'}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {isEnglish ? 'Hydrogen Infrastructure in Canada' : 'Infrastructure Hydrogène au Canada'}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {isEnglish
                ? 'Growing network of hydrogen refueling stations and planned corridors'
                : 'Réseau croissant de stations de ravitaillement et corridors planifiés'
              }
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-12">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-4xl font-bold text-primary mb-2">
                  {INFRASTRUCTURE_STATS.operationalStations}
                </div>
                <p className="text-muted-foreground">
                  {isEnglish ? 'Operational Stations' : 'Stations opérationnelles'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-4xl font-bold text-accent mb-2">
                  {INFRASTRUCTURE_STATS.plannedStations}
                </div>
                <p className="text-muted-foreground">
                  {isEnglish ? 'Planned by 2030' : 'Planifiées d\'ici 2030'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-4xl font-bold text-primary mb-2">
                  {INFRASTRUCTURE_STATS.corridors}
                </div>
                <p className="text-muted-foreground">
                  {isEnglish ? 'Major Corridors' : 'Corridors majeurs'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-4xl font-bold text-accent mb-2">
                  ${INFRASTRUCTURE_STATS.investmentBillions}B
                </div>
                <p className="text-muted-foreground">
                  {isEnglish ? 'Investment Planned' : 'Investissement planifié'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Corridor visualization */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>
                {isEnglish ? 'Planned Hydrogen Corridors' : 'Corridors Hydrogène Planifiés'}
              </CardTitle>
              <CardDescription>
                {isEnglish 
                  ? 'Strategic routes connecting major industrial centers'
                  : 'Routes stratégiques reliant les centres industriels majeurs'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="font-medium">
                      {isEnglish ? 'Quebec-Ontario Corridor' : 'Corridor Québec-Ontario'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Montreal → Toronto (540 km)
                  </p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {isEnglish ? 'Under development' : 'En développement'}
                  </Badge>
                </div>
                
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-accent" />
                    <span className="font-medium">
                      {isEnglish ? 'Alberta Industrial' : 'Industriel Alberta'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Edmonton → Calgary (300 km)
                  </p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {isEnglish ? 'Planned 2026' : 'Planifié 2026'}
                  </Badge>
                </div>
                
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="font-medium">
                      {isEnglish ? 'BC Lower Mainland' : 'BC Basses-Terres'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Vancouver → Whistler (125 km)
                  </p>
                  <Badge variant="outline" className="mt-2 text-xs bg-accent/10 text-accent border-accent/30">
                    {isEnglish ? 'Active' : 'Actif'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 gradient-dark text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              {isEnglish 
                ? 'Ready to Plan Your Transition?' 
                : 'Prêt à planifier votre transition ?'
              }
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8">
              {isEnglish
                ? 'Use our tools to calculate your TCO, find incentives, and connect with suppliers'
                : 'Utilisez nos outils pour calculer votre TCO, trouver les subventions et contacter les fournisseurs'
              }
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="heroOutline" onClick={() => setIsDemoModalOpen(true)}>
                {isEnglish ? 'Request Access' : 'Demander un accès'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="ghost" 
                asChild
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link to="/features">
                  {isEnglish ? 'See Features' : 'Voir les fonctionnalités'}
                </Link>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-8 mt-12 text-sm text-primary-foreground/60">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4" />
                {isEnglish ? '14-day free trial' : 'Essai 14 jours gratuit'}
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                {isEnglish ? 'No credit card required' : 'Sans carte bancaire'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <DemoRequestModal open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen} />
    </div>
  );
};

export default Ecosystem;
