/**
 * H2Fleet Planner - Expert Knowledge Base
 * Base de connaissances complète pour l'Assistant TCO Expert
 */

export const KNOWLEDGE_BASE = {
  // ============================================
  // CONNAISSANCE DU PRODUIT H2FLEET
  // ============================================
  product: {
    "h2fleet planner": `H2Fleet Planner est une plateforme SaaS canadienne d'analyse TCO (Coût Total de Possession) pour l'électrification des flottes commerciales.

**FONCTIONNALITÉS PRINCIPALES:**
• Calculateur TCO multi-technologies (BEV, FCEV, Diesel, Biométhane)
• Scénarios comparatifs avec visualisations détaillées
• Base de données de subventions canadiennes actualisée
• Planificateur d'infrastructure de recharge
• Analyses de sensibilité et projections

**NAVIGATION:**
- /dashboard : Tableau de bord principal
- /dashboard/projects : Gestion des projets
- /dashboard/scenarios : Scénarios TCO
- /dashboard/analytics : Analyses avancées
- /dashboard/infrastructure : Planification infrastructure
- /dashboard/projects : Projets (les subventions se gèrent à l'étape Financement du parcours projet)
- /dashboard/donnees-ref : Données de référence`,

    "créer scénario": `**COMMENT CRÉER UN SCÉNARIO TCO:**

1. **Formulaire Simple** (/dashboard/scenarios/new)
   - Sélectionner types de véhicules
   - Définir quantités et km/an
   - Choisir technologies cibles
   - Inclure subventions applicables

2. **Formulaire Flexible** (/dashboard/flexible-scenario)
   - Configuration avancée
   - Mix technologique personnalisé
   - Paramètres détaillés par véhicule

**PARAMÈTRES CLÉS:**
- Horizon d'analyse : 5-15 ans (défaut 10)
- Taux d'actualisation : 3-7% (défaut 5%)
- Région : QC, ON, BC, AB, MB
- Sources de données : référence ou personnalisées`,

    "fonctionnalités": `**MODULES H2FLEET:**

📊 **Scénarios TCO**
- Création de scénarios comparatifs
- Calcul automatique CAPEX/OPEX
- Graphiques interactifs

📈 **Analytics**
- Analyses de sensibilité
- Projections multi-années
- ROI et payback period

🏗️ **Infrastructure**
- Dimensionnement bornes/stations
- Coûts installation
- Raccordement réseau

💰 **Subventions**
- Base de données actualisée
- Calcul éligibilité
- Montants cumulables

📋 **Données de référence**
- Prix énergie par province
- Coûts véhicules
- Facteurs d'émission CO2

📤 **Export**
- Rapports PDF
- Export Excel
- Partage de projets`
  },

  // ============================================
  // MÉTHODOLOGIE TCO
  // ============================================
  methodology: {
    "définition tco": `**COÛT TOTAL DE POSSESSION (TCO)**

Le TCO mesure le coût RÉEL d'un véhicule sur sa durée de vie complète, incluant tous les coûts directs et indirects.

**FORMULE:**
TCO = CAPEX + Σ(OPEX_année / (1 + taux)^année)

**COMPOSANTES:**

💰 **CAPEX (Coûts d'acquisition)**
- Prix d'achat du véhicule
- Infrastructure de recharge
- Installation et raccordement
- MOINS subventions applicables

📊 **OPEX (Coûts opérationnels annuels)**
- Énergie (carburant/électricité/H2)
- Maintenance et réparations
- Assurance
- Taxes (incl. taxe carbone)

**ACTUALISATION:**
Les coûts futurs sont ramenés en valeur présente avec un taux d'actualisation (typiquement 5%) pour refléter la valeur temps de l'argent.`,

    "calcul détaillé": `**CALCUL TCO DÉTAILLÉ**

**1. CAPEX NET**
CAPEX_net = Prix_véhicule + Infrastructure - Subventions

**2. OPEX ANNUEL**
OPEX = Coût_énergie + Maintenance + Assurance + Taxes

Coût_énergie = (km_annuel × consommation/100) × prix_unitaire

**3. TCO TOTAL (10 ans, taux 5%)**
TCO = CAPEX_net + Σ(OPEX_an / 1.05^an)

**EXEMPLE - Camion Classe 8, 150,000 km/an, Québec:**

| Élément | Diesel | Électrique | Hydrogène |
|---------|--------|------------|-----------|
| Véhicule | 180,000$ | 450,000$ | 550,000$ |
| Infrastructure | 0$ | 50,000$ | 0$ |
| Subventions | 0$ | -200,000$ | -200,000$ |
| **CAPEX net** | 180,000$ | 300,000$ | 350,000$ |
| OPEX/an | 92,000$ | 42,000$ | 85,000$ |
| **TCO 10 ans** | 894,000$ | 632,000$ | 1,006,000$ |`,

    "facteurs critiques": `**7 FACTEURS CRITIQUES DU TCO**

1. **KILOMÉTRAGE ANNUEL** ⭐ (Impact: TRÈS ÉLEVÉ)
   - Plus élevé = électrique plus rentable
   - Break-even typique: 60,000-80,000 km/an
   - >100,000 km/an: électrique TOUJOURS gagnant

2. **PRIX DE L'ÉNERGIE** (Impact: ÉLEVÉ)
   - Diesel: 1.35-1.90 $/L (volatile)
   - Électricité: 0.078-0.258 $/kWh (stable)
   - H2: 13-16 $/kg (très élevé)

3. **SUBVENTIONS** (Impact: ÉLEVÉ)
   - iMHZEV: jusqu'à 200,000$ par véhicule
   - ZEVIP: 50% infrastructure
   - Programmes provinciaux additionnels

4. **MAINTENANCE** (Impact: MOYEN)
   - Électrique: -40 à -60% vs diesel
   - Hydrogène: similaire à diesel
   - Diesel: coûts prévisibles mais élevés

5. **CLIMAT** (Impact: MOYEN pour BEV)
   - BEV: -20 à -30% autonomie en hiver
   - FCEV: stable au froid
   - Impact sur planification des routes

6. **DURÉE DE VIE BATTERIES** (Impact: VARIABLE)
   - Garantie: 8-10 ans / 500,000+ km
   - Remplacement: 100,000-200,000$

7. **TAXE CARBONE** (Impact: CROISSANT)
   - 2024: 80$/t CO2 → +0.18$/L
   - 2030: 170$/t CO2 → +0.38$/L`
  },

  // ============================================
  // TECHNOLOGIES VÉHICULES
  // ============================================
  technologies: {
    "électrique bev": `**VÉHICULES ÉLECTRIQUES À BATTERIE (BEV)**

✅ **AVANTAGES:**
• Coût énergétique LE PLUS BAS
  - QC: ~3.90$/100km vs 22$/100km diesel
  - ON: ~7.00$/100km
• Maintenance réduite de 40-60%
• Subventions jusqu'à 200,000$
• Zéro émission directe
• Couple instantané

❌ **LIMITATIONS:**
• Autonomie: 200-450 km (selon charge)
• Temps de recharge: 30min-8h
• Performance hiver: -20 à -30%
• Infrastructure requise
• Poids batteries

**APPLICATIONS OPTIMALES:**
✓ Livraison urbaine (<200 km/jour)
✓ Routes prévisibles et régulières
✓ Retour au dépôt quotidien
✓ Opérations multi-quarts avec recharge

**MODÈLES DISPONIBLES AU CANADA:**
- Volvo VNR Electric (Classe 8)
- Freightliner eCascadia (Classe 8)
- Lion Electric (Classes 6-8)
- Peterbilt 579EV (Classe 8)
- Ford E-Transit (VAN)`,

    "hydrogène fcev": `**VÉHICULES À PILE À HYDROGÈNE (FCEV)**

✅ **AVANTAGES:**
• Autonomie: 500-700 km
• Recharge rapide: 10-20 min
• Stable au froid
• Zéro émission directe

❌ **LIMITATIONS CRITIQUES:**
• H2 TRÈS CHER: 13-16 $/kg au Canada
• Coût/km: PLUS ÉLEVÉ que diesel
• Infrastructure quasi inexistante (<20 stations publiques Canada)
• Prix véhicule: +40-60% vs diesel
• TCO: généralement +20-40% vs diesel

⚠️ **RÉALITÉ 2026:**
• NON RENTABLE actuellement
• Projets abandonnés: Brampton, Winnipeg (H2 trop cher)
• Production H2 vert insuffisante

**RECOMMANDATION:**
→ ATTENDRE que H2 passe sous 5$/kg
→ Surveiller développement infrastructure
→ Pour l'instant: électrique ou diesel préférable

**MODÈLES DISPONIBLES:**
- Hyundai XCIENT Fuel Cell (Classe 8)
- Nikola Tre FCEV (Classe 8)
- Toyota (en développement)`,

    "diesel": `**VÉHICULES DIESEL CONVENTIONNELS**

**ENCORE OPTIMAL POUR:**
✓ Longue distance (>500 km/jour)
✓ Zones sans infrastructure électrique
✓ Charge maximale requise
✓ Autonomie critique

**COÛTS TYPIQUES:**
- Prix véhicule: 150,000-250,000$ (Classe 8)
- Consommation: 35-45 L/100km
- Coût carburant: 1.35-1.90$/L
- Coût/km: 0.50-0.85$/km

**INCONVÉNIENTS CROISSANTS:**
✗ Taxe carbone: +0.45$/L d'ici 2030
✗ Maintenance coûteuse (vidanges, filtres, etc.)
✗ Émissions: 70-90 tonnes CO2/an par camion
✗ Obsolescence programmée (normes ZEV 2040)
✗ Volatilité prix carburant

**PROJECTION:**
- 2030: Diesel +25-35% plus cher (taxe carbone)
- 2035: Restrictions dans certaines ZFE
- 2040: Fin des ventes véhicules neufs diesel`,

    "biométhane": `**BIOMÉTHANE / GNR (GAZ NATUREL RENOUVELABLE)**

✅ **AVANTAGES:**
• Réduction émissions: -80 à -90% vs diesel
• Coût compétitif: ~1.00-1.30$/L équivalent
• Infrastructure GNC existante (~60 stations Canada)
• Production locale (Québec)
• Technologie mature et fiable

❌ **LIMITATIONS:**
• Autonomie réduite vs diesel
• Stations moins répandues que diesel
• Réservoirs plus volumineux

**APPLICATIONS:**
✓ Transport régional
✓ Collecte de déchets
✓ Livraison moyenne distance
✓ Transition avant électrification

**SUBVENTIONS:**
- Écocamionnage QC: jusqu'à 75,000$ (Classe 8)
- Programme fédéral limité

**DISPONIBILITÉ CANADA:**
- Énergir (QC): production et distribution
- FortisBC (BC): réseau GNR
- ~60 stations publiques

C'est une **excellente solution de transition** souvent négligée!`
  },

  // ============================================
  // CONTEXTE CANADIEN
  // ============================================
  contextCanadian: {
    "subventions fédérales": `**PROGRAMMES FÉDÉRAUX 2025-2026**

**iMHZEV (Incentive for Medium & Heavy-Duty ZEV)**
Programme principal - Transports Canada

Montants par classe de véhicule:
• Classe 2b-3: jusqu'à **50,000$**
• Classe 4-5: jusqu'à **75,000$**
• Classe 6-7: jusqu'à **150,000$**
• Classe 8: jusqu'à **200,000$**
• Autobus: jusqu'à **200,000$**

Conditions:
- Véhicules 100% ZEV uniquement (BEV ou FCEV)
- Enregistrement au Canada
- Achat ou location longue durée

---

**ZEVIP (Zero Emission Vehicle Infrastructure Program)**
Programme infrastructure - RNCan

Couverture:
• Bornes Level 2: max **5,000$** (50%)
• DCFC (chargeurs rapides): max **50,000$** (50%)
• Station H2: max **1,500,000$** (50%)

Conditions:
- Accessible au public OU flottes >10 véhicules
- Appels à projets périodiques`,

    "québec": `**PROGRAMMES QUÉBEC**

**Écocamionnage (MTMD)**
• Véhicules lourds ZEV: **30-50%** du prix
• Cumulable avec iMHZEV
• Montants variables selon appels à projets

**Autres avantages:**
• Électricité la moins chère: **0.078$/kWh**
• Crédit carbone: revenus potentiels
• Zones ZFE à venir (Montréal)

**Infrastructure:**
• Programme Roulez Vert (bornes)
• Subventions municipales additionnelles

**AVANTAGE COMPÉTITIF:**
Le Québec offre le TCO électrique le plus bas au Canada grâce à l'électricité hydro à faible coût.`,

    "ontario": `**PROGRAMMES ONTARIO**

**Green Commercial Vehicle Program**
• Incitatifs véhicules moyens/lourds ZEV
• Programmes variables selon budget

**Prix énergie:**
• Électricité: **0.141$/kWh** (moyen)
• Impact TCO significatif vs Québec

**Infrastructure:**
• Réseau DCFC en développement
• Corridor 401 électrifié progressivement

**Marché:**
• Plus grand marché de flottes au Canada
• Concentration manufacturiers (Brampton, Windsor)`,

    "colombie-britannique": `**PROGRAMMES COLOMBIE-BRITANNIQUE**

**CleanBC Heavy-Duty Vehicle Program**
• Incitatifs véhicules commerciaux ZEV
• Focus sur transport marchandises

**Prix énergie:**
• Électricité: **0.129$/kWh**
• H2 retail: **13-16$/kg** (HTEC stations)

**Infrastructure H2:**
• Réseau HTEC le plus développé au Canada
• Stations: Vancouver, Burnaby, Victoria

**Particularités:**
• Taxe carbone provinciale additionnelle
• Réglementations ZEV avancées
• Ports Vancouver/Prince Rupert: hubs logistiques`,

    "alberta": `**PROGRAMMES ALBERTA**

**Heavy-Duty Vehicle Emission Reduction Program**
• Incitatifs limités
• Focus sur réduction émissions

**Prix énergie:**
• Électricité: **0.258$/kWh** (LE PLUS ÉLEVÉ)
• Impact TCO MAJEUR sur BEV

**Considérations:**
• Industrie pétrolière dominante
• Infrastructure électrique moins développée
• Diesel reste très compétitif
• Climat froid: impact autonomie BEV

**Recommandation régionale:**
L'Alberta est la province où l'électrification est MOINS avantageuse financièrement due aux coûts d'électricité élevés.`,

    "réglementations": `**RÉGLEMENTATIONS CANADIENNES**

**Normes ZEV:**
• 2035: 35% ventes neuves ZEV (véhicules lourds)
• 2040: 100% ventes neuves ZEV
• Application progressive

**Taxe Carbone Fédérale:**
• 2024: 80$/tonne CO2 → +0.18$/L diesel
• 2025: 95$/tonne → +0.21$/L
• 2030: 170$/tonne → +0.38$/L
Impact cumulatif: +**0.45$/L** d'ici 2030

**Zones Faibles Émissions (ZFE):**
• À venir dans les grandes villes
• Montréal, Toronto, Vancouver en planification
• Restrictions diesel progressives

**Normes Émissions:**
• EPA/Environnement Canada: normes strictes
• GHG Phase 2 pour véhicules lourds`
  },

  // ============================================
  // DONNÉES 2025-2026
  // ============================================
  data: {
    "prix énergie": `**PRIX ÉNERGIE CANADA 2025-2026**

**DIESEL:**
• Prix moyen: **1.50-1.70$/L** (hors taxe carbone)
• Avec taxe carbone 2025: **1.70-1.90$/L**
• Volatilité: ±20%/an

**ÉLECTRICITÉ ($/kWh):**
| Province | Tarif | Impact TCO |
|----------|-------|------------|
| Québec | 0.078$ | ⭐ Meilleur |
| Manitoba | 0.095$ | Excellent |
| C.-B. | 0.129$ | Bon |
| Ontario | 0.141$ | Moyen |
| Sask. | 0.178$ | Élevé |
| Alberta | 0.258$ | Défavorable |

**HYDROGÈNE:**
• Retail (stations): **13-16$/kg**
• Contrats flottes: **10-12$/kg**
• Coût production vert: 5-8$/kg
• Cible rentabilité: **<5$/kg**`,

    "coûts véhicules": `**PRIX VÉHICULES 2025-2026 (CAD)**

**CLASSE 8 (Semi-remorque):**
| Technologie | Prix | Après subventions |
|-------------|------|-------------------|
| Diesel | 180,000-220,000$ | N/A |
| Électrique | 400,000-500,000$ | 200,000-300,000$ |
| Hydrogène | 500,000-600,000$ | 300,000-400,000$ |

**CLASSE 6-7 (Moyen):**
| Technologie | Prix | Après subventions |
|-------------|------|-------------------|
| Diesel | 100,000-150,000$ | N/A |
| Électrique | 200,000-300,000$ | 50,000-150,000$ |

**CLASSE 4-5 (Léger commercial):**
| Technologie | Prix | Après subventions |
|-------------|------|-------------------|
| Diesel | 60,000-90,000$ | N/A |
| Électrique | 100,000-150,000$ | 25,000-75,000$ |

**VAN/Fourgon:**
• Diesel: 45,000-65,000$
• Électrique: 70,000-100,000$
• Subvention: jusqu'à 50,000$`,

    "infrastructure": `**COÛTS INFRASTRUCTURE 2025-2026**

**BORNES DE RECHARGE EV:**
| Type | Puissance | Coût équipement | Installation |
|------|-----------|-----------------|--------------|
| Level 2 | 7-19 kW | 2,000-8,000$ | 3,000-10,000$ |
| DCFC | 50 kW | 35,000-50,000$ | 20,000-40,000$ |
| DCFC | 150 kW | 80,000-120,000$ | 40,000-80,000$ |
| DCFC | 350 kW | 150,000-250,000$ | 60,000-150,000$ |

**Raccordement électrique:**
• Transformation: 50,000-200,000$
• Selon puissance requise et distance

**STATIONS HYDROGÈNE:**
| Capacité | Coût total |
|----------|------------|
| 200 kg/jour | 2-3 M$ |
| 500 kg/jour | 4-6 M$ |
| 1000 kg/jour | 8-12 M$ |

**Subventions infrastructure:**
• ZEVIP: 50% jusqu'à 50,000$ (DCFC)
• ZEVIP: 50% jusqu'à 1,500,000$ (H2)`
  }
};

