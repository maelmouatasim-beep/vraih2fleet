"""
Agent de trading crypto AVANCÉ — analyse multi-timeframe et notifications.

Vue d'ensemble du fonctionnement (tout en mode TESTNET / argent fictif) :

  1. MULTI-TIMEFRAME : chaque paire est analysée en 15m, 1h et 4h.
     Un signal n'est gardé que si au moins 2 des 3 timeframes sont alignés.
  2. INDICATEURS COMPLETS (bibliothèque "ta") :
       - Momentum  : RSI 14, Stochastic RSI, Williams %R, MFI
       - Tendance  : MACD 12/26/9, EMA 9/21/55/200, ADX
       - Volatilité: Bandes de Bollinger 20, ATR 14, Keltner Channels
       - Volume    : OBV, VWAP, détection de volume anormal (+50 % vs moyenne 20)
  3. RÉGIME DE MARCHÉ : ADX > 25 = marché en TENDANCE (on privilégie MACD + EMA),
     ADX < 20 = marché en RANGE (on privilégie RSI + Bollinger). La pondération
     du score s'adapte automatiquement au régime détecté.
  4. SCORE COMPOSITE 0-100 pondéré selon le régime.
     ACHETER si score >= 68, VENDRE si score <= 32, sinon ATTENDRE.
  5. FILTRE ANTI-FAUX-SIGNAUX : signal confirmé sur >= 2 timeframes ET volume
     au-dessus de la moyenne.
  6. RISQUE DYNAMIQUE : taille de position selon l'ATR (risque max 1.5 % du
     capital par trade), stop-loss à 2x ATR, take-profit en 2 paliers
     (1.5x et 3x ATR), circuit breaker si perte journalière > 5 %.
  7. NOTIFICATIONS TELEGRAM (bibliothèque requests).
  8. BOUCLE toutes les 15 minutes sur 6 paires.
  9. LOGGING de chaque analyse dans journal_trades.csv.

⚠️  Ce script ANALYSE et NOTIFIE : il n'envoie aucun ordre réel.
    Les clés et secrets sont lus dans les variables d'environnement.
"""

# --- Bibliothèque standard ---
import os
import csv
import time
import logging
from datetime import datetime, date
from dataclasses import dataclass, field

# --- Bibliothèques externes ---
import ccxt                 # connexion à Binance
import pandas as pd         # tableaux de données (DataFrame)
import requests            # appels HTTP pour Telegram

# Indicateurs techniques de la bibliothèque "ta".
from ta.momentum import RSIIndicator, StochRSIIndicator, WilliamsRIndicator
from ta.trend import MACD, EMAIndicator, ADXIndicator
from ta.volatility import BollingerBands, AverageTrueRange, KeltnerChannel
from ta.volume import MFIIndicator, OnBalanceVolumeIndicator, VolumeWeightedAveragePrice


# =============================================================================
#  PARAMÈTRES — tout ce qui se règle facilement est regroupé ici
# =============================================================================

# Les 6 paires surveillées.
PAIRES = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT", "AVAX/USDT"]

# Les 3 unités de temps analysées simultanément.
TIMEFRAMES = ["15m", "1h", "4h"]

# Timeframe de référence (sert au calcul du risque et à l'affichage principal).
TIMEFRAME_REF = "1h"

# Nombre de bougies récupérées par timeframe (>= 200 pour l'EMA 200).
NB_BOUGIES = 300

# Cadence de la boucle principale : 15 minutes = 900 secondes.
INTERVALLE_SECONDES = 15 * 60

# --- Seuils de décision sur le score composite (0 à 100) ---
SEUIL_ACHETER = 68
SEUIL_VENDRE = 32

# --- Seuils ADX pour détecter le régime de marché ---
ADX_TENDANCE = 25   # ADX > 25 -> marché en tendance
ADX_RANGE = 20      # ADX < 20 -> marché en range (sans direction nette)

# --- Gestion du risque ---
CAPITAL_DEFAUT = 10000.0      # capital de repli si on ne peut pas lire le solde
RISQUE_PAR_TRADE = 0.015      # on risque au maximum 1.5 % du capital par trade
ATR_STOP_MULT = 2.0           # stop-loss à 2 x ATR
ATR_TP1_MULT = 1.5            # 1er take-profit à 1.5 x ATR (sortie de 50 %)
ATR_TP2_MULT = 3.0            # 2e take-profit à 3 x ATR (sortie des 50 % restants)
PERTE_JOUR_MAX = 0.05         # circuit breaker : arrêt si perte journalière > 5 %

