"""
Agent de trading crypto FULL AUTO — testnet Binance.

Ce script fait TOUT automatiquement (argent fictif / testnet uniquement) :
  1. Analyse multi-timeframe (15m / 1h / 4h) avec score composite
  2. Ouvre une position via un ordre MARKET si signal validé
  3. Place UN SEUL ordre réel : le STOP-LOSS (sur la totalité de la quantité).
     Les deux TAKE-PROFIT sont "virtuels" : surveillés par le bot et déclenchés
     au marché, pour ne jamais réserver deux fois les mêmes jetons.
  4. Surveille les positions ouvertes toutes les 60 s (take-profits réactifs)
  5. Ferme proprement quand TP ou SL est touché ; après TP1, le stop est
     remonté au prix d'entrée (trade "gratuit") sur la moitié restante
  6. Circuit breaker si perte journalière > 5 %
  7. Notifications Telegram + journal CSV

Règles de sécurité full-auto :
  - Une seule position par paire à la fois (pas de doublement)
  - Jamais plus de 3 positions ouvertes simultanément
  - Risque max 1.5 % du capital par trade (taille calculée par ATR)
  - Toutes les positions et ordres sont sauvegardés dans positions.json
    → si le script redémarre, il retrouve ses positions ouvertes

⚠️  TESTNET UNIQUEMENT. set_sandbox_mode(True) est activé.
    Passez en production uniquement après validation sur au moins 50 trades.
"""

import os
import csv
import json
import time
import logging
from datetime import datetime, date
from dataclasses import dataclass, field, asdict, fields

import ccxt
import pandas as pd
import requests

from ta.momentum import RSIIndicator, StochRSIIndicator, WilliamsRIndicator
from ta.trend import MACD, EMAIndicator, ADXIndicator
from ta.volatility import BollingerBands, AverageTrueRange, KeltnerChannel
from ta.volume import MFIIndicator, OnBalanceVolumeIndicator, VolumeWeightedAveragePrice


# =============================================================================
#  PARAMÈTRES
# =============================================================================

PAIRES = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT", "AVAX/USDT"]
# Mode SCALPING : on travaille en très court terme sur 1m et 5m.
TIMEFRAMES        = ["1m", "5m"]
TIMEFRAME_REF     = "5m"   # timeframe de référence (risque + affichage) — doit être dans TIMEFRAMES
NB_BOUGIES        = 500   # on maximise l'historique récupéré (était 300)
# Deux cadences distinctes (réglées pour le scalping) :
#  - on RE-ANALYSE le marché toutes les 2 minutes
#  - et on SURVEILLE les positions ouvertes toutes les 20 secondes (sorties rapides).
INTERVALLE_SECONDES      = 120   # ré-analyse complète (2 min)
INTERVALLE_SURVEILLANCE  = 20    # surveillance des positions ouvertes (20 s)

SEUIL_ACHETER     = 55
SEUIL_VENDRE      = 45
SCORE_MOMENTUM_FORT = 72   # score à partir duquel 1 seul timeframe suffit (si volume anormal)
ADX_TENDANCE      = 25
ADX_RANGE         = 20

CAPITAL_DEFAUT    = 10000.0
RISQUE_PAR_TRADE  = 0.02     # 2 % du capital risqué par trade (plus actif, reste conservateur)
ATR_STOP_MULT     = 2.0
ATR_TP1_MULT      = 0.8      # take-profit 1 court (scalping) : sortie de 50 %
ATR_TP2_MULT      = 1.5      # take-profit 2 court (scalping) : sortie des 50 % restants
PERTE_JOUR_MAX    = 0.05     # circuit breaker à -5 % / jour
MAX_POSITIONS     = 4        # jamais plus de 4 positions ouvertes en même temps
VOLUME_ANORMAL_MULT = 1.5

FICHIER_JOURNAL    = "journal_trades.csv"
FICHIER_POSITIONS  = "positions.json"   # sauvegarde des positions ouvertes

