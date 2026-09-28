import { describe, it, expect } from 'vitest';
import {
  parseGeotabVehicle,
  parseSamsaraVehicle,
  parseGeotabFleet,
  parseSamsaraFleet,
  parseProviderFleet,
} from '../telematicsParser';

describe('Telematics Parser', () => {
  describe('parseGeotabVehicle', () => {
    it('should parse Geotab device with real odometer data', () => {
      const device = {
        id: 'b123',
        name: 'Truck-001',
        vehicleIdentificationNumber: '1HGBH41JXMN109186',
        currentOdometer: 150000,
        annualKm: 45000,
      };

      const result = parseGeotabVehicle(device);

      expect(result.externalId).toBe('b123');
      expect(result.makeModel).toBe('Truck-001');
      expect(result.annualKm).toBe(45000);
      expect(result.hasRealOdometer).toBe(true);
      expect(result.currentOdometer).toBe(150000);
      expect(result.id).toBeDefined();
    });

    it('should use estimated km when annualKm is null', () => {
      const device = {
        id: 'b456',
        name: 'Van-002',
        annualKm: null,
        currentOdometer: null,
      };

      const result = parseGeotabVehicle(device);

      expect(result.hasRealOdometer).toBe(false);
      expect(result.annualKm).toBeGreaterThan(0);
      expect(result.currentOdometer).toBeUndefined();
    });

    it('should use estimated km when annualKm is 0', () => {
      const device = {
        id: 'b789',
        name: 'Medium Delivery Truck',
        annualKm: 0,
      };

      const result = parseGeotabVehicle(device);

      expect(result.hasRealOdometer).toBe(false);
      expect(result.annualKm).toBeGreaterThan(0);
    });

    it('should calculate dailyKm from annualKm', () => {
      const device = {
        id: 'b100',
        name: 'Test Vehicle',
        annualKm: 25000,
      };

      const result = parseGeotabVehicle(device);

      expect(result.dailyKm).toBe(100); // 25000 / 250 working days
    });
  });

  describe('parseSamsaraVehicle', () => {
    it('should parse Samsara vehicle with make/model', () => {
      const vehicle = {
        id: 'veh_123',
        name: 'Delivery Van',
        vin: 'WVWZZZ3CZWE123456',
        make: 'Volkswagen',
        model: 'Transporter',
        year: 2022,
        currentOdometer: 80000,
        annualKm: 35000,
      };

      const result = parseSamsaraVehicle(vehicle);

      expect(result.externalId).toBe('veh_123');
      expect(result.makeModel).toBe('Volkswagen Transporter 2022');
      expect(result.annualKm).toBe(35000);
      expect(result.hasRealOdometer).toBe(true);
    });

    it('should use name when make/model not available', () => {
      const vehicle = {
        id: 'veh_456',
        name: 'Fleet Vehicle 42',
        annualKm: 40000,
      };

      const result = parseSamsaraVehicle(vehicle);

      expect(result.makeModel).toBe('Fleet Vehicle 42');
    });

    it('should handle missing year in make/model', () => {
      const vehicle = {
        id: 'veh_789',
        name: 'Test',
        make: 'Ford',
        model: 'Transit',
        annualKm: 30000,
      };

      const result = parseSamsaraVehicle(vehicle);

      expect(result.makeModel).toBe('Ford Transit');
    });
  });

  describe('Vehicle Type Detection', () => {
    it('should detect Light Van from name containing "van"', () => {
      const device = { id: '1', name: 'Delivery Van #5' };
      const result = parseGeotabVehicle(device);
      expect(result.vehicleType).toBe('Light Van');
    });

    it('should detect Light Van from "Transit"', () => {
      const device = { id: '2', name: 'Ford Transit 250' };
      const result = parseGeotabVehicle(device);
      expect(result.vehicleType).toBe('Light Van');
    });

    it('should detect Light Van from "Sprinter"', () => {
      const device = { id: '3', name: 'Mercedes Sprinter' };
      const result = parseGeotabVehicle(device);
      expect(result.vehicleType).toBe('Light Van');
    });

    it('should detect Heavy Truck from name containing "semi"', () => {
      const device = { id: '4', name: 'Semi-Trailer Unit' };
      const result = parseGeotabVehicle(device);
      expect(result.vehicleType).toBe('Heavy Truck');
    });

    it('should detect Heavy Truck from "Cascadia"', () => {
      const device = { id: '5', name: 'Freightliner Cascadia' };
      const result = parseGeotabVehicle(device);
      expect(result.vehicleType).toBe('Heavy Truck');
    });

    it('should detect Heavy Truck from "class 8"', () => {
      const device = { id: '6', name: 'Class 8 Hauler' };
      const result = parseGeotabVehicle(device);
      expect(result.vehicleType).toBe('Heavy Truck');
    });

    it('should default to Medium Truck for ambiguous names', () => {
      const device = { id: '7', name: 'Fleet Unit 123' };
      const result = parseGeotabVehicle(device);
      expect(result.vehicleType).toBe('Medium Truck');
    });

    it('should consider deviceType in detection', () => {
      const device = {
        id: '8',
        name: 'Unit 50',
        deviceType: 'Heavy Duty Truck',
      };
      const result = parseGeotabVehicle(device);
      expect(result.vehicleType).toBe('Heavy Truck');
    });
  });

  describe('Route Type Assignment', () => {
    it('should assign Urban route to Light Vans most of the time', () => {
      const results: string[] = [];
      for (let i = 0; i < 100; i++) {
        const device = { id: `${i}`, name: 'Delivery Van' };
        results.push(parseGeotabVehicle(device).routeType);
      }
      const urbanCount = results.filter((r) => r === 'Urban').length;
      expect(urbanCount).toBeGreaterThan(70); // Should be ~80%
    });

    it('should assign Long-haul to Heavy Trucks', () => {
      const device = { id: '1', name: 'Freightliner Cascadia 579' };
      const result = parseGeotabVehicle(device);
      expect(result.routeType).toBe('Long-haul');
    });
  });

  describe('parseGeotabFleet', () => {
    it('should parse array of Geotab devices', () => {
      const devices = [
        { id: 'a1', name: 'Van 1', annualKm: 20000 },
        { id: 'a2', name: 'Truck 2', annualKm: 50000 },
      ];

      const result = parseGeotabFleet(devices);

      expect(result).toHaveLength(2);
      expect(result[0].externalId).toBe('a1');
      expect(result[1].externalId).toBe('a2');
    });

    it('should handle empty array', () => {
      expect(parseGeotabFleet([])).toEqual([]);
    });
  });

  describe('parseSamsaraFleet', () => {
    it('should parse array of Samsara vehicles', () => {
      const vehicles = [
        { id: 's1', name: 'Vehicle 1', annualKm: 30000 },
        { id: 's2', name: 'Vehicle 2', annualKm: 40000 },
      ];

      const result = parseSamsaraFleet(vehicles);

      expect(result).toHaveLength(2);
      expect(result[0].externalId).toBe('s1');
      expect(result[1].externalId).toBe('s2');
    });
  });

  describe('parseProviderFleet', () => {
    it('should route to Geotab parser for geotab provider', () => {
      const devices = [{ id: 'g1', name: 'Geotab Van' }];
      const result = parseProviderFleet('geotab', devices);
      expect(result[0].externalId).toBe('g1');
    });

    it('should route to Samsara parser for samsara provider', () => {
      const vehicles = [{ id: 's1', name: 'Samsara Truck' }];
      const result = parseProviderFleet('samsara', vehicles);
      expect(result[0].externalId).toBe('s1');
    });

    it('should throw error for unknown provider', () => {
      expect(() => parseProviderFleet('unknown', [])).toThrow(
        'Unknown provider: unknown'
      );
    });
  });

  describe('Fuel Consumption Estimates', () => {
    it('should estimate reasonable consumption for Light Van', () => {
      const device = { id: '1', name: 'Delivery Van' };
      const result = parseGeotabVehicle(device);
      expect(result.fuelConsumption).toBeGreaterThanOrEqual(12);
      expect(result.fuelConsumption).toBeLessThanOrEqual(18);
    });

    it('should estimate reasonable consumption for Medium Truck', () => {
      const device = { id: '2', name: 'Medium Fleet Unit' };
      const result = parseGeotabVehicle(device);
      expect(result.fuelConsumption).toBeGreaterThanOrEqual(22);
      expect(result.fuelConsumption).toBeLessThanOrEqual(28);
    });

    it('should estimate reasonable consumption for Heavy Truck', () => {
      const device = { id: '3', name: 'Freightliner Cascadia' };
      const result = parseGeotabVehicle(device);
      expect(result.fuelConsumption).toBeGreaterThanOrEqual(32);
      expect(result.fuelConsumption).toBeLessThanOrEqual(38);
    });
  });
});

