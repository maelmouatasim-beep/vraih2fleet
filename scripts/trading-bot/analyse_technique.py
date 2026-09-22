"""
Agent de trading crypto — Étape 2 : analyse technique et recommandations.

Pour chaque paire (BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT), ce script :
  1. Récupère l'historique des prix (bougies / OHLCV) sur le Spot Testnet Binance
  2. Calcule des indicateurs techniques avec la bibliothèque "ta" :
       - RSI (force du mouvement / sur-achat ou sur-vente)
       - MACD (tendance et momentum)
       - Bandes de Bollinger (volatilité et position du prix)
       - Moyennes mobiles SMA 20 / 50 / 200 (tendance de fond)
  3. Combine tout en un SCORE COMPOSITE de 0 à 100
  4. Applique une gestion du risque stricte :
       - 20 % maximum du capital par position
       - stop-loss calculé à partir de l'ATR (volatilité réelle)
  5. Affiche une recommandation claire : ACHETER / VENDRE / ATTENDRE + le raisonnement

⚠️  Tout se passe sur le TESTNET : argent fictif, aucune vraie transaction.
    Ce script n'envoie AUCUN ordre : il ne fait qu'analyser et conseiller.
"""

# --- Imports de la bibliothèque standard ---
import os                       # pour lire les clés API dans les variables d'environnement
from dataclasses import dataclass, field  # pour ranger proprement les résultats d'analyse

# --- Imports de bibliothèques externes ---
import ccxt                     # pour parler à Binance
import pandas as pd             # pour manipuler les données en tableau (DataFrame)

# On importe précisément les indicateurs dont on a besoin dans la bibliothèque "ta".
from ta.momentum import RSIIndicator
from ta.trend import MACD, SMAIndicator
from ta.volatility import BollingerBands, AverageTrueRange


# =============================================================================
#  PARAMÈTRES GÉNÉRAUX — on regroupe ici tous les réglages faciles à modifier
# =============================================================================

# Les paires que l'on veut analyser.
PAIRES = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"]

# L'unité de temps de chaque bougie. "1h" = une bougie par heure.
# Plus c'est court (1m, 5m), plus c'est nerveux ; plus c'est long (4h, 1d), plus c'est calme.
TIMEFRAME = "1h"

# Combien de bougies on récupère. Il en faut au moins 200 pour la moyenne mobile SMA 200.
NB_BOUGIES = 300

# --- Réglages de gestion du risque ---
CAPITAL_TOTAL = 10000.0   # capital fictif de référence, en USDT
RISQUE_MAX_PAR_POSITION = 0.20   # 20 % du capital maximum sur une seule crypto
MULTIPLICATEUR_ATR_STOP = 2.0    # stop-loss placé à 2 x ATR sous le prix d'entrée

# --- Seuils de décision pour le score composite (0 à 100) ---
SEUIL_ACHETER = 65   # score >= 65  -> ACHETER
SEUIL_VENDRE = 35    # score <= 35  -> VENDRE
# Entre les deux (35 < score < 65) -> ATTENDRE


# =============================================================================
#  STRUCTURE DE DONNÉES — pour transporter proprement le résultat d'une analyse
# =============================================================================

@dataclass
class Analyse:
    """Regroupe tout ce que l'on a calculé pour une paire."""
    paire: str
    prix: float
    score: float                  # score composite final de 0 à 100
    recommandation: str           # "ACHETER", "VENDRE" ou "ATTENDRE"
    raisons: list = field(default_factory=list)  # explications lisibles
    stop_loss: float = 0.0        # niveau de stop-loss conseillé (basé sur l'ATR)
    taille_position: float = 0.0  # montant en USDT à engager au maximum
    quantite: float = 0.0         # quantité de crypto correspondante


# =============================================================================
#  CONNEXION
# =============================================================================

def creer_connexion():
    """Crée la connexion à Binance en mode bac à sable (testnet)."""

    api_key = os.environ.get("BINANCE_TESTNET_API_KEY")
    api_secret = os.environ.get("BINANCE_TESTNET_API_SECRET")

    if not api_key or not api_secret:
        raise SystemExit(
            "❌ Clés manquantes. Définissez-les avant de lancer le script :\n"
            "     export BINANCE_TESTNET_API_KEY=\"votre_cle\"\n"
            "     export BINANCE_TESTNET_API_SECRET=\"votre_secret\""
        )

    exchange = ccxt.binance({
        "apiKey": api_key,
        "secret": api_secret,
        "enableRateLimit": True,             # respecte automatiquement les limites de Binance
        "options": {"defaultType": "spot"},  # marché comptant (spot), pas les futures
    })
    # Bascule vers le testnet : indispensable pour rester sur de l'argent fictif.
    exchange.set_sandbox_mode(True)
    return exchange