# Multiplicateur de détection de volume anormal (+50 % au-dessus de la moyenne).
VOLUME_ANORMAL_MULT = 1.5

# Fichier journal.
FICHIER_JOURNAL = "journal_trades.csv"

# Pondérations du score composite selon le régime de marché détecté.
# En TENDANCE on fait confiance à la tendance ; en RANGE on privilégie les excès
# (momentum / volatilité) car le prix oscille autour d'une moyenne.
POIDS_REGIME = {
    "TENDANCE":   {"tendance": 0.45, "momentum": 0.25, "volume": 0.20, "volatilite": 0.10},
    "RANGE":      {"momentum": 0.40, "volatilite": 0.35, "volume": 0.15, "tendance": 0.10},
    "TRANSITION": {"tendance": 0.30, "momentum": 0.30, "volatilite": 0.20, "volume": 0.20},
}

# Configuration du logging console (messages horodatés et lisibles).
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger("agent")


# =============================================================================
#  STRUCTURES DE DONNÉES
# =============================================================================

@dataclass
class ResultatPaire:
    """Résultat final consolidé pour une paire (après fusion des timeframes)."""
    paire: str
    prix: float
    recommandation: str            # ACHETER / VENDRE / ATTENDRE
    score_moyen: float             # moyenne des scores des timeframes alignés
    regime: str                    # régime du timeframe de référence
    alignement: str                # ex : "2/3 ACHETER"
    rsi: float
    adx: float
    volume_ok: bool
    risque: dict = field(default_factory=dict)  # stop, take-profits, taille...
    details_tf: list = field(default_factory=list)  # détail par timeframe


# =============================================================================
#  CONNEXION
# =============================================================================

def creer_connexion():
    """Crée la connexion à Binance en mode bac à sable (testnet)."""
    api_key = os.environ.get("BINANCE_TESTNET_API_KEY")
    api_secret = os.environ.get("BINANCE_TESTNET_API_SECRET")
    if not api_key or not api_secret:
        raise SystemExit(
            "❌ Clés Binance manquantes. Définissez :\n"
            "     export BINANCE_TESTNET_API_KEY=\"...\"\n"
            "     export BINANCE_TESTNET_API_SECRET=\"...\""
        )
    exchange = ccxt.binance({
        "apiKey": api_key,
        "secret": api_secret,
        "enableRateLimit": True,
        "options": {"defaultType": "spot"},
    })
    exchange.set_sandbox_mode(True)   # IMPORTANT : reste sur le testnet
    return exchange


# =============================================================================
#  DONNÉES ET INDICATEURS
# =============================================================================

def recuperer_bougies(exchange, paire, timeframe):
    """Télécharge les bougies (OHLCV) d'une paire pour un timeframe donné."""
    donnees = exchange.fetch_ohlcv(paire, timeframe=timeframe, limit=NB_BOUGIES)
    df = pd.DataFrame(donnees, columns=["horodatage", "open", "high", "low", "close", "volume"])
    df["horodatage"] = pd.to_datetime(df["horodatage"], unit="ms")
    return df