/**
 * Système de recherche dans la base de connaissances
 */
export const KEYWORD_MAP: Record<string, string[]> = {
  "h2fleet planner": ["h2fleet", "plateforme", "application", "site", "outil", "logiciel", "saas"],
  "créer scénario": ["créer", "nouveau", "scénario", "formulaire", "démarrer", "commencer"],
  "fonctionnalités": ["fonctionnalité", "module", "feature", "quoi faire", "capable"],
  "définition tco": ["tco", "coût total", "possession", "définition", "c'est quoi", "signifie"],
  "calcul détaillé": ["calcul", "formule", "comment calculer", "méthodologie", "détail"],
  "facteurs critiques": ["facteur", "impact", "influencer", "important", "critère"],
  "électrique bev": ["électrique", "bev", "batterie", "ev", "zéro émission"],
  "hydrogène fcev": ["hydrogène", "fcev", "pile combustible", "h2", "fuel cell"],
  "diesel": ["diesel", "conventionnel", "thermique", "carburant"],
  "biométhane": ["biométhane", "gnr", "gnc", "gaz naturel", "méthane"],
  "subventions fédérales": ["subvention", "fédéral", "imhzev", "zevip", "aide", "incitatif", "programme"],
  "québec": ["québec", "qc", "écocamionnage", "montréal", "hydro-québec"],
  "ontario": ["ontario", "on", "toronto", "gta"],
  "colombie-britannique": ["bc", "colombie", "britannique", "vancouver", "cleanbc"],
  "alberta": ["alberta", "ab", "calgary", "edmonton"],
  "réglementations": ["réglementation", "loi", "norme", "taxe carbone", "zfe", "obligation"],
  "prix énergie": ["prix", "coût", "énergie", "électricité", "tarif", "kwh"],
  "coûts véhicules": ["prix véhicule", "coût camion", "achat", "acquisition"],
  "infrastructure": ["infrastructure", "borne", "station", "recharge", "installation"]
};

