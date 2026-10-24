-- Phase 4 : contraintes, invariants et RLS des schémas kyc et credit.
-- Listes de valeurs identiques à packages/domain (vérifiées par test).

-- ── Contraintes ──────────────────────────────────────────────────────────
ALTER TABLE kyc.companies
  ADD CONSTRAINT companies_ice_check CHECK (ice ~ '^\d{15}$'),
  ADD CONSTRAINT companies_legal_form_check
    CHECK (legal_form IN ('sarl', 'sarlau', 'sa', 'sas', 'snc', 'ei', 'auto_entrepreneur', 'other')),
  ADD CONSTRAINT companies_sector_check
    CHECK (sector IN ('transport', 'construction', 'health', 'industry', 'agriculture', 'trade', 'services', 'tech', 'tourism', 'other')),
  ADD CONSTRAINT companies_revenue_band_check
    CHECK (revenue_band IS NULL OR revenue_band IN ('lt_3m', '3m_10m', '10m_50m', '50m_175m', 'gt_175m')),
  ADD CONSTRAINT companies_headcount_band_check
    CHECK (headcount_band IS NULL OR headcount_band IN ('1_9', '10_49', '50_199', '200_plus')),
  ADD CONSTRAINT companies_kyc_status_check
    CHECK (kyc_status IN ('draft', 'submitted', 'in_review', 'verified', 'rejected')),
  ADD CONSTRAINT companies_lengths_check CHECK (
    length(legal_name) BETWEEN 2 AND 200 AND length(city) BETWEEN 2 AND 100
    AND (trade_name IS NULL OR length(trade_name) <= 200)
    AND (address IS NULL OR length(address) <= 300)
  );
--> statement-breakpoint
ALTER TABLE kyc.documents
  ADD CONSTRAINT documents_type_check CHECK (type IN (
    'rc_extract', 'ice_certificate', 'articles', 'director_id', 'appointment_minutes',
    'auto_entrepreneur_card', 'tax_returns', 'business_plan', 'bank_statements',
    'tax_certificate', 'cnss_certificate', 'quote', 'other')),
  ADD CONSTRAINT documents_status_check CHECK (status IN ('clean', 'quarantined', 'rejected')),
  ADD CONSTRAINT documents_mime_check CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  ADD CONSTRAINT documents_size_check CHECK (size_bytes BETWEEN 1 AND 10485760),
  ADD CONSTRAINT documents_sha_check CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT documents_name_check CHECK (length(original_name) BETWEEN 1 AND 255);
--> statement-breakpoint
ALTER TABLE kyc.legal_texts
  ADD CONSTRAINT legal_texts_kind_check CHECK (kind IN ('terms', 'privacy', 'consent_processing')),
  ADD CONSTRAINT legal_texts_locale_check CHECK (locale IN ('fr', 'ar', 'en')),
  ADD CONSTRAINT legal_texts_sha_check CHECK (body_sha256 = encode(sha256(convert_to(body, 'UTF8')), 'hex'));