def calculer_indicateurs(df):
    """Calcule TOUS les indicateurs et ajoute des colonnes prêtes à l'emploi.

    On pré-calcule aussi des colonnes "synthétiques" (position dans Bollinger,
    volume anormal, OBV en hausse...) pour que les fonctions de score n'aient
    plus qu'à lire une valeur simple sur la dernière bougie.
    """
    haut, bas, cloture, volume = df["high"], df["low"], df["close"], df["volume"]

    # --- MOMENTUM ---
    df["rsi"] = RSIIndicator(close=cloture, window=14).rsi()
    # Stochastic RSI : valeur entre 0 et 1 (excès quand proche de 0 ou de 1).
    df["stochrsi"] = StochRSIIndicator(close=cloture, window=14).stochrsi()
    # Williams %R : entre -100 (sur-vendu) et 0 (sur-acheté).
    df["williams_r"] = WilliamsRIndicator(high=haut, low=bas, close=cloture, lbp=14).williams_r()
    # MFI : "RSI du volume", entre 0 et 100.
    df["mfi"] = MFIIndicator(high=haut, low=bas, close=cloture, volume=volume, window=14).money_flow_index()

    # --- TENDANCE ---
    macd = MACD(close=cloture, window_slow=26, window_fast=12, window_sign=9)
    df["macd"] = macd.macd()
    df["macd_signal"] = macd.macd_signal()
    df["ema9"] = EMAIndicator(close=cloture, window=9).ema_indicator()
    df["ema21"] = EMAIndicator(close=cloture, window=21).ema_indicator()
    df["ema55"] = EMAIndicator(close=cloture, window=55).ema_indicator()
    df["ema200"] = EMAIndicator(close=cloture, window=200).ema_indicator()
    adx = ADXIndicator(high=haut, low=bas, close=cloture, window=14)
    df["adx"] = adx.adx()
    df["adx_pos"] = adx.adx_pos()   # +DI : force des acheteurs
    df["adx_neg"] = adx.adx_neg()   # -DI : force des vendeurs

    # --- VOLATILITÉ ---
    boll = BollingerBands(close=cloture, window=20, window_dev=2)
    df["boll_haut"] = boll.bollinger_hband()
    df["boll_bas"] = boll.bollinger_lband()
    df["atr"] = AverageTrueRange(high=haut, low=bas, close=cloture, window=14).average_true_range()
    kc = KeltnerChannel(high=haut, low=bas, close=cloture, window=20)
    df["kc_haut"] = kc.keltner_channel_hband()
    df["kc_bas"] = kc.keltner_channel_lband()

    # --- VOLUME ---
    df["obv"] = OnBalanceVolumeIndicator(close=cloture, volume=volume).on_balance_volume()
    df["vwap"] = VolumeWeightedAveragePrice(high=haut, low=bas, close=cloture, volume=volume, window=14).volume_weighted_average_price()
    # Moyenne du volume sur 20 périodes, pour repérer un volume anormal.
    df["vol_ma20"] = volume.rolling(window=20).mean()
    df["volume_anormal"] = volume > (VOLUME_ANORMAL_MULT * df["vol_ma20"])
    # OBV "en hausse" si plus haut qu'il y a 3 bougies (achat sous-jacent).
    df["obv_rising"] = df["obv"] > df["obv"].shift(3)

    # On enlève les premières lignes incomplètes (NaN dus aux fenêtres de calcul).
    return df.dropna()


# =============================================================================
#  DÉTECTION DU RÉGIME DE MARCHÉ
# =============================================================================

def detecter_regime(ligne):
    """Détermine le régime de marché à partir de l'ADX."""
    adx = ligne["adx"]
    if adx > ADX_TENDANCE:
        return "TENDANCE"      # le prix avance dans une direction nette
    if adx < ADX_RANGE:
        return "RANGE"         # le prix oscille sans direction
    return "TRANSITION"        # zone intermédiaire, on reste prudent


# =============================================================================
#  SOUS-SCORES PAR FAMILLE D'INDICATEURS (chacun renvoie une note de 0 à 100)
# =============================================================================
#  Convention : 0 = très baissier, 50 = neutre, 100 = très haussier.

def score_momentum(ligne):
    """Combine RSI, Stochastic RSI, Williams %R et MFI."""
    notes = []

    rsi = ligne["rsi"]
    notes.append(80 if rsi < 30 else 20 if rsi > 70 else 60 if rsi < 45 else 40 if rsi > 55 else 50)

    stoch = ligne["stochrsi"]   # 0 à 1
    notes.append(80 if stoch < 0.2 else 20 if stoch > 0.8 else 50)

    wr = ligne["williams_r"]    # -100 à 0
    notes.append(80 if wr < -80 else 20 if wr > -20 else 50)

    mfi = ligne["mfi"]          # 0 à 100
    notes.append(80 if mfi < 20 else 20 if mfi > 80 else 50)

    return sum(notes) / len(notes)


def score_tendance(ligne):
    """Combine MACD, empilement des EMA et direction de l'ADX."""
    notes = []

    macd, signal = ligne["macd"], ligne["macd_signal"]
    if macd > signal and macd > 0:
        notes.append(85)
    elif macd > signal:
        notes.append(65)
    elif macd < signal and macd < 0:
        notes.append(15)
    else:
        notes.append(35)

    prix = ligne["close"]
    e9, e21, e55, e200 = ligne["ema9"], ligne["ema21"], ligne["ema55"], ligne["ema200"]
    if prix > e9 > e21 > e55 > e200:
        notes.append(90)            # alignement haussier parfait
    elif prix < e9 < e21 < e55 < e200:
        notes.append(10)            # alignement baissier parfait
    elif prix > e200:
        notes.append(65)            # au-dessus de la tendance longue
    else:
        notes.append(35)            # sous la tendance longue

    # Direction de l'ADX : +DI vs -DI nous dit qui domine.
    adx, di_pos, di_neg = ligne["adx"], ligne["adx_pos"], ligne["adx_neg"]
    if adx > ADX_TENDANCE:
        notes.append(85 if di_pos > di_neg else 15)
    elif adx < ADX_RANGE:
        notes.append(50)            # pas de tendance : neutre
    else:
        notes.append(60 if di_pos > di_neg else 40)

    return sum(notes) / len(notes)


