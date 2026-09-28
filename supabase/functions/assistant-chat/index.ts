// assistant-chat — proxy LLM fermé :
// - JWT obligatoire ;
// - limite de débit par utilisateur (fenêtre glissante en table) ;
// - tailles bornées (message, historique), rôles limités à user/assistant
//   (impossible d'injecter un message system) ;
// - context validé (zod) et traité comme donnée dans le prompt.
import { handleOptions, jsonResponse, corsHeaders as buildCorsHeaders } from "../_shared/cors.ts";
import { getUserOrThrow, HttpError, serviceRoleClient } from "../_shared/auth.ts";
import { parseJsonBody, ValidationError, z } from "../_shared/validation.ts";

const RATE_LIMIT = 30;            // requêtes
const RATE_WINDOW_MINUTES = 10;   // par fenêtre glissante

async function checkUserRateLimit(userId: string): Promise<boolean> {
  const admin = serviceRoleClient();
  const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await admin
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('bucket', 'assistant-chat')
    .eq('caller', userId)
    .gte('created_at', windowStart);
  if (error) {
    console.error('rate limit check failed:', error.message);
    return true;
  }
  if ((count ?? 0) >= RATE_LIMIT) return false;
  await admin.from('rate_limit_events').insert({ bucket: 'assistant-chat', caller: userId });
  return true;
}

// Donnée bornée, jamais une instruction : une seule ligne, longueur limitée.
function asPromptData(value: string, maxLength: number): string {
  return value.replace(/[\r\n]+/g, ' ').slice(0, maxLength);
}

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional()
    .default([]),
  context: z
    .object({
      current_url: z.string().max(300).optional(),
      page_type: z.string().max(60).optional(),
      time_on_page: z.number().min(0).max(86_400).optional(),
      has_projects: z.boolean().optional(),
      has_scenarios: z.boolean().optional(),
    })
    .optional(),
});

// ============================================
// Base de connaissances RÉALIGNÉE sur le parcours 7 étapes et le moteur
// src/lib/tco (Phase 3). RÈGLE : AUCUN chiffre figé ici — les montants,
// prix et statuts vivent dans le registre d'hypothèses et le registre
// des programmes, affichés dans l'application avec leur source et leur
// date de vérification.

