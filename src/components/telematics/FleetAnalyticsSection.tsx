import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MockVehicle } from "@/lib/mockTelematicsData";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from "recharts";
import { Route, Fuel, TrendingUp } from "lucide-react";

interface FleetAnalyticsSectionProps {
  vehicles: MockVehicle[];
}

const FleetAnalyticsSection = ({ vehicles }: FleetAnalyticsSectionProps) => {
  const { t } = useTranslation();

  // Distance analysis data
  const avgDailyKm = Math.round(vehicles.reduce((sum, v) => sum + v.dailyKm, 0) / vehicles.length);
  const maxDailyKm = Math.max(...vehicles.map(v => v.dailyKm));
  const totalAnnualKm = vehicles.reduce((sum, v) => sum + v.annualKm, 0);

  const distanceHistogram = [
    { range: '0-50', count: vehicles.filter(v => v.dailyKm <= 50).length },
    { range: '51-100', count: vehicles.filter(v => v.dailyKm > 50 && v.dailyKm <= 100).length },
    { range: '101-150', count: vehicles.filter(v => v.dailyKm > 100 && v.dailyKm <= 150).length },
    { range: '151-200', count: vehicles.filter(v => v.dailyKm > 150 && v.dailyKm <= 200).length },
    { range: '201-300', count: vehicles.filter(v => v.dailyKm > 200 && v.dailyKm <= 300).length },
    { range: '300+', count: vehicles.filter(v => v.dailyKm > 300).length },
  ];

  // Fuel consumption by type
  const fuelByType = [
    { 
      type: 'Light Van', 
      avg: Math.round(vehicles.filter(v => v.vehicleType === 'Light Van').reduce((sum, v) => sum + v.fuelConsumption, 0) / vehicles.filter(v => v.vehicleType === 'Light Van').length) || 0
    },
    { 
      type: 'Medium Truck', 
      avg: Math.round(vehicles.filter(v => v.vehicleType === 'Medium Truck').reduce((sum, v) => sum + v.fuelConsumption, 0) / vehicles.filter(v => v.vehicleType === 'Medium Truck').length) || 0
    },
    { 
      type: 'Heavy Truck', 
      avg: Math.round(vehicles.filter(v => v.vehicleType === 'Heavy Truck').reduce((sum, v) => sum + v.fuelConsumption, 0) / vehicles.filter(v => v.vehicleType === 'Heavy Truck').length) || 0
    },
  ];

  // Fuel cost distribution (estimated)
  const fuelCostDistribution = vehicles.reduce((acc, v) => {
    const type = v.vehicleType;
    const cost = (v.annualKm / 100) * v.fuelConsumption * 1.5; // Assume $1.50/L
    acc[type] = (acc[type] || 0) + cost;
    return acc;
  }, {} as Record<string, number>);

  const fuelPieData = Object.entries(fuelCostDistribution).map(([name, value]) => ({
    name,
    value: Math.round(value),
  }));

  // Route patterns
  const urbanCount = vehicles.filter(v => v.routeType === 'Urban').length;
  const regionalCount = vehicles.filter(v => v.routeType === 'Regional').length;
  const longHaulCount = vehicles.filter(v => v.routeType === 'Long-haul').length;
  const total = vehicles.length;

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(142 76% 36%)'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {t('pages.telematics.analytics.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="distance">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="distance">
              <Route className="w-4 h-4 mr-2" />
              {t('pages.telematics.analytics.tabs.distance')}
            </TabsTrigger>
            <TabsTrigger value="fuel">
              <Fuel className="w-4 h-4 mr-2" />
              {t('pages.telematics.analytics.tabs.fuel')}
            </TabsTrigger>
            <TabsTrigger value="routes">
              {t('pages.telematics.analytics.tabs.routes')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="distance" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">{t('pages.telematics.analytics.avgDaily')}</p>
                <p className="text-2xl font-bold">{avgDailyKm} km</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">{t('pages.telematics.analytics.maxDaily')}</p>
                <p className="text-2xl font-bold">{maxDailyKm} km</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">{t('pages.telematics.analytics.totalAnnual')}</p>
                <p className="text-2xl font-bold">{(totalAnnualKm / 1000000).toFixed(1)}M km</p>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distanceHistogram}>
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value) => [value, t('pages.telematics.analytics.vehicles')]}
                    labelFormatter={(label) => `${label} km/day`}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="fuel" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-4">{t('pages.telematics.analytics.avgConsumption')}</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fuelByType} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 12 }} unit=" L/100km" />
                      <YAxis type="category" dataKey="type" tick={{ fontSize: 12 }} width={100} />
                      <Tooltip 
                        formatter={(value) => [`${value} L/100km`, t('pages.telematics.analytics.consumption')]}
                      />
                      <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-4">{t('pages.telematics.analytics.fuelCostDist')}</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fuelPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {fuelPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="routes" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 border rounded-lg text-center space-y-2">
                <Badge variant="default" className="text-lg px-4 py-1">
                  {Math.round((urbanCount / total) * 100)}%
                </Badge>
                <p className="font-medium">{t('pages.telematics.analytics.urban')}</p>
                <p className="text-sm text-muted-foreground">{urbanCount} {t('pages.telematics.analytics.vehicles')}</p>
              </div>
              <div className="p-6 border rounded-lg text-center space-y-2">
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  {Math.round((regionalCount / total) * 100)}%
                </Badge>
                <p className="font-medium">{t('pages.telematics.analytics.regional')}</p>
                <p className="text-sm text-muted-foreground">{regionalCount} {t('pages.telematics.analytics.vehicles')}</p>
              </div>
              <div className="p-6 border rounded-lg text-center space-y-2">
                <Badge variant="destructive" className="text-lg px-4 py-1">
                  {Math.round((longHaulCount / total) * 100)}%
                </Badge>
                <p className="font-medium">{t('pages.telematics.analytics.longHaul')}</p>
                <p className="text-sm text-muted-foreground">{longHaulCount} {t('pages.telematics.analytics.vehicles')}</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default FleetAnalyticsSection;