def score_volatilite(ligne):
    """Position du prix dans les bandes de Bollinger et de Keltner."""
    notes = []
    prix = ligne["close"]

    # Position dans Bollinger : 0 = bande basse (bon marché), 1 = bande haute (cher).
    largeur = ligne["boll_haut"] - ligne["boll_bas"]
    if largeur > 0:
        pos = (prix - ligne["boll_bas"]) / largeur
        notes.append(75 if pos < 0.2 else 25 if pos > 0.8 else 50)
    else:
        notes.append(50)

    # Keltner : sous la bande basse = survendu, au-dessus de la haute = suracheté.
    if prix < ligne["kc_bas"]:
        notes.append(70)
    elif prix > ligne["kc_haut"]:
        notes.append(30)
    else:
        notes.append(50)

    return sum(notes) / len(notes)


def score_volume(ligne):
    """Confirme (ou non) le mouvement par le volume : OBV, VWAP, volume anormal."""
    notes = []

    # OBV en hausse = pression acheteuse en arrière-plan.
    notes.append(70 if ligne["obv_rising"] else 30)

    # Prix au-dessus du VWAP = les acheteurs paient cher (plutôt haussier).
    notes.append(60 if ligne["close"] > ligne["vwap"] else 40)

    # Un volume anormal renforce le signal en cours (dans les deux sens) :
    # on pousse légèrement la note dans le sens de l'OBV.
    if ligne["volume_anormal"]:
        notes.append(75 if ligne["obv_rising"] else 25)

    return sum(notes) / len(notes)


def calculer_score(ligne, regime):
    """Score composite 0-100 pondéré selon le régime de marché."""
    sous = {
        "tendance": score_tendance(ligne),
        "momentum": score_momentum(ligne),
        "volatilite": score_volatilite(ligne),
        "volume": score_volume(ligne),
    }
    poids = POIDS_REGIME[regime]
    score = sum(sous[cat] * poids[cat] for cat in sous)
    return round(score, 1), sous


def reco_depuis_score(score):
    """Traduit un score en recommandation."""
    if score >= SEUIL_ACHETER:
        return "ACHETER"
    if score <= SEUIL_VENDRE:
        return "VENDRE"
    return "ATTENDRE"


# =============================================================================
#  FUSION MULTI-TIMEFRAME + FILTRE ANTI-FAUX-SIGNAUX
# =============================================================================

def decision_multi_timeframe(par_tf):
    """Fusionne les analyses des 3 timeframes en une décision unique.

    par_tf : liste de dicts {timeframe, score, reco, regime, volume_ok}.
    Règle : un signal n'est valide que si >= 2 timeframes sont d'accord ET
    qu'au moins un des timeframes alignés a un volume au-dessus de sa moyenne.
    """
    achats = [r for r in par_tf if r["reco"] == "ACHETER"]
    ventes = [r for r in par_tf if r["reco"] == "VENDRE"]

    # Le volume confirme-t-il le camp majoritaire ?
    volume_confirme_achat = any(r["volume_ok"] for r in achats)
    volume_confirme_vente = any(r["volume_ok"] for r in ventes)

    if len(achats) >= 2 and volume_confirme_achat:
        decision = "ACHETER"
        alignes = achats
    elif len(ventes) >= 2 and volume_confirme_vente:
        decision = "VENDRE"
        alignes = ventes
    else:
        # Pas assez d'accord ou volume insuffisant -> on s'abstient.
        decision = "ATTENDRE"
        alignes = par_tf

    # Score moyen des timeframes qui portent la décision.
    score_moyen = round(sum(r["score"] for r in alignes) / len(alignes), 1)

    # Texte d'alignement, ex : "2/3 ACHETER".
    if decision == "ATTENDRE":
        alignement = f"{max(len(achats), len(ventes))}/3 (insuffisant)"
    else:
        alignement = f"{len(alignes)}/3 {decision}"

    return decision, score_moyen, alignement