--> statement-breakpoint
ALTER TABLE kyc.consents
  ADD CONSTRAINT consents_purpose_check CHECK (purpose IN ('processing', 'routing', 'marketing')),
  ADD CONSTRAINT consents_request_fk
    FOREIGN KEY (request_id) REFERENCES credit.financing_requests (id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE credit.financing_requests
  ADD CONSTRAINT requests_status_check CHECK (status IN ('draft', 'submitted', 'cancelled')),
  ADD CONSTRAINT requests_product_check CHECK (product_type IN ('lease', 'ijara')),
  ADD CONSTRAINT requests_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT requests_reference_check CHECK (reference ~ '^LP-\d{4}-\d{6}$'),
  ADD CONSTRAINT requests_category_check CHECK (equipment_category IS NULL OR equipment_category IN (
    'light_vehicle', 'truck', 'trailer', 'construction_machine', 'industrial_machine',
    'medical', 'it', 'agricultural', 'other')),
  ADD CONSTRAINT requests_condition_check CHECK (condition IS NULL OR condition IN ('new', 'used')),
  ADD CONSTRAINT requests_periodicity_check
    CHECK (periodicity IS NULL OR periodicity IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  ADD CONSTRAINT requests_ranges_check CHECK (
    (amount_ht IS NULL OR amount_ht > 0)
    AND vat_rate BETWEEN 0 AND 1
    AND (first_rent_pct IS NULL OR first_rent_pct BETWEEN 0 AND 100)
    AND (residual_pct IS NULL OR residual_pct BETWEEN 0 AND 100)
    AND (duration_months IS NULL OR duration_months BETWEEN 1 AND 120)
    AND (equipment_year IS NULL OR equipment_year BETWEEN 1950 AND 2100)
    AND (equipment_description IS NULL OR length(equipment_description) <= 1000)
    AND (supplier_name IS NULL OR length(supplier_name) <= 200)
  );
--> statement-breakpoint

-- Textes légaux affichés (version 2026-10-22). Le consentement enregistre
-- l'identifiant du texte : son contenu exact est retrouvable.
INSERT INTO kyc.legal_texts (kind, version, locale, body, body_sha256)
SELECT kind, version, locale, body, encode(sha256(convert_to(body, 'UTF8')), 'hex')
FROM (VALUES
  ('consent_processing', '2026-10-22', 'fr',
   'J’autorise LeasePlace à traiter les informations et documents de mon entreprise pour vérifier le dossier, préparer la demande de financement et l’orienter vers des sociétés de crédit-bail. Aucune information ne sera transmise à un bailleur sans mon accord explicite, donné bailleur par bailleur sur la liste nominative qui me sera présentée. Je peux retirer ce consentement à tout moment (loi 09-08).'),
  ('consent_processing', '2026-10-22', 'en',
   'I authorise LeasePlace to process my company’s information and documents to verify the application, prepare the financing request and route it to leasing companies. No information will be sent to any lessor without my explicit consent, given lessor by lessor on the named list that will be presented to me. I can withdraw this consent at any time (Law 09-08).'),
  ('consent_processing', '2026-10-22', 'ar',
   'أأذن لـ LeasePlace بمعالجة معلومات ووثائق مقاولتي للتحقق من الملف وتحضير طلب التمويل وتوجيهه نحو شركات الائتمان الإيجاري. لن تُرسل أي معلومة إلى أي مؤجر دون موافقتي الصريحة، مؤجرًا بمؤجر، على اللائحة الاسمية التي ستُعرض علي. يمكنني سحب هذه الموافقة في أي وقت (القانون 09-08).')
) AS t(kind, version, locale, body);
--> statement-breakpoint

-- ── Fonctions d'appartenance ─────────────────────────────────────────────
CREATE FUNCTION app.has_org_role(p_organization_id uuid, p_roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM identity.memberships m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = app.current_user_id()
      AND m.role = ANY (p_roles)
  )
$$;
--> statement-breakpoint

-- Onboarding : un utilisateur sans organisation crée son entreprise et en
-- devient dirigeant. Seule porte de création d'une organisation « company ».
CREATE FUNCTION kyc.create_company(
  p_legal_name text,
  p_slug text,
  p_ice text,
  p_legal_form text,
  p_sector text,
  p_city text,
  p_incorporation_date date,
  p_revenue_band text,
  p_headcount_band text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user uuid := app.current_user_id();
  v_org uuid := gen_random_uuid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'utilisateur requis' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (SELECT 1 FROM identity.memberships WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'utilisateur déjà rattaché à une organisation' USING ERRCODE = 'unique_violation';
  END IF;
  INSERT INTO identity.organizations (id, name, slug, type) VALUES (v_org, p_legal_name, p_slug, 'company');
  INSERT INTO identity.memberships (id, organization_id, user_id, role)
    VALUES (gen_random_uuid(), v_org, v_user, 'company_owner');
  INSERT INTO kyc.companies (
    organization_id, legal_name, ice, legal_form, sector, city,
    incorporation_date, revenue_band, headcount_band
  ) VALUES (
    v_org, trim(p_legal_name), p_ice, p_legal_form, p_sector, trim(p_city),
    p_incorporation_date, p_revenue_band, p_headcount_band
  );
  RETURN v_org;
END
$$;
--> statement-breakpoint

-- ── Documents : seul l'effacement logique est modifiable ─────────────────
CREATE FUNCTION kyc.guard_document_update() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'deleted_at') IS DISTINCT FROM (to_jsonb(OLD) - 'deleted_at')
     OR OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'document immuable (seul l''effacement est permis)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER documents_guard BEFORE UPDATE ON kyc.documents
  FOR EACH ROW EXECUTE FUNCTION kyc.guard_document_update();
--> statement-breakpoint

-- ── Consentements : immuables, sauf révocation unique ────────────────────
CREATE FUNCTION kyc.guard_consent() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'un consentement ne se supprime pas' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.revoked_at IS NOT NULL
     OR (to_jsonb(NEW) - 'revoked_at' - 'revoked_by') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked_at' - 'revoked_by')
     OR NEW.revoked_at IS NULL OR NEW.revoked_by IS DISTINCT FROM app.current_user_id() THEN
    RAISE EXCEPTION 'consentement immuable (seule la révocation est permise)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER consents_guard BEFORE UPDATE OR DELETE ON kyc.consents
  FOR EACH ROW EXECUTE FUNCTION kyc.guard_consent();
--> statement-breakpoint

-- ── Demandes : référence, machine d'états, historique ────────────────────
CREATE SEQUENCE credit.request_reference_seq;
--> statement-breakpoint
CREATE FUNCTION credit.next_request_reference() RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT 'LP-' || to_char(now() AT TIME ZONE 'Africa/Casablanca', 'YYYY') || '-'
    || lpad(nextval('credit.request_reference_seq')::text, 6, '0')
$$;
--> statement-breakpoint

-- Transitions identiques à requestMachine (packages/domain) ; contenu figé
-- dès la soumission ; soumission impossible sans consentement actif.
CREATE FUNCTION credit.guard_request_update() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_content_changed boolean :=
    (to_jsonb(NEW) - 'status' - 'submitted_at' - 'cancelled_at' - 'updated_at' - 'version')
    IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'submitted_at' - 'cancelled_at' - 'updated_at' - 'version');
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF (OLD.status, NEW.status) NOT IN (('draft', 'submitted'), ('draft', 'cancelled'), ('submitted', 'cancelled')) THEN
      RAISE EXCEPTION 'transition interdite : % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'submitted' THEN
      IF NOT EXISTS (
        SELECT 1 FROM kyc.consents c
        WHERE c.request_id = NEW.id AND c.purpose = 'processing' AND c.revoked_at IS NULL
      ) THEN
        RAISE EXCEPTION 'consentement requis avant soumission' USING ERRCODE = 'check_violation';
      END IF;
      NEW.submitted_at := now();
    ELSIF NEW.status = 'cancelled' THEN
      NEW.cancelled_at := now();
    END IF;
  END IF;
  IF OLD.status <> 'draft' AND v_content_changed THEN
    RAISE EXCEPTION 'demande figée après soumission' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER requests_guard BEFORE UPDATE ON credit.financing_requests
  FOR EACH ROW EXECUTE FUNCTION credit.guard_request_update();
--> statement-breakpoint
CREATE FUNCTION credit.record_request_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO credit.request_events (request_id, from_status, to_status, actor_user_id)
    VALUES (NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status, app.current_user_id());
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER requests_events AFTER INSERT OR UPDATE OF status ON credit.financing_requests
  FOR EACH ROW EXECUTE FUNCTION credit.record_request_event();
--> statement-breakpoint

-- Pièce jointe : même entreprise que la demande, demande encore en brouillon.
CREATE FUNCTION credit.guard_request_document() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_request credit.financing_requests;
BEGIN
  SELECT * INTO v_request FROM credit.financing_requests
    WHERE id = COALESCE(NEW.request_id, OLD.request_id);
  IF v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'pièces figées après soumission' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM kyc.documents d
    WHERE d.id = NEW.document_id AND d.organization_id = v_request.organization_id AND d.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'document d''une autre entreprise ou supprimé' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END
$$;
--> statement-breakpoint
CREATE TRIGGER request_documents_guard BEFORE INSERT OR DELETE ON credit.request_documents
  FOR EACH ROW EXECUTE FUNCTION credit.guard_request_document();
--> statement-breakpoint

-- ── Row Level Security ───────────────────────────────────────────────────
ALTER TABLE kyc.companies ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE kyc.documents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE kyc.legal_texts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE kyc.consents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit.financing_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit.request_documents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit.request_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY app_read ON kyc.companies FOR SELECT TO lp_app
  USING (app.is_member(organization_id) OR app.has_platform_role());
--> statement-breakpoint
CREATE POLICY app_update ON kyc.companies FOR UPDATE TO lp_app
  USING (app.has_org_role(organization_id, ARRAY['company_owner']))
  WITH CHECK (app.has_org_role(organization_id, ARRAY['company_owner']));
--> statement-breakpoint

CREATE POLICY app_read ON kyc.documents FOR SELECT TO lp_app
  USING (app.is_member(organization_id) OR app.has_platform_role());
--> statement-breakpoint
CREATE POLICY app_insert ON kyc.documents FOR INSERT TO lp_app
  WITH CHECK (
    app.has_org_role(organization_id, ARRAY['company_owner', 'company_member'])
    AND uploaded_by = app.current_user_id()
  );
--> statement-breakpoint
CREATE POLICY app_update ON kyc.documents FOR UPDATE TO lp_app
  USING (app.has_org_role(organization_id, ARRAY['company_owner', 'company_member']))
  WITH CHECK (app.has_org_role(organization_id, ARRAY['company_owner', 'company_member']));
--> statement-breakpoint

CREATE POLICY app_read ON kyc.legal_texts FOR SELECT TO lp_app USING (true);
--> statement-breakpoint

CREATE POLICY app_read ON kyc.consents FOR SELECT TO lp_app
  USING (app.is_member(organization_id) OR app.has_platform_role());
--> statement-breakpoint
-- Consentement : réservé au dirigeant (permission consent.grant).
CREATE POLICY app_insert ON kyc.consents FOR INSERT TO lp_app
  WITH CHECK (
    app.has_org_role(organization_id, ARRAY['company_owner'])
    AND granted_by = app.current_user_id()
    AND revoked_at IS NULL
    AND (request_id IS NULL OR EXISTS (
      SELECT 1 FROM credit.financing_requests r
      WHERE r.id = request_id AND r.organization_id = consents.organization_id
    ))
  );
--> statement-breakpoint
CREATE POLICY app_revoke ON kyc.consents FOR UPDATE TO lp_app
  USING (app.has_org_role(organization_id, ARRAY['company_owner']))
  WITH CHECK (app.has_org_role(organization_id, ARRAY['company_owner']));
--> statement-breakpoint

CREATE POLICY app_read ON credit.financing_requests FOR SELECT TO lp_app
  USING (app.is_member(organization_id) OR app.has_platform_role());
--> statement-breakpoint
CREATE POLICY app_insert ON credit.financing_requests FOR INSERT TO lp_app
  WITH CHECK (
    app.has_org_role(organization_id, ARRAY['company_owner', 'company_member'])
    AND created_by = app.current_user_id()
    AND status = 'draft'
  );
--> statement-breakpoint
CREATE POLICY app_update ON credit.financing_requests FOR UPDATE TO lp_app
  USING (app.has_org_role(organization_id, ARRAY['company_owner', 'company_member']) AND status IN ('draft', 'submitted'))
  WITH CHECK (app.has_org_role(organization_id, ARRAY['company_owner', 'company_member']));
--> statement-breakpoint

CREATE POLICY app_read ON credit.request_documents FOR SELECT TO lp_app
  USING (EXISTS (SELECT 1 FROM credit.financing_requests r WHERE r.id = request_id));
--> statement-breakpoint
CREATE POLICY app_write ON credit.request_documents FOR INSERT TO lp_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM credit.financing_requests r
    WHERE r.id = request_id AND app.has_org_role(r.organization_id, ARRAY['company_owner', 'company_member'])
  ));
