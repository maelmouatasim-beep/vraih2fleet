# -*- coding: utf-8 -*-
"""
Génère docs/tco-verification.xlsx : classeur d'audit des 6 cas de référence
TCO (docs/tco-cas-de-reference.md).

Principe : une feuille « Hypothèses » (paramètres communs, cellules nommées),
puis une feuille par cas où TOUTES les cellules de calcul sont des FORMULES
Excel référençant la feuille Hypothèses et les autres cellules. Seules les
entrées propres à chaque cas (prix, consommations, km, subventions…) sont des
constantes. L'utilisateur peut ainsi refaire/auditer chaque calcul dans Excel.

Méthode : docs/tco-methodologie.md (conventions §2, postes §3, référence §4,
émissions §5, sorties §6). Aucun résultat n'est collé en dur.

Usage : python3 scripts/tco-verification-xlsx.py
"""
import os

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "tco-verification.xlsx")

BOLD = Font(bold=True)
TITLE = Font(bold=True, size=13)
FILL_IN = PatternFill("solid", fgColor="FFF2CC")    # entrées du cas (constantes)
FILL_CALC = PatternFill("solid", fgColor="DDEBF7")  # formules

# ---------------------------------------------------------------------------
# Feuille Hypothèses : (nom défini, libellé, valeur ou formule, unité)
# ---------------------------------------------------------------------------
HYP = [
    ("taux_r",             "Taux d'actualisation nominal r", 0.05, "décimal"),
    ("g_diesel",           "Inflation diesel", 0.03, "décimal"),
    ("g_elec",             "Inflation électricité", 0.035, "décimal"),
    ("g_h2",               "Inflation hydrogène", 0.0, "décimal"),
    ("g_entretien",        "Inflation entretien", 0.025, "décimal"),
    ("g_general",          "Inflation générale", 0.021, "décimal"),
    ("prix_diesel",        "Prix diesel année 0", 2.95, "$/L"),
    ("prix_elec",          "Prix électricité effectif au compteur, année 0", 0.10, "$/kWh"),
    ("prix_h2",            "Prix H2 livré, année 0", 16.5, "$/kg"),
    ("rendement",          "Rendement de recharge (kWh véhicule / kWh compteur)", 0.90, "ratio"),
    ("maj_hiver",          "Majoration hivernale (mois d'hiver)", 0.25, "ratio"),
    ("part_hiver",         "Part des km en hiver", 0.33, "ratio"),
    ("fact_hiver",         "Facteur hivernal annualisé = 1 + maj x part", "=1+maj_hiver*part_hiver", "ratio"),
    ("taux_tvq",           "Taux TVQ", 0.09975, "décimal"),
    ("part_tvq_non_recup", "Part de TVQ non récupérable (municipalité)", 0.5, "ratio"),
    ("taux_taxes",         "Taxes non récupérables = part x TVQ (TPS remboursée 100 %)",
     "=part_tvq_non_recup*taux_tvq", "décimal"),
    ("d_diesel",           "Dépréciation annuelle diesel", 0.15, "décimal"),
    ("d_bev",              "Dépréciation annuelle BEV", 0.18, "décimal"),
    ("d_fcev",             "Dépréciation annuelle FCEV", 0.20, "décimal"),
    ("plancher_vr",        "Plancher de valeur résiduelle", 0.10, "ratio"),
    ("infra_entretien_pct","Entretien infra annuel (part du capex avant taxes)", 0.03, "ratio"),
    ("duree_vie_infra",    "Durée de vie de l'infrastructure", 15, "années"),
    ("fe_leger",           "FE diesel TTW — véhicules légers/camionnettes", 2.741, "kg CO2e/L"),
    ("fe_lourd",           "FE diesel TTW — camions moyens/lourds, autobus", 2.724, "kg CO2e/L"),
    ("ratio_wtw",          "WTW diesel = TTW x ratio", 1.25, "ratio"),
    ("fe_elec",            "FE électricité QC (WTW, au compteur)", 1.2, "g CO2e/kWh"),
    ("fe_h2",              "FE H2 électrolyse QC (WTW)", 1.0, "kg CO2e/kg"),
]