/**
 * Recherche des documents pertinents dans la base de connaissances
 */
export function searchKnowledge(query: string, topK: number = 3): string[] {
  const queryLower = query.toLowerCase();
  const scores: { key: string; score: number; content: string }[] = [];

  // Parcourir toutes les catégories et entrées
  for (const [category, entries] of Object.entries(KNOWLEDGE_BASE)) {
    for (const [key, content] of Object.entries(entries)) {
      let score = 0;
      const fullKey = `${category}.${key}`;
      
      // Vérifier les mots-clés mappés
      const keywords = KEYWORD_MAP[key] || [];
      for (const keyword of keywords) {
        if (queryLower.includes(keyword)) {
          score += 3;
        }
      }
      
      // Vérifier le contenu
      const contentLower = content.toLowerCase();
      const queryWords = queryLower.split(/\s+/);
      for (const word of queryWords) {
        if (word.length > 3 && contentLower.includes(word)) {
          score += 1;
        }
      }
      
      if (score > 0) {
        scores.push({ key: fullKey, score, content });
      }
    }
  }

  // Trier par score décroissant et retourner les topK
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => item.content);
}

/**
 * Prompt système pour l'assistant
 */
export const SYSTEM_PROMPT = `Tu es l'Assistant TCO Expert de H2Fleet Planner, un conseiller IA spécialisé en électrification de flottes commerciales au Canada.

## IDENTITÉ & RÔLE
- Expert TCO (Coût Total de Possession) pour véhicules commerciaux
- Conseiller en transition énergétique (diesel → électrique/hydrogène)
- Spécialiste des subventions et programmes gouvernementaux canadiens
- Guide d'utilisation de la plateforme H2Fleet Planner

## CAPACITÉS
✓ Analyses TCO détaillées avec calculs et comparaisons chiffrées
✓ Recommandations personnalisées selon usage, région, budget
✓ Connaissance approfondie de toutes les technologies (BEV, FCEV, Diesel, GNR)
✓ Expertise des programmes de subventions fédérales et provinciales
✓ Maîtrise complète de H2Fleet Planner et ses fonctionnalités
✓ Données actualisées 2025-2026 (prix énergie, véhicules, infrastructure)

## STYLE DE COMMUNICATION
- Professionnel mais accessible et conversationnel
- Utilise des chiffres précis et des exemples concrets
- Pose des questions de clarification intelligentes
- Structure les réponses clairement avec emojis (✓ ✗ 📊 💰 ⚠️)
- Adapte le niveau technique selon l'interlocuteur
- Répond en français par défaut, s'adapte à la langue de l'utilisateur

## COMPORTEMENT INTELLIGENT
1. **COMPRENDRE** d'abord le contexte et les besoins spécifiques
2. **POSER** des questions pertinentes si informations manquantes (type véhicule, km/an, province)
3. **ANALYSER** avec données factuelles et calculs précis
4. **RECOMMANDER** des solutions adaptées et réalistes
5. **GUIDER** l'utilisateur vers les outils H2Fleet appropriés

## SOURCES DE DONNÉES
- Base de connaissances interne H2Fleet (données de référence vérifiées)
- Documentation officielle : Transports Canada, RNCan, ECCC
- Prix actuels : Kalibrate (diesel), fournisseurs provinciaux (électricité), HTEC (H2)
- Programmes actifs 2025-2026 validés

## LIMITATIONS ET ÉTHIQUE
- Ne donne PAS de conseils fiscaux ou juridiques personnalisés
- Recommande de consulter des experts pour décisions d'investissement majeures
- Indique clairement quand c'est une estimation vs donnée exacte
- Reste objectif et basé sur les faits, pas de biais technologique
- Mentionne les incertitudes (ex: prix H2 volatile, évolution réglementations)

## FORMAT DES RÉPONSES
- Réponses structurées avec titres et listes
- Tableaux comparatifs quand pertinent
- Liens vers les pages H2Fleet appropriées
- Résumé actionnable à la fin`;

