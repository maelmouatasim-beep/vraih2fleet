/**
 * Démonstration « en volume » (phase 9) : 29 PME fictives de plus (30 avec
 * Atlas) et 76 demandes (80 au total) réparties sur tout le parcours —
 * brouillons, revue, compléments, qualifiées, transmises avec 0 à 4 offres,
 * refus motivés, offres acceptées, contrats signés et livrés, mises en loyer
 * avec commission due, facturée ou payée, abandons. Aucune donnée réelle :
 * noms, ICE et adresses (.example) inventés. Tirages déterministes (graine
 * fixe) : le jeu est identique d'une installation à l'autre. Écrit par le
 * propriétaire, triggers désactivés ; idempotent (repère : première PME).
 */
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { schema, type Database } from "@leaseplace/db";
import {
  assess,
  computeCommission,
  DEFAULT_COMMISSION_GRID,
  DECLINE_REASONS,
  invoiceDueOn,
  priceOffer,
  referenceAnnualRent,
  type BusinessSector,
  type EquipmentCategory,
  type Grade,
  type LegalForm,
} from "@leaseplace/domain";
import { DEMO_APPETITES } from "../src/lib/demo-accounts";

const DAY = 86_400_000;

interface Company {
  name: string;
  slug: string;
  sector: BusinessSector;
  city: string;
  legalForm: LegalForm;
  revenue: number;
  owner: string;
}