def build_hypotheses(wb):
    ws = wb.active
    ws.title = "Hypothèses"
    ws["A1"] = "Hypothèses communes — scénario Central, CAD courants, année de référence 2026, municipalité"
    ws["A1"].font = TITLE
    ws.append([])
    ws.append(["Nom", "Description", "Valeur", "Unité"])
    for c in "ABCD":
        ws[f"{c}3"].font = BOLD
    row = 4
    for nom, desc, val, unite in HYP:
        ws.cell(row=row, column=1, value=nom)
        ws.cell(row=row, column=2, value=desc)
        cell = ws.cell(row=row, column=3, value=val)
        cell.fill = FILL_CALC if isinstance(val, str) and val.startswith("=") else FILL_IN
        ws.cell(row=row, column=4, value=unite)
        wb.defined_names[nom] = DefinedName(nom, attr_text=f"'Hypothèses'!$C${row}")
        row += 1
    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 62
    ws.column_dimensions["C"].width = 22
    ws.column_dimensions["D"].width = 14
    return ws


# ---------------------------------------------------------------------------
# Feuilles cas 1 à 5 (un véhicule + infra éventuelle)
# ---------------------------------------------------------------------------
COLS = ["n", "Acquisition alt", "Subventions", "Énergie alt", "Entretien alt",
        "Opex infra", "Résiduels alt", "Flux net alt", "Acquisition réf",
        "Énergie réf", "Entretien réf", "Résiduels réf", "Flux net réf",
        "Économie nominale", "Facteur actualisation", "Flux act. alt",
        "Flux act. réf", "Cumul économie nominale", "Cumul économie actualisée",
        "km actualisés", "n si cumul nominal >= 0", "n si cumul actualisé >= 0",
        "TTW réf (t)", "WTW réf (t)", "WTW alt (t)"]