# =============================================================================
#  GESTION DU RISQUE DYNAMIQUE
# =============================================================================

def gestion_du_risque(capital, prix, atr):
    """Calcule taille de position, stop-loss et take-profits à partir de l'ATR."""
    # Montant d'argent que l'on accepte de perdre sur ce trade (1.5 % du capital).
    risque_montant = capital * RISQUE_PAR_TRADE

    # Distance jusqu'au stop = 2 x ATR. C'est la "perte par unité" si le stop saute.
    distance_stop = ATR_STOP_MULT * atr
    if distance_stop <= 0 or prix <= 0:
        return {}

    # Taille de position = montant risqué / distance du stop.
    # Ainsi, si le prix atteint le stop, on perd EXACTEMENT 1.5 % du capital.
    quantite = risque_montant / distance_stop
    valeur_position = quantite * prix

    # Sécurité : on ne dépasse jamais le capital disponible.
    if valeur_position > capital:
        valeur_position = capital
        quantite = capital / prix

    return {
        "quantite": quantite,
        "valeur_position": valeur_position,
        "stop_loss": prix - distance_stop,
        "take_profit_1": prix + ATR_TP1_MULT * atr,   # sortie de 50 %
        "take_profit_2": prix + ATR_TP2_MULT * atr,   # sortie des 50 % restants
        "risque_montant": risque_montant,
    }


def circuit_breaker_declenche(capital_debut_jour, capital_actuel):
    """Renvoie True si la perte du jour dépasse le seuil autorisé (5 %)."""
    if capital_debut_jour <= 0:
        return False
    perte = (capital_debut_jour - capital_actuel) / capital_debut_jour
    return perte > PERTE_JOUR_MAX


# =============================================================================
#  ANALYSE COMPLÈTE D'UNE PAIRE (les 3 timeframes)
# =============================================================================

def analyser_paire(exchange, paire, capital):
    """Analyse une paire sur les 3 timeframes puis consolide la décision."""
    par_tf = []
    lignes = {}   # on garde la dernière bougie de chaque timeframe

    for tf in TIMEFRAMES:
        df = calculer_indicateurs(recuperer_bougies(exchange, paire, tf))
        ligne = df.iloc[-1]
        lignes[tf] = ligne

        regime = detecter_regime(ligne)
        score, _sous = calculer_score(ligne, regime)
        par_tf.append({
            "timeframe": tf,
            "score": score,
            "reco": reco_depuis_score(score),
            "regime": regime,
            "volume_ok": bool(ligne["volume"] > ligne["vol_ma20"]),
        })

    # Fusion + filtre anti-faux-signaux.
    decision, score_moyen, alignement = decision_multi_timeframe(par_tf)

    # On utilise le timeframe de référence (1h) pour le risque et l'affichage.
    ref = lignes[TIMEFRAME_REF]
    prix = float(ref["close"])
    risque = gestion_du_risque(capital, prix, float(ref["atr"])) if decision == "ACHETER" else {}

    return ResultatPaire(
        paire=paire,
        prix=prix,
        recommandation=decision,
        score_moyen=score_moyen,
        regime=detecter_regime(ref),
        alignement=alignement,
        rsi=round(float(ref["rsi"]), 1),
        adx=round(float(ref["adx"]), 1),
        volume_ok=bool(ref["volume"] > ref["vol_ma20"]),
        risque=risque,
        details_tf=par_tf,
    )


# =============================================================================
#  NOTIFICATIONS TELEGRAM
# =============================================================================

def construire_message(r):
    """Construit le texte détaillé envoyé sur Telegram pour un signal."""
    icone = {"ACHETER": "🟢", "VENDRE": "🔴", "ATTENDRE": "🟡"}[r.recommandation]

    lignes = [
        f"{icone} <b>{r.recommandation}</b> — {r.paire}",
        f"💵 Prix : {r.prix:,.4f} USDT",
        f"📊 Score : {r.score_moyen}/100",
        f"🧭 Régime : {r.regime}",
        f"🔗 Alignement : {r.alignement}",
        f"📈 RSI : {r.rsi}  |  ADX : {r.adx}",
        f"🔊 Volume au-dessus de la moyenne : {'oui' if r.volume_ok else 'non'}",
    ]

    # Si on a un plan de risque (cas ACHETER), on l'ajoute.
    if r.risque:
        q = r.risque
        lignes += [
            "",
            f"🛡 Stop-loss : {q['stop_loss']:,.4f}",
            f"🎯 TP1 (50 %) : {q['take_profit_1']:,.4f}",
            f"🎯 TP2 (50 %) : {q['take_profit_2']:,.4f}",
            f"📦 Taille : {q['quantite']:.6f} {r.paire.split('/')[0]} "
            f"(~{q['valeur_position']:,.2f} USDT)",
        ]

    return "\n".join(lignes)


