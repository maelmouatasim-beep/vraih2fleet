import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SupplierType = 'vehicle_manufacturer' | 'infrastructure' | 'fuel_provider' | 'maintenance' | 'charging_infrastructure' | 'biomethane' | 'diesel_biodiesel' | 'retrofit_services' | 'other';

export interface HydrogenSupplier {
  id: string;
  company_name: string;
  supplier_type: SupplierType;
  country: string;
  province_state: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  description_en: string | null;
  description_fr: string | null;
  products_services: string[];
  certifications: string[];
  logo_url: string | null;
  headquarters_address: string | null;
  service_regions: string[];
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
}

export interface SuppliersFilter {
  supplierType?: SupplierType;
  country?: string;
  provinceState?: string;
  certification?: string;
  searchQuery?: string;
}

export const SUPPLIER_TYPE_LABELS = {
  en: {
    vehicle_manufacturer: 'Vehicle Manufacturer',
    infrastructure: 'Infrastructure Provider',
    fuel_provider: 'Fuel Provider',
    maintenance: 'Maintenance & Systems',
    charging_infrastructure: 'EV Charging Infrastructure',
    biomethane: 'Biomethane Provider',
    diesel_biodiesel: 'Diesel / Biodiesel',
    retrofit_services: 'Retrofit Services',
    other: 'Other',
  },
  fr: {
    vehicle_manufacturer: 'Fabricant de véhicules',
    infrastructure: 'Fournisseur d\'infrastructure',
    fuel_provider: 'Fournisseur de carburant',
    maintenance: 'Maintenance & Systèmes',
    charging_infrastructure: 'Infrastructure Recharge VE',
    biomethane: 'Fournisseur Biométhane',
    diesel_biodiesel: 'Diesel / Biodiesel',
    retrofit_services: 'Services de Rétrofit',
    other: 'Autre',
  },
};

export const COUNTRIES = [
  { code: 'USA', name_en: 'United States', name_fr: 'États-Unis' },
  { code: 'Canada', name_en: 'Canada', name_fr: 'Canada' },
  { code: 'China', name_en: 'China', name_fr: 'Chine' },
  { code: 'South Korea', name_en: 'South Korea', name_fr: 'Corée du Sud' },
  { code: 'France', name_en: 'France', name_fr: 'France' },
  { code: 'Ireland', name_en: 'Ireland', name_fr: 'Irlande' },
  { code: 'Netherlands', name_en: 'Netherlands', name_fr: 'Pays-Bas' },
];

export function useSuppliers(filter?: SuppliersFilter) {
  const [suppliers, setSuppliers] = useState<HydrogenSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        setLoading(true);
        
        let query = supabase
          .from('hydrogen_suppliers')
          .select('*')
          .order('company_name', { ascending: true });

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw fetchError;
        }

        setSuppliers((data as HydrogenSupplier[]) || []);
      } catch (err) {
        console.error('Error fetching suppliers:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch suppliers');
      } finally {
        setLoading(false);
      }
    }

    fetchSuppliers();
  }, []);

  // Filter suppliers based on criteria
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => {
      // Filter by supplier type
      const matchesType = !filter?.supplierType || supplier.supplier_type === filter.supplierType;

      // Filter by country
      const matchesCountry = !filter?.country || supplier.country === filter.country;

      // Filter by province/state
      const matchesProvince = !filter?.provinceState || supplier.province_state === filter.provinceState;

      // Filter by certification
      const matchesCertification = !filter?.certification || 
        supplier.certifications.some(cert => 
          cert.toLowerCase().includes(filter.certification!.toLowerCase())
        );

      // Filter by search query
      const matchesSearch = !filter?.searchQuery || 
        supplier.company_name.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        supplier.products_services.some(ps => 
          ps.toLowerCase().includes(filter.searchQuery!.toLowerCase())
        ) ||
        supplier.description_en?.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
        supplier.description_fr?.toLowerCase().includes(filter.searchQuery.toLowerCase());

      return matchesType && matchesCountry && matchesProvince && matchesCertification && matchesSearch;
    });
  }, [suppliers, filter]);

  // Get unique values for filters
  const uniqueCountries = useMemo(() => {
    return [...new Set(suppliers.map(s => s.country))].sort();
  }, [suppliers]);

  const uniqueProvinces = useMemo(() => {
    return [...new Set(suppliers.filter(s => s.province_state).map(s => s.province_state!))].sort();
  }, [suppliers]);

  const uniqueCertifications = useMemo(() => {
    const certs = suppliers.flatMap(s => s.certifications);
    return [...new Set(certs)].sort();
  }, [suppliers]);

  // Group by type
  const groupedByType = useMemo(() => {
    const groups: Record<SupplierType, HydrogenSupplier[]> = {
      vehicle_manufacturer: [],
      infrastructure: [],
      fuel_provider: [],
      maintenance: [],
      charging_infrastructure: [],
      biomethane: [],
      diesel_biodiesel: [],
      retrofit_services: [],
      other: [],
    };
    
    filteredSuppliers.forEach(supplier => {
      if (groups[supplier.supplier_type]) {
        groups[supplier.supplier_type].push(supplier);
      }
    });
    
    return groups;
  }, [filteredSuppliers]);

  return {
    suppliers: filteredSuppliers,
    allSuppliers: suppliers,
    groupedByType,
    loading,
    error,
    uniqueCountries,
    uniqueProvinces,
    uniqueCertifications,
  };
}
