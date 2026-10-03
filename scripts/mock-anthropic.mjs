#!/usr/bin/env node
/**
 * FAUX serveur de l'API Claude (POST /v1/messages), pour les tests de bout
 * en bout UNIQUEMENT — jamais utilisé en production. Réponses SCRIPTÉES et
 * déterministes : il demande un outil selon la question, puis rédige une
 * réponse avec les nombres EXACTS du résultat d'outil (comme doit le faire
 * le vrai modèle). Une question contenant « invente » renvoie d'abord un
 * chiffre inventé, pour vérifier que la fonction `copilot` le rejette et
 * redemande une réponse.
 * Import intelligent (sortie structurée json_schema) : correspondance
 * scriptée par mots-clés d'entête, plus UNE entête inventée et UN libellé
 * absent des données, que la fonction `fleet-import` doit rejeter.
 *
 *   node scripts/mock-anthropic.mjs [port]   (défaut 35563, écoute 0.0.0.0)
 *
 * Note au conseil (json_schema à sections) : un PREMIER brouillon contient
 * un chiffre en clair (rejeté par la fonction `council-note`), le second
 * n'utilise que des jetons {{fait}} de la liste reçue.
 *
 * La fonction Edge l'atteint via ANTHROPIC_BASE_URL=http://host.docker.internal:<port>.
 */
import http from "node:http";

const PORT = Number(process.argv[2] ?? process.env.MOCK_ANTHROPIC_PORT ?? 35563);
const fr = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 });
const appels = [];

function message(content, stop_reason) {
  return {
    id: `msg_mock_${appels.length}`,
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 180, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  };
}

const outil = (name, input) =>
  message([{ type: "tool_use", id: `toolu_mock_${appels.length}`, name, input }], "tool_use");
const texte = (t) => message([{ type: "text", text: t }], "end_turn");

/** Import intelligent : correspondance déterministe d'après les entêtes reçues. */
function correspondanceImport(corps) {
  const { colonnes = [] } = JSON.parse(String(corps.messages?.[0]?.content ?? "{}"));
  const regles = [
    [/asset|unit|[ée]quipement/i, "unit_number", "sure", ""],
    [/descr|type/i, "category", "probable", ""],
    [/[ée]nergie|energy|fuel/i, "fuel_type", "sure", ""],
    [/odo|mi\)/i, "annual_km", "sure", "mi"],
    [/mpg/i, "consumption_per_100km", "probable", "mpg_us"],
    [/yard|site|emplacement/i, "depot", "sure", ""],
    [/^yr$|year|ann[ée]e/i, "model_year", "sure", ""],
    [/statut|status/i, "status", "sure", ""],
  ];
  const sorties = colonnes.map((c) => {
    const r = regles.find(([re]) => re.test(c.entete));
    return r ? { entete: c.entete, champ: r[1], certitude: r[2], unite: r[3] } : { entete: c.entete, champ: "ignorer", certitude: "incertaine", unite: "" };
  });
  sorties.push({ entete: "Colonne fantôme", champ: "vin", certitude: "sure", unite: "" });
  const libelles = {
    category: { "Pickup F-150": "camionnette", "Pickup 3/4 t": "camionnette", "Fourgon aménagé": "camionnette" },
    fuel_type: { Gas: "essence" },
    status: { "En service": "actif", "Hors service": "inactif" },
  };
  const valeurs = [];
  for (const c of colonnes) {
    const s = sorties.find((x) => x.entete === c.entete);
    const table = libelles[s?.champ];
    if (!table) continue;
    for (const v of c.valeursDistinctes ?? []) {
      if (table[v]) valeurs.push({ champ: s.champ, source: v, cible: table[v], certitude: "sure" });
      else if (s.champ === "category" || s.champ === "fuel_type") valeurs.push({ champ: s.champ, source: v, cible: "", certitude: "incertaine" });
    }
  }
  valeurs.push({ champ: "fuel_type", source: "Libellé inventé", cible: "diesel", certitude: "sure" });
  return { colonnes: sorties, valeurs };
}

/** Nombre écrit à la française (« 6 411,55 ») → 6411.55. */
const nombreFr = (t) => Number(String(t).replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));