# =============================================================================
#  RÉCUPÉRATION ET PRÉPARATION DES DONNÉES
# =============================================================================

def recuperer_bougies(exchange, paire):
    """Télécharge l'historique des prix et le range dans un tableau pandas."""

    # fetch_ohlcv renvoie une liste de bougies. Chaque bougie = 6 valeurs :
    # [horodatage, ouverture (open), plus haut (high), plus bas (low), clôture (close), volume]
    donnees = exchange.fetch_ohlcv(paire, timeframe=TIMEFRAME, limit=NB_BOUGIES)

    # On transforme cette liste en DataFrame pandas, avec des colonnes nommées.
    df = pd.DataFrame(
        donnees,
        columns=["horodatage", "open", "high", "low", "close", "volume"],
    )
    # On convertit l'horodatage (en millisecondes) en vraie date lisible.
    df["horodatage"] = pd.to_datetime(df["horodatage"], unit="ms")
    return df


def calculer_indicateurs(df):
    """Ajoute au tableau toutes les colonnes d'indicateurs techniques."""

    # On travaille presque toujours sur le prix de clôture ("close").
    cloture = df["close"]

    # --- RSI sur 14 périodes ---
    # Le RSI va de 0 à 100. < 30 = sur-vendu (rebond possible), > 70 = sur-acheté (correction possible).
    df["rsi"] = RSIIndicator(close=cloture, window=14).rsi()

    # --- MACD ---
    # Le MACD compare deux moyennes exponentielles. On regarde sa "ligne" et sa "ligne signal".
    # Si la ligne MACD passe au-dessus du signal -> dynamique haussière, et inversement.
    macd = MACD(close=cloture, window_slow=26, window_fast=12, window_sign=9)
    df["macd"] = macd.macd()                # ligne MACD
    df["macd_signal"] = macd.macd_signal()  # ligne de signal

    # --- Bandes de Bollinger (20 périodes, 2 écarts-types) ---
    # Une bande haute et une bande basse autour d'une moyenne. Près de la bande basse
    # = prix relativement bas ; près de la bande haute = prix relativement haut.
    bollinger = BollingerBands(close=cloture, window=20, window_dev=2)
    df["boll_haut"] = bollinger.bollinger_hband()
    df["boll_bas"] = bollinger.bollinger_lband()

    # --- Moyennes mobiles simples (tendance de fond) ---
    df["sma20"] = SMAIndicator(close=cloture, window=20).sma_indicator()
    df["sma50"] = SMAIndicator(close=cloture, window=50).sma_indicator()
    df["sma200"] = SMAIndicator(close=cloture, window=200).sma_indicator()

    # --- ATR (Average True Range) sur 14 périodes ---
    # L'ATR mesure la volatilité réelle (de combien le prix bouge en moyenne).
    # On s'en sert pour placer un stop-loss adapté au marché du moment.
    df["atr"] = AverageTrueRange(
        high=df["high"], low=df["low"], close=cloture, window=14
    ).average_true_range()

    return df


# =============================================================================
#  SCORE COMPOSITE — on transforme les indicateurs en une note de 0 à 100
# =============================================================================
#
#  Principe : chaque indicateur "vote" avec une note de 0 à 100
#  (0 = très baissier, 50 = neutre, 100 = très haussier), puis on fait
#  une moyenne PONDÉRÉE. Les poids reflètent l'importance qu'on donne à chacun.

# Somme des poids = 1.0 (100 %). À ajuster selon votre stratégie.
POIDS = {
    "tendance": 0.35,   # moyennes mobiles : la tendance de fond, le plus important
    "macd": 0.25,       # momentum / dynamique
    "rsi": 0.20,        # sur-achat / sur-vente
    "bollinger": 0.20,  # position du prix dans sa fourchette de volatilité
}


