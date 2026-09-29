-- =====================================================
-- Règle A1 de la revue : « chaque rapport généré FIGE le plan ».
-- Un snapshot immuable par génération de rapport (PDF fr/en, Excel) :
-- version du moteur, empreinte des entrées, paramètres complets et
-- chiffres clés. De nouvelles données (registre, données client,
-- flotte) ne changent JAMAIS un rapport émis : l'application compare
-- l'empreinte courante à celle du dernier snapshot et affiche une
-- bannière « Données mises à jour disponibles » avec l'avant→après —
-- rien ne bouge sans action de l'utilisateur (regénérer un rapport).
-- Migration ADDITIVE ; RLS dès la création ; lignes IMMUABLES
-- (aucune politique UPDATE, suppression seulement via le projet).
-- =====================================================
CREATE TABLE public.report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  strategy_key TEXT NOT NULL CHECK (strategy_key IN ('plan_actuel', 'tout_electrique', 'economies_d_abord')),
  report_kind TEXT NOT NULL CHECK (report_kind IN ('pdf_fr', 'pdf_en', 'xlsx')),
  engine_version TEXT NOT NULL,
  -- Empreinte des ENTRÉES du moteur (fingerprint.ts) : même empreinte +
  -- même version = mêmes chiffres au cent près.
  fingerprint TEXT NOT NULL,
  -- Paramètres complets du plan (ParametresProjet) + libellés « donnée
  -- client » au moment de la génération.
  parameters JSONB NOT NULL,
  van NUMERIC,
  tco_alt NUMERIC,
  tco_ref NUMERIC,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_snapshots_project ON public.report_snapshots(project_id, created_at DESC);

ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report snapshots: project viewers can read"
  ON public.report_snapshots FOR SELECT
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "report snapshots: project editors can insert"
  ON public.report_snapshots FOR INSERT
  WITH CHECK (public.can_edit_project(project_id, auth.uid()) AND created_by = auth.uid());

-- PAS de politique UPDATE ni DELETE : un snapshot de rapport émis est
-- immuable (il disparaît seulement avec son projet, par cascade).
