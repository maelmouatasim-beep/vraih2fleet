import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Map, Navigation, ZoomIn, ZoomOut, MapPin, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { 
  TelematicsVehicleData, 
  GeographicZone, 
  InfrastructureRecommendation 
} from '@/hooks/useInfrastructureTelematics';
import { useInfrastructureTelematicsData, HeatmapPoint, RecommendedLocation } from '@/hooks/useInfrastructureTelematicsData';

interface InfrastructureMapProps {
  vehicles: TelematicsVehicleData[];
  zones: GeographicZone[];
  recommendations: InfrastructureRecommendation[];
  mapboxToken: string;
}

const InfrastructureMap = ({ 
  vehicles: legacyVehicles, 
  zones, 
  recommendations,
  mapboxToken 
}: InfrastructureMapProps) => {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeLayer, setActiveLayer] = useState<'vehicles' | 'heatmap' | 'infrastructure'>('vehicles');
  const [showRealFleet, setShowRealFleet] = useState(true);

  // Get real telematics data
  const { 
    vehicles: telematicsVehicles, 
    heatmapPoints, 
    hasRealData,
    recommendedLocations,
    totalRealKm,
    totalEstimatedKm
  } = useInfrastructureTelematicsData();

  // Use telematics vehicles if available, otherwise fallback to legacy
  const displayVehicles = showRealFleet && telematicsVehicles.length > 0 
    ? telematicsVehicles 
    : legacyVehicles;

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-96.5, 56], // Canada center
      zoom: 3.5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Update vehicle markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (activeLayer === 'vehicles' && displayVehicles.length > 0) {
      displayVehicles.forEach((vehicle) => {
        const lat = 'latitude' in vehicle ? vehicle.latitude : null;
        const lng = 'longitude' in vehicle ? vehicle.longitude : null;
        
        if (lat && lng) {
          const el = document.createElement('div');
          el.className = 'vehicle-marker';
          
          const vehicleType = vehicle.vehicle_type.toLowerCase();
          let color = '#22c55e'; // Green for light
          if (vehicleType.includes('medium')) color = '#3b82f6';
          if (vehicleType.includes('heavy')) color = '#ef4444';
          
          el.innerHTML = `
            <div style="
              width: 12px;
              height: 12px;
              background: ${color};
              border: 2px solid white;
              border-radius: 50%;
              cursor: pointer;
            "></div>
          `;

          const annualKm: number = 'annual_km_real' in vehicle && typeof vehicle.annual_km_real === 'number'
            ? vehicle.annual_km_real 
            : vehicle.annual_km;

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; color: #333;">
              <strong>${vehicle.make_model}</strong><br/>
              <span style="font-size: 12px;">${vehicle.vehicle_type}</span><br/>
              <span style="font-size: 12px; color: #666;">
                ${Math.round(annualKm).toLocaleString()} km/an
                ${'annual_km_real' in vehicle && vehicle.annual_km_real ? ' ✓' : ' (est.)'}
              </span>
            </div>
          `);

          const marker = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map.current!);

          markersRef.current.push(marker);
        }
      });
    }

    // Update heatmap layer
    if (map.current.getSource('heatmap-source')) {
      map.current.removeLayer('heatmap-layer');
      map.current.removeSource('heatmap-source');
    }

    if (activeLayer === 'heatmap' && heatmapPoints.length > 0) {
      const features = heatmapPoints.map(point => ({
        type: 'Feature' as const,
        properties: { weight: point.weight },
        geometry: {
          type: 'Point' as const,
          coordinates: [point.longitude, point.latitude] as [number, number],
        },
      }));

      map.current.addSource('heatmap-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features,
        },
      });

      map.current.addLayer({
        id: 'heatmap-layer',
        type: 'heatmap',
        source: 'heatmap-source',
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 500, 1],
          'heatmap-intensity': 0.8,
          'heatmap-radius': 40,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 0, 255, 0)',
            0.2, 'rgb(0, 255, 255)',
            0.4, 'rgb(0, 255, 0)',
            0.6, 'rgb(255, 255, 0)',
            0.8, 'rgb(255, 128, 0)',
            1, 'rgb(255, 0, 0)'
          ],
        },
      });
    }

    // Update infrastructure layer
    if (map.current.getSource('infrastructure-source')) {
      map.current.removeLayer('infrastructure-layer');
      map.current.removeLayer('infrastructure-coverage');
      map.current.removeSource('infrastructure-source');
    }

    if (activeLayer === 'infrastructure' && recommendedLocations.length > 0) {
      const features = recommendedLocations.map(loc => ({
        type: 'Feature' as const,
        properties: { 
          type: loc.stationType,
          name: loc.name,
          demand: loc.estimatedDemand,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [loc.coordinates.lng, loc.coordinates.lat],
        },
      }));

      map.current.addSource('infrastructure-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features,
        },
      });

      // Coverage circles
      map.current.addLayer({
        id: 'infrastructure-coverage',
        type: 'circle',
        source: 'infrastructure-source',
        paint: {
          'circle-radius': 50,
          'circle-color': [
            'match',
            ['get', 'type'],
            'ev_charger', 'rgba(34, 197, 94, 0.2)',
            'h2_station', 'rgba(59, 130, 246, 0.2)',
            'rgba(136, 136, 136, 0.2)'
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': [
            'match',
            ['get', 'type'],
            'ev_charger', '#22c55e',
            'h2_station', '#3b82f6',
            '#888888'
          ],
        },
      });

      // Station points
      map.current.addLayer({
        id: 'infrastructure-layer',
        type: 'circle',
        source: 'infrastructure-source',
        paint: {
          'circle-radius': 12,
          'circle-color': [
            'match',
            ['get', 'type'],
            'ev_charger', '#22c55e',
            'h2_station', '#3b82f6',
            '#888888'
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });
    }
  }, [activeLayer, displayVehicles, heatmapPoints, recommendedLocations, mapLoaded, showRealFleet]);

  const handleZoomIn = () => map.current?.zoomIn();
  const handleZoomOut = () => map.current?.zoomOut();
  const handleResetView = () => {
    map.current?.flyTo({ center: [-96.5, 56], zoom: 3.5 });
  };

  if (!mapboxToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            {t('infrastructure.map.title', 'Interactive Map')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center bg-muted rounded-lg">
            <p className="text-muted-foreground">
              {t('infrastructure.map.noToken', 'Mapbox key required to display map')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalKm = hasRealData ? totalRealKm : totalEstimatedKm;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              {t('infrastructure.map.title', 'Interactive Map')}
              {telematicsVehicles.length > 0 && (
                <Badge variant="outline" className="ml-2 gap-1">
                  <Database className="h-3 w-3" />
                  {t('infrastructure.telematicsIntegration.realData', 'Real Data')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {t('infrastructure.map.description', 'Visualize your fleet and infrastructure needs')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            {telematicsVehicles.length > 0 && (
              <div className="flex items-center gap-2">
                <Switch
                  id="show-real-fleet"
                  checked={showRealFleet}
                  onCheckedChange={setShowRealFleet}
                />
                <Label htmlFor="show-real-fleet" className="text-xs">
                  {t('infrastructure.telematicsIntegration.showRealFleet', 'Show Real Fleet')}
                </Label>
              </div>
            )}
            <Tabs value={activeLayer} onValueChange={(v) => setActiveLayer(v as typeof activeLayer)}>
              <TabsList className="h-8">
                <TabsTrigger value="vehicles" className="text-xs px-2">
                  {t('infrastructure.map.vehicles', 'Vehicles')}
                </TabsTrigger>
                <TabsTrigger value="heatmap" className="text-xs px-2">
                  {t('infrastructure.map.heatmap', 'Heat Map')}
                </TabsTrigger>
                <TabsTrigger value="infrastructure" className="text-xs px-2">
                  {t('infrastructure.map.stations', 'Stations')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <div ref={mapContainer} className="h-[400px] rounded-b-lg" />
          
          {/* Map controls */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <Button size="icon" variant="secondary" className="h-8 w-8" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" className="h-8 w-8" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" className="h-8 w-8" onClick={handleResetView}>
              <Navigation className="h-4 w-4" />
            </Button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 text-xs space-y-1">
            {activeLayer === 'vehicles' && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Light Van</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Medium Truck</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Heavy Truck</span>
                </div>
              </>
            )}
            {activeLayer === 'heatmap' && (
              <div className="flex items-center gap-2">
                <div className="w-16 h-2 rounded" style={{
                  background: 'linear-gradient(to right, blue, cyan, green, yellow, orange, red)'
                }} />
                <span>{t('infrastructure.map.usage', 'Usage')}</span>
              </div>
            )}
            {activeLayer === 'infrastructure' && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>{t('infrastructure.map.evCharger', 'EV Charger')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>{t('infrastructure.map.h2Station', 'H₂ Station')}</span>
                </div>
              </>
            )}
          </div>

          {/* Stats overlay */}
          <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{displayVehicles.length} {t('infrastructure.map.vehiclesLabel', 'vehicles')}</Badge>
              <Badge variant="outline">{zones.length} {t('infrastructure.map.zonesLabel', 'zones')}</Badge>
              <Badge variant="outline">{recommendedLocations.length} {t('infrastructure.map.stationsLabel', 'stations')}</Badge>
              {totalKm > 0 && (
                <Badge variant={hasRealData ? "default" : "secondary"} className="gap-1">
                  <MapPin className="h-3 w-3" />
                  {Math.round(totalKm / 1000)}k km/an
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InfrastructureMap;