/** Lecture de facture : valeurs trouvées dans le texte transmis. */
function extractionDocument(corps) {
  const blocs = corps.messages?.[0]?.content ?? [];
  const brut = (Array.isArray(blocs) ? blocs : []).map((b) => b.text ?? "").join("\n");
  const doc = (brut.match(/<document>([\s\S]*)<\/document>/) ?? [])[1] ?? "";
  const ligneGarages = String(corps.system ?? "").split("\n").find((l) => l.includes("parmi ces garages")) ?? "";
  const garages = [...ligneGarages.matchAll(/« ([^»]+) »/g)].map((m) => m[1].trim());
  const champs = [];
  const ajout = (champ, re, extraitDe = (m) => m[0]) => {
    const m = doc.match(re);
    if (m) champs.push({ champ, valeur_nombre: nombreFr(m[1]), valeur_texte: "", extrait: extraitDe(m).trim().slice(0, 120), page: 1, certitude: "sure" });
  };
  const premiereLigne = doc.split("\n").map((l) => l.trim()).find((l) => l && !/^\[page \d+\]$/.test(l)) ?? "";
  if (/Soumission/i.test(doc)) {
    const vehicule = doc.match(/Véhicule\s+(.+?)\s+—\s+(100 % électrique|électrique|hydrogène)/i);
    if (vehicule) {
      champs.push({ champ: "technologie", valeur_nombre: null, valeur_texte: vehicule[2], extrait: vehicule[0].trim(), page: 1, certitude: "sure" });
      const [marque, ...modele] = vehicule[1].trim().split(/\s+/);
      champs.push({ champ: "marque", valeur_nombre: null, valeur_texte: marque, extrait: vehicule[1].trim(), page: 1, certitude: "sure" });
      champs.push({ champ: "modele", valeur_nombre: null, valeur_texte: modele.join(" "), extrait: vehicule[1].trim(), page: 1, certitude: "probable" });
    }
    ajout("quantite", /Quantité\s+(\d+)/);
    ajout("prix_unitaire_avant_taxes", /Prix unitaire avant taxes\s+([\d\s\u00a0]+,\d{2})/);
    ajout("montant_avant_taxes", /Sous-total avant taxes\s+([\d\s\u00a0]+,\d{2})/);
    return {
      type_detecte: "vehicle_quote",
      fournisseur: premiereLigne.split(" — ")[0].trim(),
      date_document: (doc.match(/\d{4}-\d{2}-\d{2}/) ?? [""])[0],
      garage_propose: "",
      champs,
    };
  }
  if (/diesel/i.test(doc)) champs.push({ champ: "carburant", valeur_nombre: null, valeur_texte: "diesel", extrait: "diesel", page: 1, certitude: "sure" });
  ajout("litres", /([\d\s\u00a0]+(?:,\d+)?)\s*L\b/);
  ajout("montant_avant_taxes", /Sous-total[^\d]*([\d\s\u00a0]+,\d{2})/);
  ajout("montant_tps", /TPS[^\d]*\(5 %\)[^\d]*([\d\s\u00a0]+,\d{2})/);
  ajout("montant_tvq", /TVQ[^\d]*\([\d,]+ %\)[^\d]*([\d\s\u00a0]+,\d{2})/);
  const total = doc.match(/\n\s*Total[^\d]*([\d\s\u00a0]+,\d{2})/);
  if (total) champs.push({ champ: "montant_total", valeur_nombre: nombreFr(total[1]) + 100, valeur_texte: "", extrait: total[0].trim(), page: 1, certitude: "probable" });
  return {
    type_detecte: "fuel_invoice",
    fournisseur: premiereLigne.split(" — ")[0].trim(),
    date_document: (doc.match(/\d{4}-\d{2}-\d{2}/) ?? [""])[0],
    garage_propose: garages.find((g) => doc.includes(g)) ?? "",
    champs,
  };
}

function noteConseil(corps) {
  const messages = corps.messages ?? [];
  const premier = String(messages[0]?.content ?? "");
  const faits = JSON.parse(premier.match(/<faits>\n([\s\S]*)\n<\/faits>/)?.[1] ?? "[]");
  const ids = new Set(faits.map((f) => f.id));
  const j = (id, sinon = "") => (ids.has(id) ? `{{${id}}}` : sinon);
  const correction = messages.some((m) => m.role === "user" && String(m.content).startsWith("[Vérification]"));
  const couts = correction
    ? `Le plan coûte ${j("tco_plan")} en valeur actualisée contre ${j("tco_statu_quo")} pour le statu quo. La récupération actualisée est de ${j("recuperation")}.`
    : "Le plan économise 1 234 567 $ sur dix ans.";
  return {
    recommandation: String(faits.find((f) => f.id === "van_centrale")?.valeur ?? "").trim().startsWith("-")
      ? `Il est recommandé de revoir le plan avant de l'adopter : dans le scénario central, il coûte ${j("ecart_central_abs")} de plus que le statu quo en valeur actualisée, et il n'est gagnant que dans ${j("scenarios_gagnants")} des ${j("nb_scenarios")} scénarios du stress test.`
      : `Il est recommandé d'adopter le plan « ${j("strategie_retenue")} » : il économise ${j("van_centrale")} en valeur actualisée et reste gagnant dans ${j("scenarios_gagnants")} des ${j("nb_scenarios")} scénarios du stress test.`,
    contexte: `${j("organisation")} exploite ${j("nb_vehicules")} véhicules ; le plan en remplace ${j("nb_ze")} par des véhicules zéro émission sur ${j("horizon_ans")}.`,
    couts,
    financement: `L'investissement total atteint ${j("investissement_total")}, dont ${j("subventions_total")} de subventions prévues ; le reste à financer est de ${j("reste_a_financer")}.`,
    risques: `Dans le scénario prudent, la VAN est de ${j("van_prudente")} ; le niveau de risque est ${j("niveau_risque")}.`,
    hiver: `Sur ${j("nb_bev")} véhicules électriques à batterie, ${j("hiver_tient")} tiennent l'hiver sur la recharge de nuit.`,
    prochaines_etapes: `- Lancer les appels d'offres des premiers achats.\n- Déposer les demandes de subvention avant l'achat.\n- Présenter un suivi annuel au conseil.`,
  };
}