const KNOWLEDGE_BASE: Record<string, Record<string, string>> = {
  produit: {
    "h2fleet planner": `## H2Fleet
H2Fleet aide les flottes (municipalités, sociétés de transport, transporteurs) à produire un plan de remplacement pluriannuel chiffré, finançable et défendable devant un conseil, puis à le suivre.
**Menu (6 entrées)** : Accueil (/dashboard), Projets (/dashboard/projects), Ma flotte (/dashboard/fleet), Bibliothèque (/dashboard/library), Organisation (/dashboard/organization), Aide (/dashboard/help).
**Parcours projet en 7 étapes** : Flotte → Faisabilité → Stratégies → Plan → Financement → Rapports → Suivi, sous /dashboard/projects/:id/{flotte,faisabilite,strategies,plan,financement,rapports,suivi}.`,

    "démarrer h2fleet": `## Démarrer
1. **Ma flotte** (/dashboard/fleet) : saisissez ou importez (CSV/Excel) vos véhicules réels ; la télématique (Geotab/Samsara) peut alimenter kilométrages et consommations.
2. **Projets** : créez un projet (horizon d'analyse et taux d'actualisation modifiables).
3. **Étape Flotte** : sélectionnez les véhicules du projet, l'année de remplacement et la technologie cible de chacun.
4. Les étapes suivantes (Faisabilité, Stratégies, Plan, Financement, Rapports, Suivi) calculent tout avec le moteur TCO — rien à ressaisir.`,

    "étapes du parcours": `## Les 7 étapes
1. **Flotte** : quels véhicules réels sont dans le projet, avec année de remplacement et cible par véhicule.
2. **Faisabilité** : verdict BEV/FCEV par véhicule, chiffré par le moteur (économie/surcoût, récupération, CO2, subventions), réserves affichées (autonomie non modélisée).
3. **Stratégies** : trois stratégies comparées au statu quo + stress test aux bornes sourcées.
4. **Plan** : budget annuel (investissement, subventions, reste à financer, fonctionnement) et remplacements année par année.
5. **Financement** : subventions du plan par véhicule et registre des programmes (statut calculé à partir des dates, source, date de vérification).
6. **Rapports** : PDF fr/en prêt pour le conseil et classeur Excel (.xlsx) avec l'annexe des hypothèses.
7. **Suivi** : réalisé vs prévu et tâches d'équipe liées au véhicule, à l'année et à la subvention.`,

    "télématique connexion": `## Télématique
Connexion Geotab/Samsara depuis /dashboard/telematics. Les consommations importées sont marquées « télématique » ; sans donnée réelle, le moteur utilise le défaut de catégorie, marqué « estimation ». Aucun échec d'API n'est remplacé par des valeurs inventées.`,
  },

  methode: {
    "définition tco": `## Le TCO dans H2Fleet
Le coût total de possession additionne, sur l'horizon du projet : acquisition (taxes non récupérables incluses), énergie, entretien, part d'infrastructure, événements majeurs, moins subventions et valeurs résiduelles.
**Référence (statu quo)** : la même flotte, remplacée aux mêmes années par des diesels neufs équivalents. Les économies n'existent que par rapport à cette référence.
La spécification complète est docs/tco-methodologie.md (annexe des rapports).`,

    "calcul détaillé": `## Conventions du moteur
- Année 0 = acquisition (non actualisée) ; exploitation en fin d'années 1..H.
- Flux NOMINAUX (inflation par poste) actualisés au taux NOMINAL du projet.
- Année d'acquisition PAR VÉHICULE : avant le remplacement prévu, le différentiel est nul.
- Chaque résultat porte la version du moteur et l'empreinte des entrées : la même empreinte reproduit exactement les mêmes chiffres.
Ne recalculez jamais de tête : renvoyez l'utilisateur aux étapes Faisabilité/Stratégies/Plan qui affichent les chiffres réels de SA flotte.`,

    "stress test": `## Incertitude
L'étape Stratégies relance le moteur complet aux bornes SOURCÉES de chaque hypothèse (plages du registre — jamais un ±20 % arbitraire) : trois scénarios (prudent, central, favorable), tornade des paramètres influents, et un niveau de risque CALCULÉ (la stratégie reste-t-elle gagnante au scénario prudent ?).`,

    "hypothèses registre": `## Hypothèses honnêtes
Toutes les hypothèses (prix de l'énergie, facteurs d'émission, taxes, bornes, dépréciation…) vivent dans un registre unique avec, pour chacune : valeur, unité, plage, SOURCE officielle, date de lecture et un statut honnête — « vérifié » (source réellement lue), « estimation » (ordre de grandeur professionnel) ou « à valider » (source non consultée, URL fournie).
Les valeurs exactes sont visibles dans l'application et dans l'annexe des rapports. Ne citez jamais un montant de mémoire : renvoyez à ces écrans.`,
  },

  financement: {
    "subventions programmes": `## Subventions
L'étape **Financement** du parcours affiche : les programmes retenus PAR VÉHICULE du plan (montant, année de versement, cumul plafonné) et le registre des programmes fédéraux et québécois avec un statut CALCULÉ à partir des dates (un programme échu n'est jamais présenté comme actif), la source officielle et la date de la dernière vérification.
Un programme qui se termine avant l'année d'achat prévue n'est PAS compté dans le plan.
Pour tout montant exact : renvoyez à l'étape Financement — ne citez pas de montants de mémoire, ils changent et se vérifient à la source.`,
  },

  conseils: {
    "choisir technologie": `## Choisir une technologie — repères qualitatifs
- **Électrique (BEV)** : souvent avantageux au Québec (électricité peu coûteuse et très peu carbonée — voir les hypothèses vérifiées de la Bibliothèque) ; vérifier l'autonomie pour la longue distance et l'usage hors route (réserves affichées à l'étape Faisabilité, non chiffrées en v1).
- **Hydrogène (FCEV)** : coût d'énergie élevé et réseau de ravitaillement embryonnaire au Québec (réserve systématique affichée) ; pertinent surtout pour des cas d'usage spécifiques.
- **Diesel** : c'est le statu quo de référence, pas une « option » à vendre.
Le verdict CHIFFRÉ par véhicule (économie/surcoût, récupération, CO2 évité) est à l'étape Faisabilité — c'est la seule réponse fiable pour une flotte donnée.`,
  },
};