POIDS_REGIME = {
    "TENDANCE":   {"tendance": 0.45, "momentum": 0.25, "volume": 0.20, "volatilite": 0.10},
    "RANGE":      {"momentum": 0.40, "volatilite": 0.35, "volume": 0.15, "tendance": 0.10},
    "TRANSITION": {"tendance": 0.30, "momentum": 0.30, "volatilite": 0.20, "volume": 0.20},
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger("full-auto")


# =============================================================================
#  STRUCTURE D'UNE POSITION OUVERTE
# =============================================================================

@dataclass
class Position:
    """Représente un trade ouvert.

    Note : seul le STOP-LOSS est un vrai ordre posé sur Binance (ordre_sl_id).
    Les deux take-profits sont "virtuels" : ce sont de simples niveaux de prix
    que le bot surveille pour vendre au marché. Ainsi les jetons ne sont jamais
    réservés deux fois (plus de conflit "solde insuffisant").
    """
    paire: str
    cote: str                  # "BUY" (seul côté actif pour l'instant)
    prix_entree: float
    quantite_totale: float     # quantité achetée au total
    quantite_restante: float   # ce qu'il reste après TP1 éventuel
    stop_loss: float
    take_profit_1: float       # niveau de prix cible (pas un ordre posé)
    take_profit_2: float       # niveau de prix cible (pas un ordre posé)
    ordre_sl_id: str = ""      # ID de l'unique ordre réel : le stop-loss
    tp1_atteint: bool = False  # True si TP1 déjà touché (1re moitié vendue)
    horodatage: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))

    def to_dict(self):
        return asdict(self)

    @staticmethod
    def from_dict(d):
        # On ne garde que les clés connues : un ancien positions.json reste lisible.
        champs = {f.name for f in fields(Position)}
        return Position(**{k: v for k, v in d.items() if k in champs})


# =============================================================================
#  PERSISTANCE DES POSITIONS (fichier JSON)
# =============================================================================