--> statement-breakpoint
CREATE POLICY app_delete ON credit.request_documents FOR DELETE TO lp_app
  USING (EXISTS (
    SELECT 1 FROM credit.financing_requests r
    WHERE r.id = request_id AND app.has_org_role(r.organization_id, ARRAY['company_owner', 'company_member'])
  ));
--> statement-breakpoint

CREATE POLICY app_read ON credit.request_events FOR SELECT TO lp_app
  USING (EXISTS (SELECT 1 FROM credit.financing_requests r WHERE r.id = request_id));
--> statement-breakpoint

-- ── Privilèges ───────────────────────────────────────────────────────────
REVOKE ALL ON SCHEMA kyc, credit FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA kyc, credit FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app.has_org_role(uuid, text[]) FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA kyc, credit TO lp_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.has_org_role(uuid, text[]) TO lp_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kyc.create_company(text, text, text, text, text, text, date, text, text) TO lp_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION credit.next_request_reference() TO lp_app;
--> statement-breakpoint
GRANT SELECT, UPDATE ON kyc.companies TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON kyc.documents TO lp_app;
--> statement-breakpoint
GRANT SELECT ON kyc.legal_texts TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON kyc.consents TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON credit.financing_requests TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON credit.request_documents TO lp_app;
--> statement-breakpoint
GRANT SELECT ON credit.request_events TO lp_app;
