import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, AlertCircle, Truck, Factory, Zap, Leaf, Fuel, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SupplierType } from '@/hooks/useSuppliers';

interface SupplierWithCoords {
  id: string;
  company_name: string;
  supplier_type: SupplierType;
  latitude: number;
  longitude: number;
  website_url?: string | null;
  description_en?: string | null;
  description_fr?: string | null;
  country: string;
  province_state?: string | null;
}

interface SuppliersMapProps {
  suppliers: SupplierWithCoords[];
  onSupplierClick?: (supplier: SupplierWithCoords) => void;
}

const SUPPLIER_TYPE_COLORS: Record<SupplierType, string> = {
  vehicle_manufacturer: '#3b82f6', // blue
  infrastructure: '#8b5cf6', // purple (H₂)
  charging_infrastructure: '#22c55e', // green (EV)
  biomethane: '#10b981', // emerald
  fuel_provider: '#f97316', // orange
  maintenance: '#6b7280', // gray
  diesel_biodiesel: '#78716c', // stone
  retrofit_services: '#0ea5e9', // sky
  other: '#a3a3a3', // neutral
};

const SUPPLIER_TYPE_LABELS_MAP = {
  en: {
    vehicle_manufacturer: 'Vehicle Manufacturer',
    infrastructure: 'H₂ Infrastructure',
    charging_infrastructure: 'EV Charging',
    biomethane: 'Biomethane',
    fuel_provider: 'Fuel Provider',
    maintenance: 'Maintenance',
    diesel_biodiesel: 'Diesel/Biodiesel',
    retrofit_services: 'Retrofit',
    other: 'Other',
  },
  fr: {
    vehicle_manufacturer: 'Fabricant Véhicules',
    infrastructure: 'Infrastructure H₂',
    charging_infrastructure: 'Recharge VE',
    biomethane: 'Biométhane',
    fuel_provider: 'Carburant',
    maintenance: 'Maintenance',
    diesel_biodiesel: 'Diesel/Biodiesel',
    retrofit_services: 'Rétrofit',
    other: 'Autre',
  },
};

export function SuppliersMap({ suppliers, onSupplierClick }: SuppliersMapProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { token, loading: tokenLoading, error: tokenError } = useMapboxToken();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Filter suppliers with valid coordinates
  const suppliersWithCoords = suppliers.filter(
    s => s.latitude != null && s.longitude != null && !isNaN(s.latitude) && !isNaN(s.longitude)
  );

  useEffect(() => {
    if (!mapContainer.current || !token) return;

    // Initialize map
    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-96, 56], // Center on Canada
      zoom: 3,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.current?.remove();
    };
  }, [token]);

  // Add markers when suppliers change
  useEffect(() => {
    if (!map.current || !token) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    suppliersWithCoords.forEach(supplier => {
      const color = SUPPLIER_TYPE_COLORS[supplier.supplier_type] || '#a3a3a3';
      
      // Create marker element
      const el = document.createElement('div');
      el.className = 'supplier-marker';
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transition: transform 0.2s;
      `;
      el.onmouseenter = () => { el.style.transform = 'scale(1.2)'; };
      el.onmouseleave = () => { el.style.transform = 'scale(1)'; };

      // Create popup content
      const description = isEnglish ? supplier.description_en : supplier.description_fr;
      const typeLabel = isEnglish 
        ? SUPPLIER_TYPE_LABELS_MAP.en[supplier.supplier_type] 
        : SUPPLIER_TYPE_LABELS_MAP.fr[supplier.supplier_type];
      
      const popupContent = `
        <div style="min-width: 200px; font-family: system-ui, sans-serif;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${supplier.company_name}</h3>
          <div style="display: inline-block; padding: 2px 8px; background: ${color}20; color: ${color}; border-radius: 12px; font-size: 11px; font-weight: 500; margin-bottom: 8px;">
            ${typeLabel}
          </div>
          ${description ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #666; line-height: 1.4;">${description.slice(0, 100)}${description.length > 100 ? '...' : ''}</p>` : ''}
          <p style="margin: 0; font-size: 11px; color: #888;">
            📍 ${supplier.province_state ? `${supplier.province_state}, ` : ''}${supplier.country}
          </p>
          ${supplier.website_url ? `<a href="${supplier.website_url}" target="_blank" rel="noopener" style="display: inline-block; margin-top: 8px; font-size: 11px; color: ${color};">Visit website →</a>` : ''}
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([supplier.longitude, supplier.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener('click', () => {
        onSupplierClick?.(supplier);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if there are suppliers
    if (suppliersWithCoords.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      suppliersWithCoords.forEach(s => bounds.extend([s.longitude, s.latitude]));
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 8 });
    }
  }, [suppliersWithCoords, token, isEnglish, onSupplierClick]);

  // Count by type for legend
  const countByType = suppliersWithCoords.reduce((acc, s) => {
    acc[s.supplier_type] = (acc[s.supplier_type] || 0) + 1;
    return acc;
  }, {} as Record<SupplierType, number>);

  if (tokenLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (tokenError || !token) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-[400px] gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            {isEnglish 
              ? 'Map unavailable. Please configure MAPBOX_PUBLIC_TOKEN.' 
              : 'Carte indisponible. Veuillez configurer MAPBOX_PUBLIC_TOKEN.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          {isEnglish ? 'Supplier Locations' : 'Localisation des Fournisseurs'}
        </CardTitle>
        <CardDescription>
          {isEnglish 
            ? `${suppliersWithCoords.length} partners with known locations` 
            : `${suppliersWithCoords.length} partenaires avec localisation connue`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <div ref={mapContainer} className="h-[400px] w-full rounded-b-lg" />
          
          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
            <p className="text-xs font-medium mb-2">
              {isEnglish ? 'Legend' : 'Légende'}
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(countByType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: SUPPLIER_TYPE_COLORS[type as SupplierType] }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {isEnglish 
                      ? SUPPLIER_TYPE_LABELS_MAP.en[type as SupplierType] 
                      : SUPPLIER_TYPE_LABELS_MAP.fr[type as SupplierType]} ({count})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats overlay */}
          <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {suppliersWithCoords.length} {isEnglish ? 'locations' : 'emplacements'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