def build_case_simple(wb, spec):
    ws = wb.create_sheet(f"Cas {spec['id']}")
    ws["A1"] = f"Cas {spec['id']} — {spec['titre']}"
    ws["A1"].font = TITLE

    techno = spec["techno"]  # 'BEV' | 'FCEV'
    inputs = [
        ("Horizon H (années)", spec["H"], "ans"),
        ("Kilométrage annuel", spec["km"], "km/an"),
        ("Prix réf (diesel) avant taxes", spec["ref_prix"], "$"),
        ("Conso réf", spec["ref_conso"], "L/100 km"),
        ("Entretien réf", spec["ref_cpk"], "$/km"),
        ("Prix alt avant taxes", spec["alt_prix"], "$"),
        ("Conso alt", spec["alt_conso"], "kWh/100 km" if techno == "BEV" else "kg H2/100 km"),
        ("Entretien alt", spec["alt_cpk"], "$/km"),
        ("Subvention (montant)", spec["sub"], "$"),
        ("Subvention (année de versement)", spec["sub_annee"], "année"),
        ("Infra — capex avant taxes", spec["infra"], "$"),
        ("FE diesel TTW (choix catégorie)", f"={spec['fe']}", "kg CO2e/L"),
    ]
    ws["A3"] = "Entrées du cas (constantes)"; ws["A3"].font = BOLD
    r = 4
    for lab, val, unite in inputs:
        ws.cell(row=r, column=1, value=lab)
        c = ws.cell(row=r, column=2, value=val)
        c.fill = FILL_CALC if isinstance(val, str) and str(val).startswith("=") else FILL_IN
        ws.cell(row=r, column=3, value=unite)
        r += 1
    # B4..B15
    H_, KM, PREF, CREF, EREF = "$B$4", "$B$5", "$B$6", "$B$7", "$B$8"
    PALT, CALT, EALT, SUB, SUBAN, INFRA, FE = "$B$9", "$B$10", "$B$11", "$B$12", "$B$13", "$B$14", "$B$15"

    d_alt = {"BEV": "d_bev", "FCEV": "d_fcev"}[techno]
    conso_compteur = (f"={CALT}*fact_hiver/rendement" if techno == "BEV"
                      else f"={CALT}*fact_hiver")
    prix_energie_alt = "prix_elec" if techno == "BEV" else "prix_h2"
    g_energie_alt = "g_elec" if techno == "BEV" else "g_h2"

    derived = [
        ("Prix réf avec taxes non récupérables", f"={PREF}*(1+taux_taxes)"),
        ("Prix alt avec taxes non récupérables", f"={PALT}*(1+taux_taxes)"),
        ("Infra avec taxes non récupérables", f"={INFRA}*(1+taux_taxes)"),
        ("Conso alt facturée (compteur ou pompe) /100 km", conso_compteur),
        ("VR réf fin d'horizon (avant taxes, nominale)",
         f"=MAX({PREF}*(1-d_diesel)^{H_},plancher_vr*{PREF})"),
        ("VR alt fin d'horizon (avant taxes, nominale)",
         f"=MAX({PALT}*(1-{d_alt})^{H_},plancher_vr*{PALT})"),
        ("VR infra fin d'horizon (linéaire sur 15 ans)",
         f"=IF({INFRA}>0,{INFRA}*(duree_vie_infra-{H_})/duree_vie_infra,0)"),
    ]
    ws.cell(row=17, column=1, value="Valeurs dérivées (formules)").font = BOLD
    r = 18
    for lab, f in derived:
        ws.cell(row=r, column=1, value=lab)
        c = ws.cell(row=r, column=2, value=f); c.fill = FILL_CALC
        r += 1
    PREF_TTC, PALT_TTC, INFRA_TTC = "$B$18", "$B$19", "$B$20"
    CONSO_C, VRREF, VRALT, VRINFRA = "$B$21", "$B$22", "$B$23", "$B$24"

    # tableau annuel
    hdr = 27
    for j, name in enumerate(COLS, start=1):
        c = ws.cell(row=hdr, column=j, value=name); c.font = BOLD
    first = hdr + 1
    H = spec["H"]
    for n in range(H + 1):
        row = first + n
        A = f"A{row}"
        ws.cell(row=row, column=1, value=(0 if n == 0 else f"=A{row-1}+1"))
        formulas = [
            f"=IF({A}=0,{PALT_TTC}+{INFRA_TTC},0)",                              # B acq alt
            f"=IF({A}={SUBAN},{SUB},0)",                                          # C subventions
            f"=IF({A}=0,0,{KM}*{CONSO_C}/100*{prix_energie_alt}*(1+{g_energie_alt})^{A})",  # D énergie alt
            f"=IF({A}=0,0,{KM}*{EALT}*(1+g_entretien)^{A})",                      # E entretien alt
            f"=IF({A}=0,0,infra_entretien_pct*{INFRA}*(1+g_entretien)^{A})",      # F opex infra
            f"=IF({A}={H_},{VRALT}+{VRINFRA},0)",                                 # G résiduels alt
            f"=B{row}-C{row}+D{row}+E{row}+F{row}-G{row}",                        # H flux alt
            f"=IF({A}=0,{PREF_TTC},0)",                                           # I acq réf
            f"=IF({A}=0,0,{KM}*{CREF}/100*prix_diesel*(1+g_diesel)^{A})",         # J énergie réf
            f"=IF({A}=0,0,{KM}*{EREF}*(1+g_entretien)^{A})",                      # K entretien réf
            f"=IF({A}={H_},{VRREF},0)",                                           # L résiduels réf
            f"=I{row}+J{row}+K{row}-L{row}",                                      # M flux réf
            f"=M{row}-H{row}",                                                    # N économie
            f"=1/(1+taux_r)^{A}",                                                 # O facteur
            f"=H{row}*O{row}",                                                    # P flux act alt
            f"=M{row}*O{row}",                                                    # Q flux act réf
            (f"=N{row}" if n == 0 else f"=R{row-1}+N{row}"),                      # R cumul nominal
            (f"=N{row}*O{row}" if n == 0 else f"=S{row-1}+N{row}*O{row}"),        # S cumul actualisé
            f"=IF({A}=0,0,{KM}*O{row})",                                          # T km actualisés
            f'=IF(R{row}>=0,{A},"")',                                             # U payback simple
            f'=IF(S{row}>=0,{A},"")',                                             # V payback actualisé
            f"=IF({A}=0,0,{KM}*{CREF}/100*{FE}/1000)",                            # W TTW réf t
            f"=W{row}*ratio_wtw",                                                 # X WTW réf t
            (f"=IF({A}=0,0,{KM}*{CONSO_C}/100*fe_elec/1000000)" if techno == "BEV"
             else f"=IF({A}=0,0,{KM}*{CONSO_C}/100*fe_h2/1000)"),                 # Y WTW alt t
        ]
        for j, f in enumerate(formulas, start=2):
            c = ws.cell(row=row, column=j, value=f); c.fill = FILL_CALC
    last = first + H

    write_results(ws, spec["id"], first, last, H_, res_row=last + 3)
    style_table(ws, hdr, last)
    return ws


