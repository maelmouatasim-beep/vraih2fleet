

# Suppression de la page Demo et du bouton "Take a Tour"

## Ce qui va changer

La page `/demo` sera supprimee et toutes les references a cette page seront nettoyees sur l'ensemble du site.

---

## Fichiers a modifier

### 1. Supprimer la page Demo
- **`src/pages/Demo.tsx`** : suppression du fichier
- **`src/hooks/useDemoScreenshots.ts`** : suppression du fichier (utilise uniquement par Demo.tsx)

### 2. Supprimer la route dans `src/App.tsx`
- Retirer la route `/demo` (`<Route path="/demo" element={<Demo />} />`)
- Retirer la route `/demo-dashboard` (`<Route path="/demo-dashboard" element={<DemoDashboard />} />`)
- Changer la redirection `/calculator` pour pointer vers `/features` au lieu de `/demo`
- Retirer les imports `Demo` et `DemoDashboard`
- *Note : `src/pages/DemoDashboard.tsx` sera aussi supprime*

### 3. Retirer le bouton "Take a Tour" du Hero (`src/components/landing/Hero.tsx`)
- Supprimer le deuxieme bouton CTA (le `Button` avec `Link to="/demo"`) dans la section hero
- Garder uniquement le bouton principal "Demander un acces"

### 4. Nettoyer la Navbar (`src/components/landing/Navbar.tsx`)
- Retirer l'entree `{ href: "/demo", label: t('landing.navbar.demo') }` du tableau `productItems`
- Si le tableau ne contient plus qu'un seul item (`/features`), transformer le dropdown "Product" en lien direct

### 5. Nettoyer les autres pages qui referent a `/demo`
- **`src/pages/Features.tsx`** (ligne 174) : remplacer le lien `/demo` par une action "Demander un acces" (ouvrir le DemoRequestModal)
- **`src/pages/Methodology.tsx`** (ligne 329) : meme chose, remplacer le lien `/demo` par le DemoRequestModal
- **`src/pages/Guides.tsx`** (ligne 241) : remplacer le lien `/demo` par `/features` ou le DemoRequestModal
- **`src/pages/Ecosystem.tsx`** (ligne 612) : remplacer le lien `/demo` par le DemoRequestModal

---

## Details techniques

### Transformation du dropdown "Product" dans la Navbar

Puisque le dropdown "Product" ne contiendra plus qu'un seul item (`/features`), il sera remplace par un lien direct :

```text
Avant:  Product (dropdown) -> Features, Demo
Apres:  Features (lien direct vers /features)
```

### Remplacement des liens `/demo` dans les autres pages

Les boutons "Try Demo" / "Take a Tour" seront remplaces par des boutons qui ouvrent le `DemoRequestModal` (demande de demo), coherent avec la strategie d'acces restreint actuelle.

### Fichiers supprimes (3 fichiers)
- `src/pages/Demo.tsx`
- `src/pages/DemoDashboard.tsx`
- `src/hooks/useDemoScreenshots.ts`

### Fichiers modifies (6 fichiers)
- `src/App.tsx`
- `src/components/landing/Hero.tsx`
- `src/components/landing/Navbar.tsx`
- `src/pages/Features.tsx`
- `src/pages/Methodology.tsx`
- `src/pages/Guides.tsx`
- `src/pages/Ecosystem.tsx`