const KEYWORD_MAP: Record<string, string[]> = {
  "h2fleet planner": ["h2fleet", "plateforme", "application", "site", "outil", "logiciel", "c'est quoi", "menu"],
  "démarrer h2fleet": ["démarrer", "commencer", "guide", "premier", "début", "start", "tutoriel", "importer"],
  "étapes du parcours": ["étape", "parcours", "flotte", "faisabilité", "stratégie", "plan", "rapport", "suivi", "scénario", "scenario"],
  "télématique connexion": ["télématique", "geotab", "samsara", "connecter", "api", "consommation réelle"],
  "définition tco": ["tco", "coût total", "possession", "définition", "signifie", "statu quo", "référence"],
  "calcul détaillé": ["calcul", "formule", "comment calculer", "méthodologie", "actualisation", "horizon", "empreinte"],
  "stress test": ["stress", "sensibilité", "risque", "prudent", "tornade", "incertitude", "scénario prudent"],
  "hypothèses registre": ["hypothèse", "source", "vérifié", "estimation", "à valider", "prix", "tarif", "énergie", "bibliothèque"],
  "subventions programmes": ["subvention", "programme", "aide", "incitatif", "pavé", "roulez vert", "écocamionnage", "fédéral", "provincial", "financement"],
  "choisir technologie": ["électrique", "bev", "hydrogène", "fcev", "diesel", "technologie", "choisir", "batterie", "pile"],
};

