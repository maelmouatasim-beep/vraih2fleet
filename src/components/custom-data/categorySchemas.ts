// Category definitions and field schemas for custom reference data

import { z } from 'zod';

export interface CategoryDefinition {
  value: string;
  label: string;
  labelFr: string;
  icon: string;
  description: string;
  descriptionFr: string;
}

export const CATEGORIES: CategoryDefinition[] = [
  { 
    value: 'drivers', 
    label: 'Driver Information', 
    labelFr: 'Informations chauffeurs',
    icon: '👨‍✈️',
    description: 'Store driver contact info, licenses, and certifications',
    descriptionFr: 'Coordonnées, permis et certifications des chauffeurs'
  },
  { 
    value: 'vehicles', 
    label: 'Vehicle Specifications', 
    labelFr: 'Spécifications véhicules',
    icon: '🚚',
    description: 'Track fleet vehicles with specs and status',
    descriptionFr: 'Suivez les véhicules de flotte avec leurs spécifications'
  },
  { 
    value: 'maintenance', 
    label: 'Maintenance Schedule', 
    labelFr: 'Calendrier maintenance',
    icon: '🔧',
    description: 'Schedule and track maintenance tasks',
    descriptionFr: 'Planifiez et suivez les tâches de maintenance'
  },
  { 
    value: 'routes', 
    label: 'Route Data', 
    labelFr: 'Données itinéraires',
    icon: '📍',
    description: 'Define routes with distances and charging stops',
    descriptionFr: 'Définissez les itinéraires avec distances et arrêts recharge'
  },
  { 
    value: 'charging', 
    label: 'Charging Stations', 
    labelFr: 'Bornes de recharge',
    icon: '⚡',
    description: 'Manage charging and refueling station info',
    descriptionFr: 'Gérez les informations des stations de recharge'
  },
  { 
    value: 'metrics', 
    label: 'Custom Metrics', 
    labelFr: 'Métriques personnalisées',
    icon: '📊',
    description: 'Track custom KPIs and measurements',
    descriptionFr: 'Suivez vos KPIs et mesures personnalisées'
  },
  { 
    value: 'other', 
    label: 'Other', 
    labelFr: 'Autre',
    icon: '📄',
    description: 'Custom data with flexible fields',
    descriptionFr: 'Données personnalisées avec champs flexibles'
  },
];

// Field types for dynamic form generation
export type FieldType = 
  | 'text' 
  | 'number' 
  | 'email' 
  | 'tel' 
  | 'date' 
  | 'time'
  | 'textarea' 
  | 'select' 
  | 'multiselect';

export interface FormField {
  name: string;
  label: string;
  labelFr: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  placeholderFr?: string;
  unit?: string;
  options?: { value: string; label: string; labelFr: string }[];
  min?: number;
  max?: number;
  section?: string;
  sectionFr?: string;
  conditionalOn?: { field: string; values: string[] };
  helpText?: string;
  helpTextFr?: string;
}

// Zod schemas for validation
export const driverSchema = z.object({
  driverName: z.string().min(1, 'Driver name is required'),
  employeeId: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  certifications: z.array(z.string()).optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export const vehicleSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle ID is required'),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().min(1990).max(2030).optional(),
  vehicleType: z.string().optional(),
  batteryCapacity: z.number().positive().optional(),
  hydrogenTankSize: z.number().positive().optional(),
  fuelTankSize: z.number().positive().optional(),
  range: z.number().positive().optional(),
  payloadCapacity: z.number().positive().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().positive().optional(),
  vin: z.string().optional(),
  licensePlate: z.string().optional(),
  currentMileage: z.number().min(0).optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export const maintenanceSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment ID is required'),
  maintenanceType: z.string().optional(),
  scheduledDate: z.string().optional(),
  lastCompletedDate: z.string().optional(),
  frequency: z.string().optional(),
  frequencyValue: z.number().positive().optional(),
  assignedTechnician: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
  priority: z.string().optional(),
  notes: z.string().optional(),
});

export const routeSchema = z.object({
  routeName: z.string().min(1, 'Route name is required'),
  startLocation: z.string().optional(),
  endLocation: z.string().optional(),
  distance: z.number().positive().optional(),
  estimatedDuration: z.number().positive().optional(),
  chargingStops: z.number().min(0).optional(),
  elevationGain: z.number().min(0).optional(),
  trafficLevel: z.string().optional(),
  preferredTime: z.string().optional(),
  daysOfWeek: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const chargingSchema = z.object({
  stationName: z.string().min(1, 'Station name is required'),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  chargerType: z.string().optional(),
  powerOutput: z.number().positive().optional(),
  numberOfPorts: z.number().min(1).optional(),
  costPerUnit: z.number().min(0).optional(),
  operatingHours: z.string().optional(),
  network: z.string().optional(),
  access: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export const metricsSchema = z.object({
  metricName: z.string().min(1, 'Metric name is required'),
  value: z.number(),
  unit: z.string().optional(),
  dateRecorded: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

export const otherSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  customFields: z.array(z.object({
    key: z.string(),
    value: z.string(),
    type: z.enum(['text', 'number', 'date']),
  })).optional(),
});

export function getSchemaForCategory(category: string) {
  switch (category) {
    case 'drivers': return driverSchema;
    case 'vehicles': return vehicleSchema;
    case 'maintenance': return maintenanceSchema;
    case 'routes': return routeSchema;
    case 'charging': return chargingSchema;
    case 'metrics': return metricsSchema;
    case 'other': return otherSchema;
    default: return z.object({});
  }
}
