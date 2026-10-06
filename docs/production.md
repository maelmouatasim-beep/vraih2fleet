# Mise en production sur h2fleet.ca

Guide pas à pas, **dans l'ordre**, pour passer le site sur ton domaine sans
jamais casser le site de test. Chaque phase se termine par une vérification ;
on ne passe à la suivante que si elle est bonne.

## Choix de l'hébergeur : Cloudflare Pages

| | Cloudflare Pages (retenu) | Vercel |
|---|---|---|
| Dépôt GitHub **privé** | oui, gratuit | oui |
| Usage **commercial** sur l'offre gratuite | **autorisé** | **interdit** sur l'offre Hobby (offre Pro payante) |
| DNS du domaine | inclus (gratuit), même tableau de bord | séparé |
| Builds | 500 / mois, faits par Cloudflare (ne consomment pas les minutes GitHub) | 6 000 min / mois |
| Retour arrière | un clic (« Rollback ») | un clic |

H2Fleet est un produit commercial : Cloudflare est le seul des deux qui reste
gratuit et conforme. Il héberge aussi le DNS de h2fleet.ca, ce qui regroupe le
site, les redirections et les enregistrements de courriel au même endroit.

## Ce qui est déjà prêt dans le dépôt

- **URL propres** (`BrowserRouter`) : `npm run build:prod`. Ce build **refuse
  de construire** si une variable Supabase manque, si l'URL ne correspond pas
  au projet, si une clé secrète a été collée à la place de la clé publique,
  ou si le hash routing est demandé. Un build refusé laisse le déploiement
  précédent en ligne.
- **Redirections** :
  - les anciennes pages publiques renvoient une 301 côté serveur
    (`dist/_redirects`), générée depuis la même liste que le routeur
    (`src/lib/production/site.ts`) ;
  - les anciens liens à hash (`h2fleet.ca/#/dashboard`) deviennent
    `h2fleet.ca/dashboard` ;
  - toute autre route sert l'application : c'est le mode SPA de Pages,
    actif parce que le site n'a pas de `404.html`.
- **En-têtes de sécurité** (`dist/_headers`) : CSP stricte (seul Supabase est
  appelé depuis le navigateur), HSTS, anti-iframe, `nosniff`, cache d'un an
  pour les fichiers fingerprintés.
- **Testé** : la CI construit le bundle de production et le sert comme
  Cloudflare Pages (`scripts/serveur-production.mjs`). Le parcours terrain
  complet (18 étapes : PDF, Excel, Word, temps réel, copilote) et la
  régression visuelle tournent dessus. Une seule violation de la CSP fait
  échouer la CI.
- **Node 22** imposé à l'hébergeur (`.node-version`).
- **Dépôt privé anticipé** :
  - le déploiement GitHub Pages s'arrête de lui-même quand le dépôt devient
    privé ;
  - le job lourd de la CI (~15 min) ne tourne plus à chaque push, seulement
    la nuit, à la main et sur la branche `production` (voir phase F).

## Phase A — Préparer (aucun effet sur le site de test)

1. **Compte Cloudflare** : https://dash.cloudflare.com/sign-up (offre Free).
   Active tout de suite la double authentification (My Profile →
   Authentication).
2. **Ajouter le domaine** : Websites → *Add a domain* → `h2fleet.ca` →
   offre **Free**. Cloudflare importe les enregistrements DNS existants :
   compare la liste avec celle d'IONOS, **à l'identique**. Les courriels
   du domaine sont chez IONOS (boîte `noreply@h2fleet.ca`) : ces
   enregistrements doivent être recopiés **tels quels**, jamais modifiés
   ni « simplifiés » :
   - MX `mx00.ionos.com` et `mx01.ionos.com` ;
   - TXT SPF à la racine `v=spf1 include:_spf-us.ionos.com ~all` ;
   - CNAME DKIM `s1-ionos._domainkey` → `s1.dkim.ionos.com`,
     `s2-ionos._domainkey` → `s2.dkim.ionos.com` (et tout autre
     `…._domainkey` affiché par IONOS), en **DNS only (nuage gris)** ;
   - TXT `_dmarc`.
   Rien ne doit manquer, sinon l'envoi et la réception s'arrêtent à la
   bascule des serveurs de noms. (Le DNS doit passer chez Cloudflare parce
   que Cloudflare Pages n'accepte la racine `h2fleet.ca` que pour un
   domaine dont il gère le DNS ; la messagerie, elle, reste chez IONOS.)
