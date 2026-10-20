# ADR 0007 — CSP stricte à nonce

Statut : accepté (2026-10-20), à revoir en phase 3

Le middleware génère un nonce par requête et pose `script-src 'self'
'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `frame-ancestors 'none'`,
`base-uri 'self'`, `form-action 'self'` ; `style-src 'unsafe-inline'`
reste nécessaire (next/font, Radix). Conséquence : toutes les pages sont
rendues dynamiquement. En phase 3, les pages publiques (objectif ISR et
Lighthouse > 95) pourront passer à une CSP par empreintes sans nonce.
