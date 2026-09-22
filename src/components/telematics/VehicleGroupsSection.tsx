import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Zap, Fuel, Car, Plus } from "lucide-react";
import { VehicleGroup } from "@/lib/mockTelematicsData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface VehicleGroupsSectionProps {
  groups: VehicleGroup[];
}

const VehicleGroupsSection = ({ groups }: VehicleGroupsSectionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedGroups(newExpanded);
  };

  const handleCreateProject = (group: VehicleGroup) => {
    // Navigate to projects with pre-filled data
    navigate('/dashboard/projects', { 
      state: { 
        createFromGroup: true,
        groupName: group.name,
        vehicleCount: group.vehicles.length,
        technology: group.technology,
        avgDailyKm: group.avgDailyKm,
      }
    });
  };

  const getTechIcon = (tech: string) => {
    switch (tech) {
      case 'BEV': return <Zap className="w-4 h-4 text-green-500" />;
      case 'FCEV': return <Fuel className="w-4 h-4 text-blue-500" />;
      default: return <Car className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pages.telematics.groups.title')}</CardTitle>
        <CardDescription>
          {t('pages.telematics.groups.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.filter(g => g.vehicles.length > 0).map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          
          // Prepare histogram data
          const histogramData = [
            { range: '0-50', count: group.vehicles.filter(v => v.dailyKm <= 50).length },
            { range: '51-100', count: group.vehicles.filter(v => v.dailyKm > 50 && v.dailyKm <= 100).length },
            { range: '101-200', count: group.vehicles.filter(v => v.dailyKm > 100 && v.dailyKm <= 200).length },
            { range: '201-300', count: group.vehicles.filter(v => v.dailyKm > 200 && v.dailyKm <= 300).length },
            { range: '300+', count: group.vehicles.filter(v => v.dailyKm > 300).length },
          ].filter(d => d.count > 0);

          return (
            <Collapsible key={group.id} open={isExpanded} onOpenChange={() => toggleGroup(group.id)}>
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getTechIcon(group.technology)}
                      <h4 className="font-semibold">{group.name}</h4>
                      <Badge variant={group.badgeVariant}>{group.badge}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {group.vehicles.length} {t('pages.telematics.groups.vehicles')}, {t('pages.telematics.groups.avgKm')}: {group.avgDailyKm} km/day
                    </p>
                    <p className="text-sm font-medium text-primary">
                      {group.recommendation}
                    </p>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="space-y-4">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogramData}>
                        <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                          formatter={(value) => [value, t('pages.telematics.groups.vehicleCount')]}
                          labelFormatter={(label) => `${label} km/day`}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {histogramData.map((_, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={`hsl(var(--primary))`}
                              opacity={0.7 + (index * 0.1)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {group.vehicles.slice(0, 10).map((v) => (
                      <Badge key={v.id} variant="outline" className="text-xs">
                        {v.externalId}
                      </Badge>
                    ))}
                    {group.vehicles.length > 10 && (
                      <Badge variant="secondary" className="text-xs">
                        +{group.vehicles.length - 10} {t('pages.telematics.groups.more')}
                      </Badge>
                    )}
                  </div>

                  <Button onClick={() => handleCreateProject(group)} className="w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('pages.telematics.groups.createProject')}
                  </Button>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default VehicleGroupsSection;