3. **DNSSEC** : si DNSSEC est activé chez ton registraire, **désactive-le
   d'abord** (sinon le domaine devient injoignable pendant le changement).
4. **Serveurs de noms** : chez ton registraire (là où h2fleet.ca a été
   acheté), remplace les serveurs de noms par les **deux noms donnés par
   Cloudflare** (du type `xxx.ns.cloudflare.com`). Attends que Cloudflare
   affiche le domaine **Active** (de quelques minutes à 24 h). Le site de
   test GitHub Pages n'utilise pas ce domaine : rien ne casse.
5. **DNSSEC chez Cloudflare** (facultatif, recommandé) : DNS → Settings →
   *Enable DNSSEC*, puis colle l'enregistrement DS fourni chez le
   registraire.
6. **Branche de production** : sur GitHub → *Branches* → *New branch* →
   nom `production`, source `claude/code-integration-site-o88hza`.
   - **Seule cette branche alimente h2fleet.ca.** Mes pushes quotidiens vont
     sur la branche de développement et ne touchent jamais la production.
   - Protège-la : Settings → Branches → *Add rule* → `production` →
     *Require a pull request before merging*.
7. **Projet Pages** : Workers & Pages → *Create* → onglet **Pages** →
   *Connect to Git* → GitHub → autorise l'application Cloudflare **seulement
   sur le dépôt `vraih2fleet`** → sélectionne-le, puis :

   | Réglage | Valeur |
   |---|---|
   | Project name | `h2fleet` (donne `h2fleet.pages.dev`) |
   | Production branch | `production` |
   | Framework preset | None |
   | Build command | `npm run build:prod` |
   | Build output directory | `dist` |
   | Root directory | (vide) |

   *Environment variables* : mêmes valeurs **publiques** que les variables
   GitHub, à saisir pour **Production ET Preview** :
   - `VITE_SUPABASE_URL` = `https://rjyvcogtvcgzwxeprgsm.supabase.co`
   - `VITE_SUPABASE_PROJECT_ID` = `rjyvcogtvcgzwxeprgsm`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = la clé publishable, celle de la
     variable GitHub (jamais la clé `service_role` ni `sb_secret_…` : le build
     la refuserait)

   → *Save and Deploy*. Si le journal de build montre une autre version de
   Node que 22, ajoute la variable `NODE_VERSION` = `22`.
8. **Aperçus = nouveau site de test** : Settings → Builds → *Preview
   deployments* : **All non-production branches**. Chaque push sur la
   branche de développement donne une adresse fixe
   `https://<alias>.h2fleet.pages.dev`. Note l'alias exact affiché dans
   *Deployments* : il remplacera GitHub Pages quand le dépôt sera privé.

**Vérification A** :
- `https://h2fleet.pages.dev` affiche l'accueil avec ses styles.
- Un rafraîchissement (F5) sur `https://h2fleet.pages.dev/dashboard` ne
  donne pas d'erreur 404.
- `https://h2fleet.pages.dev/ecosystem` redirige vers `/features`.
- Page de connexion : elle s'affiche. La connexion elle-même attend la
  phase B.

## Phase B — Brancher Supabase et le domaine (le site de test reste intact)

1. **Supabase → Authentication → URL Configuration → Redirect URLs** :
   **ajoute**, sans rien retirer, les adresses suivantes :
   - `https://h2fleet.ca/**`
   - `https://h2fleet.pages.dev/**`
   - `https://*.h2fleet.pages.dev/**`

   Laisse le *Site URL* sur GitHub Pages pour l'instant.
2. **Supabase → Edge Functions → Secrets** : régénère les secrets et pose
   `ALLOWED_ORIGINS` en suivant la procédure de rotation de
   `docs/securite-secrets.md`. La nouvelle liste garde GitHub Pages et
   ajoute :
   - `https://h2fleet.ca`
   - `https://www.h2fleet.ca`
   - `https://h2fleet.pages.dev`
   - `https://*.h2fleet.pages.dev` : ce joker n'autorise qu'un seul niveau
     de sous-domaine, en HTTPS. Il est testé.