function repondre(corps) {
  const schema = corps.output_config?.format?.schema;
  if (schema?.properties?.recommandation) return texte(JSON.stringify(noteConseil(corps)));
  if (schema?.properties?.type_detecte) return texte(JSON.stringify(extractionDocument(corps)));
  if (corps.output_config?.format?.type === "json_schema") return texte(JSON.stringify(correspondanceImport(corps)));
  const messages = corps.messages ?? [];
  // Question du tour = DERNIER message utilisateur en texte simple (les
  // précédents de l'historique viennent avant).
  const question = String([...messages].reverse().find((m) => m.role === "user" && typeof m.content === "string")?.content ?? "");
  const dernier = messages[messages.length - 1];
  const blocs = Array.isArray(dernier?.content) ? dernier.content : [];
  const correction = blocs.find((b) => b.type === "text" && String(b.text).startsWith("[Vérification"));
  const resultat = blocs.find((b) => b.type === "tool_result");

  if (correction) return texte("Je reprends sans chiffre non vérifié : la simulation est disponible à l'étape Stratégies.");
  if (!resultat) {
    if (/invente/i.test(question)) return texte("L'économie serait de 987 654 $ selon mes estimations.");
    if (/diesel/i.test(question)) return outil("simuler", { prix: { carburants_pct: -20 }, stress_test: true });
    if (/budget/i.test(question)) return outil("optimiser", { budget_investissement_annuel: 500000 });
    if (/repouss|report/i.test(question)) return outil("simuler", { decaler: { categories: ["camionnette", "autobus_urbain_12m"], ans: 2 } });
    return outil("lire_projet", { sections: ["resume"] });
  }

  const r = JSON.parse(resultat.content);
  if (r.plan_simule) {
    const lignes = [
      `Avec ${r.variations_prix_pct ? "le diesel à −20 %" : "ce changement"}, l'économie du plan passe de **${fr.format(r.plan_actuel.economie_van)} $** à **${fr.format(r.plan_simule.economie_van)} $** (source : ${r.source}).`,
    ];
    if (r.stress_test) {
      lignes.push(
        `- Stress test : le plan reste gagnant dans ${r.stress_test.scenarios_gagnants} scénarios sur ${r.stress_test.scenarios_total} (prudent : ${fr.format(r.stress_test.scenario_prudent_van)} $).`,
      );
    }
    if (r.proposition) lignes.push(`- ${r.proposition.vehicules_modifies} véhicule(s) changeraient : vous pouvez appliquer la proposition avec « Appliquer au plan ».`);
    return texte(lignes.join("\n"));
  }
  if (r.contraintes_utilisees) {
    const v = r.resultat ? `${fr.format(r.resultat.economie_van)} $` : "non calculable";
    return texte(
      `Avec un budget d'investissement de ${fr.format(r.contraintes_utilisees.budget_investissement_annuel)} $ par an, l'optimiseur obtient une économie de **${v}** (${r.realisable ? "toutes les contraintes respectées" : "contraintes non toutes respectées"} ; source : ${r.source}).` +
        (r.proposition ? `\n- ${r.proposition.vehicules_modifies} véhicule(s) changeraient d'année ou de technologie : proposition applicable après aperçu.` : ""),
    );
  }
  if (r.resume) {
    return texte(`Le plan actuel compte ${r.resume.plan?.vehicules ?? 0} véhicules ; économie : ${fr.format(r.resume.plan?.economie_van ?? 0)} $ (source : ${r.resume.source}).`);
  }
  return texte("Résultat reçu.");
}

http
  .createServer((req, res) => {
    if (req.method === "GET" && req.url === "/appels") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(appels));
      return;
    }
    let brut = "";
    req.on("data", (c) => (brut += c));
    req.on("end", () => {
      try {
        const corps = JSON.parse(brut || "{}");
        appels.push({
          url: req.url,
          model: corps.model,
          outils: (corps.tools ?? []).map((t) => t.name),
          thinking: corps.thinking,
          tool_choice: corps.tool_choice ?? null,
          format: corps.output_config?.format?.type ?? null,
          // pour vérifier la minimisation (aucune colonne personnelle transmise)
          contenuImport: corps.output_config?.format ? String(corps.messages?.[0]?.content ?? "") : null,
        });
        const r = repondre(corps);
        res.writeHead(200, { "content-type": "application/json", "request-id": "req_mock" });
        res.end(JSON.stringify(r));
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: String(e) } }));
      }
    });
  })
  .listen(PORT, "0.0.0.0", () => console.log(`mock Anthropic sur :${PORT}`));