const COMPANIES: readonly Company[] = [
  {
    name: "Souss Agrumes Export SARL",
    slug: "souss-agrumes",
    sector: "agriculture",
    city: "Agadir",
    legalForm: "sarl",
    revenue: 38_000_000,
    owner: "Hicham Ait Lahcen",
  },
  {
    name: "Bâtiments Rif Construction SA",
    slug: "batiments-rif",
    sector: "construction",
    city: "Tanger",
    legalForm: "sa",
    revenue: 96_000_000,
    owner: "Nadia Amrani",
  },
  {
    name: "Clinique Les Orangers SARL",
    slug: "clinique-orangers",
    sector: "health",
    city: "Rabat",
    legalForm: "sarl",
    revenue: 22_000_000,
    owner: "Dr Karim Bennani",
  },
  {
    name: "Fès Textile Industrie SARL",
    slug: "fes-textile",
    sector: "industry",
    city: "Fès",
    legalForm: "sarl",
    revenue: 31_000_000,
    owner: "Zineb Tazi",
  },
  {
    name: "Marrakech Événements SARLAU",
    slug: "marrakech-evenements",
    sector: "tourism",
    city: "Marrakech",
    legalForm: "sarlau",
    revenue: 6_500_000,
    owner: "Yassine Ouazzani",
  },
  {
    name: "Oriental Logistique SARL",
    slug: "oriental-logistique",
    sector: "transport",
    city: "Oujda",
    legalForm: "sarl",
    revenue: 27_000_000,
    owner: "Mourad Belhaj",
  },
  {
    name: "Atlas Froid Industriel SA",
    slug: "atlas-froid",
    sector: "industry",
    city: "Casablanca",
    legalForm: "sa",
    revenue: 120_000_000,
    owner: "Leïla Chraibi",
  },
  {
    name: "Doukkala Céréales SARL",
    slug: "doukkala-cereales",
    sector: "agriculture",
    city: "El Jadida",
    legalForm: "sarl",
    revenue: 14_000_000,
    owner: "Abdelaziz Moutawakil",
  },
  {
    name: "Cabinet Dentaire Al Amal SARL",
    slug: "dentaire-al-amal",
    sector: "health",
    city: "Casablanca",
    legalForm: "sarl",
    revenue: 4_200_000,
    owner: "Dr Salma Idrissi",
  },
  {
    name: "Tétouan Imprimerie SARL",
    slug: "tetouan-imprimerie",
    sector: "industry",
    city: "Tétouan",
    legalForm: "sarl",
    revenue: 9_800_000,
    owner: "Omar Benjelloun",
  },
  {
    name: "Kénitra Matériaux SARL",
    slug: "kenitra-materiaux",
    sector: "trade",
    city: "Kénitra",
    legalForm: "sarl",
    revenue: 18_500_000,
    owner: "Rachid El Ouafi",
  },
  {
    name: "Sahara Transports Frigorifiques SARL",
    slug: "sahara-frigo",
    sector: "transport",
    city: "Laâyoune",
    legalForm: "sarl",
    revenue: 41_000_000,
    owner: "Brahim Ould Ahmed",
  },
  {
    name: "Meknès Agro Équipement SARL",
    slug: "meknes-agro",
    sector: "agriculture",
    city: "Meknès",
    legalForm: "sarl",
    revenue: 12_000_000,
    owner: "Fatima Zahra Lamrani",
  },
  {
    name: "Data Maghreb Services SARL",
    slug: "data-maghreb",
    sector: "tech",
    city: "Casablanca",
    legalForm: "sarl",
    revenue: 16_000_000,
    owner: "Mehdi Sqalli",
  },
  {
    name: "Riad Hospitality Group SA",
    slug: "riad-hospitality",
    sector: "tourism",
    city: "Marrakech",
    legalForm: "sa",
    revenue: 58_000_000,
    owner: "Sophia Berrada",
  },
  {
    name: "Béni Mellal BTP SARL",
    slug: "beni-mellal-btp",
    sector: "construction",
    city: "Béni Mellal",
    legalForm: "sarl",
    revenue: 24_000_000,
    owner: "Khalid Nejjar",
  },
  {
    name: "Pharma Distribution Nord SARL",
    slug: "pharma-nord",
    sector: "trade",
    city: "Tanger",
    legalForm: "sarl",
    revenue: 67_000_000,
    owner: "Imane Kettani",
  },
  {
    name: "Laboratoire Ibn Sina Analyses SARL",
    slug: "labo-ibn-sina",
    sector: "health",
    city: "Fès",
    legalForm: "sarl",
    revenue: 8_900_000,
    owner: "Dr Hamza Alami",
  },
  {
    name: "Safi Pêche et Conserves SA",
    slug: "safi-conserves",
    sector: "industry",
    city: "Safi",
    legalForm: "sa",
    revenue: 140_000_000,
    owner: "Jamal Benkirane",
  },
  {
    name: "Ouarzazate Solaire Ingénierie SARL",
    slug: "ouarzazate-solaire",
    sector: "services",
    city: "Ouarzazate",
    legalForm: "sarl",
    revenue: 11_000_000,
    owner: "Amina Ait Benhaddou",
  },
  {
    name: "Nador Commerce Général SARL",
    slug: "nador-commerce",
    sector: "trade",
    city: "Nador",
    legalForm: "sarl",
    revenue: 7_400_000,
    owner: "Said Boukili",
  },
  {
    name: "Ifrane Bois et Menuiserie SARL",
    slug: "ifrane-bois",
    sector: "industry",
    city: "Ifrane",
    legalForm: "sarl",
    revenue: 5_600_000,
    owner: "Youssef Amezian",
  },
  {
    name: "Settat Carrières SARL",
    slug: "settat-carrieres",
    sector: "construction",
    city: "Settat",
    legalForm: "sarl",
    revenue: 33_000_000,
    owner: "Hassan Zerouali",
  },
  {
    name: "Casablanca Coursiers Express SARLAU",
    slug: "casa-coursiers",
    sector: "transport",
    city: "Casablanca",
    legalForm: "sarlau",
    revenue: 3_900_000,
    owner: "Anas Filali",
  },
  {
    name: "Coopérative Argan Essaouira",
    slug: "argan-essaouira",
    sector: "agriculture",
    city: "Essaouira",
    legalForm: "other",
    revenue: 2_600_000,
    owner: "Khadija Oubella",
  },
  {
    name: "Taza Travaux Publics SARL",
    slug: "taza-tp",
    sector: "construction",
    city: "Taza",
    legalForm: "sarl",
    revenue: 19_000_000,
    owner: "Driss Lahlou",
  },
  {
    name: "Mohammedia Plastiques SA",
    slug: "mohammedia-plastiques",
    sector: "industry",
    city: "Mohammedia",
    legalForm: "sa",
    revenue: 76_000_000,
    owner: "Rim Benslimane",
  },
  {
    name: "Agadir Nautique Services SARL",
    slug: "agadir-nautique",
    sector: "services",
    city: "Agadir",
    legalForm: "sarl",
    revenue: 5_100_000,
    owner: "Tarik Essaidi",
  },
  {
    name: "Larache Fruits Rouges SARL",
    slug: "larache-fruits",
    sector: "agriculture",
    city: "Larache",
    legalForm: "sarl",
    revenue: 21_000_000,
    owner: "Houda Zemmouri",
  },
];

