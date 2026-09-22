import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ExternalLink, 
  ChevronDown, 
  Search, 
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Building2,
  MapPin
} from 'lucide-react';
import { IncentiveProgram, CANADIAN_PROVINCES } from '@/hooks/useIncentives';

interface SubsidiesProgramsListProps {
  programs: IncentiveProgram[];
  loading: boolean;
}

export function SubsidiesProgramsList({ programs, loading }: SubsidiesProgramsListProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());

  const filteredPrograms = programs.filter(program => {
    const matchesSearch = searchQuery === '' || 
      program.program_name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      program.program_name_fr.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLevel = levelFilter === 'all' || program.level === levelFilter;
    const matchesStatus = statusFilter === 'all' || program.status === statusFilter;
    const matchesProvince = provinceFilter === 'all' || 
      program.level === 'federal' || 
      program.province === provinceFilter;
    
    return matchesSearch && matchesLevel && matchesStatus && matchesProvince;
  });

  const toggleExpanded = (id: string) => {
    setExpandedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isEnglish ? 'en-CA' : 'fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />{t('subsidies.active')}</Badge>;
      case 'expired':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{t('subsidies.expired')}</Badge>;
      case 'coming_soon':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{t('subsidies.comingSoon')}</Badge>;
      default:
        return null;
    }
  };

  const getLevelIcon = (level: string) => {
    return level === 'federal' ? (
      <Building2 className="h-4 w-4 text-blue-600" />
    ) : (
      <MapPin className="h-4 w-4 text-purple-600" />
    );
  };

  const getDaysUntilDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('subsidies.searchPrograms')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('subsidies.allLevels')} />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">{t('subsidies.allLevels')}</SelectItem>
                <SelectItem value="federal">{t('subsidies.federal')}</SelectItem>
                <SelectItem value="provincial">{t('subsidies.provincial')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('subsidies.allStatus')} />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">{t('subsidies.allStatus')}</SelectItem>
                <SelectItem value="active">{t('subsidies.active')}</SelectItem>
                <SelectItem value="expired">{t('subsidies.expired')}</SelectItem>
                <SelectItem value="coming_soon">{t('subsidies.comingSoon')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={provinceFilter} onValueChange={setProvinceFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('subsidies.allProvinces')} />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">{t('subsidies.allProvinces')}</SelectItem>
                {CANADIAN_PROVINCES.map(prov => (
                  <SelectItem key={prov.code} value={prov.code}>
                    {isEnglish ? prov.name_en : prov.name_fr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filteredPrograms.length} {t('subsidies.programsFound')}
      </p>

      {/* Programs List */}
      <div className="space-y-3">
        {filteredPrograms.map(program => {
          const isExpanded = expandedPrograms.has(program.id);
          const daysUntil = getDaysUntilDeadline(program.deadline);

          return (
            <Collapsible key={program.id} open={isExpanded} onOpenChange={() => toggleExpanded(program.id)}>
              <Card className={`transition-shadow ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {getLevelIcon(program.level)}
                          <CardTitle className="text-base">
                            {isEnglish ? program.program_name_en : program.program_name_fr}
                          </CardTitle>
                          {getStatusBadge(program.status)}
                          {program.province && (
                            <Badge variant="outline">{program.province}</Badge>
                          )}
                          {daysUntil !== null && daysUntil > 0 && daysUntil <= 60 && (
                            <Badge variant="destructive" className="animate-pulse">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {daysUntil} {isEnglish ? 'days left' : 'jours restants'}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2">
                          {isEnglish ? program.description_en : program.description_fr}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600">
                            {formatCurrency(program.amount_cad)}
                          </p>
                          {program.amount_max_cad && program.amount_max_cad !== program.amount_cad && (
                            <p className="text-xs text-muted-foreground">
                              {isEnglish ? 'Up to' : 'Jusqu\'à'} {formatCurrency(program.amount_max_cad)}
                            </p>
                          )}
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-medium mb-2">{t('subsidies.eligibility')}</h4>
                        <p className="text-sm text-muted-foreground">
                          {isEnglish ? program.eligibility_criteria_en : program.eligibility_criteria_fr}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">{t('subsidies.vehicleTypes')}</h4>
                        <div className="flex flex-wrap gap-1">
                          {program.vehicle_classes.map(vc => (
                            <Badge key={vc} variant="outline" className="text-xs">{vc}</Badge>
                          ))}
                        </div>
                        <h4 className="font-medium mb-2 mt-3">{t('subsidies.fuelTypes')}</h4>
                        <div className="flex flex-wrap gap-1">
                          {program.fuel_types.map(ft => (
                            <Badge key={ft} variant="secondary" className="text-xs">{ft}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {program.deadline && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{t('subsidies.deadline')}:</span>
                        <span className="font-medium">
                          {new Date(program.deadline).toLocaleDateString(isEnglish ? 'en-CA' : 'fr-CA')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <Button asChild>
                        <a href={program.application_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {t('subsidies.applyNow')}
                        </a>
                      </Button>
                      <Button variant="outline" asChild>
                        <a href={program.source_url} target="_blank" rel="noopener noreferrer">
                          {t('subsidies.officialSite')}
                        </a>
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {t('subsidies.lastVerified')}: {new Date(program.last_verified_date).toLocaleDateString(isEnglish ? 'en-CA' : 'fr-CA')}
                    </p>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {filteredPrograms.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('subsidies.noResults')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
