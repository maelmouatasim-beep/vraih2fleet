import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// ENRICHED KNOWLEDGE BASE - GPT-4 Level Expert
// ============================================
const KNOWLEDGE_BASE: Record<string, Record<string, string>> = {
  // ============================================
  // PRODUCT KNOWLEDGE
  // ============================================
  product: {
    "h2fleet planner": `H2Fleet Planner est une plateforme SaaS canadienne d'analyse TCO (Coût Total de Possession) pour l'électrification des flottes commerciales.

**FONCTIONNALITÉS PRINCIPALES:**
• Calculateur TCO multi-technologies (BEV, FCEV, Diesel, Biométhane)
• Scénarios comparatifs avec visualisations détaillées
• Base de données de subventions canadiennes actualisée
• Planificateur d'infrastructure de recharge
• Analyses de sensibilité et projections
• Export PDF/Excel des rapports

**NAVIGATION:**
- /dashboard : Tableau de bord principal
- /dashboard/projects : Gestion des projets
- /dashboard/scenarios : Scénarios TCO
- /dashboard/analytics : Analyses avancées
- /dashboard/infrastructure : Planification infrastructure
- /dashboard/subsidies : Subventions disponibles
- /dashboard/donnees-ref : Données de référence
- /dashboard/telematics : Connexion télématique`,

    "créer scénario": `## Comment créer un scénario TCO

### Formulaire Simple (/dashboard/scenarios/new)
1. Sélectionner types de véhicules (classe 4-8)
2. Définir quantités et km/an
3. Choisir technologies cibles (BEV, FCEV, Diesel)
4. Inclure subventions applicables
5. Voir résultats TCO instantanés

### Formulaire Flexible (/dashboard/flexible-scenario)
- Configuration avancée par véhicule
- Mix technologique personnalisé
- Paramètres détaillés (consommation, maintenance)
- Sources de données traçables

**PARAMÈTRES CLÉS:**
- Horizon d'analyse : 5-15 ans (défaut 10)
- Taux d'actualisation : 3-7% (défaut 5%)
- Région : QC, ON, BC, AB, MB
- Sources : référence ou personnalisées`,

    "fonctionnalités": `## Modules H2Fleet

📊 **Scénarios TCO**
- Création de scénarios comparatifs
- Calcul automatique CAPEX/OPEX
- Graphiques interactifs
- Comparaison multi-scénarios

📈 **Analytics**
- Analyses de sensibilité
- Projections multi-années
- ROI et payback period
- What-if analysis

🏗️ **Infrastructure**
- Dimensionnement bornes/stations
- Coûts installation et raccordement
- Puissance électrique requise
- Planification évolutive

💰 **Subventions**
- Base de données actualisée 2025-2026
- Calcul éligibilité automatique
- Montants cumulables
- Dates limites

📋 **Données de référence**
- Prix énergie par province
- Coûts véhicules actualisés
- Facteurs d'émission CO2
- Sources vérifiées

📤 **Export**
- Rapports PDF professionnels
- Export Excel détaillé
- Partage de projets`,

    "démarrer h2fleet": `## Guide de démarrage rapide

### Étape 1 : Créer un projet (2 min)
1. Cliquez sur **"Nouveau Projet"**
2. Nommez-le (ex: "Analyse Flotte 2026")
3. Sélectionnez votre **province**
4. Définissez durée d'analyse (10 ans recommandé)

### Étape 2 : Créer un scénario (5 min)
1. Dans votre projet, cliquez **"Nouveau Scénario"**
2. Définissez votre flotte actuelle (diesel)
3. Ajoutez les alternatives (électrique, hydrogène)
4. Incluez les subventions applicables

### Étape 3 : Analyser (3 min)
- Consultez le **TCO comparatif**
- Identifiez les **économies potentielles**
- Vérifiez la **période de retour**
- Exportez pour votre direction

🚀 En 10 minutes, vous aurez votre première analyse complète !`,

    "télématique connexion": `## Connecter votre télématique

### Fournisseurs supportés :
- **Geotab** (MyGeotab)
- **Samsara**
- Autres sur demande

### Étapes de connexion :
1. Allez dans **Télématique** (/dashboard/telematics)
2. Cliquez sur **"Connecter"**
3. Entrez vos identifiants API
4. Sélectionnez les véhicules à importer

### Données importées :
- Kilométrage annuel réel
- Consommation carburant
- Type et classe de véhicule
- Profil d'utilisation

📊 Ces données réelles améliorent la précision du TCO de 20-30%.`,
  },

  // ============================================
  // TCO METHODOLOGY
  // ============================================
  methodology: {
    "définition tco": `## Coût Total de Possession (TCO)

Le TCO mesure le coût **RÉEL** d'un véhicule sur sa durée de vie complète, incluant tous les coûts directs et indirects.

### Formule :
**TCO = CAPEX + Σ(OPEX_année / (1 + taux)^année)**

### Composantes CAPEX (acquisition) :
💰 Prix d'achat du véhicule
💰 Infrastructure de recharge
💰 Installation et raccordement
💰 MOINS subventions applicables

### Composantes OPEX (annuel) :
📊 Énergie (carburant/électricité/H2)
📊 Maintenance et réparations
📊 Assurance
📊 Taxes (incl. taxe carbone)

### Actualisation :
Les coûts futurs sont ramenés en valeur présente avec un taux d'actualisation (typiquement 5%) pour refléter la valeur temps de l'argent.`,

    "calcul détaillé": `## Calcul TCO détaillé

### 1. CAPEX NET
CAPEX_net = Prix_véhicule + Infrastructure - Subventions

### 2. OPEX ANNUEL
OPEX = Coût_énergie + Maintenance + Assurance + Taxes
Coût_énergie = (km_annuel × consommation/100) × prix_unitaire

### 3. TCO TOTAL (10 ans, taux 5%)
TCO = CAPEX_net + Σ(OPEX_an / 1.05^an)

### Exemple - Camion Classe 8, 150,000 km/an, Québec :

| Élément | Diesel | Électrique | Hydrogène |
|---------|--------|------------|-----------|
| Véhicule | 180,000$ | 450,000$ | 550,000$ |
| Infrastructure | 0$ | 50,000$ | 0$ |
| Subventions | 0$ | -200,000$ | -200,000$ |
| **CAPEX net** | 180,000$ | 300,000$ | 350,000$ |
| OPEX/an | 92,000$ | 42,000$ | 85,000$ |
| **TCO 10 ans** | 894,000$ | 632,000$ | 1,006,000$ |

✅ Électrique : économie de 262,000$ (-29%)
❌ Hydrogène : surcoût de 112,000$ (+12%)`,

    "facteurs critiques": `## 7 Facteurs critiques du TCO

### 1. KILOMÉTRAGE ANNUEL ⭐ (Impact: TRÈS ÉLEVÉ)
- Plus élevé = électrique plus rentable
- Break-even typique: 60,000-80,000 km/an
- >100,000 km/an: électrique TOUJOURS gagnant

### 2. PRIX DE L'ÉNERGIE (Impact: ÉLEVÉ)
- Diesel: 1.50-1.90 $/L (volatile ±20%/an)
- Électricité: 0.078-0.258 $/kWh (stable)
- H2: 13-16 $/kg (très élevé, en baisse)

### 3. SUBVENTIONS (Impact: ÉLEVÉ)
- iMHZEV: jusqu'à 200,000$ par véhicule
- ZEVIP: 50% infrastructure (max 50k$ DCFC)
- Programmes provinciaux additionnels

### 4. MAINTENANCE (Impact: MOYEN)
- Électrique: -40 à -60% vs diesel
- Hydrogène: similaire à diesel
- Moins de pièces mobiles = moins de pannes

### 5. CLIMAT (Impact: MOYEN pour BEV)
- BEV: -20 à -30% autonomie en hiver
- FCEV: stable au froid
- Impact sur planification des routes

### 6. DURÉE DE VIE BATTERIES (Impact: VARIABLE)
- Garantie: 8-10 ans / 500,000+ km
- Remplacement: 100,000-200,000$

### 7. TAXE CARBONE (Impact: CROISSANT)
- 2024: 80$/t CO2 → +0.18$/L
- 2030: 170$/t CO2 → +0.38$/L
→ Impact cumulatif: +**0.45$/L** d'ici 2030`,

    "payback période": `## Période de retour sur investissement

### Définition :
Temps pour que les économies OPEX compensent le surcoût CAPEX.

### Formule :
**Payback = Surcoût CAPEX ÷ Économies OPEX annuelles**

### Exemple Classe 8 Électrique vs Diesel (QC) :
- Surcoût CAPEX net: 120,000$ (après subventions)
- Économie OPEX/an: 50,000$
- **Payback: 2.4 ans**

### Benchmarks typiques (avec subventions) :
- ⚡ **EV Classe 8** : 2-4 ans
- ⚡ **EV Classe 6-7** : 3-5 ans
- 🔋 **H2 FCEV** : 6-10 ans (souvent non rentable)

💡 Les subventions réduisent le payback de 2-3 ans en moyenne.`,
  },

  // ============================================
  // VEHICLE TECHNOLOGIES
  // ============================================
  technologies: {
    "électrique bev": `## Véhicules Électriques à Batterie (BEV)

### ✅ AVANTAGES :
• Coût énergétique **LE PLUS BAS**
  - QC: ~3.90$/100km vs 22$/100km diesel
  - ON: ~7.00$/100km
• Maintenance réduite de **40-60%**
• Subventions jusqu'à **200,000$**
• Zéro émission directe
• Couple instantané, conduite plus douce

### ❌ LIMITATIONS :
• Autonomie: 200-450 km (selon charge)
• Temps de recharge: 30min-8h
• Performance hiver: -20 à -30%
• Infrastructure requise
• Poids batteries (impact charge utile)

### APPLICATIONS OPTIMALES :
✓ Livraison urbaine (<200 km/jour)
✓ Routes prévisibles et régulières
✓ Retour au dépôt quotidien
✓ Opérations multi-quarts avec recharge

### MODÈLES DISPONIBLES AU CANADA :
- Volvo VNR Electric (Classe 8) - 275 km
- Freightliner eCascadia (Classe 8) - 400 km
- Lion Electric (Classes 6-8) - 400 km 🍁
- Peterbilt 579EV (Classe 8)
- Ford E-Transit (VAN) - 200 km`,

    "hydrogène fcev": `## Véhicules à Pile à Hydrogène (FCEV)

### ✅ AVANTAGES :
• Autonomie: 500-700 km
• Recharge rapide: 10-20 min
• Stable au froid
• Zéro émission directe

### ❌ LIMITATIONS CRITIQUES :
• H2 **TRÈS CHER**: 13-16 $/kg au Canada
• Coût/km: **PLUS ÉLEVÉ que diesel**
• Infrastructure quasi inexistante (<20 stations publiques Canada)
• Prix véhicule: +40-60% vs diesel
• TCO: généralement **+20-40% vs diesel**

### ⚠️ RÉALITÉ 2026 :
• **NON RENTABLE** actuellement
• Projets abandonnés: Brampton, Winnipeg (H2 trop cher)
• Production H2 vert insuffisante au Canada

### RECOMMANDATION :
→ **ATTENDRE** que H2 passe sous 5$/kg
→ Surveiller développement infrastructure
→ Pour l'instant: électrique ou diesel préférable

### MODÈLES DISPONIBLES :
- Hyundai XCIENT Fuel Cell (Classe 8) - 400 km
- Nikola Tre FCEV (Classe 8) - 800 km`,

    "diesel": `## Véhicules Diesel Conventionnels

### ENCORE OPTIMAL POUR :
✓ Longue distance (>500 km/jour)
✓ Zones sans infrastructure électrique
✓ Charge maximale requise
✓ Flexibilité itinéraires

### COÛTS TYPIQUES (Classe 8) :
- Prix véhicule: 150,000-220,000$
- Consommation: 35-45 L/100km
- Coût carburant: 1.50-1.90$/L
- Coût/km: 0.55-0.85$/km

### INCONVÉNIENTS CROISSANTS :
✗ Taxe carbone: +0.45$/L d'ici 2030
✗ Maintenance coûteuse
✗ Émissions: 70-90 tonnes CO2/an
✗ Obsolescence programmée (2040)
✗ Volatilité prix carburant

### PROJECTION :
- 2030: Diesel +25-35% plus cher (taxe carbone)
- 2035: Restrictions ZFE grandes villes
- 2040: Fin des ventes véhicules neufs diesel`,

    "biométhane": `## Biométhane / GNR (Gaz Naturel Renouvelable)

### ✅ AVANTAGES :
• Réduction émissions: **-80 à -90%** vs diesel
• Coût compétitif: ~1.00-1.30$/L équivalent
• Infrastructure GNC existante (~60 stations Canada)
• Production locale (Québec, Ontario)
• Technologie mature et fiable

### ❌ LIMITATIONS :
• Autonomie réduite vs diesel
• Stations moins répandues
• Réservoirs plus volumineux

### APPLICATIONS :
✓ Transport régional
✓ Collecte de déchets
✓ Livraison moyenne distance
✓ **Transition** avant électrification

### SUBVENTIONS :
- Écocamionnage QC: jusqu'à 75,000$ (Classe 8)
- Programme fédéral limité

### DISPONIBILITÉ CANADA :
- Énergir (QC): production et distribution
- FortisBC (BC): réseau GNR
- ~60 stations publiques

💡 C'est une **excellente solution de transition** souvent négligée!`,
  },

  // ============================================
  // CANADIAN CONTEXT
  // ============================================
  contextCanadian: {
    "subventions fédérales": `## Programmes Fédéraux 2025-2026

### iMHZEV (Transports Canada)
**Programme principal véhicules lourds ZEV**

| Classe | Montant max |
|--------|-------------|
| Classe 2b-3 | 50,000$ |
| Classe 4-5 | 75,000$ |
| Classe 6-7 | 150,000$ |
| Classe 8 | **200,000$** |
| Autobus | 200,000$ |

**Conditions:**
- Véhicules 100% ZEV uniquement (BEV ou FCEV)
- Enregistrement au Canada
- Achat ou location longue durée

---

### ZEVIP (RNCan)
**Infrastructure de recharge**

| Type | Couverture | Max |
|------|------------|-----|
| Level 2 | 50% | 5,000$ |
| DCFC | 50% | **50,000$** |
| Station H2 | 50% | **1,500,000$** |

**Conditions:**
- Accessible au public OU flottes >10 véhicules
- Appels à projets périodiques

✅ **CUMULABLE** avec programmes provinciaux`,

    "québec": `## Programmes Québec

### Écocamionnage (MTMD)
• Véhicules lourds ZEV: **30-50%** du prix
• Cumulable avec iMHZEV
• Montants variables selon appels à projets

### Avantages Québec :
• Électricité la moins chère: **0.078$/kWh**
• Tarif M (grandes puissances) avantageux
• Crédit carbone: revenus potentiels
• Production locale (Lion Electric 🍁)

### Infrastructure :
• Programme Roulez Vert (bornes)
• Subventions municipales additionnelles
• Zones ZFE à venir (Montréal)

### AVANTAGE COMPÉTITIF :
Le Québec offre le **TCO électrique le plus bas au Canada** grâce à l'électricité hydro à faible coût.`,

    "ontario": `## Programmes Ontario

### Green Commercial Vehicle Program
• Incitatifs véhicules moyens/lourds ZEV
• Programmes variables selon budget

### Prix énergie :
• Électricité: **0.141$/kWh** (moyen)
• Impact TCO significatif vs Québec (+80% coût énergie)

### Infrastructure :
• Réseau DCFC en développement
• Corridor 401 électrifié progressivement
• Investissements fédéraux significatifs

### Marché :
• Plus grand marché de flottes au Canada
• Concentration manufacturiers (Brampton, Windsor)
• Hub logistique continental`,

    "colombie-britannique": `## Programmes Colombie-Britannique

### CleanBC Heavy-Duty Vehicle Program
• Incitatifs véhicules commerciaux ZEV
• Focus sur transport marchandises
• Programmes portuaires (Vancouver, Prince Rupert)

### Prix énergie :
• Électricité: **0.129$/kWh**
• H2 retail: **13-16$/kg** (HTEC stations)

### Infrastructure H2 :
• Réseau HTEC le plus développé au Canada
• Stations: Vancouver, Burnaby, Victoria
• Plans d'expansion corridor

### Particularités :
• Taxe carbone provinciale additionnelle
• Réglementations ZEV avancées
• Ports: hubs logistiques majeurs`,

    "alberta": `## Programmes Alberta

### Heavy-Duty Vehicle Emission Reduction
• Incitatifs limités
• Focus sur réduction émissions

### Prix énergie :
• Électricité: **0.258$/kWh** (LE PLUS ÉLEVÉ)
• Impact TCO MAJEUR sur BEV

### Considérations :
• Industrie pétrolière dominante
• Infrastructure électrique moins développée
• Diesel reste très compétitif
• Climat froid: impact autonomie BEV

### ⚠️ Recommandation :
L'Alberta est la province où l'électrification est **MOINS avantageuse** financièrement due aux coûts d'électricité élevés. Analyser cas par cas.`,

    "réglementations": `## Réglementations Canadiennes

### Normes ZEV Véhicules Lourds :
• 2030: 35% ventes neuves ZEV
• 2040: **100% ventes neuves ZEV**
• Application progressive

### Taxe Carbone Fédérale :
| Année | $/tonne | Impact diesel |
|-------|---------|---------------|
| 2024 | 80$ | +0.18$/L |
| 2025 | 95$ | +0.21$/L |
| 2030 | 170$ | **+0.38$/L** |

→ Impact cumulatif: **+0.45$/L** d'ici 2030

### Zones Faibles Émissions (ZFE) :
• À venir dans les grandes villes
• Montréal, Toronto, Vancouver en planification
• Restrictions diesel progressives`,
  },

  // ============================================
  // 2025-2026 DATA
  // ============================================
  data: {
    "prix énergie": `## Prix Énergie Canada 2025-2026

### DIESEL :
• Prix moyen: **1.50-1.70$/L** (hors taxe carbone)
• Avec taxe carbone 2025: **1.70-1.90$/L**
• Volatilité: ±20%/an

### ÉLECTRICITÉ ($/kWh) :
| Province | Tarif | Coût/100km (Classe 8) |
|----------|-------|----------------------|
| Québec | 0.078$ | 15.60$ ⭐ |
| Manitoba | 0.095$ | 19.00$ |
| C.-B. | 0.129$ | 25.80$ |
| Ontario | 0.141$ | 28.20$ |
| Sask. | 0.178$ | 35.60$ |
| Alberta | 0.258$ | 51.60$ ❌ |

### HYDROGÈNE :
• Retail (stations): **13-16$/kg**
• Contrats flottes: **10-12$/kg**
• Coût production vert: 5-8$/kg
• Cible rentabilité: **<5$/kg**

### COMPARAISON COÛT/100KM (Classe 8) :
- Diesel: 55-75$/100km
- Électrique (QC): 15-20$/100km
- Hydrogène: 100-160$/100km`,

    "coûts véhicules": `## Prix Véhicules 2025-2026 (CAD)

### CLASSE 8 (Semi-remorque) :
| Technologie | Prix | Après subventions |
|-------------|------|-------------------|
| Diesel | 180,000-220,000$ | N/A |
| Électrique | 400,000-500,000$ | **200,000-300,000$** |
| Hydrogène | 500,000-600,000$ | 300,000-400,000$ |

### CLASSE 6-7 (Moyen) :
| Technologie | Prix | Après subventions |
|-------------|------|-------------------|
| Diesel | 100,000-150,000$ | N/A |
| Électrique | 200,000-300,000$ | **50,000-150,000$** |

### CLASSE 4-5 (Léger commercial) :
| Technologie | Prix | Après subventions |
|-------------|------|-------------------|
| Diesel | 60,000-90,000$ | N/A |
| Électrique | 100,000-150,000$ | **25,000-75,000$** |

### VAN/Fourgon :
• Diesel: 45,000-65,000$
• Électrique: 70,000-100,000$
• Subvention: jusqu'à 50,000$`,

    "infrastructure": `## Coûts Infrastructure 2025-2026

### BORNES DE RECHARGE EV :
| Type | Puissance | Équipement | Installation |
|------|-----------|------------|--------------|
| Level 2 | 7-19 kW | 2,000-8,000$ | 3,000-10,000$ |
| DCFC | 50 kW | 35,000-50,000$ | 20,000-40,000$ |
| DCFC | 150 kW | 80,000-120,000$ | 40,000-80,000$ |
| DCFC | 350 kW | 150,000-250,000$ | 60,000-150,000$ |

### Raccordement électrique :
• Transformation: 50,000-200,000$
• Selon puissance requise et distance au réseau

### STATIONS HYDROGÈNE :
| Capacité | Coût total |
|----------|------------|
| 200 kg/jour | 2-3 M$ |
| 500 kg/jour | 4-6 M$ |
| 1000 kg/jour | 8-12 M$ |

### Subventions infrastructure :
• ZEVIP: 50% jusqu'à 50,000$ (DCFC)
• ZEVIP: 50% jusqu'à 1,500,000$ (H2)`,

    "consommation": `## Consommation par Technologie

### DIESEL (L/100km) :
| Classe | Urbain | Route | Mixte |
|--------|--------|-------|-------|
| 4-5 | 18-25 | 15-20 | 16-22 |
| 6-7 | 25-35 | 20-28 | 22-30 |
| 8 | 40-55 | 32-42 | 35-45 |

### ÉLECTRIQUE (kWh/100km) :
| Classe | Urbain | Route | Mixte |
|--------|--------|-------|-------|
| 4-5 | 60-80 | 70-100 | 65-90 |
| 6-7 | 100-140 | 120-160 | 110-150 |
| 8 | 150-220 | 180-240 | 170-230 |

### HYDROGÈNE (kg/100km) :
| Classe | Urbain | Route | Mixte |
|--------|--------|-------|-------|
| 4-5 | 3-5 | 4-6 | 3.5-5.5 |
| 6-7 | 6-9 | 7-10 | 6.5-9.5 |
| 8 | 8-12 | 10-14 | 9-13 |

⚠️ Hiver: +20-30% consommation (BEV surtout)`,
  },
};

