#!/usr/bin/env node
/**
 * Captures d'écran de l'APERÇU (dist/ construit par `npm run build:preview`)
 * avec une session Supabase FACTICE injectée dans le navigateur de test :
 * toutes les requêtes vers *.supabase.co sont interceptées localement
 * (aucun réseau, aucune vraie donnée). Outil de documentation uniquement —
 * rien de tout ceci n'est embarqué dans l'application.
 *
 * Usage : node scripts/preview-screenshots.mjs [dossier_sortie]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const DIST = resolve('dist');
const SORTIE = resolve(process.argv[2] ?? 'screenshots');
const PORT = 4179;
const REF = 'fihklznbfufhowopwwuc';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const PROJET_ID = '33333333-3333-4333-8333-333333333333';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

function jwtFactice() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: USER_ID,
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.factice`;
}

const SESSION = {
  access_token: jwtFactice(),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'factice',
  user: {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@h2fleet.test',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Démo Capture' },
    created_at: new Date().toISOString(),
  },
};

const LIGNES = {
  profiles: [{ id: USER_ID, full_name: 'Démo Capture', company: 'Ville de Démo', avatar_url: null, function_title: 'x', fleet_size: '10_50', email: 'demo@h2fleet.test' }],
  organization_members: [{ id: 'm1', organization_id: ORG_ID, user_id: USER_ID, role: 'admin', created_at: new Date().toISOString(), organizations: { id: ORG_ID, name: 'Ville de Démo', org_type: 'municipalite', region: 'CA_QC', currency: 'CAD' } }],
  organizations: [{ id: ORG_ID, name: 'Ville de Démo', org_type: 'municipalite', region: 'CA_QC', currency: 'CAD', created_by: USER_ID, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
  projects: [{ id: PROJET_ID, name: 'Transition 2027-2036', description: 'Plan de remplacement pluriannuel', country_or_region: 'CA_QC', currency: 'CAD', default_analysis_horizon_years: 10, default_discount_rate: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user_id: USER_ID, organization_id: ORG_ID }],
  vehicles: [
    { id: 'v1', organization_id: ORG_ID, unit_number: 'U-101', vin: null, make: 'Ford', model: 'F-550', model_year: 2018, in_service_date: null, category: 'camionnette', fuel_type: 'diesel', annual_km: 32000, consumption_per_100km: 16.4, consumption_source: 'saisie', usage_profile: 'urbain', department: 'Travaux publics', depot: 'Garage central', status: 'actif', telematics_vehicle_id: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'v2', organization_id: ORG_ID, unit_number: 'U-214', vin: null, make: 'Freightliner', model: 'M2 106', model_year: 2016, in_service_date: null, category: 'camion_moyen', fuel_type: 'diesel', annual_km: 41000, consumption_per_100km: null, consumption_source: 'estimation', usage_profile: 'regional', department: 'Voirie', depot: 'Garage central', status: 'actif', telematics_vehicle_id: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'v3', organization_id: ORG_ID, unit_number: 'B-07', vin: null, make: 'Nova Bus', model: 'LFS', model_year: 2014, in_service_date: null, category: 'autobus_urbain_12m', fuel_type: 'diesel', annual_km: 58000, consumption_per_100km: 46, consumption_source: 'telematique', usage_profile: 'urbain', department: 'Transport', depot: 'Dépôt Nord', status: 'actif', telematics_vehicle_id: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ],
};

// Étape Flotte du parcours : véhicules inclus dans le projet (joint vehicles(*))
LIGNES.project_vehicles = [
  { id: 'pv1', project_id: PROJET_ID, vehicle_id: 'v1', replacement_year: 2028, target_technology: 'bev', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), vehicles: LIGNES.vehicles[0] },
  { id: 'pv2', project_id: PROJET_ID, vehicle_id: 'v2', replacement_year: 2028, target_technology: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), vehicles: LIGNES.vehicles[1] },
  { id: 'pv3', project_id: PROJET_ID, vehicle_id: 'v3', replacement_year: 2030, target_technology: 'bev', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), vehicles: LIGNES.vehicles[2] },
];

function tableDepuisUrl(url) {
  const m = url.pathname.match(/\/rest\/v1\/([a-zA-Z_]+)/);
  return m ? m[1] : null;
}

async function main() {
  if (!existsSync(DIST)) throw new Error('dist/ absent — lancer npm run build:preview');
  mkdirSync(SORTIE, { recursive: true });

  const serveur = createServer(async (req, res) => {
    const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let fichier = join(DIST, chemin === '/' ? 'index.html' : chemin);
    if (!existsSync(fichier)) fichier = join(DIST, 'index.html');
    const corps = await readFile(fichier);
    res.writeHead(200, { 'content-type': MIME[extname(fichier)] ?? 'application/octet-stream' });
    res.end(corps);
  });
  await new Promise((r) => serveur.listen(PORT, r));

  // Chromium préinstallé dans l'environnement (PLAYWRIGHT_BROWSERS_PATH) ;
  // executablePath explicite pour rester indépendant de la révision.
  const navigateur = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-CA' });

  // Interception : le Supabase réel n'est JAMAIS contacté.
  await contexte.route(`**://${REF}.supabase.co/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/auth/v1/token') || url.pathname.startsWith('/auth/v1/user')) {
      return route.fulfill({ json: url.pathname.includes('user') ? SESSION.user : SESSION });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = tableDepuisUrl(url);
      let lignes = LIGNES[table] ?? [];
      const attendUnique = route.request().headers()['accept']?.includes('vnd.pgrst.object');
      const json = attendUnique ? (lignes[0] ?? null) : lignes;
      return route.fulfill({
        status: attendUnique && json === null ? 406 : 200,
        headers: { 'content-range': `0-${Math.max(lignes.length - 1, 0)}/${lignes.length}` },
        json,
      });
    }
    return route.fulfill({ json: [] });
  });

  const page = await contexte.newPage();
  await page.goto(`http://localhost:${PORT}/#/`);
  await page.evaluate(([ref, session]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    localStorage.setItem('h2fleet-language', 'fr');
  }, [REF, SESSION]);

  const captures = [
    ['#/dashboard', 'accueil-menu-6-entrees'],
    ['#/dashboard/fleet', 'ma-flotte'],
    [`#/dashboard/projects/${PROJET_ID}/flotte`, 'parcours-etape-flotte'],
    [`#/dashboard/projects/${PROJET_ID}/faisabilite`, 'parcours-etape-faisabilite'],
    [`#/dashboard/projects/${PROJET_ID}/strategies`, 'parcours-etape-strategies'],
    [`#/dashboard/projects/${PROJET_ID}/plan`, 'parcours-etape-plan'],
    [`#/dashboard/projects/${PROJET_ID}/financement`, 'parcours-etape-financement'],
    [`#/dashboard/projects/${PROJET_ID}/suivi`, 'parcours-etape-suivi'],
    ['#/dashboard/organization', 'organisation'],
    ['#/dashboard/library', 'bibliotheque'],
  ];
  for (const [route, nom] of captures) {
    await page.goto(`http://localhost:${PORT}/${route}`);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: join(SORTIE, `${nom}.png`), fullPage: ['strategies','plan','financement','suivi'].some((x) => nom.includes(x)) });
    console.log('capturé :', nom);
  }

  await navigateur.close();
  serveur.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
