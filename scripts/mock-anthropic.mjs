#!/usr/bin/env node
/**
 * FAUX serveur de l'API Claude (POST /v1/messages), pour les tests de bout
 * en bout UNIQUEMENT — jamais utilisé en production. Réponses SCRIPTÉES et
 * déterministes : il demande un outil selon la question, puis rédige une
 * réponse avec les nombres EXACTS du résultat d'outil (comme doit le faire
 * le vrai modèle). Une question contenant « invente » renvoie d'abord un
 * chiffre inventé, pour vérifier que la fonction `copilot` le rejette et
 * redemande une réponse.
 *
 *   node scripts/mock-anthropic.mjs [port]   (défaut 35563, écoute 0.0.0.0)
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

function repondre(corps) {
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
        appels.push({ url: req.url, model: corps.model, outils: (corps.tools ?? []).map((t) => t.name), thinking: corps.thinking, tool_choice: corps.tool_choice ?? null });
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
