-- =====================================================
-- Phase 5, point 7 — NOTE AU CONSEIL GÉNÉRÉE.
-- Sommaire décisionnel (fr ou en) rédigé depuis l'étape Rapports : les
-- chiffres sont des FAITS calculés par le moteur (jetons {{fait}} dans le
-- texte rédigé par l'IA, remplacés par l'application) ; l'utilisateur
-- édite le texte, chaque nombre est vérifié contre ces faits avant tout
-- export. Chaque export PDF ou Word FIGE le plan dans un snapshot de
-- rapport (report_snapshots, kinds note_pdf / note_docx) auquel la note
-- est liée. Migration ADDITIVE ; RLS dès la création ; aucune suppression.
-- =====================================================

ALTER TABLE public.report_snapshots DROP CONSTRAINT IF EXISTS report_snapshots_report_kind_check;
ALTER TABLE public.report_snapshots
  ADD CONSTRAINT report_snapshots_report_kind_check
  CHECK (report_kind IN ('pdf_fr', 'pdf_en', 'xlsx', 'note_pdf', 'note_docx'));

CREATE TABLE public.council_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('fr', 'en')),
  -- Texte par section (contexte, recommandation, couts, financement,
  -- risques, hiver, prochaines_etapes), tel qu'édité par l'utilisateur.
  sections JSONB NOT NULL CHECK (jsonb_typeof(sections) = 'object' AND pg_column_size(sections) <= 60000),
  -- Faits du moteur utilisés (identifiant → valeur et rendu fr/en).
  facts JSONB NOT NULL CHECK (jsonb_typeof(facts) = 'array' AND pg_column_size(facts) <= 60000),
  source TEXT NOT NULL CHECK (source IN ('ia', 'modele')),
  engine_version TEXT NOT NULL CHECK (char_length(engine_version) <= 20),
  fingerprint TEXT NOT NULL CHECK (char_length(fingerprint) <= 80),
  -- Dernier export (PDF ou Word) : snapshot figé du plan.
  report_snapshot_id UUID REFERENCES public.report_snapshots(id) ON DELETE SET NULL,
  exported_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_council_notes_project ON public.council_notes(project_id, updated_at DESC);

ALTER TABLE public.council_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "council notes: project viewers read"
  ON public.council_notes FOR SELECT
  TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "council notes: project editors insert"
  ON public.council_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_project(project_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "council notes: project editors update"
  ON public.council_notes FOR UPDATE
  TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
-- Aucune policy DELETE : une note n'est jamais supprimée.

-- Projet, auteur et date de création verrouillés ; auteur de la
-- modification et date signés par la base ; le snapshot lié doit
-- appartenir au même projet.
CREATE OR REPLACE FUNCTION public.council_notes_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.project_id := OLD.project_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  IF NEW.report_snapshot_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.report_snapshots r WHERE r.id = NEW.report_snapshot_id AND r.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'snapshot d''un autre projet' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER council_notes_guard
  BEFORE INSERT OR UPDATE ON public.council_notes
  FOR EACH ROW EXECUTE FUNCTION public.council_notes_guard();