const CATEGORIES_BY_SECTOR: Record<BusinessSector, readonly EquipmentCategory[]> = {
  transport: ["truck", "trailer", "light_vehicle"],
  construction: ["construction_machine", "truck", "light_vehicle"],
  health: ["medical", "it"],
  industry: ["industrial_machine", "it", "light_vehicle"],
  agriculture: ["agricultural", "truck", "light_vehicle"],
  trade: ["light_vehicle", "truck", "it"],
  services: ["it", "light_vehicle", "other"],
  tech: ["it", "other"],
  tourism: ["light_vehicle", "other"],
  other: ["other"],
};

const AMOUNT: Record<EquipmentCategory, [number, number]> = {
  light_vehicle: [180_000, 650_000],
  truck: [700_000, 2_400_000],
  trailer: [350_000, 1_600_000],
  construction_machine: [900_000, 4_500_000],
  industrial_machine: [500_000, 6_000_000],
  medical: [300_000, 3_500_000],
  it: [80_000, 900_000],
  agricultural: [250_000, 1_800_000],
  other: [100_000, 1_200_000],
};

const DESCRIPTIONS: Record<EquipmentCategory, readonly string[]> = {
  light_vehicle: ["Véhicules utilitaires légers", "Fourgons de livraison", "Pick-up double cabine"],
  truck: ["Tracteur routier 4x2", "Porteur 19 tonnes", "Camion benne 8x4"],
  trailer: ["Semi-remorque frigorifique", "Semi-remorque plateau", "Citerne alimentaire"],
  construction_machine: [
    "Pelle hydraulique 22 t",
    "Chargeuse sur pneus",
    "Centrale à béton mobile",
  ],
  industrial_machine: [
    "Ligne d'injection plastique",
    "Machine de découpe laser",
    "Compresseur industriel",
  ],
  medical: [
    "Scanner 64 barrettes",
    "Échographe et table d'examen",
    "Fauteuils dentaires et radiologie",
  ],
  it: ["Serveurs et baies de stockage", "Parc d'ordinateurs portables", "Équipement réseau"],
  agricultural: [
    "Tracteur agricole 110 ch",
    "Système d'irrigation goutte à goutte",
    "Moissonneuse-batteuse",
  ],
  other: ["Mobilier et agencement", "Groupe électrogène", "Bateau de service"],
};

type Status =
  | "draft"
  | "submitted"
  | "in_review"
  | "needs_info"
  | "qualified"
  | "routed"
  | "accepted"
  | "financed"
  | "cancelled";

/** 76 demandes : répartition sur tout le parcours. */
const PLAN: readonly [Status, number, [number, number]][] = [
  ["draft", 7, [1, 60]],
  ["submitted", 7, [1, 4]],
  ["in_review", 5, [2, 8]],
  ["needs_info", 4, [5, 15]],
  ["qualified", 5, [6, 14]],
  ["routed", 22, [2, 21]],
  ["accepted", 9, [20, 60]],
  ["financed", 11, [50, 160]],
  ["cancelled", 6, [10, 90]],
];

const STEPS: Record<Status, readonly Status[]> = {
  draft: ["draft"],
  submitted: ["draft", "submitted"],
  in_review: ["draft", "submitted", "in_review"],
  needs_info: ["draft", "submitted", "in_review", "needs_info"],
  qualified: ["draft", "submitted", "in_review", "qualified"],
  routed: ["draft", "submitted", "in_review", "qualified", "routed"],
  accepted: ["draft", "submitted", "in_review", "qualified", "routed", "accepted"],
  financed: ["draft", "submitted", "in_review", "qualified", "routed", "accepted", "financed"],
  cancelled: ["draft", "submitted", "cancelled"],
};

const BASE_RATE: Record<Grade, number> = { A: 0.072, B: 0.078, C: 0.086, D: 0.098, E: 0.11 };
const GRADE_ORDER = ["A", "B", "C", "D", "E"] as const;

/** Générateur pseudo-aléatoire à graine fixe (mulberry32). */
function rng(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T,
    shuffle: <T>(list: readonly T[]): T[] =>
      list
        .map((v) => ({ v, k: next() }))
        .sort((x, y) => x.k - y.k)
        .map((x) => x.v),
  };
}

const slugEmail = (name: string, domain: string) =>
  `${name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^dr /, "")
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "")}@${domain}.example`;