def score_tendance(ligne):
    """Note la tendance via l'empilement des moyennes mobiles (0-100)."""
    prix = ligne["close"]
    sma20, sma50, sma200 = ligne["sma20"], ligne["sma50"], ligne["sma200"]

    note = 50  # on part d'un point neutre
    raison = ""

    # Configuration franchement haussière : prix > court terme > moyen terme > long terme.
    if prix > sma20 > sma50 > sma200:
        note = 90
        raison = "Tendance haussière forte (prix > SMA20 > SMA50 > SMA200)"
    # Configuration franchement baissière : l'inverse.
    elif prix < sma20 < sma50 < sma200:
        note = 10
        raison = "Tendance baissière forte (prix < SMA20 < SMA50 < SMA200)"
    # Prix au-dessus de la longue moyenne : plutôt haussier mais sans alignement parfait.
    elif prix > sma200:
        note = 65
        raison = "Tendance de fond haussière (prix au-dessus de la SMA200)"
    else:
        note = 35
        raison = "Tendance de fond baissière (prix sous la SMA200)"

    return note, raison


def score_macd(ligne):
    """Note le MACD : ligne au-dessus ou en-dessous du signal (0-100)."""
    macd, signal = ligne["macd"], ligne["macd_signal"]

    if macd > signal and macd > 0:
        return 85, "MACD haussier et positif (momentum d'achat)"
    if macd > signal:
        return 65, "MACD repasse au-dessus du signal (momentum qui s'améliore)"
    if macd < signal and macd < 0:
        return 15, "MACD baissier et négatif (momentum de vente)"
    return 35, "MACD sous le signal (momentum qui faiblit)"


def score_rsi(ligne):
    """Note le RSI : on cherche les excès (0-100)."""
    rsi = ligne["rsi"]

    if rsi < 30:
        return 80, f"RSI bas ({rsi:.0f}) : sur-vendu, rebond possible"
    if rsi > 70:
        return 20, f"RSI haut ({rsi:.0f}) : sur-acheté, correction possible"
    if rsi < 45:
        return 60, f"RSI modéré ({rsi:.0f}) : marge de hausse"
    if rsi > 55:
        return 45, f"RSI modéré ({rsi:.0f}) : marge de baisse"
    return 50, f"RSI neutre ({rsi:.0f})"


def score_bollinger(ligne):
    """Note la position du prix dans les bandes de Bollinger (0-100)."""
    prix = ligne["close"]
    haut, bas = ligne["boll_haut"], ligne["boll_bas"]

    # On calcule où se situe le prix entre la bande basse (0 %) et la bande haute (100 %).
    largeur = haut - bas
    if largeur <= 0:
        return 50, "Bollinger neutre"
    position = (prix - bas) / largeur  # 0 = sur la bande basse, 1 = sur la bande haute

    if position < 0.2:
        return 75, "Prix proche de la bande basse de Bollinger (bon marché à court terme)"
    if position > 0.8:
        return 25, "Prix proche de la bande haute de Bollinger (cher à court terme)"
    return 50, "Prix au milieu des bandes de Bollinger"


def calculer_score(ligne):
    """Combine tous les sous-scores en un score composite pondéré (0-100)."""

    # Chaque indicateur renvoie sa note + une phrase d'explication.
    note_tend, raison_tend = score_tendance(ligne)
    note_macd, raison_macd = score_macd(ligne)
    note_rsi, raison_rsi = score_rsi(ligne)
    note_boll, raison_boll = score_bollinger(ligne)

    # Moyenne pondérée selon les poids définis plus haut.
    score = (
        note_tend * POIDS["tendance"]
        + note_macd * POIDS["macd"]
        + note_rsi * POIDS["rsi"]
        + note_boll * POIDS["bollinger"]
    )

    # On renvoie le score arrondi et la liste des raisons pour l'affichage.
    raisons = [raison_tend, raison_macd, raison_rsi, raison_boll]
    return round(score, 1), raisons


# =============================================================================
#  GESTION DU RISQUE
# =============================================================================

def gestion_du_risque(prix, atr):
    """Calcule le stop-loss et la taille de position selon des règles strictes."""

    # Stop-loss basé sur la volatilité : on le place à 2 x ATR sous le prix d'entrée.
    # Avantage : sur un marché agité (ATR grand), le stop est plus large pour éviter
    # de se faire sortir au moindre soubresaut ; sur un marché calme, il est plus serré.
    stop_loss = prix - (MULTIPLICATEUR_ATR_STOP * atr)

    # Taille maximale autorisée sur cette position : 20 % du capital, jamais plus.
    taille_position = CAPITAL_TOTAL * RISQUE_MAX_PAR_POSITION

    # Quantité de crypto correspondante (montant divisé par le prix).
    quantite = taille_position / prix if prix > 0 else 0.0

    return stop_loss, taille_position, quantite