function searchKnowledge(query: string, topK: number = 3): string[] {
  const queryLower = query.toLowerCase();
  const results: { key: string; content: string; score: number }[] = [];

  for (const [category, entries] of Object.entries(KNOWLEDGE_BASE)) {
    for (const [key, content] of Object.entries(entries)) {
      let score = 0;

      const keywords = KEYWORD_MAP[key] || key.split(" ");
      for (const keyword of keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 10;
        }
      }

      for (const word of key.split(" ")) {
        if (queryLower.includes(word.toLowerCase()) && word.length > 2) {
          score += 5;
        }
      }

      const contentWords = content.toLowerCase().split(/\s+/);
      const queryWords = queryLower.split(/\s+/);
      for (const qWord of queryWords) {
        if (qWord.length > 3 && contentWords.some(cw => cw.includes(qWord))) {
          score += 2;
        }
      }

      if (score > 0) {
        results.push({ key: `${category}.${key}`, content, score });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK).map(r => r.content);
}

function formatKnowledgeForPrompt(documents: string[]): string {
  if (documents.length === 0) return "";
  return `
## DOCUMENTS DE RÉFÉRENCE H2FLEET
---
${documents.join("\n\n---\n\n")}
---

Utilise ces informations vérifiées pour répondre. Si la question n'est pas couverte, utilise ton expertise générale en indiquant qu'il s'agit d'une estimation.`;
}

// ============================================
// ============================================
// PROMPT SYSTÈME — assistant aligné sur le moteur (aucun chiffre inventé)
// ============================================

const SYSTEM_PROMPT = `Tu es l'assistant de H2Fleet, un outil de planification de la transition des flottes (diesel → électrique/hydrogène) pour le marché québécois et canadien.

## RÈGLE ABSOLUE SUR LES CHIFFRES
- Tu ne cites JAMAIS un prix, un montant de subvention, un pourcentage d'économie ou un délai de récupération de mémoire.
- Les seuls chiffres que tu peux répéter sont ceux présents dans les DOCUMENTS DE RÉFÉRENCE ci-dessous ou fournis par l'utilisateur dans la conversation.
- Pour toute valeur, renvoie l'utilisateur à l'écran qui l'affiche avec sa source et sa date de vérification : étape Faisabilité (verdict par véhicule), Stratégies (comparaison et stress test), Plan (budget annuel), Financement (subventions), Bibliothèque et annexe des rapports (hypothèses).
- Si une information n'est ni dans les documents ni dans la conversation, dis-le simplement et indique où la trouver dans l'application.

## CONTEXTE UTILISATEUR
{context}

{knowledge}

## COMPORTEMENT
- Comprends le besoin, pose une question de clarification si nécessaire (catégorie de véhicules, kilométrage, échéance).
- Guide vers l'étape du parcours qui répond à la question (routes du menu et du parcours dans les documents).
- Reste objectif entre technologies : le verdict chiffré appartient au moteur, pas à toi.
- Mentionne les limites affichées par l'outil (autonomie non modélisée en v1, hypothèses « à valider », montants de subventions non garantis avant acceptation d'une demande).
- Ne donne pas de conseil juridique ou fiscal personnalisé.

## FORMAT
- Réponses courtes et structurées (titres ##, listes), vouvoiement.
- Français par défaut ; réponds en anglais si l'utilisateur écrit en anglais.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  try {
    // Auth et validation d'abord : une mauvaise configuration serveur ne
    // doit pas masquer un 401/400.
    const { user } = await getUserOrThrow(req);
    if (!(await checkUserRateLimit(user.id))) {
      return jsonResponse(
        req,
        { response: "⚠️ Trop de requêtes. Merci de patienter quelques minutes." },
        429,
      );
    }

    const { message, history = [], context } = await parseJsonBody(req, chatRequestSchema, 256 * 1024);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('AI service not configured');
    }

    // Search knowledge base for relevant documents
    const relevantDocs = searchKnowledge(message, 4);
    const knowledgeSection = formatKnowledgeForPrompt(relevantDocs);
    
    // Knowledge search completed

    // Contexte : donnée validée et bornée, jamais interprétée comme instruction
    const contextDetails = context ? `
- **Page actuelle**: "${asPromptData(context.page_type ?? 'inconnue', 60)}" (URL: "${asPromptData(context.current_url ?? 'N/A', 300)}")
- **Temps sur page**: ${Math.round(context.time_on_page ?? 0)} secondes
- **A des projets**: ${context.has_projects ? 'Oui ✓' : 'Non - suggérer de créer un projet'}
- **A des scénarios**: ${context.has_scenarios ? 'Oui ✓' : 'Non - suggérer de créer un scénario'}
` : 'Aucun contexte spécifique fourni';
    
    const systemPrompt = SYSTEM_PROMPT
      .replace('{context}', contextDetails)
      .replace('{knowledge}', knowledgeSection);

    // Build messages array with conversation history
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Historique borné, rôles limités à user/assistant par le schéma zod
    const recentHistory = history.slice(-12);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // AI request prepared

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return jsonResponse(req, { 
          response: '⚠️ Service temporairement surchargé. Veuillez réessayer dans quelques secondes.'
        });
      }
      
      if (response.status === 402) {
        return jsonResponse(req, { 
          response: '⚠️ Les crédits IA sont épuisés. Veuillez contacter l\'administrateur.'
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Streaming response
    
    return new Response(response.body, {
      headers: {
        ...buildCorsHeaders(req),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return jsonResponse(req, { error: error.message }, error.status);
    }
    if (error instanceof ValidationError) {
      return jsonResponse(req, { error: error.message }, 400);
    }
    console.error('Error in assistant-chat function:', error);
    
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    const errorMessage = isAbortError 
      ? '⚠️ La requête a pris trop de temps. Veuillez réessayer.'
      : '⚠️ Erreur temporaire du service. Veuillez réessayer dans un instant.';

    return jsonResponse(req, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      response: errorMessage
    });
  }
});
