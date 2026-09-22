# Bot de trading crypto — Étape 1 (Spot Testnet Binance)

Premier script de l'agent de trading : il se connecte au **Spot Testnet** de
Binance (argent fictif), affiche les prix de BTC/USDT, ETH/USDT, SOL/USDT, et
votre solde de test.

## 1. Obtenir des clés API de test

1. Allez sur https://testnet.binance.vision/
2. Connectez-vous avec un compte GitHub.
3. Générez une **API Key** et une **Secret Key** (notez bien le secret, il ne
   s'affiche qu'une fois).
4. Optionnel : utilisez le bouton « faucet » pour recevoir des fonds fictifs.

## 2. Installer les dépendances

```bash
cd scripts/trading-bot
python -m venv .venv
source .venv/bin/activate        # Windows : .venv\Scripts\activate
pip install -r requirements.txt
```

## 3. Renseigner les clés (sans les écrire dans le code)

```bash
export BINANCE_TESTNET_API_KEY="votre_cle"
export BINANCE_TESTNET_API_SECRET="votre_secret"
```

> ⚠️ Ne committez **jamais** vos clés dans Git.

## 4. Lancer les scripts

### a) Prix et solde (étape 1)

```bash
python binance_testnet.py
```

### b) Analyse technique et recommandations (étape 2)

```bash
python analyse_technique.py
```

Ce script analyse BTC, ETH, SOL et BNB (USDT) avec RSI, MACD, Bandes de
Bollinger et moyennes mobiles, calcule un **score composite 0-100** par crypto,
applique une **gestion du risque stricte** (max 20 % du capital par position,
stop-loss basé sur l'ATR) et affiche une recommandation **ACHETER / VENDRE /
ATTENDRE** avec le raisonnement détaillé.

> Ce script **n'envoie aucun ordre** : il ne fait qu'analyser et conseiller.
> Les réglages (paires, timeframe, capital, seuils, poids des indicateurs) sont
> regroupés en haut du fichier `analyse_technique.py` et faciles à modifier.

### c) Agent avancé multi-timeframe (étape 3)

```bash
python agent_avance.py
```

Agent professionnel qui tourne en boucle (toutes les 15 min) sur 6 paires
(BTC, ETH, SOL, BNB, ADA, AVAX / USDT) et qui :

- analyse **3 timeframes** simultanément (15m, 1h, 4h) ; un signal n'est valide
  que si **≥ 2 timeframes sont alignés** ET que le **volume** est au-dessus de sa
  moyenne (filtre anti-faux-signaux) ;
- calcule une batterie d'indicateurs : **momentum** (RSI, Stochastic RSI,
  Williams %R, MFI), **tendance** (MACD, EMA 9/21/55/200, ADX), **volatilité**
  (Bollinger, ATR, Keltner) et **volume** (OBV, VWAP, volume anormal) ;
- **détecte le régime de marché** via l'ADX (tendance / range / transition) et
  **adapte la pondération** du score composite 0-100 ;
- recommande **ACHETER (≥ 68) / VENDRE (≤ 32) / ATTENDRE** ;
- applique une **gestion du risque dynamique** : taille de position calculée pour
  ne risquer que **1.5 % du capital** par trade, stop-loss à 2× ATR, take-profit
  en 2 paliers (1.5× et 3× ATR), et **circuit breaker** si la perte du jour
  dépasse 5 % ;
- envoie une **notification Telegram** détaillée à chaque signal ;
- **journalise** chaque analyse dans `journal_trades.csv`.

> Comme les autres, ce script **n'envoie aucun ordre** : il analyse, journalise
> et notifie. À vous de valider/passer les ordres (mode semi-automatique).

#### Variables d'environnement à définir

```bash
export BINANCE_TESTNET_API_KEY="..."
export BINANCE_TESTNET_API_SECRET="..."
export TELEGRAM_BOT_TOKEN="..."     # token de votre bot Telegram
export TELEGRAM_CHAT_ID="..."       # identifiant du chat destinataire
```

> 🔒 **Sécurité** : le token Telegram et les clés Binance ne sont **jamais**
> écrits dans le code. Ils sont lus dans l'environnement pour éviter de publier
> un secret dans Git. Si un secret a déjà été partagé en clair quelque part,
> régénérez-le (Telegram : `/revoke` puis `/token` auprès de @BotFather).