3. **Domaine du projet Pages** : projet `h2fleet` → *Custom domains* →
   *Set up a custom domain*. Ajoute `h2fleet.ca`, puis `www.h2fleet.ca`.
   Cloudflare crée lui-même les enregistrements DNS et le certificat
   (quelques minutes).
4. **www → sans www** : Rules → *Redirect Rules* → *Create rule* → modèle
   **« Redirect from WWW to root »** → code **301**, *Preserve query string*
   coché → Deploy.
5. **HTTPS partout** : SSL/TLS → Overview → mode **Full (strict)** ;
   SSL/TLS → Edge Certificates → **Always Use HTTPS** activé.

**Vérification B**, sur `https://h2fleet.ca` :
- connexion, création d'un projet, téléchargement du PDF et de l'Excel ;
- copilote, s'il est activé : la réponse arrive, ce qui prouve que la CORS
  des fonctions est correcte ;
- `https://www.h2fleet.ca/login` redirige vers `https://h2fleet.ca/login` ;
- `http://h2fleet.ca` redirige vers `https://` ;
- https://securityheaders.com/?q=h2fleet.ca liste CSP, HSTS, X-Frame-Options,
  Referrer-Policy et Permissions-Policy.

## Phase C — Bascule (h2fleet.ca devient l'adresse officielle)

1. Supabase → Authentication → URL Configuration → **Site URL** =
   `https://h2fleet.ca`. Les liens de courriel (confirmation, mot de passe)
   pointent désormais sur le domaine ; GitHub Pages reste dans les Redirect
   URLs tant qu'il existe.
2. Supabase → Edge Functions → Secrets → **`APP_BASE_URL`** =
   `https://h2fleet.ca` : liens des courriels applicatifs et des
   invitations.
3. Fais une inscription test avec une adresse externe. Le lien du courriel
   doit ouvrir `https://h2fleet.ca/…`. Fais aussi une réinitialisation de
   mot de passe : la page `/reset-password` doit s'ouvrir.

**Retour arrière** : Pages → *Deployments* → un déploiement précédent →
*Rollback to this deployment* (immédiat). Pour revenir au site de test,
remets le *Site URL* sur GitHub Pages : rien n'a été retiré.

## Phase D — Courriels du domaine (IONOS)

Objectif : envoyer depuis `noreply@h2fleet.ca` sans finir dans les
indésirables. Le domaine et la boîte sont chez **IONOS** ; l'envoi passe
par `smtp.ionos.com:465` (authentification Supabase : fait ; courriels
applicatifs : `docs/courriels.md`). **Ne jamais toucher aux MX ni au SPF
d'IONOS.**

État relevé le 2026-10-05 (lecture DNS publique, rien modifié) :

| Enregistrement | Valeur | État |
|---|---|---|
| MX | `mx00.ionos.com`, `mx01.ionos.com` | ✅ |
| SPF (TXT racine) | `v=spf1 include:_spf-us.ionos.com ~all` | ✅ autorise les serveurs d'envoi IONOS |
| DKIM `s1-ionos._domainkey`, `s2-ionos._domainkey` | CNAME → `s1/s2.dkim.ionos.com`, clés publiées | ✅ |
| DKIM `s42582890._domainkey` | CNAME → `s42582890.dkim.ionos.com`, **cible introuvable** | ⚠️ à vérifier dans IONOS |
| DMARC (`_dmarc`) | `v=DMARC1; p=none;` (sans adresse de rapports) | ⚠️ à compléter |
| `s1._domainkey`, `s2._domainkey` | anciens CNAME d'un autre service d'envoi | sans effet, à retirer un jour (facultatif) |

1. **DKIM** : IONOS → *Domaines & SSL* → `h2fleet.ca` → *DNS* (ou
   *Courriel* → paramètres de la boîte) : vérifier que la signature DKIM
   est **activée** pour le domaine. Le sélecteur `s42582890` pointe vers
   une clé absente : soit il est inutilisé (alors sans effet), soit
   l'activation n'est pas terminée. Le juge de paix est l'étape 3.
