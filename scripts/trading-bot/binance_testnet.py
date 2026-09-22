"""
Agent de trading crypto — Étape 1 : connexion au Spot Testnet de Binance.

Ce script :
  1. Se connecte au Spot Testnet de Binance (testnet.binance.vision)
  2. Affiche le prix actuel de BTC/USDT, ETH/USDT et SOL/USDT
  3. Affiche votre solde fictif (argent virtuel) du compte testnet

⚠️  Le testnet utilise de l'argent FICTIF. Aucune vraie crypto n'est échangée.
    Créez vos clés ici : https://testnet.binance.vision/
"""

# On importe "os" pour lire les variables d'environnement (où sont stockées les clés)
import os

# ccxt est la bibliothèque qui sait parler à des dizaines de plateformes crypto,
# dont Binance. Elle uniformise le code : on apprend une fois, on réutilise partout.
import ccxt


def creer_connexion():
    """Crée et configure la connexion à Binance Spot Testnet."""

    # On lit les clés depuis les variables d'environnement.
    # JAMAIS écrire ses clés directement dans le code : si vous partagez le fichier,
    # tout le monde verrait vos clés. On les met plutôt dans des variables système.
    api_key = os.environ.get("BINANCE_TESTNET_API_KEY")
    api_secret = os.environ.get("BINANCE_TESTNET_API_SECRET")

    # Si une des clés manque, on arrête tout de suite avec un message clair.
    if not api_key or not api_secret:
        raise SystemExit(
            "❌ Clés manquantes.\n"
            "   Définissez-les avant de lancer le script :\n"
            "     export BINANCE_TESTNET_API_KEY=\"votre_cle\"\n"
            "     export BINANCE_TESTNET_API_SECRET=\"votre_secret\"\n"
            "   (Créez vos clés sur https://testnet.binance.vision/)"
        )

    # On crée l'objet "exchange" qui représente notre connexion à Binance.
    exchange = ccxt.binance({
        "apiKey": api_key,
        "secret": api_secret,
        # enableRateLimit = True : ccxt attend automatiquement entre deux requêtes
        # pour ne pas dépasser les limites de Binance et se faire bloquer.
        "enableRateLimit": True,
        # On précise que l'on veut le marché "spot" (achat/vente comptant),
        # par opposition aux "futures" (contrats à terme) plus risqués.
        "options": {"defaultType": "spot"},
    })

    # Ligne ESSENTIELLE : on bascule ccxt en mode bac à sable (sandbox = testnet).
    # Sans cette ligne, le script viserait le VRAI Binance avec du VRAI argent.
    exchange.set_sandbox_mode(True)

    return exchange


def afficher_prix(exchange):
    """Récupère et affiche le dernier prix de quelques paires."""

    # La liste des paires que l'on veut surveiller. Format ccxt : "BASE/QUOTE".
    paires = ["BTC/USDT", "ETH/USDT", "SOL/USDT"]

    print("\n📈 Prix actuels (Spot Testnet)")
    print("-" * 32)

    # On boucle sur chaque paire pour demander son "ticker" (résumé du marché).
    for paire in paires:
        # fetch_ticker renvoie un dictionnaire avec plein d'infos sur la paire.
        ticker = exchange.fetch_ticker(paire)
        # "last" = le prix de la dernière transaction effectuée. C'est le prix "actuel".
        prix = ticker["last"]
        # On affiche joliment, aligné sur 10 caractères pour le nom de la paire.
        print(f"  {paire:<10} : {prix:,.2f} USDT")


def afficher_solde(exchange):
    """Récupère et affiche le solde fictif du compte testnet."""

    print("\n💰 Solde du compte (fictif / testnet)")
    print("-" * 32)

    # fetch_balance interroge VOTRE compte : il faut donc des clés valides.
    solde = exchange.fetch_balance()

    # "total" contient, pour chaque monnaie, la quantité totale détenue.
    totaux = solde["total"]

    # On ne garde que les monnaies dont le solde est strictement positif,
    # sinon on afficherait des centaines de lignes à zéro.
    monnaies_non_vides = {m: q for m, q in totaux.items() if q and q > 0}

    if not monnaies_non_vides:
        print("  (Aucun fonds : demandez des jetons de test via le robinet/faucet du testnet)")
        return

    # On affiche chaque monnaie possédée et sa quantité.
    for monnaie, quantite in sorted(monnaies_non_vides.items()):
        print(f"  {monnaie:<6} : {quantite}")


def main():
    """Point d'entrée : on enchaîne connexion, prix, puis solde."""

    # 1) On établit la connexion sécurisée au testnet.
    exchange = creer_connexion()

    # On enveloppe les appels réseau dans un try/except pour afficher une erreur
    # lisible plutôt qu'une longue trace technique si quelque chose se passe mal.
    try:
        # 2) Affichage des prix.
        afficher_prix(exchange)
        # 3) Affichage du solde.
        afficher_solde(exchange)
    except ccxt.AuthenticationError:
        print("\n❌ Authentification refusée : vérifiez vos clés API du testnet.")
    except ccxt.NetworkError as e:
        print(f"\n❌ Problème réseau avec Binance : {e}")
    except ccxt.ExchangeError as e:
        print(f"\n❌ Binance a renvoyé une erreur : {e}")


# Cette condition garantit que main() ne s'exécute que si on lance CE fichier
# directement (et pas s'il est importé depuis un autre script).
if __name__ == "__main__":
    main()