def envoyer_telegram(message):
    """Envoie un message sur Telegram via l'API (bibliothèque requests).

    Le token et le chat_id sont lus dans les variables d'environnement, JAMAIS
    écrits en dur dans le code (un secret dans le code = un secret exposé).
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        log.warning("Telegram non configuré (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        reponse = requests.post(
            url,
            data={"chat_id": chat_id, "text": message, "parse_mode": "HTML"},
            timeout=10,
        )
        reponse.raise_for_status()
        return True
    except requests.RequestException as e:
        # On ne fait jamais planter l'agent à cause d'une notification ratée.
        log.warning("Échec de l'envoi Telegram : %s", e)
        return False


# =============================================================================
#  JOURNALISATION (CSV)
# =============================================================================

def journaliser(r):
    """Ajoute une ligne au fichier journal_trades.csv (en-tête créé si besoin)."""
    fichier_existe = os.path.exists(FICHIER_JOURNAL)
    with open(FICHIER_JOURNAL, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        # Si le fichier vient d'être créé, on écrit d'abord la ligne d'en-tête.
        if not fichier_existe:
            writer.writerow(["horodatage", "paire", "prix", "score",
                             "regime", "recommandation"])
        writer.writerow([
            datetime.now().isoformat(timespec="seconds"),
            r.paire, f"{r.prix:.4f}", r.score_moyen, r.regime, r.recommandation,
        ])


# =============================================================================
#  CAPITAL / SOLDE
# =============================================================================

def lire_capital(exchange):
    """Lit le solde USDT du testnet ; renvoie une valeur de repli en cas d'échec."""
    try:
        solde = exchange.fetch_balance()
        usdt = solde["total"].get("USDT", 0.0)
        return float(usdt) if usdt and usdt > 0 else CAPITAL_DEFAUT
    except ccxt.BaseError as e:
        log.warning("Impossible de lire le solde (%s). Capital par défaut utilisé.", e)
        return CAPITAL_DEFAUT


# =============================================================================
#  BOUCLE PRINCIPALE
# =============================================================================

def main():
    exchange = creer_connexion()
    log.info("Agent démarré sur le Spot Testnet Binance.")

    # Référence pour le circuit breaker : capital au début de la journée.
    jour_courant = date.today()
    capital_debut_jour = lire_capital(exchange)
    log.info("Capital de départ du jour : %.2f USDT", capital_debut_jour)

    while True:
        # Si on a changé de jour, on remet à zéro la référence du circuit breaker.
        if date.today() != jour_courant:
            jour_courant = date.today()
            capital_debut_jour = lire_capital(exchange)
            log.info("Nouveau jour. Capital de référence : %.2f USDT", capital_debut_jour)

        capital_actuel = lire_capital(exchange)

        # CIRCUIT BREAKER : si on a trop perdu aujourd'hui, on s'arrête.
        if circuit_breaker_declenche(capital_debut_jour, capital_actuel):
            msg = (f"⛔️ CIRCUIT BREAKER déclenché : perte journalière > "
                   f"{PERTE_JOUR_MAX*100:.0f} %. Agent arrêté.")
            log.error(msg)
            envoyer_telegram(msg)
            break

        # Analyse de chaque paire.
        for paire in PAIRES:
            try:
                r = analyser_paire(exchange, paire, capital_actuel)
                journaliser(r)   # on journalise TOUTES les analyses
                log.info("%-10s score %-5s %-9s régime=%s align=%s",
                         r.paire, r.score_moyen, r.recommandation, r.regime, r.alignement)

                # On ne notifie que les vrais signaux (achat/vente), pas les "attendre".
                if r.recommandation in ("ACHETER", "VENDRE"):
                    envoyer_telegram(construire_message(r))
            except ccxt.BaseError as e:
                log.warning("Erreur sur %s : %s", paire, e)

        # Pause jusqu'au prochain cycle.
        log.info("Cycle terminé. Prochaine analyse dans %d minutes.", INTERVALLE_SECONDES // 60)
        time.sleep(INTERVALLE_SECONDES)


if __name__ == "__main__":
    main()
