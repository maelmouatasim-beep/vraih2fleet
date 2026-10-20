/**
 * Comptes de DÉMONSTRATION — organisations et personnes FICTIVES.
 *
 * Mots de passe et secrets TOTP sont publics (ils sont dans le dépôt) :
 * une base qui contient ces comptes ne doit jamais contenir de données
 * réelles. Le jeu n'est chargé que par `pnpm db:seed` (refus en production
 * hors mode démo).
 */
import type { OrganizationType, Role } from "@leaseplace/domain";

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