describe('Phase 2c — déterminisme et identité importée', () => {
  it('aucune valeur aléatoire : deux parses identiques donnent les mêmes chiffres', () => {
    const device = { id: 'd1', name: 'Van-042', annualKm: null, currentOdometer: null };
    const a = parseGeotabVehicle(device);
    const b = parseGeotabVehicle(device);
    expect(a.annualKm).toBe(b.annualKm);
    expect(a.fuelConsumption).toBe(b.fuelConsumption);
    expect(a.routeType).toBe(b.routeType);
  });

  it('consommation jamais mesurée par ces APIs ⇒ défaut de catégorie marqué « estimation »', () => {
    const v = parseSamsaraVehicle({ id: 's1', name: 'Cascadia 07', annualKm: 88000 });
    expect(v.consumptionSource).toBe('estimation');
    // défaut de catégorie camion_lourd du moteur TCO (36 L/100 km)
    expect(v.fuelConsumption).toBe(36);
    expect(v.hasRealOdometer).toBe(true);
  });

  it('VIN, marque, modèle et année importés quand l\'API les fournit', () => {
    const v = parseSamsaraVehicle({
      id: 's2',
      name: 'Unit 9',
      vin: '1FUJGLDR2LLL12345',
      make: 'Freightliner',
      model: 'eCascadia',
      year: 2025,
      annualKm: 60000,
    });
    expect(v.vin).toBe('1FUJGLDR2LLL12345');
    expect(v.make).toBe('Freightliner');
    expect(v.model).toBe('eCascadia');
    expect(v.modelYear).toBe(2025);

    const g = parseGeotabVehicle({ id: 'g2', name: 'Truck 3', vehicleIdentificationNumber: 'VINGEO123456789XX' });
    expect(g.vin).toBe('VINGEO123456789XX');
  });

  it('km inconnu ⇒ défaut de catégorie (hasRealOdometer=false), jamais un tirage', () => {
    const v = parseGeotabVehicle({ id: 'g3', name: 'Sprinter 12' });
    expect(v.hasRealOdometer).toBe(false);
    expect(v.annualKm).toBe(30000); // kmParAnDefaut camionnette (src/lib/tco)
  });
});
