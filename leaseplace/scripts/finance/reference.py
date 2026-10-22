#!/usr/bin/env python3
"""Contre-calcul INDÉPENDANT du moteur financier (aucun code partagé avec
packages/domain) : formules fermées en Decimal, TEG par bissection pure.
Usage : python3 scripts/finance/reference.py > packages/domain/src/finance/__fixtures__/reference-cases.json
"""
import json
from decimal import Decimal as D, ROUND_HALF_UP, getcontext

getcontext().prec = 50
MONTHS = {"monthly": 1, "quarterly": 3, "semiannual": 6, "annual": 12}

def cents(x):
    return D(x).quantize(D("0.01"), rounding=ROUND_HALF_UP)

CASES = [
    dict(id="mensuel-echoir-vr1", amount=1_000_000, months=60, per="monthly", timing="advance", rate="0.09", first=None, rv=10_000, fees=2_000, ins=0, ins_req=False),
    dict(id="mensuel-echu-sans-vr", amount=500_000, months=36, per="monthly", timing="arrears", rate="0.075", first=None, rv=0, fees=0, ins=0, ins_req=False),
    dict(id="trimestriel-majore-assurance", amount=2_400_000, months=48, per="quarterly", timing="advance", rate="0.0825", first=480_000, rv=48_000, fees=5_000, ins=1_200, ins_req=True),
    dict(id="taux-zero", amount=120_000, months=12, per="monthly", timing="arrears", rate="0", first=None, rv=0, fees=0, ins=0, ins_req=False),
    dict(id="annuel-echu-vr10", amount=300_000, months=60, per="annual", timing="arrears", rate="0.10", first=None, rv=30_000, fees=0, ins=0, ins_req=False),
    dict(id="semestriel-majore-assurance-facultative", amount=850_000, months=36, per="semiannual", timing="advance", rate="0.069", first=100_000, rv=8_500, fees=1_500, ins=900, ins_req=False),
]

def price(c):
    m = MONTHS[c["per"]]
    n = c["months"] // m
    i = D(c["rate"]) * m / 12
    def t(k):  # échéance du loyer k, en périodes
        return k - 1 if c["timing"] == "advance" else k
    def v(p):
        return (1 + i) ** -p if i else D(1)
    rv_pv = D(c["rv"]) * v(n)
    if c["first"] is None:
        rent = (D(c["amount"]) - rv_pv) / sum(v(t(k)) for k in range(1, n + 1))
        first = rent
    else:
        rent = (D(c["amount"]) - D(c["first"]) * v(t(1)) - rv_pv) / sum(v(t(k)) for k in range(2, n + 1))
        first = D(c["first"])
    return n, m, cents(first), cents(rent)

def npv(r, flows):
    return sum(a / (1 + r) ** t for t, a in flows)

def bisect(flows):
    lo, hi = D("-0.5"), D("1")
    for _ in range(200):
        mid = (lo + hi) / 2
        if (npv(mid, flows) > 0) == (npv(lo, flows) > 0):
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

out = []
for c in CASES:
    n, m, first, rent = price(c)
    vat = D("0.2")
    pay = {}
    def add(month, **kw):
        line = pay.setdefault(month, dict(rent=D(0), fees=D(0), ins=D(0), rv=D(0)))
        for k, x in kw.items():
            line[k] += D(x)
    add(0, fees=c["fees"])
    for k in range(1, n + 1):
        month = (k - 1) * m if c["timing"] == "advance" else k * m
        add(month, rent=first if k == 1 else rent, ins=c["ins"])
    add(c["months"], rv=c["rv"])
    rents = sum(l["rent"] for l in pay.values())
    fees = sum(l["fees"] for l in pay.values())
    ins = sum(l["ins"] for l in pay.values())
    rv = sum(l["rv"] for l in pay.values())
    vat_total = sum(cents((l["rent"] + l["fees"] + l["rv"]) * vat) for l in pay.values())
    paid_ht = rents + fees + ins + rv
    cost = rents + fees + (ins if c["ins_req"] else 0) + rv - c["amount"]
    flows = [(0, D(c["amount"]))]
    for month, l in sorted(pay.items()):
        p = l["rent"] + l["fees"] + l["rv"] + (l["ins"] if c["ins_req"] else 0)
        if p:
            flows.append((month, -p))
    if c["rate"] == "0" and c["fees"] == 0:
        monthly = D(0)
    else:
        monthly = bisect(flows)
    teg = (1 + monthly) ** 12 - 1
    out.append(dict(
        id=c["id"],
        input=dict(financedAmountHt=c["amount"], durationMonths=c["months"], periodicity=c["per"], timing=c["timing"],
                   annualRate=float(c["rate"]), firstRentHt=c["first"], residualValueHt=c["rv"],
                   fileFeesHt=c["fees"], insurancePerPeriodHt=c["ins"], insuranceRequired=c["ins_req"]),
        expected=dict(periods=n, rentHt=float(rent), firstRentHt=float(first), rentsHt=float(rents),
                      paidHt=float(paid_ht), vat=float(vat_total), paidTtc=float(paid_ht + vat_total),
                      financingCostHt=float(cost), annualEffectiveRate=float(teg)),
    ))
print(json.dumps(out, indent=2, ensure_ascii=False))