def charger_positions():
    """Recharge les positions depuis le disque (survie au redémarrage)."""
    if not os.path.exists(FICHIER_POSITIONS):
        return {}
    with open(FICHIER_POSITIONS, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return {paire: Position.from_dict(d) for paire, d in raw.items()}


def sauvegarder_positions(positions):
    """Écrit toutes les positions ouvertes sur le disque."""
    with open(FICHIER_POSITIONS, "w", encoding="utf-8") as f:
        json.dump({p: pos.to_dict() for p, pos in positions.items()}, f, indent=2)


# =============================================================================
#  CONNEXION
# =============================================================================

def creer_connexion():
    api_key    = os.environ.get("BINANCE_TESTNET_API_KEY")
    api_secret = os.environ.get("BINANCE_TESTNET_API_SECRET")
    if not api_key or not api_secret:
        raise SystemExit(
            "❌ Clés Binance manquantes.\n"
            "   export BINANCE_TESTNET_API_KEY=\"...\"\n"
            "   export BINANCE_TESTNET_API_SECRET=\"...\""
        )
    exchange = ccxt.binance({
        "apiKey": api_key,
        "secret": api_secret,
        "enableRateLimit": True,
        "options": {"defaultType": "spot"},
    })
    exchange.set_sandbox_mode(True)  # TESTNET — argent fictif
    return exchange


# =============================================================================
#  DONNÉES ET INDICATEURS  (identique à agent_avance.py)
# =============================================================================

def recuperer_bougies(exchange, paire, timeframe):
    donnees = exchange.fetch_ohlcv(paire, timeframe=timeframe, limit=NB_BOUGIES)
    df = pd.DataFrame(donnees, columns=["horodatage","open","high","low","close","volume"])
    df["horodatage"] = pd.to_datetime(df["horodatage"], unit="ms")
    return df


def calculer_indicateurs(df):
    haut, bas, cloture, volume = df["high"], df["low"], df["close"], df["volume"]

    df["rsi"]       = RSIIndicator(close=cloture, window=14).rsi()
    df["stochrsi"]  = StochRSIIndicator(close=cloture, window=14).stochrsi()
    df["williams_r"]= WilliamsRIndicator(high=haut, low=bas, close=cloture, lbp=14).williams_r()
    df["mfi"]       = MFIIndicator(high=haut, low=bas, close=cloture, volume=volume, window=14).money_flow_index()

    macd_obj = MACD(close=cloture, window_slow=26, window_fast=12, window_sign=9)
    df["macd"]        = macd_obj.macd()
    df["macd_signal"] = macd_obj.macd_signal()
    df["ema9"]   = EMAIndicator(close=cloture, window=9).ema_indicator()
    df["ema21"]  = EMAIndicator(close=cloture, window=21).ema_indicator()
    df["ema55"]  = EMAIndicator(close=cloture, window=55).ema_indicator()
    df["ema200"] = EMAIndicator(close=cloture, window=200).ema_indicator()
    adx_obj = ADXIndicator(high=haut, low=bas, close=cloture, window=14)
    df["adx"]     = adx_obj.adx()
    df["adx_pos"] = adx_obj.adx_pos()
    df["adx_neg"] = adx_obj.adx_neg()

    boll = BollingerBands(close=cloture, window=20, window_dev=2)
    df["boll_haut"] = boll.bollinger_hband()
    df["boll_bas"]  = boll.bollinger_lband()
    df["atr"] = AverageTrueRange(high=haut, low=bas, close=cloture, window=14).average_true_range()
    kc = KeltnerChannel(high=haut, low=bas, close=cloture, window=20)
    df["kc_haut"] = kc.keltner_channel_hband()
    df["kc_bas"]  = kc.keltner_channel_lband()

    df["obv"]  = OnBalanceVolumeIndicator(close=cloture, volume=volume).on_balance_volume()
    df["vwap"] = VolumeWeightedAveragePrice(
        high=haut, low=bas, close=cloture, volume=volume, window=14
    ).volume_weighted_average_price()
    df["vol_ma20"]       = volume.rolling(window=20).mean()
    df["volume_anormal"] = volume > (VOLUME_ANORMAL_MULT * df["vol_ma20"])
    df["obv_rising"]     = df["obv"] > df["obv"].shift(3)

    df = df.dropna()

    # Sécurité : sur le testnet, certaines paires manquent d'historique et le
    # dropna() peut tout supprimer. On vérifie qu'il reste assez de bougies
    # AVANT que analyser_paire ne tente df.iloc[-1] (sinon IndexError).
    if len(df) < 10:
        raise ValueError(
            f"Pas assez de données après calcul des indicateurs "
            f"({len(df)} bougie(s) restante(s), minimum 10 requis)."
        )

    return df


# =============================================================================
#  SCORE COMPOSITE  (identique à agent_avance.py)
# =============================================================================

def detecter_regime(ligne):
    adx = ligne["adx"]
    if adx > ADX_TENDANCE: return "TENDANCE"
    if adx < ADX_RANGE:    return "RANGE"
    return "TRANSITION"


def score_momentum(l):
    rsi = l["rsi"]
    notes = [
        80 if rsi < 30 else 20 if rsi > 70 else 60 if rsi < 45 else 40 if rsi > 55 else 50,
        80 if l["stochrsi"] < 0.2 else 20 if l["stochrsi"] > 0.8 else 50,
        80 if l["williams_r"] < -80 else 20 if l["williams_r"] > -20 else 50,
        80 if l["mfi"] < 20 else 20 if l["mfi"] > 80 else 50,
    ]
    return sum(notes) / len(notes)


def score_tendance(l):
    macd, sig = l["macd"], l["macd_signal"]
    notes = [
        85 if macd > sig and macd > 0 else 65 if macd > sig else 15 if macd < sig and macd < 0 else 35
    ]
    p, e9, e21, e55, e200 = l["close"], l["ema9"], l["ema21"], l["ema55"], l["ema200"]
    notes.append(90 if p > e9 > e21 > e55 > e200 else 10 if p < e9 < e21 < e55 < e200
                 else 65 if p > e200 else 35)
    adx, dp, dn = l["adx"], l["adx_pos"], l["adx_neg"]
    notes.append(85 if adx > ADX_TENDANCE and dp > dn
                 else 15 if adx > ADX_TENDANCE
                 else 50 if adx < ADX_RANGE
                 else 60 if dp > dn else 40)
    return sum(notes) / len(notes)


def score_volatilite(l):
    prix = l["close"]
    largeur = l["boll_haut"] - l["boll_bas"]
    pos_boll = (prix - l["boll_bas"]) / largeur if largeur > 0 else 0.5
    notes = [
        75 if pos_boll < 0.2 else 25 if pos_boll > 0.8 else 50,
        70 if prix < l["kc_bas"] else 30 if prix > l["kc_haut"] else 50,
    ]
    return sum(notes) / len(notes)


def score_volume(l):
    notes = [
        70 if l["obv_rising"] else 30,
        60 if l["close"] > l["vwap"] else 40,
    ]
    if l["volume_anormal"]:
        notes.append(75 if l["obv_rising"] else 25)
    return sum(notes) / len(notes)


def calculer_score(ligne, regime):
    sous = {
        "tendance":   score_tendance(ligne),
        "momentum":   score_momentum(ligne),
        "volatilite": score_volatilite(ligne),
        "volume":     score_volume(ligne),
    }
    poids = POIDS_REGIME[regime]
    score = sum(sous[cat] * poids[cat] for cat in sous)
    return round(score, 1), sous


def reco_depuis_score(score):
    if score >= SEUIL_ACHETER: return "ACHETER"
    if score <= SEUIL_VENDRE:  return "VENDRE"
    return "ATTENDRE"


def decision_multi_timeframe(par_tf):
    # Deux façons d'obtenir un signal ACHETER :
    #  1) TOUS les timeframes alignés (avec 2 timeframes : 2/2) + volume au-dessus
    #     de sa moyenne sur au moins l'un d'eux.
    #  2) Signal fort sur momentum : un SEUL timeframe suffit s'il a un score
    #     élevé (>= 72) ET un volume anormal détecté (pic de volume).
    # Pour la VENTE, on garde la règle stricte : tous les timeframes alignés.
    nb_tf = len(par_tf)
    achats = [r for r in par_tf if r["reco"] == "ACHETER"]
    ventes = [r for r in par_tf if r["reco"] == "VENDRE"]
    vol_achat = any(r["volume_ok"] for r in achats)
    vol_vente = any(r["volume_ok"] for r in ventes)

    # Timeframes "momentum fort" : achat + score élevé + volume anormal.
    achats_forts = [r for r in achats
                    if r["score"] >= SCORE_MOMENTUM_FORT and r["volume_anormal"]]

    if len(achats) == nb_tf and vol_achat:
        decision, alignes = "ACHETER", achats
        alignement = f"{len(alignes)}/{nb_tf} ACHETER"
    elif achats_forts:
        # Un seul timeframe puissant suffit (pic de volume + score élevé).
        decision, alignes = "ACHETER", achats_forts
        alignement = f"{len(achats_forts)}/{nb_tf} ACHETER (momentum fort)"
    elif len(ventes) == nb_tf and vol_vente:
        decision, alignes = "VENDRE", ventes
        alignement = f"{len(alignes)}/{nb_tf} VENDRE"
    else:
        decision, alignes = "ATTENDRE", par_tf
        alignement = f"{max(len(achats), len(ventes))}/{nb_tf} (insuffisant)"

    score_moyen = round(sum(r["score"] for r in alignes) / len(alignes), 1)
    return decision, score_moyen, alignement


def analyser_paire(exchange, paire):
    """Analyse la paire sur les 3 timeframes ; renvoie la décision + données de ref."""
    par_tf, lignes = [], {}
    for tf in TIMEFRAMES:
        df   = calculer_indicateurs(recuperer_bougies(exchange, paire, tf))
        ligne = df.iloc[-1]
        lignes[tf] = ligne
        regime = detecter_regime(ligne)
        score, _ = calculer_score(ligne, regime)
        par_tf.append({
            "timeframe": tf, "score": score, "reco": reco_depuis_score(score),
            "regime": regime, "volume_ok": bool(ligne["volume"] > ligne["vol_ma20"]),
            "volume_anormal": bool(ligne["volume_anormal"]),
        })
    decision, score_moyen, alignement = decision_multi_timeframe(par_tf)
    ref = lignes[TIMEFRAME_REF]
    return decision, score_moyen, alignement, ref, par_tf


# =============================================================================
#  GESTION DU RISQUE
# =============================================================================

def calculer_risque(capital, prix, atr):
    """Renvoie les niveaux de stop/TP et la taille de position."""
    risque_montant = capital * RISQUE_PAR_TRADE
    distance_stop  = ATR_STOP_MULT * atr
    if distance_stop <= 0 or prix <= 0:
        return None
    quantite = risque_montant / distance_stop
    valeur   = quantite * prix
    # On plafonne à la totalité du capital par sécurité.
    if valeur > capital:
        quantite = capital / prix
        valeur   = capital
    return {
        "quantite":      quantite,
        "valeur":        valeur,
        "stop_loss":     round(prix - distance_stop, 8),
        "take_profit_1": round(prix + ATR_TP1_MULT * atr, 8),
        "take_profit_2": round(prix + ATR_TP2_MULT * atr, 8),
        "risque_montant": risque_montant,
    }


def circuit_breaker_declenche(capital_debut_jour, capital_actuel):
    if capital_debut_jour <= 0:
        return False
    return (capital_debut_jour - capital_actuel) / capital_debut_jour > PERTE_JOUR_MAX


# =============================================================================
#  EXÉCUTION DES ORDRES
# =============================================================================

def poser_stop_loss(exchange, paire, quantite, niveau_stop):
    """Pose un ordre STOP_LOSS_LIMIT et renvoie son ID.

    Le prix limite est placé 0.1 % sous le déclencheur pour être exécuté
    même quand le marché bouge vite.
    """
    prix_limite = round(niveau_stop * 0.999, 8)
    ordre = exchange.create_order(
        paire, "STOP_LOSS_LIMIT", "sell", quantite, prix_limite,
        {"stopPrice": niveau_stop, "timeInForce": "GTC"},
    )
    return str(ordre["id"])


def ouvrir_position(exchange, paire, risque):
    """Achète au marché puis pose UN SEUL ordre réel : le stop-loss.

    Les take-profits sont volontairement virtuels (surveillés par le bot),
    pour éviter de réserver deux fois la même quantité de jetons.
    """
    quantite = float(exchange.amount_to_precision(paire, risque["quantite"]))

    log.info("  -> ENTRÉE MARKET %s qty=%.6f", paire, quantite)
    ordre_entree = exchange.create_market_order(paire, "buy", quantite)
    prix_reel = float(ordre_entree.get("average") or ordre_entree.get("price") or risque["stop_loss"])

    # Unique ordre au repos : le stop-loss sur la TOTALITÉ de la quantité.
    ordre_sl_id = poser_stop_loss(exchange, paire, quantite, risque["stop_loss"])

    log.info("  -> SL=%.4f (réel)  |  TP1=%.4f  TP2=%.4f (virtuels)",
             risque["stop_loss"], risque["take_profit_1"], risque["take_profit_2"])

    return Position(
        paire            = paire,
        cote             = "BUY",
        prix_entree      = prix_reel,
        quantite_totale  = quantite,
        quantite_restante= quantite,
        stop_loss        = risque["stop_loss"],
        take_profit_1    = risque["take_profit_1"],
        take_profit_2    = risque["take_profit_2"],
        ordre_sl_id      = ordre_sl_id,
    )


def annuler_ordre(exchange, paire, ordre_id):
    """Annule un ordre en ignorant les erreurs si déjà fermé/rempli."""
    try:
        if ordre_id:
            exchange.cancel_order(ordre_id, paire)
    except ccxt.BaseError:
        pass   # ordre déjà exécuté ou inexistant, on ignore


def fermer_position_marche(exchange, paire, quantite):
    """Vend la quantité restante au marché (sortie forcée)."""
    qte = float(exchange.amount_to_precision(paire, quantite))
    if qte <= 0:
        return
    log.info("  -> SORTIE MARKET %s qty=%.6f", paire, qte)
    exchange.create_market_order(paire, "sell", qte)


# =============================================================================
#  SUIVI DES POSITIONS OUVERTES
# =============================================================================

def evaluer_position(pos, prix_actuel, sl_declenche):
    """Décide quoi faire d'une position (logique pure, sans appel réseau).

    Renvoie l'une des actions : "STOP", "TP1", "TP2" ou "RIEN".
    - "STOP" : l'ordre stop-loss réel a été exécuté → position fermée.
    - "TP1"  : le prix a atteint le 1er take-profit → vendre la 1re moitié.
    - "TP2"  : TP1 déjà fait et le prix atteint le 2e take-profit → vendre le reste.
    - "RIEN" : rien à faire pour l'instant.
    """
    # Le vrai ordre stop a été rempli par Binance : la position est close.
    if sl_declenche:
        return "STOP"
    # TP1 pas encore fait et prix au-dessus de la 1re cible -> on prend la moitié.
    if not pos.tp1_atteint and prix_actuel >= pos.take_profit_1:
        return "TP1"
    # TP1 déjà fait et prix au-dessus de la 2e cible -> on solde le reste.
    if pos.tp1_atteint and prix_actuel >= pos.take_profit_2:
        return "TP2"
    return "RIEN"


def verifier_positions(exchange, positions):
    """Surveille chaque position : stop-loss réel + take-profits virtuels.

    À chaque appel (toutes les 60 s) on lit le prix actuel et le statut du
    stop-loss, puis on applique la décision de evaluer_position().
    """
    a_fermer = []  # paires dont la position est entièrement terminée

    for paire, pos in list(positions.items()):
        try:
            # Prix courant + statut du seul ordre réel (le stop-loss).
            prix_actuel  = float(exchange.fetch_ticker(paire)["last"])
            sl_declenche = exchange.fetch_order(pos.ordre_sl_id, paire)["status"] == "closed"

            action = evaluer_position(pos, prix_actuel, sl_declenche)

            # --- Stop-loss touché : position fermée en perte (ou au breakeven) ---
            if action == "STOP":
                log.info("🔴 STOP-LOSS touché sur %s (entrée=%.4f stop=%.4f)",
                         paire, pos.prix_entree, pos.stop_loss)
                journaliser_cloture(pos, "STOP_LOSS")
                envoyer_telegram(f"🔴 <b>STOP-LOSS</b> — {paire}\n"
                                 f"Entrée : {pos.prix_entree:.4f} → Stop : {pos.stop_loss:.4f}")
                a_fermer.append(paire)
                continue

            # --- TP1 atteint : vendre 50 % au marché, remonter le stop au breakeven ---
            if action == "TP1":
                log.info("🎯 TP1 atteint sur %s (%.4f) — vente de 50 %% au marché",
                         paire, pos.take_profit_1)
                # On annule d'abord le stop (il couvrait toute la quantité)...
                annuler_ordre(exchange, paire, pos.ordre_sl_id)
                # ... on vend la moitié...
                qte_moitie = float(exchange.amount_to_precision(paire, pos.quantite_totale * 0.5))
                exchange.create_market_order(paire, "sell", qte_moitie)
                pos.tp1_atteint       = True
                pos.quantite_restante = float(
                    exchange.amount_to_precision(paire, pos.quantite_totale - qte_moitie))
                # ... puis on repose un stop au PRIX D'ENTRÉE sur le reste (trade "gratuit").
                pos.stop_loss   = pos.prix_entree
                pos.ordre_sl_id = poser_stop_loss(
                    exchange, paire, pos.quantite_restante, pos.prix_entree)
                sauvegarder_positions(positions)
                envoyer_telegram(f"🎯 <b>TP1 atteint</b> — {paire}\n"
                                 f"50 % vendus à ~{pos.take_profit_1:.4f}\n"
                                 f"Stop remonté au prix d'entrée ({pos.prix_entree:.4f}) ✅")
                continue  # le TP2 sera évalué au prochain cycle de surveillance

            # --- TP2 atteint : solder le reste au marché ---
            if action == "TP2":
                log.info("🎯🎯 TP2 atteint sur %s (%.4f) — clôture totale",
                         paire, pos.take_profit_2)
                annuler_ordre(exchange, paire, pos.ordre_sl_id)
                fermer_position_marche(exchange, paire, pos.quantite_restante)
                journaliser_cloture(pos, "TAKE_PROFIT")
                envoyer_telegram(f"🎯🎯 <b>TP2 atteint</b> — {paire}\n"
                                 f"Position entièrement fermée à ~{pos.take_profit_2:.4f} ✅")
                a_fermer.append(paire)

        except ccxt.BaseError as e:
            log.warning("Erreur suivi position %s : %s", paire, e)

    for paire in a_fermer:
        del positions[paire]

    return positions


# =============================================================================
#  JOURNALISATION
# =============================================================================

def journaliser_signal(paire, prix, score, regime, reco, risque=None):
    """Journalise chaque signal (ouverture ou attente)."""
    existe = os.path.exists(FICHIER_JOURNAL)
    with open(FICHIER_JOURNAL, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if not existe:
            w.writerow(["horodatage","paire","prix","score","regime",
                        "recommandation","stop_loss","tp1","tp2","taille_usdt"])
        sl   = risque["stop_loss"]     if risque else ""
        tp1  = risque["take_profit_1"] if risque else ""
        tp2  = risque["take_profit_2"] if risque else ""
        val  = risque["valeur"]        if risque else ""
        w.writerow([datetime.now().isoformat(timespec="seconds"),
                    paire, f"{prix:.4f}", score, regime, reco, sl, tp1, tp2, val])


def journaliser_cloture(pos, motif):
    """Journalise la clôture d'une position."""
    existe = os.path.exists(FICHIER_JOURNAL)
    with open(FICHIER_JOURNAL, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if not existe:
            w.writerow(["horodatage","paire","prix","score","regime",
                        "recommandation","stop_loss","tp1","tp2","taille_usdt"])
        w.writerow([datetime.now().isoformat(timespec="seconds"),
                    pos.paire, f"{pos.prix_entree:.4f}", "", "",
                    f"CLOTURE_{motif}", pos.stop_loss,
                    pos.take_profit_1, pos.take_profit_2, ""])


# =============================================================================
#  TELEGRAM
# =============================================================================

def envoyer_telegram(message):
    token   = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data={"chat_id": chat_id, "text": message, "parse_mode": "HTML"},
            timeout=10,
        ).raise_for_status()
    except requests.RequestException as e:
        log.warning("Telegram : %s", e)


def message_ouverture(paire, prix, score, regime, alignement, risque, ref):
    """Message Telegram envoyé à l'ouverture d'un trade."""
    return (
        f"🟢 <b>ACHAT EXÉCUTÉ</b> — {paire}\n"
        f"💵 Prix d'entrée : {prix:.4f} USDT\n"
        f"📊 Score : {score}/100  |  Régime : {regime}\n"
        f"🔗 Alignement : {alignement}\n"
        f"📈 RSI : {ref['rsi']:.1f}  |  ADX : {ref['adx']:.1f}\n"
        f"\n"
        f"🛡 Stop-loss     : {risque['stop_loss']:.4f}\n"
        f"🎯 TP1 (50 %)   : {risque['take_profit_1']:.4f}\n"
        f"🎯 TP2 (50 %)   : {risque['take_profit_2']:.4f}\n"
        f"📦 Taille       : ~{risque['valeur']:.2f} USDT\n"
        f"⚠️  Risque max   : {risque['risque_montant']:.2f} USDT (1.5 %)"
    )


# =============================================================================
#  CAPITAL
# =============================================================================

def lire_capital(exchange):
    try:
        solde = exchange.fetch_balance()
        usdt  = solde["total"].get("USDT", 0.0)
        return float(usdt) if usdt and usdt > 0 else CAPITAL_DEFAUT
    except ccxt.BaseError as e:
        log.warning("Lecture solde impossible (%s). Valeur par défaut.", e)
        return CAPITAL_DEFAUT


# =============================================================================
#  BOUCLE PRINCIPALE
# =============================================================================

def cycle_analyse(exchange, positions, capital_actuel):
    """Analyse les 6 paires et exécute les ouvertures / fermetures de signal."""
    resume_scores = []   # pour le récapitulatif de fin de cycle
    log.info("===== NOUVEAU CYCLE D'ANALYSE =====")
    for paire in PAIRES:
        try:
            decision, score, alignement, ref, _ = analyser_paire(exchange, paire)
            prix   = float(ref["close"])
            regime = detecter_regime(ref)

            # Log clair, paire par paire : on voit le score et la décision en direct.
            icone = {"ACHETER": "🟢", "VENDRE": "🔴", "ATTENDRE": "⚪️"}.get(decision, "")
            log.info("  %s %-10s score=%-5s %-9s régime=%-10s align=%s",
                     icone, paire, score, decision, regime, alignement)
            resume_scores.append(f"{paire.split('/')[0]}={score}")

            # Journalise le signal (même si on n'agit pas).
            journaliser_signal(paire, prix, score, regime, decision)

            # --- OUVERTURE DE POSITION ---
            if decision == "ACHETER" and paire not in positions:
                if len(positions) >= MAX_POSITIONS:
                    log.info("  -> Max positions atteint (%d), signal ignoré.", MAX_POSITIONS)
                    continue
                risque = calculer_risque(capital_actuel, prix, float(ref["atr"]))
                if not risque:
                    log.warning("  -> Calcul du risque impossible pour %s.", paire)
                    continue
                pos = ouvrir_position(exchange, paire, risque)
                positions[paire] = pos
                sauvegarder_positions(positions)
                envoyer_telegram(message_ouverture(
                    paire, pos.prix_entree, score, regime, alignement, risque, ref))

            # --- FERMETURE FORCÉE sur signal VENDRE (si position ouverte) ---
            elif decision == "VENDRE" and paire in positions:
                pos = positions[paire]
                log.info("  -> Signal VENDRE sur position ouverte %s — sortie marché.", paire)
                annuler_ordre(exchange, paire, pos.ordre_sl_id)
                fermer_position_marche(exchange, paire, pos.quantite_restante)
                journaliser_cloture(pos, "SIGNAL_VENDRE")
                envoyer_telegram(
                    f"🔴 <b>SORTIE sur signal</b> — {paire}\n"
                    f"Entrée : {pos.prix_entree:.4f}  |  Score VENDRE : {score}")
                del positions[paire]
                sauvegarder_positions(positions)

        except (ccxt.BaseError, ValueError) as e:
            # ccxt.BaseError : souci réseau / API. ValueError : données insuffisantes
            # pour cette paire. Dans les deux cas on passe à la paire suivante.
            log.warning("Erreur sur %s : %s", paire, e)
            resume_scores.append(f"{paire.split('/')[0]}=ERR")

    # Récapitulatif clair de tous les scores du cycle, sur une seule ligne.
    log.info("📊 Scores du cycle : %s", "  ".join(resume_scores))
    return positions


def main():
    exchange = creer_connexion()
    # Pré-chargement des marchés (nécessaire pour amount_to_precision).
    exchange.load_markets()
    log.info("Agent FULL-AUTO démarré sur le Spot Testnet Binance.")

    # Reprise des positions ouvertes si le script a été redémarré.
    positions = charger_positions()
    log.info("%d position(s) chargée(s) depuis le disque.", len(positions))

    jour_courant       = date.today()
    capital_debut_jour = lire_capital(exchange)
    log.info("Capital de départ du jour : %.2f USDT", capital_debut_jour)

    # On force une analyse dès le premier tour (dernier_analyse très ancien).
    dernier_analyse = 0.0

    while True:
        maintenant = time.time()

        # --- Remise à zéro du circuit breaker au début d'un nouveau jour ---
        if date.today() != jour_courant:
            jour_courant       = date.today()
            capital_debut_jour = lire_capital(exchange)
            log.info("Nouveau jour — capital de référence : %.2f USDT", capital_debut_jour)

        capital_actuel = lire_capital(exchange)

        # --- Circuit breaker (vérifié à chaque tour de surveillance) ---
        if circuit_breaker_declenche(capital_debut_jour, capital_actuel):
            msg = (f"⛔️ <b>CIRCUIT BREAKER</b>\n"
                   f"Perte journalière > {PERTE_JOUR_MAX*100:.0f} %.\n"
                   f"Capital début : {capital_debut_jour:.2f} USDT\n"
                   f"Capital actuel : {capital_actuel:.2f} USDT\n"
                   f"Agent arrêté (les stops restent en place).")
            log.error("CIRCUIT BREAKER déclenché.")
            envoyer_telegram(msg)
            break

        # --- 1. Surveillance des positions ouvertes : à CHAQUE tour (60 s) ---
        #    C'est ici que les take-profits virtuels se déclenchent vite.
        if positions:
            positions = verifier_positions(exchange, positions)
            sauvegarder_positions(positions)

        # --- 2. Analyse complète : seulement toutes les 15 minutes ---
        if maintenant - dernier_analyse >= INTERVALLE_SECONDES:
            dernier_analyse = maintenant
            positions = cycle_analyse(exchange, positions, capital_actuel)
            log.info("Analyse terminée. %d position(s) ouverte(s).", len(positions))

        # Pause courte : on reste réactif sur les positions.
        time.sleep(INTERVALLE_SURVEILLANCE)


if __name__ == "__main__":
    main()