2. **DMARC** : modifier l'enregistrement TXT `_dmarc` existant (pas en
   créer un second) en
   `v=DMARC1; p=none; rua=mailto:<une boîte que tu lis>` pour recevoir
   les rapports. Après 2 à 4 semaines de rapports propres (SPF et DKIM
   alignés), passer à `p=quarantine`.
3. **Vérification** : Paramètres → *Courriel de test* vers une boîte
   Gmail, puis « Afficher l'original ». Tu dois lire SPF **PASS**, DKIM
   **PASS** (`d=h2fleet.ca`) et DMARC **PASS**. Faire de même avec le
   courriel de confirmation d'inscription.
4. **Formulaire de contact** : la boîte `contact@h2fleet.ca` existe déjà
   chez IONOS ; poser le secret `CONTACT_INBOX_EMAIL` avec cette adresse.
   Ne JAMAIS activer Cloudflare Email Routing : il remplacerait les MX
   d'IONOS (la réception du courriel passerait par Cloudflare).
5. **Plus tard (Brevo)** : voir `docs/deploiement.md` — un seul SPF
   fusionné, jamais deux.

## Phase E — Historique git

Avant de passer le dépôt en privé : procédure et risques dans
`docs/historique-git.md`. **Rien n'est exécuté sans ton accord.**

## Phase F — Passer le dépôt en privé

À faire **après** les phases A à D et après la phase E si tu la valides.
Vérifie d'abord que l'aperçu Cloudflare de la branche de développement
fonctionne : il remplace GitHub Pages comme site de test.

1. GitHub → Settings → *Danger Zone* → **Change repository visibility** →
   *Make private*.
2. **Ce qui change, tout seul** :
   - **GitHub Pages s'arrête.** Le site
     `maelmouatasim-beep.github.io/vraih2fleet` n'est pas gratuit sur un
     dépôt privé, et le workflow « Deploy Pages » se met en veille de
     lui-même. Le site de test devient l'aperçu
     `https://<alias>.h2fleet.pages.dev`.
   - **Minutes GitHub Actions** : 2 000 min/mois gratuites en privé
     (illimitées en public).
     - Mesuré sur les 13 derniers pushes : CI ≈ 18 min facturées par push,
       dont 15 pour le job lourd.
     - Le job lourd (Supabase local + e2e) ne tourne donc plus à chaque
       push, seulement : chaque nuit (07 h 17 UTC), à la main (Actions → CI
       → *Run workflow*) et sur la branche `production`.
     - Le job léger (typecheck, lint, tests, build ≈ 3 min) tourne toujours
       à chaque push. On tombe à environ 3 à 4 min par push, plus 15 min par
       nuit.
     - Alternative : GitHub Pro (environ 4 $ US/mois, 3 000 min).
   - Cloudflare Pages continue de déployer : son autorisation sur le dépôt
     est conservée.
   - Claude Code continue d'accéder au dépôt (application GitHub
     installée).
3. **Ce qui ne change pas** : Supabase, les secrets, h2fleet.ca, l'aperçu
   claude.ai.
4. **Après** : retire `https://maelmouatasim-beep.github.io` de
   `ALLOWED_ORIGINS` et des Redirect URLs de Supabase. Retire aussi les
   variables de dépôt devenues inutiles, si tu le souhaites.

## Phase G — Mettre en production ensuite

- **Livrer** : GitHub → *Pull requests* → *New* → base `production` ←
  compare `claude/code-integration-site-o88hza` → *Create* → *Merge*.
  Cloudflare construit et publie h2fleet.ca en 2 à 3 minutes. Je peux
  préparer la pull request ; la fusion reste ta décision.
- **Revenir en arrière** : Pages → *Deployments* → *Rollback*.
- **Supabase** : les migrations et les fonctions sont déployées à chaque push
  par « Deploy Supabase ». Le site de test et la production partagent
  aujourd'hui **le même projet Supabase** : c'est acceptable pour le pilote.
  Les migrations étant toujours additives, la version en ligne continue de
  fonctionner quand la base est en avance sur elle.
  Un second projet Supabase (gratuit) sera préférable dès qu'il y aura des
  données client réelles et des tests destructifs ; voir
  `docs/pret-premier-client.md`.
