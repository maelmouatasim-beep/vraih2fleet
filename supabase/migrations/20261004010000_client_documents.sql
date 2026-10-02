-- =====================================================
-- Phase 5, point 4 — FACTURES ET DEVIS du client (pièces justificatives).
-- Factures de carburant, factures Hydro-Québec, devis de véhicules, de
-- bornes ou de raccordement : le document est conservé (stockage privé,
-- empreinte SHA-256), les valeurs sont extraites (IA ou saisie), puis
-- CONFIRMÉES par l'utilisateur avant d'alimenter la couche « donnée
-- client » (couche 3 de la méthodologie). Le rapport cite la pièce.
-- Migration ADDITIVE ; RLS dès la création ; aucune suppression.
-- =====================================================

-- 1. Stockage privé : chemin = <organization_id>/<uuid>.<ext>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "client documents: members read their organization files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-documents'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "client documents: org writers upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-documents'
    AND public.is_org_writer(((storage.foldername(name))[1])::uuid, auth.uid())
  );
-- Aucune policy UPDATE / DELETE : une pièce justificative est immuable.

-- 2. Registre des pièces
CREATE TABLE public.client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NULL = pièce de l'organisation (factures) ; sinon pièce d'un projet
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('fuel_invoice', 'electricity_invoice', 'vehicle_quote', 'charger_quote', 'grid_quote')),
  storage_path TEXT NOT NULL UNIQUE CHECK (char_length(storage_path) <= 300),
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  -- Fournisseur et date du document (saisis ou extraits, confirmés)
  supplier TEXT CHECK (supplier IS NULL OR char_length(supplier) <= 200),
  document_date DATE,
  -- Valeurs extraites : { champs: [{ champ, valeur, extrait, retrouve, origine }], mode: 'ia'|'manuel' }
  extraction JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Ce qui a été écrit à la confirmation : [{ cible, champ, avant, apres }]
  applied JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (split_part(storage_path, '/', 1) = organization_id::text)
);

CREATE INDEX idx_client_documents_org ON public.client_documents(organization_id, created_at DESC);
CREATE INDEX idx_client_documents_project ON public.client_documents(project_id) WHERE project_id IS NOT NULL;

CREATE TRIGGER trg_client_documents_updated_at
  BEFORE UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cohérence : projet de la même organisation ; une pièce confirmée ou
-- rejetée ne change plus (ni fichier, ni valeurs) ; confirmation datée
-- par la base, au nom de l'utilisateur connecté.
CREATE OR REPLACE FUNCTION public.client_documents_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.id = NEW.project_id AND p.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'le projet n''appartient pas à cette organisation' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'pièce déjà %', OLD.status USING ERRCODE = '42501';
    END IF;
    IF NEW.organization_id <> OLD.organization_id OR NEW.storage_path <> OLD.storage_path
       OR NEW.sha256 <> OLD.sha256 OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
      RAISE EXCEPTION 'pièce immuable' USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'confirmed' THEN
      NEW.confirmed_by := auth.uid();
      NEW.confirmed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_documents_guard
  BEFORE INSERT OR UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.client_documents_guard();

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client documents: members and project viewers read"
  ON public.client_documents FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR (project_id IS NOT NULL AND public.can_view_project(project_id, auth.uid()))
  );

CREATE POLICY "client documents: org writers add"
  ON public.client_documents FOR INSERT
  WITH CHECK (
    public.is_org_writer(organization_id, auth.uid())
    AND uploaded_by = auth.uid()
    AND status = 'pending'
    AND (project_id IS NULL OR public.can_edit_project(project_id, auth.uid()))
  );

CREATE POLICY "client documents: org writers confirm or reject"
  ON public.client_documents FOR UPDATE
  USING (public.is_org_writer(organization_id, auth.uid()))
  WITH CHECK (
    public.is_org_writer(organization_id, auth.uid())
    AND (project_id IS NULL OR public.can_edit_project(project_id, auth.uid()))
  );
-- Aucune policy DELETE : pièce justificative.

-- 3. Liens « valeur ← pièce » sur les cibles existantes
ALTER TABLE public.energy_client_inputs
  ADD COLUMN diesel_document_id UUID REFERENCES public.client_documents(id) ON DELETE SET NULL,
  ADD COLUMN electricity_document_id UUID REFERENCES public.client_documents(id) ON DELETE SET NULL;

ALTER TABLE public.garages
  ADD COLUMN grid_quote_document_id UUID REFERENCES public.client_documents(id) ON DELETE SET NULL,
  -- Coût unitaire INSTALLÉ d'une borne par type (devis, $ avant taxes) :
  -- { "niveau2": 9500, "rapide50": 48000 } — remplace le coût du registre pour ce garage.
  ADD COLUMN charger_unit_quote JSONB CHECK (charger_unit_quote IS NULL OR jsonb_typeof(charger_unit_quote) = 'object'),
  ADD COLUMN charger_quote_document_id UUID REFERENCES public.client_documents(id) ON DELETE SET NULL;

-- Devis de véhicule (prix d'achat avant taxes de la technologie cible)
ALTER TABLE public.project_vehicles
  ADD COLUMN quote_price NUMERIC CHECK (quote_price IS NULL OR (quote_price > 0 AND quote_price < 10000000)),
  ADD COLUMN quote_technology TEXT CHECK (quote_technology IS NULL OR quote_technology IN ('bev', 'fcev')),
  ADD COLUMN quote_document_id UUID REFERENCES public.client_documents(id) ON DELETE SET NULL,
  ADD CONSTRAINT project_vehicles_quote_complete CHECK ((quote_price IS NULL) = (quote_technology IS NULL));
