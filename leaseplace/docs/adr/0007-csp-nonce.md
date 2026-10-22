# ADR 0007 — CSP stricte à nonce

Statut : accepté (2026-10-20), confirmé en phase 3 (2026-10-22)

Le middleware génère un nonce par requête et pose `script-src 'self'
'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `frame-ancestors 'none'`,
`base-uri 'self'`, `form-action 'self'` ; `style-src 'unsafe-inline'`
reste nécessaire (next/font, Radix). Conséquence : toutes les pages sont
rendues dynamiquement. En phase 3, les pages publiques (objectif ISR et
Lighthouse > 95) pourront passer à une CSP par empreintes sans nonce.

## Révision phase 3

Pages publiques gardées sous CSP à nonce (rendu dynamique) : sans
`'unsafe-inline'`, la mesure Lighthouse montre que le rendu dynamique n'est
pas le facteur limitant (temps serveur ~50 ms) ; les leviers retenus sont
le poids du HTML et du JavaScript (ADR 0010). Zod 4 tentait une compilation
par `new Function` (bloquée par la CSP) : `z.config({ jitless: true })`
(`apps/web/src/lib/zod.ts`).
