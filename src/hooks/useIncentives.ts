import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type IncentiveLevel = 'federal' | 'provincial' | 'municipal';
export type IncentiveStatus = 'active' | 'expired' | 'coming_soon';

export interface IncentiveProgram {
  id: string;
  program_name_en: string;
  program_name_fr: string;
  level: IncentiveLevel;
  province: string | null;
  amount_cad: number;
  amount_max_cad: number | null;
  vehicle_classes: string[];
  fuel_types: string[];
  description_en: string;
  description_fr: string;
  eligibility_criteria_en: string;
  eligibility_criteria_fr: string;
  application_url: string;
  deadline: string | null;
  status: IncentiveStatus;
  last_verified_date: string;
  source_url: string;
  created_at: string;
  updated_at: string;
}

export interface IncentivesFilter {
  province?: string;
  vehicleClass?: string;
  fuelType?: string;
  status?: IncentiveStatus;
}

// Canadian provinces and territories
export const CANADIAN_PROVINCES = [
  { code: 'AB', name_en: 'Alberta', name_fr: 'Alberta' },
  { code: 'BC', name_en: 'British Columbia', name_fr: 'Colombie-Britannique' },
  { code: 'MB', name_en: 'Manitoba', name_fr: 'Manitoba' },
  { code: 'NB', name_en: 'New Brunswick', name_fr: 'Nouveau-Brunswick' },
  { code: 'NL', name_en: 'Newfoundland and Labrador', name_fr: 'Terre-Neuve-et-Labrador' },
  { code: 'NS', name_en: 'Nova Scotia', name_fr: 'Nouvelle-Écosse' },
  { code: 'NT', name_en: 'Northwest Territories', name_fr: 'Territoires du Nord-Ouest' },
  { code: 'NU', name_en: 'Nunavut', name_fr: 'Nunavut' },
  { code: 'ON', name_en: 'Ontario', name_fr: 'Ontario' },
  { code: 'PE', name_en: 'Prince Edward Island', name_fr: 'Île-du-Prince-Édouard' },
  { code: 'QC', name_en: 'Quebec', name_fr: 'Québec' },
  { code: 'SK', name_en: 'Saskatchewan', name_fr: 'Saskatchewan' },
  { code: 'YT', name_en: 'Yukon', name_fr: 'Yukon' },
];

// Vehicle classes
export const VEHICLE_CLASSES = [
  'Light-duty commercial',
  'Class 2b',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
];

// Fuel types
export const FUEL_TYPES = [
  { code: 'BEV', name_en: 'Battery Electric', name_fr: 'Électrique à batterie' },
  { code: 'FCEV', name_en: 'Hydrogen Fuel Cell', name_fr: 'Pile à combustible hydrogène' },
  { code: 'PHEV', name_en: 'Plug-in Hybrid', name_fr: 'Hybride rechargeable' },
];

export function useIncentives(filter?: IncentivesFilter) {
  const [programs, setPrograms] = useState<IncentiveProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIncentives() {
      try {
        setLoading(true);
        
        let query = supabase
          .from('incentives_programs')
          .select('*')
          .order('level', { ascending: true })
          .order('amount_cad', { ascending: false });

        // Filter by status (default to active)
        if (filter?.status) {
          query = query.eq('status', filter.status);
        } else {
          query = query.eq('status', 'active');
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw fetchError;
        }

        setPrograms((data as IncentiveProgram[]) || []);
      } catch (err) {
        console.error('Error fetching incentives:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch incentives');
      } finally {
        setLoading(false);
      }
    }

    fetchIncentives();
  }, [filter?.status]);

  // Filter programs based on criteria
  const filteredPrograms = useMemo(() => {
    return programs.filter(program => {
      // Include federal programs always, plus matching provincial
      const matchesProvince = 
        program.level === 'federal' || 
        !filter?.province || 
        program.province === filter.province;

      // Check vehicle class match
      const matchesVehicleClass = 
        !filter?.vehicleClass || 
        program.vehicle_classes.some(vc => 
          vc.toLowerCase().includes(filter.vehicleClass!.toLowerCase()) ||
          filter.vehicleClass!.toLowerCase().includes(vc.toLowerCase())
        );

      // Check fuel type match
      const matchesFuelType = 
        !filter?.fuelType || 
        program.fuel_types.includes(filter.fuelType);

      return matchesProvince && matchesVehicleClass && matchesFuelType;
    });
  }, [programs, filter?.province, filter?.vehicleClass, filter?.fuelType]);

  // Calculate total incentives for a given number of vehicles
  const calculateTotal = (vehicleCount: number): number => {
    return filteredPrograms.reduce((total, program) => {
      return total + (program.amount_cad * vehicleCount);
    }, 0);
  };

  // Calculate per-vehicle breakdown
  const calculatePerVehicle = (): { federal: number; provincial: number; total: number } => {
    const federal = filteredPrograms
      .filter(p => p.level === 'federal')
      .reduce((sum, p) => sum + p.amount_cad, 0);
    
    const provincial = filteredPrograms
      .filter(p => p.level === 'provincial')
      .reduce((sum, p) => sum + p.amount_cad, 0);

    return {
      federal,
      provincial,
      total: federal + provincial,
    };
  };

  // Check if deadline is approaching (within 60 days)
  const isDeadlineApproaching = (deadline: string | null): boolean => {
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil > 0 && daysUntil <= 60;
  };

  // Get days since last verification
  const getDaysSinceVerification = (lastVerified: string): number => {
    const verifiedDate = new Date(lastVerified);
    const now = new Date();
    return Math.floor((now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  return {
    programs: filteredPrograms,
    allPrograms: programs,
    loading,
    error,
    calculateTotal,
    calculatePerVehicle,
    isDeadlineApproaching,
    getDaysSinceVerification,
  };
}
