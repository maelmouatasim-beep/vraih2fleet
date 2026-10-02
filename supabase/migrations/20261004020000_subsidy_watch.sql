-- =====================================================
-- Phase 5, point 5 — VEILLE DES SUBVENTIONS.
-- Le workflow hebdomadaire (GitHub Actions) relit les pages et PDF
-- officiels des programmes, archive le texte lu (data/veille/<date>/) et
-- dépose chaque CHANGEMENT détecté (montant, date, statut — extraits
-- avant → après) dans une FILE DE VALIDATION réservée aux
-- administrateurs H2Fleet (has_role 'admin'). Rien n'est appliqué
-- automatiquement : un changement VALIDÉ devient un « événement de
-- programme », visible par tous et à l'origine d'une alerte pour les
-- projets dont le plan utilise ce programme.
-- Migration ADDITIVE ; RLS dès la création ; aucune suppression.
-- =====================================================

CREATE TABLE public.subsidy_watch_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id TEXT NOT NULL CHECK (char_length(program_id) BETWEEN 1 AND 80),
  source_url TEXT NOT NULL CHECK (source_url ~ '^https://' AND char_length(source_url) <= 500),
  change_kind TEXT NOT NULL CHECK (change_kind IN ('montant', 'date', 'statut')),
  facts_added JSONB NOT NULL DEFAULT '[]'::jsonb,
  facts_removed JSONB NOT NULL DEFAULT '[]'::jsonb,
  excerpt_before TEXT NOT NULL DEFAULT '' CHECK (char_length(excerpt_before) <= 4000),
  excerpt_after TEXT NOT NULL DEFAULT '' CHECK (char_length(excerpt_after) <= 4000),
  -- Chemin du texte archivé dans le dépôt (data/veille/<date>/<source>.txt)
  archive_path TEXT CHECK (archive_path IS NULL OR char_length(archive_path) <= 300),
  dedupe_key TEXT NOT NULL UNIQUE CHECK (char_length(dedupe_key) <= 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  review_note TEXT CHECK (review_note IS NULL OR char_length(review_note) <= 2000),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subsidy_watch_changes_status ON public.subsidy_watch_changes(status, detected_at DESC);

ALTER TABLE public.subsidy_watch_changes ENABLE ROW LEVEL SECURITY;

-- Lecture : administrateurs H2Fleet seulement. Aucune écriture directe :
-- dépôt par le workflow (rôle postgres de l'API de gestion), décision par
-- les fonctions ci-dessous.
CREATE POLICY "subsidy watch: H2Fleet admins read the queue"
  ON public.subsidy_watch_changes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Événements de programme VALIDÉS (lisibles par tout utilisateur connecté)
CREATE TABLE public.subsidy_program_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id UUID NOT NULL UNIQUE REFERENCES public.subsidy_watch_changes(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  change_kind TEXT NOT NULL CHECK (change_kind IN ('montant', 'date', 'statut')),
  summary_fr TEXT NOT NULL CHECK (char_length(summary_fr) BETWEEN 5 AND 1000),
  summary_en TEXT NOT NULL CHECK (char_length(summary_en) BETWEEN 5 AND 1000),
  source_url TEXT NOT NULL,
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subsidy_program_events_program ON public.subsidy_program_events(program_id, validated_at DESC);

ALTER TABLE public.subsidy_program_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subsidy events: signed-in users read"
  ON public.subsidy_program_events FOR SELECT
  TO authenticated
  USING (true);
-- Aucune policy INSERT/UPDATE/DELETE : seule la fonction de validation écrit.

-- Validation : administrateur H2Fleet, changement encore en attente,
-- résumé fr/en (ce que les projets verront). Atomique.
CREATE OR REPLACE FUNCTION public.validate_subsidy_change(_change UUID, _summary_fr TEXT, _summary_en TEXT, _note TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.subsidy_watch_changes;
  _id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'réservé aux administrateurs H2Fleet' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _c FROM public.subsidy_watch_changes WHERE id = _change FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'changement introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF _c.status <> 'pending' THEN
    RAISE EXCEPTION 'changement déjà traité' USING ERRCODE = '42501';
  END IF;
  UPDATE public.subsidy_watch_changes
     SET status = 'validated', review_note = _note, reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = _change;
  INSERT INTO public.subsidy_program_events (change_id, program_id, change_kind, summary_fr, summary_en, source_url, validated_by)
  VALUES (_change, _c.program_id, _c.change_kind, trim(_summary_fr), trim(_summary_en), _c.source_url, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_subsidy_change(_change UUID, _note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'réservé aux administrateurs H2Fleet' USING ERRCODE = '42501';
  END IF;
  UPDATE public.subsidy_watch_changes
     SET status = 'rejected', review_note = _note, reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = _change AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'changement introuvable ou déjà traité' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_subsidy_change(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_subsidy_change(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_subsidy_change(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_subsidy_change(UUID, TEXT) TO authenticated;
