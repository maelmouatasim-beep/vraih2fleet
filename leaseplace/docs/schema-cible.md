# Schéma cible (validé le 2026-10-20)

Construit **phase par phase** : chaque table arrive avec la phase qui
l'utilise, ses policies RLS et ses tests d'isolation. Conventions : uuid v7,
`timestamptz` (UTC, affiché en Africa/Casablanca), montants
`numeric(18,2)` + `currency char(3)` (`MAD`), taux `numeric(9,6)`, statuts
`text` + CHECK générés depuis `packages/domain`, `version` pour le verrou
optimiste, pièces d'identité chiffrées côté application (`_enc` + `_hash`).

| Schéma     | Tables                                                                                                                                                                                                                                                                                | Phase                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `identity` | users, sessions, accounts, verifications, two_factors, organizations (`type`), memberships, invitations, role_catalog, rate_limits, impersonation_sessions                                                                                                                            | **1** (impersonation : 8) |
| `audit`    | events (append-only, chaîné)                                                                                                                                                                                                                                                          | **1**                     |
| `dev`      | outbox (boîte d'envoi de démonstration)                                                                                                                                                                                                                                               | **1**                     |
| `ref`      | sectors (NMA), asset_categories (courbe de valeur résiduelle), regions, cities                                                                                                                                                                                                        | 3–4                       |
| `kyc`      | companies, directors, beneficial_owners, documents, document_extractions, kyc_checks, legal_texts, consents, consent_recipients, data_subject_requests, retention_policies                                                                                                            | 4–5                       |
| `credit`   | financing_requests (`product_type lease \| ijara`, `currency`, `submitted_by_org_id`, `supplier_org_id`), request_documents, request_events, risk_assessments, risk_overrides, lessor_appetites, routing_decisions, routing_targets (pivot de la RLS bailleur), credit_memos, ai_runs | 4–6                       |
| `market`   | offers (coût total et TEG calculés par le moteur), deals, signature_envelopes                                                                                                                                                                                                         | 6–7                       |
| `billing`  | commission_grids + tiers (`mode marginal`), mandates, commissions, invoices + lines (numérotation annuelle sans trou)                                                                                                                                                                 | 8                         |
| `comms`    | threads (un fil par demande × bailleur), messages, message_reads, notifications, notification_deliveries, notification_preferences                                                                                                                                                    | 6–7                       |

Règles RLS cibles : une entreprise voit son organisation et les offres
**soumises** sur ses demandes ; un bailleur voit une demande seulement via un
`routing_target` le concernant (`selected`, envoyé, consentement actif qui le
nomme), uniquement **ses** offres et **ses** fils ; la plateforme voit tout,
chaque action auditée. Détail colonne par colonne : proposition du
2026-10-20 (conversation de lancement).
