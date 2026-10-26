/**
 * Évaluation MANUELLE du fournisseur réel (jamais en CI : appels payants).
 * Rédige la note de synthèse du dossier de démonstration avec l'API Claude
 * et la passe au vérificateur (sources, nombres). Usage :
 *   ANTHROPIC_API_KEY=… pnpm --filter @leaseplace/ai eval [nombre d'essais]
 */
import { createAnthropicProvider } from "../anthropic";
import { demoFacts } from "../fixtures.test-helpers";
import { verifyMemo } from "../verify";

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.LP_AI_MODEL;
if (!apiKey || !model) {
  console.error("ANTHROPIC_API_KEY et LP_AI_MODEL requis (évaluation manuelle, appels facturés).");
  process.exit(1);
}
const runs = Number(process.argv[2] ?? "3");
const provider = createAnthropicProvider({ apiKey, model });
const { facts, sourceIds } = demoFacts();
let passed = 0;
for (let i = 1; i <= runs; i++) {
  try {
    const { output, meta } = await provider.writeMemo(facts);
    const issues = verifyMemo(output, facts, sourceIds);
    if (issues.length === 0) passed++;
    console.warn(
      `essai ${String(i)} : ${issues.length === 0 ? "conforme" : `${String(issues.length)} écart(s)`} · ${String(meta.usage.inputTokens)} + ${String(meta.usage.outputTokens)} jetons · ${String(meta.durationMs)} ms`,
    );
    for (const issue of issues)
      console.warn(`  - ${issue.code} (${issue.section ?? "?"}) : ${issue.detail}`);
  } catch (error) {
    console.warn(`essai ${String(i)} : erreur`, error);
  }
}
console.warn(`${String(passed)}/${String(runs)} notes conformes.`);