def write_results(ws, case_id, first, last, H_ref, res_row):
    ws.cell(row=res_row - 1, column=1, value="Résultats (formules)").font = BOLD
    res = [
        ("TCO actualisé — alternative ($)", f"=SUM(P{first}:P{last})"),
        ("TCO actualisé — référence ($)", f"=SUM(Q{first}:Q{last})"),
        ("VAN différentielle réf − alt ($)", f"=B{res_row+1}-B{res_row}"),
        ("km actualisés", f"=SUM(T{first}:T{last})"),
        ("TCO/km actualisé — alternative ($/km)", f"=B{res_row}/B{res_row+3}"),
        ("TCO/km actualisé — référence ($/km)", f"=B{res_row+1}/B{res_row+3}"),
        ("Délai de récupération simple (années)",
         f'=IF(COUNT(U{first}:U{last})=0,"null : jamais atteint sur l\'horizon",MIN(U{first}:U{last}))'),
        ("Délai de récupération actualisé (années)",
         f'=IF(COUNT(V{first}:V{last})=0,"null : jamais atteint sur l\'horizon",MIN(V{first}:V{last}))'),
        ("CO2e évité cumulé TTW (t)", f"=SUM(W{first}:W{last})"),
        ("CO2e évité cumulé WTW (t)", f"=SUM(X{first}:X{last})-SUM(Y{first}:Y{last})"),
        ("Coût (+) ou gain (−) par tonne WTW évitée ($/t)",
         f"=(B{res_row}-B{res_row+1})/B{res_row+9}"),
    ]
    for i, (lab, f) in enumerate(res):
        ws.cell(row=res_row + i, column=1, value=lab).font = BOLD
        c = ws.cell(row=res_row + i, column=2, value=f); c.fill = FILL_CALC


def style_table(ws, hdr, last):
    ws.column_dimensions["A"].width = 40
    for j in range(2, len(COLS) + 1):
        ws.column_dimensions[get_column_letter(j)].width = 16
    for row in ws.iter_rows(min_row=hdr + 1, max_row=last, min_col=2, max_col=len(COLS)):
        for c in row:
            if c.column <= 20:  # colonnes monétaires/facteurs
                c.number_format = "#,##0.00"
            else:
                c.number_format = "0.000"


CASES = [
    dict(id=1, titre="Camionnette de service BEV", H=10, km=30000,
         ref_prix=68000, ref_conso=15, ref_cpk=0.14, techno="BEV",
         alt_prix=95000, alt_conso=32, alt_cpk=0.10, sub=2500, sub_annee=1,
         infra=15000, fe="fe_leger"),
    dict(id=2, titre="Autobus urbain 12 m BEV", H=10, km=60000,
         ref_prix=750000, ref_conso=45, ref_cpk=0.95, techno="BEV",
         alt_prix=1720000, alt_conso=140, alt_cpk=0.70, sub=0, sub_annee=1,
         infra=250000, fe="fe_lourd"),
    dict(id=3, titre="Camion lourd BEV (classe 8)", H=10, km=60000,
         ref_prix=200000, ref_conso=36, ref_cpk=0.35, techno="BEV",
         alt_prix=460000, alt_conso=115, alt_cpk=0.25, sub=115000, sub_annee=1,
         infra=250000, fe="fe_lourd"),
    dict(id=4, titre="Véhicule léger BEV", H=10, km=25000,
         ref_prix=45000, ref_conso=9, ref_cpk=0.10, techno="BEV",
         alt_prix=49500, alt_conso=20, alt_cpk=0.07, sub=7000, sub_annee=0,
         infra=15000, fe="fe_leger"),
    dict(id=5, titre="Camion lourd FCEV (H2 électrolyse)", H=10, km=60000,
         ref_prix=200000, ref_conso=36, ref_cpk=0.35, techno="FCEV",
         alt_prix=720000, alt_conso=8, alt_cpk=0.32, sub=150000, sub_annee=1,
         infra=0, fe="fe_lourd"),
]


