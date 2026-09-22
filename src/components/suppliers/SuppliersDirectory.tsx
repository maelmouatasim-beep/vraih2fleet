import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  useSuppliers, 
  SUPPLIER_TYPE_LABELS,
  COUNTRIES,
  HydrogenSupplier,
  SupplierType 
} from '@/hooks/useSuppliers';
import { useFavoriteSuppliers } from '@/hooks/useFavoriteSuppliers';
import { 
  Search, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  ExternalLink, 
  CheckCircle2,
  Truck,
  Fuel,
  Wrench,
  Factory,
  Filter,
  Award,
  Zap,
  Leaf,
  Settings,
  CircleDot,
  Heart,
  DollarSign,
  Clock,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';


interface SuppliersDirectoryProps {
  showExport?: boolean;
}

export function SuppliersDirectory({ showExport = true }: SuppliersDirectoryProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [supplierType, setSupplierType] = useState<SupplierType | ''>('');
  const [country, setCountry] = useState('');
  const [certification, setCertification] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<HydrogenSupplier | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { 
    suppliers: allSuppliers, 
    loading, 
    error,
    uniqueCountries,
    uniqueCertifications,
  } = useSuppliers({
    supplierType: supplierType || undefined,
    country: country || undefined,
    certification: certification || undefined,
    searchQuery: searchQuery || undefined,
  });

  const { favoriteIds, toggleFavorite, isFavorite } = useFavoriteSuppliers();

  // Filter suppliers by favorites if needed
  const suppliers = showFavoritesOnly 
    ? allSuppliers.filter(s => favoriteIds.has(s.id))
    : allSuppliers;

  const getSupplierTypeIcon = (type: SupplierType) => {
    switch (type) {
      case 'vehicle_manufacturer': return <Truck className="h-4 w-4" />;
      case 'infrastructure': return <Factory className="h-4 w-4" />;
      case 'fuel_provider': return <Fuel className="h-4 w-4" />;
      case 'maintenance': return <Wrench className="h-4 w-4" />;
      case 'charging_infrastructure': return <Zap className="h-4 w-4" />;
      case 'biomethane': return <Leaf className="h-4 w-4" />;
      case 'diesel_biodiesel': return <Fuel className="h-4 w-4" />;
      case 'retrofit_services': return <Settings className="h-4 w-4" />;
      case 'other': return <CircleDot className="h-4 w-4" />;
      default: return <CircleDot className="h-4 w-4" />;
    }
  };

  const getSupplierTypeColor = (type: SupplierType) => {
    switch (type) {
      case 'vehicle_manufacturer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'infrastructure': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'fuel_provider': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'maintenance': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'charging_infrastructure': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'biomethane': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'diesel_biodiesel': return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
      case 'retrofit_services': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      case 'other': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // PDF export is now handled by SuppliersPDFDownloadButton

  const clearFilters = () => {
    setSearchQuery('');
    setSupplierType('');
    setCountry('');
    setCertification('');
    setShowFavoritesOnly(false);
  };

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-500/10 to-blue-500/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                {t('suppliers.title')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('suppliers.subtitle')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('suppliers.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" />
                  {t('suppliers.supplierType')}
                </Label>
                <Select value={supplierType || 'all'} onValueChange={(v) => setSupplierType(v === 'all' ? '' : v as SupplierType)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('suppliers.allTypes')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">{t('suppliers.allTypes')}</SelectItem>
                    <SelectItem value="vehicle_manufacturer">
                      {SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'].vehicle_manufacturer}
                    </SelectItem>
                    <SelectItem value="infrastructure">
                      {SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'].infrastructure}
                    </SelectItem>
                    <SelectItem value="fuel_provider">
                      {SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'].fuel_provider}
                    </SelectItem>
                    <SelectItem value="maintenance">
                      {SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'].maintenance}
                    </SelectItem>
                    <SelectItem value="charging_infrastructure">
                      {SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'].charging_infrastructure}
                    </SelectItem>
                    <SelectItem value="biomethane">
                      {SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'].biomethane}
                    </SelectItem>
                    <SelectItem value="diesel_biodiesel">
                      {SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'].diesel_biodiesel}
                    </SelectItem>
                    <SelectItem value="retrofit_services">
                      {SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'].retrofit_services}
                    </SelectItem>
                    <SelectItem value="other">
                      {SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'].other}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {t('suppliers.country')}
                </Label>
                <Select value={country || 'all'} onValueChange={(v) => setCountry(v === 'all' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('suppliers.allCountries')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">{t('suppliers.allCountries')}</SelectItem>
                    {uniqueCountries.map(c => (
                      <SelectItem key={c} value={c}>
                        {COUNTRIES.find(co => co.code === c)?.[isEnglish ? 'name_en' : 'name_fr'] || c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Award className="h-3.5 w-3.5" />
                  {t('suppliers.certification')}
                </Label>
                <Select value={certification || 'all'} onValueChange={(v) => setCertification(v === 'all' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('suppliers.allCertifications')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">{t('suppliers.allCertifications')}</SelectItem>
                    {uniqueCertifications.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button variant="ghost" onClick={clearFilters} className="w-full">
                  {t('suppliers.clearFilters')}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Results count and favorites filter */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {suppliers.length} {t('suppliers.suppliersFound')}
              {showFavoritesOnly && favoriteIds.size > 0 && (
                <span className="ml-1">({t('suppliers.favorites.filterFavorites')})</span>
              )}
            </p>
            <Button
              variant={showFavoritesOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className="flex items-center gap-1.5"
            >
              <Heart className={`h-4 w-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              {t('suppliers.favorites.title')}
              {favoriteIds.size > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {favoriteIds.size}
                </Badge>
              )}
            </Button>
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{showFavoritesOnly ? t('suppliers.favorites.noFavorites') : t('suppliers.noSuppliers')}</p>
              <p className="text-sm mt-1">{t('suppliers.tryDifferentFilters')}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {suppliers.map(supplier => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  isEnglish={isEnglish}
                  getSupplierTypeIcon={getSupplierTypeIcon}
                  getSupplierTypeColor={getSupplierTypeColor}
                  onClick={() => setSelectedSupplier(supplier)}
                  isFavorite={isFavorite(supplier.id)}
                  onToggleFavorite={(e) => {
                    e.stopPropagation();
                    toggleFavorite(supplier.id);
                  }}
                  t={t}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Detail Modal */}
      <SupplierDetailModal
        supplier={selectedSupplier}
        isOpen={!!selectedSupplier}
        onClose={() => setSelectedSupplier(null)}
        isEnglish={isEnglish}
        getSupplierTypeIcon={getSupplierTypeIcon}
        getSupplierTypeColor={getSupplierTypeColor}
        t={t}
      />
    </>
  );
}

// Supplier Card Component
interface SupplierCardProps {
  supplier: HydrogenSupplier;
  isEnglish: boolean;
  getSupplierTypeIcon: (type: SupplierType) => React.ReactNode;
  getSupplierTypeColor: (type: SupplierType) => string;
  onClick: () => void;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  t: (key: string) => string;
}

function SupplierCard({
  supplier,
  isEnglish,
  getSupplierTypeIcon,
  getSupplierTypeColor,
  onClick,
  isFavorite,
  onToggleFavorite,
  t,
}: SupplierCardProps) {
  const typeLabel = SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'][supplier.supplier_type];

  return (
    <div 
      className="border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer hover:border-primary/50 relative"
      onClick={onClick}
    >
      {/* Favorite Button */}
      <button
        onClick={onToggleFavorite}
        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors"
        title={isFavorite ? t('suppliers.favorites.remove') : t('suppliers.favorites.add')}
      >
        <Heart 
          className={`h-5 w-5 transition-colors ${
            isFavorite 
              ? 'fill-red-500 text-red-500' 
              : 'text-muted-foreground hover:text-red-400'
          }`} 
        />
      </button>

      <div className="flex items-start justify-between gap-3 pr-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h4 className="font-semibold truncate">{supplier.company_name}</h4>
            {supplier.is_verified && (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <Badge className={`${getSupplierTypeColor(supplier.supplier_type)} flex items-center gap-1`}>
              {getSupplierTypeIcon(supplier.supplier_type)}
              {typeLabel}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {supplier.province_state ? `${supplier.province_state}, ${supplier.country}` : supplier.country}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {isEnglish ? supplier.description_en : supplier.description_fr}
          </p>

          <div className="flex flex-wrap gap-1">
            {supplier.products_services.slice(0, 3).map((service, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {service}
              </Badge>
            ))}
            {supplier.products_services.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{supplier.products_services.length - 3}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {supplier.contact_email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              {t('suppliers.contact')}
            </span>
          )}
          {supplier.website_url && (
            <span className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />
              {t('suppliers.website')}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm">
          {t('suppliers.viewDetails')}
        </Button>
      </div>
    </div>
  );
}

// Supplier Detail Modal
interface SupplierDetailModalProps {
  supplier: HydrogenSupplier | null;
  isOpen: boolean;
  onClose: () => void;
  isEnglish: boolean;
  getSupplierTypeIcon: (type: SupplierType) => React.ReactNode;
  getSupplierTypeColor: (type: SupplierType) => string;
  t: (key: string) => string;
}

function SupplierDetailModal({
  supplier,
  isOpen,
  onClose,
  isEnglish,
  getSupplierTypeIcon,
  getSupplierTypeColor,
  t,
}: SupplierDetailModalProps) {
  if (!supplier) return null;

  const typeLabel = SUPPLIER_TYPE_LABELS[isEnglish ? 'en' : 'fr'][supplier.supplier_type];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2">
              {supplier.company_name}
              {supplier.is_verified && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
            </DialogTitle>
          </div>
          <DialogDescription className="flex items-center gap-2 pt-2">
            <Badge className={`${getSupplierTypeColor(supplier.supplier_type)} flex items-center gap-1`}>
              {getSupplierTypeIcon(supplier.supplier_type)}
              {typeLabel}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {supplier.province_state ? `${supplier.province_state}, ${supplier.country}` : supplier.country}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Description */}
          <div>
            <h4 className="font-medium mb-2">{t('suppliers.about')}</h4>
            <p className="text-muted-foreground">
              {isEnglish ? supplier.description_en : supplier.description_fr}
            </p>
          </div>

          {/* Products & Services */}
          <div>
            <h4 className="font-medium mb-2">{t('suppliers.productsServices')}</h4>
            <div className="flex flex-wrap gap-2">
              {supplier.products_services.map((service, i) => (
                <Badge key={i} variant="secondary">{service}</Badge>
              ))}
            </div>
          </div>

          {/* Certifications */}
          {supplier.certifications.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Award className="h-4 w-4" />
                {t('suppliers.certifications')}
              </h4>
              <div className="flex flex-wrap gap-2">
                {supplier.certifications.map((cert, i) => (
                  <Badge key={i} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Service Regions */}
          {supplier.service_regions.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">{t('suppliers.serviceRegions')}</h4>
              <div className="flex flex-wrap gap-2">
                {supplier.service_regions.map((region, i) => (
                  <Badge key={i} variant="outline">{region}</Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Contact Information */}
          <div>
            <h4 className="font-medium mb-3">{t('suppliers.contactInfo')}</h4>
            <div className="space-y-2">
              {supplier.contact_email && (
                <a 
                  href={`mailto:${supplier.contact_email}`}
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {supplier.contact_email}
                </a>
              )}
              {supplier.contact_phone && (
                <a 
                  href={`tel:${supplier.contact_phone}`}
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {supplier.contact_phone}
                </a>
              )}
              {supplier.website_url && (
                <a 
                  href={supplier.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                >
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  {supplier.website_url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {supplier.website_url && (
              <Button asChild className="flex-1">
                <a href={supplier.website_url} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4 mr-2" />
                  {t('suppliers.visitWebsite')}
                </a>
              </Button>
            )}
            {supplier.contact_email && (
              <Button variant="outline" asChild className="flex-1">
                <a href={`mailto:${supplier.contact_email}`}>
                  <Mail className="h-4 w-4 mr-2" />
                  {t('suppliers.sendEmail')}
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SuppliersDirectory;