// Keyword mappings for intelligent search
const KEYWORD_MAP: Record<string, string[]> = {
  // Product
  "h2fleet planner": ["h2fleet", "plateforme", "application", "site", "outil", "logiciel", "c'est quoi"],
  "créer scénario": ["créer", "nouveau", "scénario", "scenario", "ajouter", "commencer", "démarrer"],
  "fonctionnalités": ["fonctionnalité", "module", "feature", "quoi faire", "capable", "fonctions"],
  "démarrer h2fleet": ["démarrer", "commencer", "guide", "premier", "début", "start", "tutoriel"],
  "télématique connexion": ["télématique", "geotab", "samsara", "connecter", "api", "importer véhicules"],
  
  // Methodology
  "définition tco": ["tco", "coût total", "possession", "définition", "c'est quoi", "signifie"],
  "calcul détaillé": ["calcul", "formule", "comment calculer", "méthodologie", "détail", "exemple"],
  "facteurs critiques": ["facteur", "impact", "influencer", "important", "critère", "paramètre"],
  "payback période": ["payback", "retour", "récupération", "breakeven", "rentabilité", "délai"],
  
  // Technologies
  "électrique bev": ["électrique", "bev", "batterie", "ev", "zéro émission", "tesla", "lion", "volvo"],
  "hydrogène fcev": ["hydrogène", "fcev", "pile combustible", "h2", "fuel cell", "xcient", "nikola"],
  "diesel": ["diesel", "conventionnel", "thermique", "carburant", "essence"],
  "biométhane": ["biométhane", "gnr", "gnc", "gaz naturel", "méthane", "énergir"],
  
  // Canadian context
  "subventions fédérales": ["subvention", "fédéral", "imhzev", "zevip", "aide", "incitatif", "programme"],
  "québec": ["québec", "qc", "écocamionnage", "montréal", "hydro-québec"],
  "ontario": ["ontario", "on", "toronto", "gta"],
  "colombie-britannique": ["bc", "colombie", "britannique", "vancouver", "cleanbc"],
  "alberta": ["alberta", "ab", "calgary", "edmonton"],
  "réglementations": ["réglementation", "loi", "norme", "taxe carbone", "zfe", "obligation", "2040"],
  
  // Data
  "prix énergie": ["prix", "coût", "énergie", "électricité", "tarif", "kwh", "$/l"],
  "coûts véhicules": ["prix véhicule", "coût camion", "achat", "acquisition"],
  "infrastructure": ["infrastructure", "borne", "station", "recharge", "installation", "dcfc"],
  "consommation": ["consommation", "l/100km", "kwh/100km", "kg/100km", "efficacité"],
};