# ---------------------------------------------------------------------------
# Feuille cas 6 (mini-plan 5 véhicules, H=12, infra partagée, re-remplacement)
# ---------------------------------------------------------------------------
def build_case6(wb):
    ws = wb.create_sheet("Cas 6")
    ws["A1"] = "Cas 6 — Mini-plan 5 véhicules (horizon 12 ans, infra partagée, re-remplacement an 10)"
    ws["A1"].font = TITLE

    def put(row, lab, val, unite=""):
        ws.cell(row=row, column=1, value=lab)
        c = ws.cell(row=row, column=2, value=val)
        c.fill = FILL_CALC if isinstance(val, str) and str(val).startswith("=") else FILL_IN
        if unite:
            ws.cell(row=row, column=3, value=unite)

    ws["A3"] = "Entrées du cas (constantes)"; ws["A3"].font = BOLD
    put(4, "Horizon H", 12, "ans")
    ws["A5"] = "Véhicules légers BEV (paramètres du cas 4)"; ws["A5"].font = BOLD
    put(6, "Nombre", 2); put(7, "km/an (par véhicule)", 25000)
    put(8, "Prix réf avant taxes", 45000, "$"); put(9, "Conso réf", 9, "L/100 km")
    put(10, "Entretien réf", 0.10, "$/km"); put(11, "Prix alt avant taxes", 49500, "$")
    put(12, "Conso alt", 20, "kWh/100 km"); put(13, "Entretien alt", 0.07, "$/km")
    put(14, "Subventions an 0 par véhicule (PAVÉ 5 000 + RV 2 000)", 7000, "$")
    put(15, "Année de re-remplacement (fin de vie 10 ans)", 10)
    ws["A17"] = "Camionnette BEV (paramètres du cas 1, durée de vie 12 ans ici)"; ws["A17"].font = BOLD
    put(18, "km/an", 30000); put(19, "Prix réf avant taxes", 68000, "$")
    put(20, "Conso réf", 15, "L/100 km"); put(21, "Entretien réf", 0.14, "$/km")
    put(22, "Prix alt avant taxes", 95000, "$"); put(23, "Conso alt", 32, "kWh/100 km")
    put(24, "Entretien alt", 0.10, "$/km"); put(25, "Subvention (Écocamionnage 2b)", 2500, "$")
    put(26, "Année de versement", 1)
    ws["A28"] = "Camions moyens BEV classe 6"; ws["A28"].font = BOLD
    put(29, "Nombre", 2); put(30, "km/an (par véhicule)", 35000)
    put(31, "Prix réf avant taxes", 140000, "$"); put(32, "Conso réf", 26, "L/100 km")
    put(33, "Entretien réf", 0.25, "$/km"); put(34, "Prix alt avant taxes", 300000, "$")
    put(35, "Conso alt", 62, "kWh/100 km"); put(36, "Entretien alt", 0.18, "$/km")
    put(37, "Subvention par véhicule (Écocamionnage 25 %)", 75000, "$")
    put(38, "Année de versement", 1)
    ws["A40"] = "Infrastructure partagée (an 0)"; ws["A40"].font = BOLD
    put(41, "Borne (unité)", 15000, "$"); put(42, "Nombre de bornes", 5)
    put(43, "Raccordement", 60000, "$")
    put(44, "Capex infra avant taxes", "=B41*B42+B43", "$")

    NV, KMV, PRV, CRV, ERV = "$B$6", "$B$7", "$B$8", "$B$9", "$B$10"
    PAV, CAV, EAV, SUBV, ANREPL = "$B$11", "$B$12", "$B$13", "$B$14", "$B$15"
    KMC, PRC, CRC, ERC = "$B$18", "$B$19", "$B$20", "$B$21"
    PAC, CAC, EAC, SUBC, ANC = "$B$22", "$B$23", "$B$24", "$B$25", "$B$26"
    NM, KMM, PRM, CRM, ERM = "$B$29", "$B$30", "$B$31", "$B$32", "$B$33"
    PAM, CAM, EAM, SUBM, ANM = "$B$34", "$B$35", "$B$36", "$B$37", "$B$38"
    INFRA, H_ = "$B$44", "$B$4"

    ws["A46"] = "Valeurs dérivées (formules)"; ws["A46"].font = BOLD
    derived = [
        ("kWh compteur/an — 1 véhicule léger", f"={KMV}*{CAV}/100*fact_hiver/rendement"),
        ("kWh compteur/an — camionnette", f"={KMC}*{CAC}/100*fact_hiver/rendement"),
        ("kWh compteur/an — 1 camion moyen", f"={KMM}*{CAM}/100*fact_hiver/rendement"),
        ("kWh compteur/an — total site (année 1)", f"={NV}*B47+B48+{NM}*B49"),
        ("Prix rachat VL alt an 10 (avant taxes, inflation générale)", f"={PAV}*(1+g_general)^{ANREPL}"),
        ("Prix rachat VL réf an 10 (avant taxes)", f"={PRV}*(1+g_general)^{ANREPL}"),
        ("VR an 10 — VL alt ancien (plancher 10 % du prix initial)", f"=plancher_vr*{PAV}"),
        ("VR an 10 — VL réf ancien (plancher 10 %)", f"=plancher_vr*{PRV}"),
        ("VR fin 12 — VL alt nouveau (2 ans de possession)",
         f"=MAX(B51*(1-d_bev)^({H_}-{ANREPL}),plancher_vr*B51)"),
        ("VR fin 12 — VL réf nouveau", f"=MAX(B52*(1-d_diesel)^({H_}-{ANREPL}),plancher_vr*B52)"),
        ("VR fin 12 — camionnette alt", f"=MAX({PAC}*(1-d_bev)^{H_},plancher_vr*{PAC})"),
        ("VR fin 12 — camionnette réf", f"=MAX({PRC}*(1-d_diesel)^{H_},plancher_vr*{PRC})"),
        ("VR fin 12 — 1 camion moyen alt", f"=MAX({PAM}*(1-d_bev)^{H_},plancher_vr*{PAM})"),
        ("VR fin 12 — 1 camion moyen réf", f"=MAX({PRM}*(1-d_diesel)^{H_},plancher_vr*{PRM})"),
        ("VR fin 12 — infrastructure (linéaire 15 ans)",
         f"={INFRA}*(duree_vie_infra-{H_})/duree_vie_infra"),
    ]
    r = 47
    for lab, f in derived:
        ws.cell(row=r, column=1, value=lab)
        c = ws.cell(row=r, column=2, value=f); c.fill = FILL_CALC
        r += 1
    KWH_TOT = "$B$50"
    PRACHAT_A, PRACHAT_R = "$B$51", "$B$52"
    VR10A, VR10R = "$B$53", "$B$54"
    VR12_VLA, VR12_VLR = "$B$55", "$B$56"
    VR12_CA, VR12_CR = "$B$57", "$B$58"
    VR12_MA, VR12_MR, VR12_I = "$B$59", "$B$60", "$B$61"

    # répartition de l'infra au prorata des kWh de l'année 1
    ws["A63"] = "Répartition de l'infrastructure (prorata kWh compteur an 1)"; ws["A63"].font = BOLD
    alloc = [
        ("Part véhicule léger 1", f"=B47/{KWH_TOT}*{INFRA}"),
        ("Part véhicule léger 2", f"=B47/{KWH_TOT}*{INFRA}"),
        ("Part camionnette", f"=B48/{KWH_TOT}*{INFRA}"),
        ("Part camion moyen 1", f"=B49/{KWH_TOT}*{INFRA}"),
        ("Part camion moyen 2", f"=B49/{KWH_TOT}*{INFRA}"),
        ("Somme des parts", "=SUM(B64:B68)"),
        ("Contrôle somme = capex", f'=IF(ABS(B69-{INFRA})<0.01,"OK","ÉCART")'),
    ]
    r = 64
    for lab, f in alloc:
        ws.cell(row=r, column=1, value=lab)
        c = ws.cell(row=r, column=2, value=f); c.fill = FILL_CALC
        r += 1

    # tableau annuel
    hdr = 73
    for j, name in enumerate(COLS, start=1):
        c = ws.cell(row=hdr, column=j, value=name); c.font = BOLD
    first = hdr + 1
    H = 12
    for n in range(H + 1):
        row = first + n
        A = f"A{row}"
        ws.cell(row=row, column=1, value=(0 if n == 0 else f"=A{row-1}+1"))
        formulas = [
            # B acq alt : an 0 = 5 véhicules + infra ; an 10 = rachat 2 VL
            f"=IF({A}=0,({NV}*{PAV}+{PAC}+{NM}*{PAM}+{INFRA})*(1+taux_taxes),"
            f"IF({A}={ANREPL},{NV}*{PRACHAT_A}*(1+taux_taxes),0))",
            # C subventions : an 0 = 2 x 7 000 ; an 1 = 2 500 + 2 x 75 000 ; rachat an 10 sans subvention
            f"=IF({A}=0,{NV}*{SUBV},IF({A}=1,{SUBC}+{NM}*{SUBM},0))",
            # D énergie alt
            f"=IF({A}=0,0,{KWH_TOT}*prix_elec*(1+g_elec)^{A})",
            # E entretien alt
            f"=IF({A}=0,0,({NV}*{KMV}*{EAV}+{KMC}*{EAC}+{NM}*{KMM}*{EAM})*(1+g_entretien)^{A})",
            # F opex infra
            f"=IF({A}=0,0,infra_entretien_pct*{INFRA}*(1+g_entretien)^{A})",
            # G résiduels alt : an 10 = VR anciens VL ; an 12 = VR nouveaux VL + camionnette + camions + infra
            f"=IF({A}={ANREPL},{NV}*{VR10A},IF({A}={H_},{NV}*{VR12_VLA}+{VR12_CA}+{NM}*{VR12_MA}+{VR12_I},0))",
            f"=B{row}-C{row}+D{row}+E{row}+F{row}-G{row}",
            # I acq réf
            f"=IF({A}=0,({NV}*{PRV}+{PRC}+{NM}*{PRM})*(1+taux_taxes),"
            f"IF({A}={ANREPL},{NV}*{PRACHAT_R}*(1+taux_taxes),0))",
            # J énergie réf
            f"=IF({A}=0,0,({NV}*{KMV}*{CRV}+{KMC}*{CRC}+{NM}*{KMM}*{CRM})/100*prix_diesel*(1+g_diesel)^{A})",
            # K entretien réf
            f"=IF({A}=0,0,({NV}*{KMV}*{ERV}+{KMC}*{ERC}+{NM}*{KMM}*{ERM})*(1+g_entretien)^{A})",
            # L résiduels réf
            f"=IF({A}={ANREPL},{NV}*{VR10R},IF({A}={H_},{NV}*{VR12_VLR}+{VR12_CR}+{NM}*{VR12_MR},0))",
            f"=I{row}+J{row}+K{row}-L{row}",
            f"=M{row}-H{row}",
            f"=1/(1+taux_r)^{A}",
            f"=H{row}*O{row}",
            f"=M{row}*O{row}",
            (f"=N{row}" if n == 0 else f"=R{row-1}+N{row}"),
            (f"=N{row}*O{row}" if n == 0 else f"=S{row-1}+N{row}*O{row}"),
            f"=IF({A}=0,0,({NV}*{KMV}+{KMC}+{NM}*{KMM})*O{row})",
            f'=IF(R{row}>=0,{A},"")',
            f'=IF(S{row}>=0,{A},"")',
            # W TTW réf : légers/camionnette en fe_leger, camions moyens en fe_lourd
            f"=IF({A}=0,0,(({NV}*{KMV}*{CRV}+{KMC}*{CRC})*fe_leger+{NM}*{KMM}*{CRM}*fe_lourd)/100/1000)",
            f"=W{row}*ratio_wtw",
            f"=IF({A}=0,0,{KWH_TOT}*fe_elec/1000000)",
        ]
        for j, f in enumerate(formulas, start=2):
            c = ws.cell(row=row, column=j, value=f); c.fill = FILL_CALC
    last = first + H
    write_results(ws, 6, first, last, H_, res_row=last + 3)
    style_table(ws, hdr, last)
    return ws


# ---------------------------------------------------------------------------
def main():
    wb = Workbook()
    build_hypotheses(wb)
    for spec in CASES:
        build_case_simple(wb, spec)
    build_case6(wb)
    out = os.path.abspath(OUT)
    wb.save(out)
    print(f"écrit : {out}")

    # vérification : les cellules de calcul contiennent des formules, pas des valeurs
    wb2 = load_workbook(out)
    n_form = 0
    for name in [f"Cas {i}" for i in range(1, 7)]:
        ws = wb2[name]
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str) and c.value.startswith("="):
                    n_form += 1
        # les cellules de résultats (colonne B du bloc Résultats) doivent être des formules
        for row in ws.iter_rows(min_col=1, max_col=2):
            lab = row[0].value
            if isinstance(lab, str) and lab.startswith(("TCO actualisé", "VAN", "Délai", "CO2e", "Coût")):
                v = row[1].value
                assert isinstance(v, str) and v.startswith("="), f"{name}!{row[1].coordinate} n'est pas une formule : {v!r}"
    print(f"vérifié : {n_form} cellules de formule ; toutes les cellules de résultats sont des formules.")


if __name__ == "__main__":
    main()
