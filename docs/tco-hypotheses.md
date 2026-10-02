# Hypothèses par défaut du moteur TCO

**DOCUMENT GÉNÉRÉ** depuis `src/lib/tco/assumptions.ts` et
`src/lib/tco/subsidy-programs.ts` — ne pas éditer à la main
(`npm run docs:tco` pour régénérer ; un test de CI vérifie la fraîcheur).

Statuts : ✅ vérifié = source réellement lue à la date indiquée ;
≈ estimation = ordre de grandeur professionnel à affiner ;
⚠️ à valider = source non consultable depuis l’environnement — consulter l’URL.

Bilan : 10 vérifiées, 24 estimations, 12 à valider (hors défauts par catégorie, tous « estimation »).

## Hypothèses générales

| Hypothèse | Valeur | Unité | Plage | Région | Statut | Source | Vérifiée le |
|---|---|---|---|---|---|---|---|
| Prix du diesel HORS TPS/TVQ (accises et SPEDE compris) — MOYENNE MOBILE 12 MOIS StatCan, Montréal/Québec | 1.8179 (CAD 2026) | $/L | 1.4751 – 2.5658 | QC | ✅ vérifié | [Statistique Canada — Tableau 18-10-0001-01 — diesel libre-service, moyenne 12 mois (2025-09 à 2026-08) des villes de Montréal et de Québec, série archivée (data/sources/2026-09-29/statcan-diesel-12mois.json)](https://www150.statcan.gc.ca/t1/tbl1/fr/tv.action?pid=1810000101) | 2026-09-29 |
| Hydro-Québec tarif M — prix de l’énergie (première tranche, ≤ 210 000 kWh/mois) | 0.06292 (CAD 2026) | $/kWh | 0.06292 – 0.08 | QC | ✅ vérifié | [Hydro-Québec — Grille des tarifs d’électricité, en vigueur le 1er avril 2026, Articles 3.2 (tarif G) et 4.2 (tarif M)](https://www.hydroquebec.com/data/documents-donnees/pdf/grille-tarifaire.pdf) | 2026-09-28 |
| Hydro-Québec tarif M — prime de puissance mensuelle | 18.242 (CAD 2026) | $/kW/mois | 18.242 – 22 | QC | ✅ vérifié | [Hydro-Québec — Grille des tarifs d’électricité, en vigueur le 1er avril 2026, Articles 3.2 (tarif G) et 4.2 (tarif M)](https://www.hydroquebec.com/data/documents-donnees/pdf/grille-tarifaire.pdf) | 2026-09-28 |
| Hydro-Québec tarif G — prix de l’énergie (première tranche, ≤ 15 090 kWh/mois) | 0.12388 (CAD 2026) | $/kWh | 0.09534 – 0.12388 | QC | ✅ vérifié | [Hydro-Québec — Grille des tarifs d’électricité, en vigueur le 1er avril 2026, Articles 3.2 (tarif G) et 4.2 (tarif M)](https://www.hydroquebec.com/data/documents-donnees/pdf/grille-tarifaire.pdf) | 2026-09-28 |
| Coût effectif de l’électricité au dépôt (énergie + prime de puissance amortie), recharge nocturne étalée | 0.1 (CAD 2026) | $/kWh | 0.075 – 0.16 | QC | ≈ estimation | [Hydro-Québec — Grille des tarifs d’électricité, en vigueur le 1er avril 2026, Articles 3.2 (tarif G) et 4.2 (tarif M)](https://www.hydroquebec.com/data/documents-donnees/pdf/grille-tarifaire.pdf) | 2026-09-28 |
| Prix de l’hydrogène livré à la pompe/au dépôt | 16.5 (CAD 2025) | $/kg | 12 – 20 | CA | ⚠️ à valider | [HTEC (réseau C.-B.) / Propulsion Québec — FAQ HTEC (prix à la pompe C.-B.) ; étude « Potentiel d’adoption de l’hydrogène vert », 2023](https://www.htec.ca/faqs/) | 2026-09-28 |
| Rendement de la recharge (kWh batterie ÷ kWh compteur) | 0.9 | ratio | 0.85 – 0.95 | CA | ≈ estimation | [RNCan — Documentation efficacité énergétique des VE (pertes chargeur + batterie + conditionnement)](https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports) | 2026-09-28 |
| Majoration de la consommation électrique en conditions hivernales (pendant les mois d’hiver) | 0.25 | ratio | 0.1 – 0.4 | QC | ⚠️ à valider | [Université Concordia (données STM) — Étude consommation autobus électriques Montréal : 1,4 kWh/km été → 1,7 kWh/km hiver (+26 %)](https://techxplore.com/news/2025-11-montreal-electric-buses-energy-winter.html) | 2026-09-28 |
| Part du kilométrage annuel parcourue en conditions hivernales | 0.33 | ratio | 0.25 – 0.42 | QC | ≈ estimation | [H2Fleet — ≈ 4 mois d’hiver sur 12, kilométrage uniforme](https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md) | 2026-09-28 |
| Inflation générale (IPC) — indexation entretien, assurance, prix d’achat futurs | 0.021 | ratio | 0.01 – 0.03 | CA | ⚠️ à valider | [Banque du Canada — Cible de maîtrise de l’inflation (fourchette 1-3 %, cible 2 %)](https://www.banqueducanada.ca/grandes-fonctions/politique-monetaire/inflation/) | 2026-09-28 |
| Inflation propre au prix du diesel | 0.03 | ratio | 0 – 0.06 | QC | ≈ estimation | [H2Fleet — Hypothèse : IPC + tarification carbone/SPEDE croissante ; à étalonner sur la série de la Régie](https://www.regie-energie.qc.ca/fr/prix-produits-petroliers) | 2026-09-28 |
| Inflation propre au prix de l’électricité (tarifs généraux HQ) | 0.035 | ratio | 0.02 – 0.05 | QC | ≈ estimation | [Hydro-Québec — Grille des tarifs d’électricité, en vigueur le 1er avril 2026, Articles 3.2 (tarif G) et 4.2 (tarif M)](https://www.hydroquebec.com/data/documents-donnees/pdf/grille-tarifaire.pdf) | 2026-09-28 |
| Évolution annuelle du prix de l’hydrogène livré | 0 | ratio | -0.04 – 0.04 | QC | ≈ estimation | [H2Fleet — Marché naissant : baisse attendue des coûts de production vs coûts de distribution ; neutre par défaut](https://propulsionquebec.com/wp-content/uploads/2023/11/PropulsionQc_Hydrogene-vert_VF1.pdf) | 2026-09-28 |
| Inflation propre aux coûts d’entretien (main-d’œuvre + pièces) | 0.025 | ratio | 0.015 – 0.04 | QC | ≈ estimation | [H2Fleet — Hypothèse : IPC + 0,5 pt (pression main-d’œuvre spécialisée)](https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md) | 2026-09-28 |
| Taux d’actualisation NOMINAL par défaut (coût d’emprunt municipal long terme) | 0.05 | ratio | 0.03 – 0.07 | QC | ≈ estimation | [H2Fleet — À remplacer par le taux d’emprunt réel de l’organisme (obligations municipales 10-20 ans)](https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md) | 2026-09-28 |
| Facteur d’émission réservoir-à-roue, diesel, véhicules lourds (CO2+CH4+N2O) | 2.724 | kgCO2e/L | 2.705 – 2.741 | CA | ✅ vérifié | [MELCCFP (Québec) — Guide de quantification des émissions de gaz à effet de serre, février 2025, Tableaux 5-6 (reprend RIN 1990-2022, partie II, tableau A6.1-15)](https://www.environnement.gouv.qc.ca/changements/ges/guide-quantification/guide-quantification-ges.pdf) | 2026-09-28 |
| Facteur d’émission réservoir-à-roue, diesel, véhicules légers et camions légers | 2.741 | kgCO2e/L | 2.726 – 2.741 | CA | ✅ vérifié | [MELCCFP (Québec) — Guide de quantification des émissions de gaz à effet de serre, février 2025, Tableaux 5-6 (reprend RIN 1990-2022, partie II, tableau A6.1-15)](https://www.environnement.gouv.qc.ca/changements/ges/guide-quantification/guide-quantification-ges.pdf) | 2026-09-28 |
| Majoration puits-au-réservoir du diesel (extraction, raffinage, transport), en part du TTW | 0.25 | ratio | 0.15 – 0.35 | CA | ⚠️ à valider | [ECCC / GHGenius — Modèle d’analyse du cycle de vie des carburants (GHGenius) — intensité amont du diesel](https://ghgenius.ca/) | 2026-09-28 |
| Intensité GES du réseau électrique du Québec (consommation) | 1.2 | gCO2e/kWh | 0.6 – 35 | QC | ⚠️ à valider | [ECCC — Québec : aperçu sur l’électricité propre (données RIN 2022), Section « Émissions et production d’électricité »](https://www.canada.ca/fr/services/environnement/meteo/changementsclimatiques/plan-climatique/electricite-propre/apercu-quebec.html) | 2026-09-28 |
| Facteur d’émission puits-à-roue, H2 par électrolyse au Québec | 1 | kgCO2e/kgH2 | 0.4 – 2.5 | QC | ⚠️ à valider | [Propulsion Québec / ECCC — Étude hydrogène vert 2023 (électrolyse alimentée par le réseau QC) ](https://propulsionquebec.com/wp-content/uploads/2023/11/PropulsionQc_Hydrogene-vert_VF1.pdf) | 2026-09-28 |
| Facteur d’émission puits-à-roue, H2 par reformage du méthane (SMR) sans captage | 10 | kgCO2e/kgH2 | 9 – 12 | CA | ⚠️ à valider | [RNCan / AIE — Stratégie canadienne pour l’hydrogène (intensités par filière)](https://ressources-naturelles.canada.ca/production-denergie/lavenir-de-lhydrogene-au-canada) | 2026-09-28 |
| Coût social du carbone (SC-CO2) pour 2026 — valorisation HORS TCO | 275 (CAD 2021) | $/tCO2e | 100 – 400 | CA | ✅ vérifié | [Environnement et Changement climatique Canada — Social Cost of Greenhouse Gas Estimates — Interim Updated Guidance, Table 1 (C$2021, taux Ramsey 2 %)](https://www.canada.ca/en/environment-climate-change/services/climate-change/science-research-data/social-cost-ghg.html) | 2026-09-28 |
| Taux de la TPS | 0.05 | ratio | 0.05 – 0.05 | CA | ✅ vérifié | [ARC — Facturer ou percevoir la TPS/TVH — quel taux appliquer (page lue et archivée : TPS de 5 % dans les provinces non participantes)](https://www.canada.ca/fr/agence-revenu/services/impot/entreprises/sujets/tps-tvh-entreprises/facturer-percevoir-quel-taux.html) | 2026-09-29 |
| Taux de la TVQ | 0.09975 | ratio | 0.09975 – 0.09975 | QC | ⚠️ à valider | [Revenu Québec — Taux de la TVQ en vigueur (art. 16, Loi sur la taxe de vente du Québec)](https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/perception-de-la-tps-et-de-la-tvq/calcul-des-taxes/) | 2026-09-28 |
| Part de la TPS remboursée aux municipalités | 1 | ratio | 1 – 1 | CA | ✅ vérifié | [ARC — RC4049 — Renseignements sur la TPS/TVH pour les municipalités (publication complète, lue et archivée)](https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications/rc4049/renseignements-tps-tvh-municipalites.html) | 2026-09-29 |
| Part de la TVQ remboursée aux municipalités (factures depuis 2015) | 0.5 | ratio | 0.5 – 0.628 | QC | ✅ vérifié | [Finances Québec — Dépenses fiscales 2025, fiche 310302 — Remboursement accordé aux écoles, collèges, universités, hôpitaux et municipalités (lue et archivée)](https://www.budget.finances.gouv.qc.ca/budget/outils/depenses-fiscales/fiches/fiche-310302.asp) | 2026-09-28 |
| Taux de dépréciation annuel (géométrique) — véhicules diesel | 0.15 | ratio | 0.12 – 0.2 | CA | ≈ estimation | [H2Fleet — Pratique d’évaluation de flotte ; à étalonner sur les encans (Ritchie Bros) par catégorie](https://www.rbauction.com/) | 2026-09-28 |
| Taux de dépréciation annuel (géométrique) — véhicules électriques à batterie | 0.18 | ratio | 0.13 – 0.25 | CA | ≈ estimation | [H2Fleet — Marché secondaire ZE lourd encore mince : décote d’incertitude vs diesel](https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md) | 2026-09-28 |
| Taux de dépréciation annuel (géométrique) — véhicules à pile à combustible | 0.2 | ratio | 0.15 – 0.28 | CA | ≈ estimation | [H2Fleet — Marché secondaire quasi inexistant : décote maximale](https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md) | 2026-09-28 |
| Plancher de valeur résiduelle (valeur ferraille/pièces), en part du prix d’achat | 0.1 | ratio | 0.05 – 0.15 | CA | ≈ estimation | [H2Fleet — Convention (méthodologie §3.7)](https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md) | 2026-09-28 |
| Borne niveau 2 (7-19 kW) installée au dépôt (matériel + installation) | 15000 (CAD 2026) | $ | 8000 – 25000 | QC | ≈ estimation | [RNCan (PIVEZ) — Coûts types des projets PIVEZ ; à remplacer par soumissions](https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports/pivez) | 2026-09-28 |
| Borne rapide CC ~50 kW installée (matériel + installation) | 60000 (CAD 2026) | $ | 40000 – 90000 | QC | ≈ estimation | [RNCan (PIVEZ) — Coûts types des projets PIVEZ ; à remplacer par soumissions](https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports/pivez) | 2026-09-28 |
| Borne rapide CC ~150 kW installée (matériel + installation) | 150000 (CAD 2026) | $ | 100000 – 220000 | QC | ≈ estimation | [RNCan (PIVEZ) — Coûts types des projets PIVEZ ; à remplacer par soumissions](https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports/pivez) | 2026-09-28 |
| Raccordement et mise à niveau électrique d’un dépôt (entrée, transformateur, distribution) | 100000 (CAD 2026) | $ | 20000 – 500000 | QC | ≈ estimation | [Hydro-Québec — Très variable selon la capacité disponible — UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE](https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html) | 2026-09-28 |
| Puissance électrique résiduelle présumée d’un garage existant, quand la puissance disponible réelle n’est pas renseignée (fiche du garage) | 20 | kW | 0 – 100 | QC | ≈ estimation | [Hydro-Québec — Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE](https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html) | 2026-09-28 |
| Raccordement — limite haute du palier 1 (puissance supplémentaire au-delà de la capacité disponible du garage) | 50 | kW | 30 – 75 | QC | ≈ estimation | [Hydro-Québec — Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE](https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html) | 2026-09-28 |
| Raccordement — limite haute du palier 2 (au-delà : palier 3) | 250 | kW | 150 – 400 | QC | ≈ estimation | [Hydro-Québec — Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE](https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html) | 2026-09-28 |
| Mise à niveau électrique — palier 1 : jusqu’à 50 kW supplémentaires (circuits et panneau, sans changement d’entrée) | 20000 (CAD 2026) | $ | 10000 – 50000 | QC | ≈ estimation | [Hydro-Québec — Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE](https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html) | 2026-09-28 |
| Mise à niveau électrique — palier 2 : de 50 à 250 kW supplémentaires (nouvelle entrée ou transformateur) | 100000 (CAD 2026) | $ | 50000 – 200000 | QC | ≈ estimation | [Hydro-Québec — Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE](https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html) | 2026-09-28 |
| Mise à niveau électrique — palier 3 : plus de 250 kW supplémentaires (alimentation dédiée, poste) | 500000 (CAD 2026) | $ | 200000 – 500000 | QC | ≈ estimation | [Hydro-Québec — Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE](https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html) | 2026-09-28 |
| Entretien annuel de l’infrastructure de recharge, en part du capital | 0.03 | ratio | 0.02 – 0.05 | CA | ≈ estimation | [H2Fleet — Pratique de l’industrie (contrats d’entretien réseaux de recharge)](https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md) | 2026-09-28 |
| Durée de vie de l’infrastructure de recharge | 15 | annees | 10 – 20 | CA | ≈ estimation | [H2Fleet — Convention d’amortissement (méthodologie §3.5)](https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md) | 2026-09-28 |
| Station de ravitaillement H2 au dépôt (capacité moyenne, clés en main) | 3500000 (CAD 2026) | $ | 1500000 – 8000000 | CA | ⚠️ à valider | [Propulsion Québec / Hydrolux — Étude 2023 + annonces de réseau 2025-2026 (aucun prix public normalisé)](https://propulsionquebec.com/wp-content/uploads/2023/11/PropulsionQc_Hydrogene-vert_VF1.pdf) | 2026-09-28 |
| Baisse annuelle attendue du prix des packs batterie (désactivée par défaut dans le moteur) | -0.05 | ratio | -0.08 – 0 | CA | ⚠️ à valider | [BloombergNEF — Lithium-Ion Battery Price Survey 2025 : pack moyen 108 $US/kWh, −8 % vs 2024 ; BEV 99 $US/kWh](https://about.bnef.com/insights/clean-transport/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour-despite-rising-metal-prices-bloombergnef/) | 2026-09-28 |
| Taux de change USD → CAD (véhicules importés des É.-U.) | 1.35 | CAD/USD | 1.25 – 1.45 | CA | ⚠️ à valider | [Banque du Canada — Taux de change quotidiens](https://www.banqueducanada.ca/taux/taux-de-change/) | 2026-09-28 |
| Droits de douane sur les VE fabriqués en Chine (régime de quota de février 2026) | 0.061 | ratio | 0.061 – 1 | CA | ⚠️ à valider | [Ministère des Finances du Canada — Surtaxe de 100 % (2024) remplacée en février 2026 par un quota de 49 000 unités/an à 6,1 % ; 100 % au-delà](https://www.canada.ca/fr/ministere-finances/nouvelles/2024/08/surtaxe-sur-les-vehicules-electriques-fabriques-en-chine.html) | 2026-09-28 |

### Notes

- **prix_diesel** : Valeur et plage lues depuis src/lib/tco/energy-data.json, mis à jour par le workflow hebdomadaire update-energy-data.yml (variation > 20 % = mise en attente, jamais appliquée automatiquement). Moyenne 12 mois 2,0902 $ TTC ÷ 1,14975 = 1,8179 $ AVANT TPS/TVQ — le moteur ajoute la part non récupérable selon l’organisme (§3.1 v2.2). Le taux de TVQ de la conversion est à_valider (taux_tvq). Borne basse = mois le plus bas des 12 derniers ; borne haute = SPOT DE CRISE du bulletin de la Régie du 2026-09-21 (2,95 $ TTC → 2,5658 $), utilisé UNIQUEMENT comme borne du scénario Favorable.
- **hq_tarif_m_energie** : 6,292 ¢/kWh au 2026-04-01 (2e tranche : 4,666 ¢/kWh). Hausse générale 3,8 % en 2026.
- **hq_tarif_m_puissance** : Puissance à facturer minimale : 65 % de la puissance maximale appelée en hiver (mécanisme de « ratchet », Tarifs d’électricité 2026, art. 2.17 et équivalents).
- **hq_tarif_g_energie** : 12,388 ¢/kWh ; reste 9,534 ¢/kWh ; prime 22,071 $/kW au-delà de 50 kW ; accès 15,426 $/mois.
- **cout_effectif_elec_depot** : Dérivé du tarif M : énergie 6,292 ¢ + prime 18,242 $/kW×12 répartie sur les kWh du site. Exemple : 10 camions × 40 000 kWh/an, pointe 300 kW → ≈ 0,063 + 0,164×300×12/400 000 ≈ 0,079 $/kWh ; recharge rapide simultanée → 0,12-0,16 $/kWh. Un devis/facture HQ saisi dans le projet est prioritaire.
- **prix_h2_livre** : Réseau public QC embryonnaire (stations Hydrolux 2025-2026) : pas de prix affiché officiel au QC. 16,50 $/kg = prix pompe C.-B. (HTEC, non lu directement) ; >17 $/kg estimé au QC hors subventions.
- **rendement_recharge** : Le moteur facture kWh_compteur = kWh_véhicule ÷ rendement (méthodologie §3.3).
- **majoration_hivernale_bev** : S’applique aussi aux FCEV (chauffage cabine), plage identique par défaut.
- **inflation_electricite** : Point de donnée vérifié : hausse 2026 de 3,8 % aux tarifs généraux (grille 2026).
- **taux_actualisation_nominal** : Stocké en décimal ; cohérent avec des flux NOMINAUX (méthodologie §2.2-2.3).
- **fe_diesel_ttw_lourds** : Lu au Tableau 6 : véhicules lourds diesel, dispositif perfectionné = 2 681 g CO2 + 0,11 g CH4 + 0,151 g N2O = 2 724 g éq. CO2/L. Sans dispositif : 2 705 ; véhicules légers diesel : 2 741.
- **fe_diesel_amont** : WTW diesel = TTW × (1 + majoration).
- **fe_reseau_qc** : Page consultée via le workflow mais la valeur chiffrée n’a pas pu être extraite du HTML ; 1,2 g éq. CO2/kWh (2022) d’après le résumé de recherche. Borne haute 35 g : approche marginale (importations/pointe) pour le stress test.
- **fe_h2_electrolyse_qc** : Inclut compression/distribution ; dépend du transport (camion vs pipeline).
- **fe_h2_smr** : SMR avec captage (bleu) : ~3-5 kg éq. CO2/kg, à saisir par projet selon le fournisseur.
- **cout_social_carbone_2026** : Lu à la Table 1 : 247 $ (2020) → 275 $ (2026) → 294 $ (2030), C$2021, taux Ramsey 2 %. Croît chaque année ; le moteur applique la valeur de l’année du flux.
- **taux_tps** : Archive : data/sources/2026-09-29/arc-taux.txt (« facture la TPS de 5 % », province non participante).
- **taux_tvq** : Aucune source officielle n’a pu être LUE depuis nos environnements (Revenu Québec = application JavaScript sans contenu serveur ; LégisQuébec art. 16 LTVQ = 403 CloudFront) — taux usuel depuis 2013, à faire valider manuellement sur la page Revenu Québec ci-dessus.
- **taux_recup_tps_municipalite** : VÉRIFIÉ : « Remboursement municipal … dont le taux est de 100 % de la TPS et de la partie fédérale de la TVH » (archive : data/sources/2026-09-29/rc4049-complet.txt).
- **taux_recup_tvq_municipalite** : VÉRIFIÉ : « le taux de remboursement des municipalités … de 50 % depuis le 1er janvier 2015 » (62,8 % en 2014, 43 % avant l’abolition de 1997) — archive : data/sources/2026-09-28/qc-depenses-fiscales-310302.txt. Taux non récupérable municipal résultant ≈ 0,5 × 9,975 % = 4,99 % du prix avant taxes. Entreprises : CTI/RTI complets → 0 %. Sociétés de transport : à confirmer (organismes désignés ou non selon leur statut).
- **raccordement_depot** : Plage de référence et valeur proposée par défaut pour un devis saisi. Le calcul d’infrastructure n’applique plus ce forfait par garage : il retient un palier selon les kW supplémentaires (raccordement_palier1 à 3).
- **puissance_disponible_garage_presumee** : Ordre de grandeur prudent (une borne niveau 2 tient sans travaux). À remplacer par la puissance réellement disponible : facture Hydro-Québec (puissance appelée vs puissance de l’entrée) ou relevé d’un électricien.
- **raccordement_palier1** : Borne basse de la plage du raccordement de dépôt (raccordement_depot : 20 000 $ à 500 000 $).
- **raccordement_palier2** : Valeur centrale du raccordement de dépôt du registre (raccordement_depot).
- **raccordement_palier3** : Borne haute de la plage du raccordement de dépôt du registre (raccordement_depot) ; un devis Hydro-Québec est indispensable à ce niveau.
- **trajectoire_prix_batterie** : Ne s’applique qu’à la part batterie du prix (≈ 30-40 % pour un camion lourd BEV).
- **droits_douane_ve_chine** : Régime instable : vérifier avant tout calcul portant sur un véhicule d’origine chinoise.

## Défauts par catégorie de véhicule (tous « estimation »)

### Véhicule léger de service (berline, VUS compact)

Durée de vie : 10 ans — km/an par défaut : 25000

| Technologie | Consommation | Prix d’achat (CAD 2026) | Entretien ($/km) |
|---|---|---|---|
| diesel | 9 L/100 km (7–12) | 45 000 $ (35 000–55 000) | 0.1 (0.07–0.14) |
| BEV | 20 kWh/100 km (16–26) | 55 000 $ (45 000–70 000) | 0.07 (0.05–0.1) |
| FCEV | 1 kg H2/100 km (0.8–1.3) | 75 000 $ (60 000–95 000) | 0.09 (0.06–0.13) |

Sources :
- RNCan — Guide de consommation de carburant (à_valider : https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports/guide-consommation-carburant)

### Camionnette / fourgonnette de service (classes 2b-3)

Durée de vie : 10 ans — km/an par défaut : 30000

| Technologie | Consommation | Prix d’achat (CAD 2026) | Entretien ($/km) |
|---|---|---|---|
| diesel | 15 L/100 km (12–20) | 68 000 $ (55 000–85 000) | 0.14 (0.1–0.2) |
| BEV | 32 kWh/100 km (25–45) | 95 000 $ (75 000–125 000) | 0.1 (0.07–0.14) |
| FCEV | 1.6 kg H2/100 km (1.2–2.2) | 150 000 $ (110 000–200 000) | 0.13 (0.09–0.18) |

Sources :
- NREL Fleet DNA / RNCan (à_valider : https://www.nrel.gov/transportation/fleettest.html)

### Camion porteur moyen (classes 4-6)

Durée de vie : 12 ans — km/an par défaut : 35000

| Technologie | Consommation | Prix d’achat (CAD 2026) | Entretien ($/km) |
|---|---|---|---|
| diesel | 26 L/100 km (20–34) | 140 000 $ (110 000–180 000) | 0.25 (0.18–0.35) |
| BEV | 62 kWh/100 km (45–85) | 300 000 $ (220 000–400 000) | 0.18 (0.12–0.26) |
| FCEV | 4.5 kg H2/100 km (3.2–6) | 460 000 $ (350 000–620 000) | 0.23 (0.16–0.33) |

Sources :
- NREL / NACFE (à_valider : https://nacfe.org/)

### Camion lourd (classes 7-8)

Durée de vie : 12 ans — km/an par défaut : 60000

| Technologie | Consommation | Prix d’achat (CAD 2026) | Entretien ($/km) |
|---|---|---|---|
| diesel | 36 L/100 km (28–46) | 200 000 $ (160 000–260 000) | 0.35 (0.25–0.5) |
| BEV | 115 kWh/100 km (85–150) | 460 000 $ (350 000–620 000) | 0.25 (0.17–0.36) |
| FCEV | 8 kg H2/100 km (6–10.5) | 720 000 $ (520 000–950 000) | 0.32 (0.22–0.46) |

Sources :
- NACFE Run on Less Electric / constructeurs (à_valider)

### Autobus urbain 12 m

Durée de vie : 16 ans — km/an par défaut : 60000

| Technologie | Consommation | Prix d’achat (CAD 2026) | Entretien ($/km) |
|---|---|---|---|
| diesel | 45 L/100 km (35–58) | 750 000 $ (650 000–900 000) | 0.95 (0.7–1.3) |
| BEV | 140 kWh/100 km (120–170) | 1 720 000 $ (1 500 000–2 000 000) | 0.7 (0.5–1) |
| FCEV | 9 kg H2/100 km (7–11.5) | 2 400 000 $ (1 900 000–3 100 000) | 0.9 (0.65–1.25) |

Sources :
- BEV kWh/km : Université Concordia/STM, 1,4 été-1,7 hiver kWh/km (à_valider : https://techxplore.com/news/2025-11-montreal-electric-buses-energy-winter.html)
- Prix BEV : contrat ATUQ/Nova Bus 2023 — 339 LFSe+ pour 583 M$ ≈ 1,72 M$/unité (à_valider : https://www.newswire.ca/fr/news-releases/nova-bus-marque-l-histoire-en-remportant-un-appel-d-offres-pour-une-commande-de-jusqu-a-1-229-autobus-electriques-a-grande-autonomie-au-quebec-862154677.html)

## Programmes de subventions

Seuls les programmes au statut « actif » sont comptés automatiquement par le moteur.

### PAVÉ — Programme pour l’abordabilité des véhicules électriques (fédéral)

Palier : federal — cible : vehicule — **statut : actif** (✅ vérifié, le 2026-09-28) — fin : 2031-03-31

Source : [Transports Canada — Electric Vehicle Affordability Program: Overview (page modifiée le 2026-09-10)](https://tc.canada.ca/en/road-transportation/innovative-technologies/electric-vehicles/electric-vehicle-affordability-program)

- vehicule_leger × BEV/FCEV : jusqu’à 5 000 $ — Véhicules légers (< 8 500 lb) neufs, transaction ≤ 50 000 $ (sans plafond si fabriqué au Canada). Barème dégressif VÉRIFIÉ (tableau de la page Overview, archivée) : 5 000 $ (2026), 4 000 $ (2027), 3 000 $ (2028 et 2029), 2 000 $ (2030 et 2031).
- Cumul : Cumulable avec Roulez vert (programmes de paliers différents).
- Limites : VÉRIFIÉ (page Overview archivée) : particuliers 1 incitatif ; organisations et entreprises max 10 ; gouvernements provinciaux, territoriaux et MUNICIPAUX max 10 sur les 5 ans du programme. Le montant dépend de la date de soumission de l’évaluation d’admissibilité par le concessionnaire, pas de la date d’achat.
- Année de versement par défaut : année d’acquisition (point de vente)
- Notes : Transactions à partir du 2026-02-16 ; jusqu’au 2031-03-31 ou épuisement des fonds (2,00 G$ restants au 2026-09-01 sur 2,275 G$ — vérifié). Appliqué au point de vente.

### Roulez vert (Québec) — véhicule neuf

Palier : provincial — cible : vehicule — **statut : actif** (✅ vérifié, le 2026-09-28) — fin : 2026-12-31

Source : [Gouvernement du Québec — Montant de l’aide financière pour un véhicule électrique neuf (page officielle)](https://www.quebec.ca/en/transports/electric-transportation/financial-assistance-electric-vehicle/new-vehicle/amount-financial-assistance)

- vehicule_leger × BEV : jusqu’à 2 000 $ — PDSF < 65 000 $. Montant 2026 ; le programme prend fin le 2026-12-31.
- vehicule_leger × FCEV : jusqu’à 2 000 $
- Cumul : Cumulable avec le PAVÉ fédéral.
- Année de versement par défaut : année d’acquisition (point de vente)
- Notes : Vérifié : 2 000 $ VE, 2 000 $ pile à combustible, 1 000 $/500 $ hybride rechargeable en 2026 ; les taxes se calculent sur le prix AVANT rabais ; aucune subvention provinciale après le 2027-01-01. Volet borne à domicile 600 $ (non pertinent flotte).

### Écocamionnage volet 1 (Québec, MTMD) — acquisition de véhicules

Palier : provincial — cible : vehicule — **statut : actif** (✅ vérifié, le 2026-09-28) — fin : 2028-03-31

Source : [MTMD (Québec) — Modalités d’application du programme Écocamionnage 2025-2028, section 6.1.5](https://www.quebec.ca/transports/aide-financiere/electrification/ecocamionnage/volet-1)

- camionnette × BEV/FCEV : jusqu’à 2 500 $ — Fourgonnette classe 2b (PNBV 3 856-4 535 kg), non admissible à Roulez vert : montant forfaitaire DÉGRESSIF PAR ANNÉE FINANCIÈRE (bascule au 1er avril, date de la facture) — 5 000 $ (2025-2026), 2 500 $ (2026-2027, en vigueur), 0 $ (2027-2028). Vérifié (tableau 1). Convention prudente : l’année calendaire N reçoit le montant de l’année financière N→N+1.
- camionnette × BEV/FCEV : 25 % du coût, max 30 000 $ — Classe 3 (PNBV 4 536-6 350 kg) : 25 % du coût d’achat, max 30 000 $. Vérifié (tableau 2).
- camion_moyen × BEV/FCEV : 35 % du coût, max 75 000 $ — Classe 4 (PNBV 6 351-7 257 kg) : 35 % du coût d’achat, max 75 000 $. Vérifié (tableau 2).
- camion_moyen, camion_lourd × BEV/FCEV : 25 % du coût, max 100 000 $ — Classes 5-7 (PNBV 7 258-14 969 kg) : max 100 000 $ (vérifié). La cellule « Part du coût d’achat (%) » de ces classes est VIDE dans le tableau 2 du PDF officiel (constaté sur le document archivé, rendu image haute résolution) alors que l’intro 6.1.5.2 annonce des proportions — coquille probable. Position prudente : 25 % (borne basse du même tableau), plafonné — À VALIDER auprès du MTMD.
- camion_lourd × BEV/FCEV : 25 % du coût, max 150 000 $ — Classe 8 (PNBV ≥ 14 970 kg) : max 150 000 $ (vérifié) ; % du coût d’achat À VALIDER (cellule vide, même raison que les classes 5-7) — 25 % retenu par prudence. La bonification achat local s’applique DANS le plafond : le maximum reste 150 000 $.
- Bonification achat local : +15 %
- Cumul : « Un véhicule ne peut obtenir qu’une seule aide financière » au sein du programme (vérifié, 6.1.6). Art. 7.14.2 (VÉRIFIÉ) : le cumul des aides publiques (gouvernements du Québec et du Canada, crédits d’impôt inclus) ne peut dépasser 75 % des dépenses admissibles ; tout excédent est déduit de l’aide du programme — la contribution minimale du demandeur est de 25 %.
- Limites : VÉRIFIÉ : plafond de 3 M$ d’aide par demandeur par année financière pour les acquisitions de véhicules (7.10 ; 1 M$/an pour les autres volets). Municipalités ADMISSIBLES au volet 1 (6.1.2). Inscription au Registre des propriétaires et exploitants de véhicules lourds (RPEVL) avec cote de sécurité satisfaisante requise, SAUF pour les fourgonnettes classe 2b (6.1.2).
- Année de versement par défaut : année suivant l’acquisition (après livraison/approbation)
- Notes : Versement unique APRÈS livraison et approbation (vérifié, 6.1.6) → année de versement par défaut : 1. Conditions : inscription au Registre CTQ, établissement au Québec depuis 2 ans, achat chez un fournisseur québécois si disponible. Autobus urbains : programme distinct (PAGTCP), pas Écocamionnage.

### iVMLZE / iMHZEV (fédéral) — véhicules moyens et lourds

Palier : federal — cible : vehicule — **statut : ferme** (✅ vérifié, le 2026-09-28) — fin : 2026-03-31

Source : [Transports Canada — Page officielle : « Closed: Incentives for Medium- and Heavy-Duty Zero-Emission Vehicles »](https://tc.canada.ca/en/road-transportation/innovative-technologies/zero-emission-vehicles/medium-heavy-duty-zero-emission-vehicles)

- camionnette, camion_moyen, camion_lourd, autobus_urbain_12m × BEV/FCEV : jusqu’à 200 000 $ — Jusqu’à 200 000 $ selon la catégorie, du temps du programme.
- Cumul : N/A (fermé).
- Année de versement par défaut : année d’acquisition (point de vente)
- Notes : VÉRIFIÉ FERMÉ : « Status: Closed — The iMHZEV Program has ended » (page lue le 2026-09-28). NON COMPTÉ par défaut. Conservé au registre parce que l’ancien contenu du produit le présentait encore comme actif.

### PIVEZ / ZEVIP (fédéral, RNCan) — infrastructure de recharge

Palier : federal — cible : infrastructure — **statut : suspendu** (✅ vérifié, le 2026-09-28)

Source : [RNCan — Page officielle PIVEZ : volets « Fermé aux demandes » (propriétaires/exploitants et organismes d’exécution)](https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports/pivez)

- vehicule_leger, camionnette, camion_moyen, camion_lourd, autobus_urbain_12m × BEV : 50 % du coût, max 2 000 000 $ — 50 % des coûts admissibles, max 2 M$ par projet (volet propriétaires/exploitants).
- Cumul : Total de l’aide publique plafonné selon les modalités du programme (à confirmer par appel de propositions).
- Année de versement par défaut : année suivant l’acquisition (après livraison/approbation)
- Notes : VÉRIFIÉ : les volets affichent « Fermé aux demandes » (page lue le 2026-09-28) ; programme disponible jusqu’en 2027 — de nouveaux appels peuvent rouvrir. Statut « suspendu » : NON COMPTÉ par défaut.

### FTCZE — Fonds pour le transport en commun à zéro émission (fédéral, LICC)

Palier : federal — cible : vehicule — **statut : suspendu** (✅ vérifié, le 2026-09-28)

Source : [Logement, Infrastructures et Collectivités Canada — Fonds pour le transport en commun à zéro émission (2,75 G$, objectif 5 000 autobus ZE)](https://logement-infrastructure.canada.ca/zero-emissions-trans-zero-emissions/index-fra.html)

- autobus_urbain_12m × BEV/FCEV : montant du projet à saisir (jamais compté automatiquement) — Montants par projet (contribution + prêt BIC), pas de barème public par véhicule — saisir le montant réel du projet. Plafond 0 = jamais compté automatiquement.
- Cumul : Se combine avec le financement de la Banque de l’infrastructure du Canada (prêts autobus).
- Année de versement par défaut : année suivant l’acquisition (après livraison/approbation)
- Notes : VÉRIFIÉ (page officielle lue et archivée le 2026-09-28) : « La période de soumission des demandes pour les projets de planification et les projets d’immobilisations… est maintenant terminée » — guichet FERMÉ aux nouvelles demandes, résultats à venir. Statut « suspendu » : NON COMPTÉ par défaut ; saisir le montant réel si un projet a été retenu. Part contributive type non publiée.

### Programme d’aide gouvernementale au transport collectif (Québec, MTMD) — électrification des autobus

Palier : provincial — cible : vehicule — **statut : actif** (⚠️ à valider, le 2026-09-28)

Source : [MTMD (Québec) — Programmes d’aide au transport collectif](https://www.transports.gouv.qc.ca/fr/aide-finan/transport-collectif/Pages/transport-collectif.aspx)

- autobus_urbain_12m × BEV/FCEV : montant du projet à saisir (jamais compté automatiquement) — Aide au surcoût d’électrification des sociétés de transport (taux et enveloppes par décret) — saisir le montant réel du projet. Plafond 0 = jamais compté automatiquement.
- Cumul : Se combine au FTCZE fédéral dans les projets récents (ex. commandes ATUQ).
- Année de versement par défaut : année suivant l’acquisition (après livraison/approbation)
- Notes : Ni le statut ni les taux n’ont pu être lus depuis l’environnement — À VALIDER avant tout calcul autobus.

## À valider en priorité (sources inaccessibles depuis l’environnement)

- Prix de l’hydrogène livré à la pompe/au dépôt → https://www.htec.ca/faqs/
- Majoration de la consommation électrique en conditions hivernales (pendant les mois d’hiver) → https://techxplore.com/news/2025-11-montreal-electric-buses-energy-winter.html
- Inflation générale (IPC) — indexation entretien, assurance, prix d’achat futurs → https://www.banqueducanada.ca/grandes-fonctions/politique-monetaire/inflation/
- Majoration puits-au-réservoir du diesel (extraction, raffinage, transport), en part du TTW → https://ghgenius.ca/
- Intensité GES du réseau électrique du Québec (consommation) → https://www.canada.ca/fr/services/environnement/meteo/changementsclimatiques/plan-climatique/electricite-propre/apercu-quebec.html
- Facteur d’émission puits-à-roue, H2 par électrolyse au Québec → https://propulsionquebec.com/wp-content/uploads/2023/11/PropulsionQc_Hydrogene-vert_VF1.pdf
- Facteur d’émission puits-à-roue, H2 par reformage du méthane (SMR) sans captage → https://ressources-naturelles.canada.ca/production-denergie/lavenir-de-lhydrogene-au-canada
- Taux de la TVQ → https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/perception-de-la-tps-et-de-la-tvq/calcul-des-taxes/
- Station de ravitaillement H2 au dépôt (capacité moyenne, clés en main) → https://propulsionquebec.com/wp-content/uploads/2023/11/PropulsionQc_Hydrogene-vert_VF1.pdf
- Baisse annuelle attendue du prix des packs batterie (désactivée par défaut dans le moteur) → https://about.bnef.com/insights/clean-transport/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour-despite-rising-metal-prices-bloombergnef/
- Taux de change USD → CAD (véhicules importés des É.-U.) → https://www.banqueducanada.ca/taux/taux-de-change/
- Droits de douane sur les VE fabriqués en Chine (régime de quota de février 2026) → https://www.canada.ca/fr/ministere-finances/nouvelles/2024/08/surtaxe-sur-les-vehicules-electriques-fabriques-en-chine.html
- Programme d’aide gouvernementale au transport collectif (Québec, MTMD) — électrification des autobus → https://www.transports.gouv.qc.ca/fr/aide-finan/transport-collectif/Pages/transport-collectif.aspx