function searchKnowledge(query: string, topK: number = 3): string[] {
  const queryLower = query.toLowerCase();
  const results: { key: string; content: string; score: number }[] = [];

  for (const [category, entries] of Object.entries(KNOWLEDGE_BASE)) {
    for (const [key, content] of Object.entries(entries)) {
      let score = 0;

      const keywords = KEYWORD_MAP[key] || key.split(" ");
      for (const keyword of keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 10;
        }
      }

      for (const word of key.split(" ")) {
        if (queryLower.includes(word.toLowerCase()) && word.length > 2) {
          score += 5;
        }
      }

      const contentWords = content.toLowerCase().split(/\s+/);
      const queryWords = queryLower.split(/\s+/);
      for (const qWord of queryWords) {
        if (qWord.length > 3 && contentWords.some(cw => cw.includes(qWord))) {
          score += 2;
        }
      }

      if (score > 0) {
        results.push({ key: `${category}.${key}`, content, score });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK).map(r => r.content);
}

function formatKnowledgeForPrompt(documents: string[]): string {
  if (documents.length === 0) return "";
  return `
## DOCUMENTS DE RÉFÉRENCE H2FLEET
---
${documents.join("\n\n---\n\n")}
---

Utilise ces informations vérifiées pour répondre. Si la question n'est pas couverte, utilise ton expertise générale en indiquant qu'il s'agit d'une estimation.`;
}

// ============================================
// ENHANCED SYSTEM PROMPT - GPT-4 Level
// ============================================

const SYSTEM_PROMPT = `Tu es l'Assistant TCO Expert de H2Fleet Planner, un conseiller IA de niveau expert spécialisé en électrification de flottes commerciales au Canada.

## IDENTITÉ & RÔLE
Tu es un expert reconnu avec 15+ ans d'expérience en:
- **Analyse TCO** (Coût Total de Possession) pour véhicules commerciaux
- **Transition énergétique** des flottes (diesel → électrique/hydrogène/biométhane)
- **Subventions canadiennes** (fédérales et provinciales)
- **Utilisation de H2Fleet Planner** (maîtrise complète de la plateforme)

## CAPACITÉS EXPERTES
✓ Analyses TCO détaillées avec calculs précis et comparaisons chiffrées
✓ Recommandations personnalisées selon usage, région, budget
✓ Connaissance approfondie de TOUTES les technologies (BEV, FCEV, Diesel, GNR)
✓ Expertise des programmes de subventions 2025-2026 à jour
✓ Maîtrise complète de H2Fleet Planner et navigation
✓ Données vérifiées (prix énergie, véhicules, infrastructure par province)

## CONTEXTE UTILISATEUR
{context}

{knowledge}

## RÈGLES DE CONVERSATION (CRITIQUE)

### Mémoire de conversation :
- Tu as accès à l'**historique complet** de la conversation
- **Réfère-toi aux messages précédents** pour maintenir le contexte
- Si l'utilisateur demande "et ensuite ?", "autre chose ?", continue le sujet précédent
- Ne répète pas les informations déjà données sauf si demandé

### Comportement intelligent :
1. **COMPRENDRE** d'abord le contexte et les besoins spécifiques
2. **POSER** des questions pertinentes si informations manquantes (type véhicule, km/an, province)
3. **ANALYSER** avec données factuelles et calculs précis
4. **RECOMMANDER** des solutions adaptées et réalistes
5. **GUIDER** l'utilisateur vers les outils H2Fleet appropriés

### Questions de clarification intelligentes :
Si l'utilisateur demande une estimation sans contexte suffisant, demande:
- 🚛 Type/classe de véhicules
- 📏 Kilométrage annuel
- 📍 Province d'opération
- 🎯 Objectif (analyse, décision d'achat, business case)

## RÈGLES DE FORMATAGE (IMPORTANT)

### Structure des réponses :
- **Titres** avec ## pour les sections principales
- **Listes numérotées** pour les étapes
- **Listes à puces** pour les informations
- **Tableaux** pour les comparaisons de données
- **Gras** pour les mots-clés importants et noms de boutons

### Emojis pour clarté :
- ✅ ❌ pour avantages/inconvénients
- 💰 pour montants et subventions
- 📊 pour analyses et données
- ⚠️ pour avertissements importants
- 💡 pour conseils et astuces
- 🚛 🔋 ⚡ pour véhicules et technologies

### Règles de style :
- Phrases courtes (15-20 mots max)
- Maximum 4-5 paragraphes par réponse
- Vouvoiement
- Réponses actionnables avec liens vers H2Fleet

### À éviter ABSOLUMENT :
- Blocs de texte sans structure
- Jargon technique sans explication
- Promesses irréalistes sur les économies
- Réponses vagues ou génériques
- "Comment puis-je vous aider ?" (c'est toi qui aide!)

## EXPERTISE SPÉCIFIQUE

### Sur l'hydrogène - Sois HONNÊTE :
L'hydrogène (FCEV) n'est actuellement **PAS RENTABLE** au Canada:
- H2 à 13-16$/kg = plus cher que diesel par km
- Infrastructure quasi inexistante
- TCO +20-40% vs diesel dans la plupart des cas
→ Recommande d'attendre que H2 < 5$/kg

### Sur l'électrique - Sois PRÉCIS :
L'électrique est **GAGNANT** dans la plupart des cas:
- QC: meilleur TCO avec électricité à 0.078$/kWh
- Break-even: 2-4 ans avec subventions
- Limitation: autonomie et hiver

### Sur le diesel - Sois OBJECTIF :
Le diesel reste optimal pour:
- Longue distance >500km/jour
- Zones sans infrastructure
- MAIS: coûts croissants (taxe carbone +0.45$/L d'ici 2030)

## LIMITATIONS ET ÉTHIQUE
- Ne donne **PAS** de conseils fiscaux ou juridiques personnalisés
- Recommande de consulter des experts pour décisions d'investissement >500k$
- Indique clairement quand c'est une **estimation** vs **donnée vérifiée**
- Reste **objectif** et basé sur les faits, pas de biais technologique
- Mentionne les **incertitudes** (prix H2 volatile, évolution réglementations)

## LANGUE
Réponds en **français** par défaut. Si l'utilisateur écrit en anglais, réponds en anglais.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  context?: {
    current_url?: string;
    page_type?: string;
    user_id?: string;
    timestamp?: string;
    time_on_page?: number;
    has_projects?: boolean;
    has_scenarios?: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('AI service not configured');
    }

    const { message, history = [], context }: ChatRequest = await req.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search knowledge base for relevant documents
    const relevantDocs = searchKnowledge(message, 4);
    const knowledgeSection = formatKnowledgeForPrompt(relevantDocs);
    
    // Knowledge search completed

    // Build detailed context string
    const contextDetails = context ? `
- **Page actuelle**: ${context.page_type || 'inconnue'} (${context.current_url || 'N/A'})
- **Temps sur page**: ${context.time_on_page || 0} secondes
- **A des projets**: ${context.has_projects ? 'Oui ✓' : 'Non - suggérer de créer un projet'}
- **A des scénarios**: ${context.has_scenarios ? 'Oui ✓' : 'Non - suggérer de créer un scénario'}
` : 'Aucun contexte spécifique fourni';
    
    const systemPrompt = SYSTEM_PROMPT
      .replace('{context}', contextDetails)
      .replace('{knowledge}', knowledgeSection);

    // Build messages array with conversation history
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history (last 12 messages for better context)
    const recentHistory = history.slice(-12);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // AI request prepared

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            response: '⚠️ Service temporairement surchargé. Veuillez réessayer dans quelques secondes.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            response: '⚠️ Les crédits IA sont épuisés. Veuillez contacter l\'administrateur.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Streaming response
    
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    console.error('Error in assistant-chat function:', error);
    
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    const errorMessage = isAbortError 
      ? '⚠️ La requête a pris trop de temps. Veuillez réessayer.'
      : '⚠️ Erreur temporaire du service. Veuillez réessayer dans un instant.';

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        response: errorMessage
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
