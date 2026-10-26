/**
 * Comptes de DÉMONSTRATION — organisations et personnes FICTIVES.
 *
 * Mots de passe et secrets TOTP sont publics (ils sont dans le dépôt) :
 * une base qui contient ces comptes ne doit jamais contenir de données
 * réelles. Le jeu n'est chargé que par `pnpm db:seed` (refus en production
 * hors mode démo).
 */
import type {
  BusinessSector,
  EquipmentCategory,
  Grade,
  OrganizationType,
  Role,
} from "@leaseplace/domain";

export const DEMO_PASSWORD = "Demo-LeasePlace-2026!";

export interface DemoAccount {
  key: string;
  name: string;
  email: string;
  role: Role;
  organization: string;
  /** Secret TOTP brut (format Better-Auth) ; absent pour une PME. */
  totpSecret?: string;
  /** Faux : se connecte par lien magique ou code, sans mot de passe. */
  password: boolean;
}

export interface DemoOrganization {
  key: string;
  name: string;
  slug: string;
  type: OrganizationType;
}

export const DEMO_ORGANIZATIONS: readonly DemoOrganization[] = [
  {
    key: "atlas",
    name: "Atlas Transports Logistique SARL",
    slug: "atlas-transports",
    type: "company",
  },
  { key: "cedre", name: "Cèdre Leasing", slug: "cedre-leasing", type: "lessor" },
  { key: "argane", name: "Argane Bail", slug: "argane-bail", type: "lessor" },
  { key: "oasis", name: "Oasis Crédit-Bail", slug: "oasis-credit-bail", type: "lessor" },
  { key: "medina", name: "Médina Leasing", slug: "medina-leasing", type: "lessor" },
  { key: "sahel", name: "Sahel Équipement Bail", slug: "sahel-equipement-bail", type: "lessor" },
  {
    key: "plateforme",
    name: "LeasePlace Opérations",
    slug: "leaseplace-operations",
    type: "platform",
  },
];

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    key: "entreprise",
    name: "Salma Benali",
    email: "salma.benali@atlas-transports.example",
    role: "company_owner",
    organization: "atlas",
    password: false,
  },
  {
    key: "bailleur",
    name: "Youssef Alaoui",
    email: "youssef.alaoui@cedre-leasing.example",
    role: "lessor_admin",
    organization: "cedre",
    totpSecret: "DemoCedreLeasingTotpSecret000001",
    password: true,
  },
  {
    key: "bailleur-b",
    name: "Imane Tazi",
    email: "imane.tazi@argane-bail.example",
    role: "lessor_analyst",
    organization: "argane",
    totpSecret: "DemoArganeBailTotpSecret00000002",
    password: true,
  },
  {
    key: "ops",
    name: "Karim Idrissi",
    email: "karim.idrissi@leaseplace.example",
    role: "platform_ops",
    organization: "plateforme",
    totpSecret: "DemoPlatformOpsTotpSecret0000003",
    password: true,
  },
  {
    key: "admin",
    name: "Nadia El Fassi",
    email: "nadia.elfassi@leaseplace.example",
    role: "platform_admin",
    organization: "plateforme",
    totpSecret: "DemoPlatformAdminTotpSecret00004",
    password: true,
  },
];

/** Appétit de démonstration de chaque bailleur fictif (critères d'orientation). */
export interface DemoAppetite {
  organization: string;
  minAmountHt: number;
  maxAmountHt: number;
  minDurationMonths: number;
  maxDurationMonths: number;
  sectors: BusinessSector[];
  categories: EquipmentCategory[];
  minGrade: Grade;
}

export const DEMO_APPETITES: readonly DemoAppetite[] = [
  {
    organization: "cedre",
    minAmountHt: 100_000,
    maxAmountHt: 5_000_000,
    minDurationMonths: 24,
    maxDurationMonths: 84,
    sectors: [],
    categories: [],
    minGrade: "C",
  },
  {
    organization: "argane",
    minAmountHt: 50_000,
    maxAmountHt: 2_000_000,
    minDurationMonths: 12,
    maxDurationMonths: 60,
    sectors: ["transport", "construction", "agriculture", "trade"],
    categories: ["light_vehicle", "truck", "trailer", "construction_machine", "agricultural"],
    minGrade: "C",
  },
  {
    organization: "oasis",
    minAmountHt: 200_000,
    maxAmountHt: 20_000_000,
    minDurationMonths: 24,
    maxDurationMonths: 84,
    sectors: [],
    categories: [],
    minGrade: "B",
  },
  {
    organization: "medina",
    minAmountHt: 50_000,
    maxAmountHt: 1_500_000,
    minDurationMonths: 12,
    maxDurationMonths: 72,
    sectors: [],
    categories: ["light_vehicle", "it", "medical", "industrial_machine", "other"],
    minGrade: "D",
  },
  {
    organization: "sahel",
    minAmountHt: 300_000,
    maxAmountHt: 30_000_000,
    minDurationMonths: 36,
    maxDurationMonths: 120,
    sectors: [],
    categories: ["truck", "construction_machine", "industrial_machine", "agricultural"],
    minGrade: "C",
  },
];