const revenueBand = (r: number) =>
  r < 3_000_000
    ? "lt_3m"
    : r < 10_000_000
      ? "3m_10m"
      : r < 50_000_000
        ? "10m_50m"
        : r < 175_000_000
          ? "50m_175m"
          : "gt_175m";

export interface VolumeIds {
  ops: string;
  admin: string;
  lessors: Record<string, string>;
  /** Utilisateur bailleur qui signe les offres (créé s'il manque). */
  lessorUsers: Record<string, string>;
  legalTexts: { processing: string; routing: string };
}

export async function seedVolume(db: Database, ids: VolumeIds): Promise<number> {
  const [existing] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(sql`slug = ${COMPANIES[0]?.slug ?? ""}`);
  if (existing) return 0;
  const r = rng(20_260_901);
  let created = 0;
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    const now = Date.now();

    // Un chargé d'affaires (sans accès) par bailleur qui n'a pas de compte de démo.
    const signer: Record<string, string> = { ...ids.lessorUsers };
    for (const [key, orgId] of Object.entries(ids.lessors)) {
      if (signer[key]) continue;
      const userId = uuidv7();
      await tx.insert(schema.users).values({
        id: userId,
        name: `Chargé d'affaires ${key.charAt(0).toUpperCase()}${key.slice(1)}`,
        email: `charge.affaires@${key}-leasing.example`,
        emailVerified: true,
      });
      await tx
        .insert(schema.memberships)
        .values({ id: uuidv7(), organizationId: orgId, userId, role: "lessor_analyst" });
      signer[key] = userId;
    }

    // 29 PME et leurs dirigeants (sans mot de passe : connexion par code).
    const companies = [];
    for (const [i, c] of COMPANIES.entries()) {
      const orgId = uuidv7();
      const ownerId = uuidv7();
      await tx
        .insert(schema.organizations)
        .values({ id: orgId, name: c.name, slug: c.slug, type: "company" });
      await tx.insert(schema.users).values({
        id: ownerId,
        name: c.owner,
        email: slugEmail(c.owner, c.slug),
        emailVerified: true,
      });
      await tx
        .insert(schema.memberships)
        .values({ id: uuidv7(), organizationId: orgId, userId: ownerId, role: "company_owner" });
      const incorporation = new Date(Date.UTC(1998 + r.int(0, 22), r.int(0, 11), r.int(1, 28)));
      await tx.insert(schema.companies).values({
        organizationId: orgId,
        legalName: c.name,
        ice: `00${String(1_000_000_000_000 + (i + 1) * 7_919_311).slice(0, 13)}`,
        legalForm: c.legalForm,
        incorporationDate: incorporation,
        sector: c.sector,
        city: c.city,
        address: `${String(r.int(2, 180))}, zone d'activité, ${c.city}`,
        revenueBand: revenueBand(c.revenue),
        headcountBand:
          c.revenue < 10_000_000 ? "10_49" : c.revenue < 60_000_000 ? "50_199" : "200_plus",
        kycStatus: "verified",
      });
      companies.push({ ...c, orgId, ownerId, incorporation });
    }

    const statuses = PLAN.flatMap(([s, n, days]) =>
      Array.from({ length: n }, () => ({ status: s, days })),
    );
    for (const [index, item] of statuses.entries()) {
      const company = companies[index % companies.length];
      if (!company) continue;
      const { status } = item;
      const category = r.pick(CATEGORIES_BY_SECTOR[company.sector]);
      const [lo, hi] = AMOUNT[category];
      const amountHt = Math.round((lo + r.next() * (hi - lo)) / 1000) * 1000;
      const durationMonths = r.pick([24, 36, 48, 60, 72, 84]);
      const firstRentPct = r.pick([0, 5, 10, 10, 15, 20]);
      const residualPct = r.pick([1, 1, 2]);
      const daysAgo = r.int(item.days[0], item.days[1]);
      const start = now - daysAgo * DAY;
      const at = (d: number) => new Date(Math.min(now - 3_600_000, start + d * DAY));
      const description = `${r.pick(DESCRIPTIONS[category])} — ${company.city}`;
      const requestId = uuidv7();
      const steps = STEPS[status];
      const submitted = status !== "draft";
      await tx.insert(schema.financingRequests).values({
        id: requestId,
        reference: sql`credit.next_request_reference()`,
        organizationId: company.orgId,
        createdBy: company.ownerId,
        status,
        equipmentCategory: category,
        equipmentDescription: description,
        condition: "new",
        supplierName: `Fournisseur ${company.city}`,
        amountHt,
        durationMonths,
        firstRentPct,
        residualPct,
        periodicity: r.next() < 0.85 ? "monthly" : "quarterly",
        submittedAt: submitted ? at(0) : null,
        cancelledAt: status === "cancelled" ? at(3) : null,
        createdAt: at(-1),
        updatedAt: at(Math.max(0, steps.length - 2)),
      });
      created++;
      for (const [i, to] of steps.entries())
        await tx.insert(schema.requestEvents).values({
          requestId,
          fromStatus: i === 0 ? null : steps[i - 1],
          toStatus: to,
          actorUserId:
            to === "in_review" || to === "qualified" || to === "needs_info"
              ? ids.ops
              : company.ownerId,
          occurredAt: at(
            i === 0
              ? -1
              : Math.min(i - 1, 3) + (to === "financed" ? 30 : to === "accepted" ? 8 : 0),
          ),
        });
      if (!submitted) continue;
      const processingId = uuidv7();
      await tx.insert(schema.consents).values({
        id: processingId,
        organizationId: company.orgId,
        requestId,
        purpose: "processing",
        legalTextId: ids.legalTexts.processing,
        grantedBy: company.ownerId,
        grantedAt: at(0),
      });
      if (!["qualified", "routed", "accepted", "financed"].includes(status)) continue;

      // Indice calculé par le moteur, note validée (comme en revue).
      const scale = company.revenue / 20_000_000;
      const fiscalYears = [0, 1].map((k) => ({
        year: 2025 - k,
        revenue: Math.round(company.revenue * (1 - k * 0.08)),
        netIncome: Math.round(company.revenue * (0.01 + r.next() * 0.07) * (1 - k * 0.1)),
        depreciation: Math.round(1_000_000 * scale * (0.5 + r.next())),
        equity: Math.round(company.revenue * (0.15 + r.next() * 0.25)),
        financialDebt: Math.round(company.revenue * (0.05 + r.next() * 0.35)),
        cash: Math.round(company.revenue * (0.02 + r.next() * 0.1)),
      }));
      const assessment = assess({
        now: new Date(now),
        incorporationDate: company.incorporation,
        sector: company.sector,
        equipmentCategory: category,
        condition: "new",
        equipmentYear: null,
        amountHt,
        annualRentHt: referenceAnnualRent({
          amountHt,
          durationMonths,
          periodicity: "monthly",
          firstRentPct,
          residualPct,
        }),
        fiscalYears,
        consistencyFailures: 0,
      });
      const assessmentId = uuidv7();
      await tx.insert(schema.riskAssessments).values({
        id: assessmentId,
        requestId,
        organizationId: company.orgId,
        modelVersion: assessment.modelVersion,
        inputs: { fiscalYears },
        ratios: assessment.ratios,
        factors: assessment.factors,
        flags: assessment.flags,
        score: assessment.score,
        grade: assessment.grade,
        uncappedGrade: assessment.uncappedGrade,
        createdBy: ids.ops,
        createdAt: at(2),
      });
      await tx.insert(schema.creditMemos).values({
        id: uuidv7(),
        requestId,
        assessmentId,
        status: "approved",
        content: {
          sections: [
            {
              key: "presentation",
              paragraphs: [
                {
                  text: `${company.name}, ${company.city}, en activité depuis ${String(company.incorporation.getUTCFullYear())}.`,
                  sources: ["PROFILE"],
                },
              ],
            },
            {
              key: "need",
              paragraphs: [
                {
                  text: `Financement en crédit-bail : ${description.toLowerCase()}.`,
                  sources: ["REQUEST"],
                },
              ],
            },
            {
              key: "financials",
              paragraphs: [
                {
                  text: "Activité régulière sur les deux derniers exercices ; endettement à suivre.",
                  sources: ["FINANCIALS"],
                },
              ],
            },
          ],
        },
        sourceMap: {},
        createdBy: ids.ops,
        decidedBy: ids.ops,
        decidedAt: at(3),
        createdAt: at(3),
      });
      if (status === "qualified") continue;

      // Bailleurs dont l'appétit couvre le dossier ; au moins deux destinataires.
      const grade = assessment.grade;
      const fits = DEMO_APPETITES.filter(
        (a) =>
          amountHt >= a.minAmountHt &&
          amountHt <= a.maxAmountHt &&
          durationMonths >= a.minDurationMonths &&
          durationMonths <= a.maxDurationMonths &&
          (a.sectors.length === 0 || a.sectors.includes(company.sector)) &&
          (a.categories.length === 0 || a.categories.includes(category)) &&
          GRADE_ORDER.indexOf(grade) <= GRADE_ORDER.indexOf(a.minGrade),
      ).map((a) => a.organization);
      const pool = r.shuffle(fits.length >= 2 ? fits : [...new Set([...fits, "cedre", "oasis"])]);
      const sentTo = pool.slice(0, Math.min(4, Math.max(2, r.int(2, 4))));
      const routingConsent = uuidv7();
      await tx.insert(schema.consents).values({
        id: routingConsent,
        organizationId: company.orgId,
        requestId,
        purpose: "routing",
        legalTextId: ids.legalTexts.routing,
        grantedBy: company.ownerId,
        grantedAt: at(3),
      });
      for (const l of sentTo)
        await tx
          .insert(schema.consentRecipients)
          .values({ consentId: routingConsent, lessorOrganizationId: ids.lessors[l] ?? "" });
      const decisionId = uuidv7();
      await tx.insert(schema.routingDecisions).values({
        id: decisionId,
        requestId,
        grade,
        maxTargets: 4,
        profile: { demo: true },
        appetites: [],
        createdBy: ids.ops,
        createdAt: at(3),
      });

      // Offres : 0 à 4 pour un dossier transmis, au moins 2 pour un dossier accepté.
      const closed = status === "accepted" || status === "financed";
      const offerCount = closed
        ? Math.max(2, r.int(2, sentTo.length))
        : Math.min(sentTo.length, r.int(0, sentTo.length));
      const offering = sentTo.slice(0, offerCount);
      const winner = closed ? r.pick(offering) : null;
      const offerIds = new Map<string, string>();
      for (const [i, l] of sentTo.entries()) {
        const targetId = uuidv7();
        const offered = offering.includes(l);
        // Passé le délai de réponse, un bailleur sans offre a presque toujours décliné.
        const declined = !offered && r.next() < (daysAgo > 5 || closed ? 0.85 : 0.2);
        const viewed = offered || declined || r.next() < 0.6;
        await tx.insert(schema.routingTargets).values({
          id: targetId,
          decisionId,
          requestId,
          lessorOrganizationId: ids.lessors[l] ?? "",
          status: offered ? "offered" : declined ? "declined" : viewed ? "viewed" : "sent",
          exclusions: [],
          rank: i + 1,
          proposed: true,
          sentAt: at(3),
          slaDueAt: new Date(at(3).getTime() + 3 * DAY),
          firstViewedAt: viewed ? at(3 + r.next()) : null,
          respondedAt: offered || declined ? at(3.5 + r.next() * 2) : null,
        });
        await tx
          .insert(schema.threads)
          .values({ id: uuidv7(), requestId, lessorOrganizationId: ids.lessors[l] ?? "" });
        if (declined) {
          const reason = r.pick(DECLINE_REASONS.filter((x) => x !== "other"));
          await tx.insert(schema.targetDeclines).values({
            targetId,
            reason,
            declinedBy: signer[l] ?? "",
            declinedAt: at(4),
          });
          continue;
        }
        if (!offered) continue;
        const rate = Math.round((BASE_RATE[grade] + (r.next() - 0.5) * 0.012) * 10_000) / 10_000;
        const fileFeesHt = r.pick([0, 1_500, 2_500, 5_000, 8_000]);
        const priced = priceOffer({
          financedAmountHt: amountHt,
          durationMonths,
          periodicity: "monthly",
          timing: "advance",
          annualRate: rate,
          firstRentHt: Math.round((amountHt * firstRentPct) / 100),
          residualValueHt: Math.round((amountHt * residualPct) / 100),
          fileFeesHt,
          insurancePerPeriodHt: 0,
          insuranceRequired: false,
          validUntil: new Date(now + r.int(5, 30) * DAY),
          conditions: r.next() < 0.3 ? "Caution personnelle du dirigeant." : "",
        });
        const offerId = uuidv7();
        offerIds.set(l, offerId);
        await tx.insert(schema.offers).values({
          id: offerId,
          targetId,
          requestId,
          lessorOrganizationId: ids.lessors[l] ?? "",
          status: closed ? (l === winner ? "accepted" : "not_retained") : "submitted",
          financedAmountHt: amountHt,
          durationMonths,
          periodicity: "monthly",
          timing: "advance",
          annualRate: rate,
          firstRentHt: priced.firstRentHt,
          rentHt: priced.rentHt,
          residualValueHt: Math.round((amountHt * residualPct) / 100),
          fileFeesHt,
          insurancePerPeriodHt: 0,
          insuranceRequired: false,
          vatRate: 0.2,
          financingCostHt: priced.normalized.totals.financingCostHt,
          paidTtc: priced.normalized.totals.paidTtc,
          effectiveRate: Math.round(priced.normalized.rates.annualEffectiveRate * 1e6) / 1e6,
          validUntil: new Date(now + r.int(5, 30) * DAY),
          conditions: "",
          submittedBy: signer[l] ?? "",
          createdAt: at(4 + i * 0.3),
        });
      }
      if (!closed || !winner) continue;

      // Opération : acceptée → signée → livrée → en loyer (avec commission).
      const lessorId = ids.lessors[winner] ?? "";
      const day = (d: Date) =>
        new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const acceptedAt = at(8);
      const dealStatus =
        status === "financed"
          ? "active"
          : r.pick(["accepted", "signed", "signed", "delivered"] as const);
      const chain = ["accepted", "signed", "delivered", "active"] as const;
      const reached = chain.slice(0, chain.indexOf(dealStatus) + 1);
      const dates = {
        signed: day(at(14)),
        delivered: day(at(24)),
        active: day(at(30)),
      };
      const dealId = uuidv7();
      await tx.insert(schema.deals).values({
        id: dealId,
        requestId,
        offerId: offerIds.get(winner) ?? "",
        companyOrganizationId: company.orgId,
        lessorOrganizationId: lessorId,
        status: dealStatus,
        financedAmountHt: amountHt,
        acceptedAt,
        acceptedBy: company.ownerId,
        signedOn: reached.includes("signed") ? dates.signed : null,
        deliveredOn: reached.includes("delivered") ? dates.delivered : null,
        activatedOn: reached.includes("active") ? dates.active : null,
      });
      for (const [i, to] of reached.entries())
        await tx.insert(schema.dealEvents).values({
          dealId,
          fromStatus: i === 0 ? null : reached[i - 1],
          toStatus: to,
          occurredOn: to === "accepted" ? acceptedAt : dates[to],
          actorUserId: to === "accepted" ? company.ownerId : (signer[winner] ?? null),
        });
      if (dealStatus !== "active") continue;
      const [mandate] = await tx
        .select({ id: schema.mandates.id })
        .from(schema.mandates)
        .where(sql`lessor_organization_id = ${lessorId} and status = 'active'`);
      if (!mandate) continue;
      const c = computeCommission(amountHt, DEFAULT_COMMISSION_GRID);
      const commissionStatus = r.pick(["due", "invoiced", "paid", "paid"] as const);
      let invoiceId: string | null = null;
      if (commissionStatus !== "due") {
        invoiceId = uuidv7();
        const issuedOn = day(at(33));
        await tx.insert(schema.invoices).values({
          id: invoiceId,
          number: sql`billing.next_invoice_number()`,
          lessorOrganizationId: lessorId,
          issuedOn,
          dueOn: invoiceDueOn(issuedOn),
          amountHt: c.amountHt,
          vatRate: c.vatRate,
          vat: c.vat,
          amountTtc: c.amountTtc,
          createdBy: ids.admin,
        });
      }
      await tx.insert(schema.commissions).values({
        id: uuidv7(),
        dealId,
        requestId,
        lessorOrganizationId: lessorId,
        mandateId: mandate.id,
        status: commissionStatus,
        financedAmountHt: amountHt,
        grid: DEFAULT_COMMISSION_GRID,
        amountHt: c.amountHt,
        vatRate: c.vatRate,
        vat: c.vat,
        amountTtc: c.amountTtc,
        activatedOn: dates.active,
        invoiceId,
        paidOn: commissionStatus === "paid" ? day(at(50)) : null,
        paymentReference:
          commissionStatus === "paid" ? `VIR-${String(r.int(100_000, 999_999))}` : null,
      });
    }
  });
  return created;
}