# =============================================================================
#  ANALYSE COMPLÈTE D'UNE PAIRE
# =============================================================================

def analyser_paire(exchange, paire):
    """Enchaîne : données -> indicateurs -> score -> risque -> recommandation."""

    # 1) Données + indicateurs.
    df = recuperer_bougies(exchange, paire)
    df = calculer_indicateurs(df)

    # On prend la DERNIÈRE bougie : c'est l'état actuel du marché.
    ligne = df.iloc[-1]

    # 2) Score composite.
    score, raisons = calculer_score(ligne)

    # 3) Décision selon les seuils.
    if score >= SEUIL_ACHETER:
        recommandation = "ACHETER"
    elif score <= SEUIL_VENDRE:
        recommandation = "VENDRE"
    else:
        recommandation = "ATTENDRE"

    # 4) Gestion du risque (utile surtout pour un ACHAT, mais on la calcule toujours).
    prix = float(ligne["close"])
    stop_loss, taille_position, quantite = gestion_du_risque(prix, float(ligne["atr"]))

    # On range tout dans notre structure Analyse.
    return Analyse(
        paire=paire,
        prix=prix,
        score=score,
        recommandation=recommandation,
        raisons=raisons,
        stop_loss=stop_loss,
        taille_position=taille_position,
        quantite=quantite,
    )


# =============================================================================
#  AFFICHAGE
# =============================================================================

# Petites icônes pour rendre la lecture plus rapide.
ICONES = {"ACHETER": "🟢", "VENDRE": "🔴", "ATTENDRE": "🟡"}


def afficher_analyse(a):
    """Affiche le résultat d'une analyse de façon claire et lisible."""

    print("\n" + "=" * 56)
    print(f"  {a.paire}   |   Prix : {a.prix:,.2f} USDT")
    print("=" * 56)
    print(f"  Score composite : {a.score} / 100")
    print(f"  Recommandation  : {ICONES[a.recommandation]} {a.recommandation}")

    # Le détail du raisonnement, indicateur par indicateur.
    print("\n  Raisonnement :")
    for raison in a.raisons:
        print(f"    • {raison}")

    # On n'affiche le plan de risque que si l'on conseille d'acheter.
    if a.recommandation == "ACHETER":
        # Distance du stop en pourcentage, pour visualiser le risque encouru.
        distance_pct = (a.prix - a.stop_loss) / a.prix * 100
        print("\n  Plan de gestion du risque :")
        print(f"    • Montant max engagé : {a.taille_position:,.2f} USDT "
              f"({RISQUE_MAX_PAR_POSITION*100:.0f} % du capital)")
        print(f"    • Quantité           : {a.quantite:.6f} {a.paire.split('/')[0]}")
        print(f"    • Stop-loss (2x ATR) : {a.stop_loss:,.2f} USDT "
              f"(soit -{distance_pct:.2f} %)")


def afficher_resume(analyses):
    """Affiche un tableau récapitulatif trié du meilleur au moins bon score."""

    print("\n" + "#" * 56)
    print("  RÉSUMÉ (trié par score décroissant)")
    print("#" * 56)
    # On trie les paires : les meilleures opportunités en haut.
    for a in sorted(analyses, key=lambda x: x.score, reverse=True):
        print(f"  {ICONES[a.recommandation]} {a.paire:<10} "
              f"score {a.score:>5} / 100   ->  {a.recommandation}")


# =============================================================================
#  PROGRAMME PRINCIPAL
# =============================================================================

def main():
    exchange = creer_connexion()

    analyses = []
    for paire in PAIRES:
        try:
            a = analyser_paire(exchange, paire)
            analyses.append(a)
            afficher_analyse(a)
        except ccxt.BaseError as e:
            # Si une paire échoue (réseau, paire absente du testnet…), on prévient
            # mais on continue avec les autres paires.
            print(f"\n⚠️  Impossible d'analyser {paire} : {e}")

    # Tableau de synthèse à la fin.
    if analyses:
        afficher_resume(analyses)

    print("\nℹ️  Rappel : ce script ne fait qu'analyser. Aucun ordre n'est envoyé.")


if __name__ == "__main__":
    main()