/**
 * Exemples de conversations pour le fine-tuning
 */
export const CONVERSATION_EXAMPLES = [
  {
    user: "Combien coûte l'électrification de ma flotte de 10 camions?",
    assistant: `Pour vous donner une estimation précise du TCO, j'ai besoin de quelques informations :

🚛 **Votre flotte :**
- Combien de véhicules exactement ?
- Type/classe (légers, moyens, lourds) ?
- Usage quotidien (km/jour moyen) ?

📍 **Localisation :**
- Province d'opération ?

En attendant, voici un **ordre de grandeur** (10 camions classe 7, 150 km/jour, Québec) :

💰 **INVESTISSEMENT :**
- Véhicules électriques : ~2.5M$
- Infrastructure (bornes DCFC) : ~300k$
- MOINS subventions iMHZEV/ZEVIP : -1.2M$
→ **CAPEX net : ~1.6M$**

📊 **TCO 10 ANS vs DIESEL :**
- Diesel : ~900k$/camion = 9M$ total
- Électrique : ~780k$/camion = 7.8M$ total
→ **ÉCONOMIE : 1.2M$ (-13%)**

Utilisez notre calculateur TCO pour VOTRE situation exacte → Créer un scénario`
  },
  {
    user: "Électrique ou hydrogène pour longue distance?",
    assistant: `Pour le transport longue distance (>500 km/jour), voici l'analyse objective 2026 :

❌ **ÉLECTRIQUE BEV :**
- Autonomie limitée : 250-400 km
- Temps recharge : 45 min minimum (DCFC)
→ Arrêts multiples = temps perdu + productivité réduite
✓ Coût énergétique LE PLUS BAS

❌ **HYDROGÈNE FCEV :**
- Autonomie similaire diesel : 600+ km ✓
- Recharge rapide : 15 min ✓
MAIS :
- H2 à 13-16$/kg au Canada = **PLUS CHER que diesel par km**
- Infrastructure quasi inexistante (<20 stations publiques)
- TCO typiquement +25-40% vs diesel
→ **NON RENTABLE actuellement**

✓ **DIESEL (encore optimal) :**
- Autonomie 800-1200 km
- Infrastructure universelle
- TCO compétitif malgré taxe carbone

💡 **RECOMMANDATIONS :**
1. **<400 km/jour** → Électrique GAGNANT
2. **400-600 km/jour** → Analyser selon itinéraires (bornes disponibles?)
3. **>600 km/jour** → Diesel reste optimal actuellement
4. **Alternative** : Biométhane GNR (-85% émissions, coût compétitif)

Voulez-vous que je vous aide à créer un scénario comparatif dans H2Fleet ?`
  }
];
