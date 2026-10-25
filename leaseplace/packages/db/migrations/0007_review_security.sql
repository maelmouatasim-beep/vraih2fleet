-- Phase 5 : revue des dossiers par la plateforme. Statuts de demande
-- étendus (en revue, compléments demandés, qualifiée), tables de revue
-- réservées à la plateforme, traces IA et évaluations immuables.
-- Listes de valeurs identiques à packages/domain (vérifié par test).

-- ── Contraintes ──────────────────────────────────────────────────────────
ALTER TABLE credit.financing_requests DROP CONSTRAINT requests_status_check;
--> statement-breakpoint
ALTER TABLE credit.financing_requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('draft', 'submitted', 'in_review', 'needs_info', 'qualified', 'cancelled'));
--> statement-breakpoint
ALTER TABLE kyc.documents ADD CONSTRAINT documents_review_status_check
  CHECK (review_status IN ('pending', 'extracted', 'verified', 'rejected'));
--> statement-breakpoint
ALTER TABLE credit.ai_runs
  ADD CONSTRAINT ai_runs_purpose_check CHECK (purpose IN ('document_extraction', 'credit_memo')),
  ADD CONSTRAINT ai_runs_provider_check CHECK (provider IN ('anthropic', 'mock')),
  ADD CONSTRAINT ai_runs_status_check CHECK (status IN ('succeeded', 'failed', 'rejected')),
  ADD CONSTRAINT ai_runs_sha_check CHECK (input_sha256 ~ '^[0-9a-f]{64}$');
--> statement-breakpoint
ALTER TABLE kyc.kyc_checks
  ADD CONSTRAINT kyc_checks_code_check CHECK (code IN (
    'ice_match', 'rc_match', 'legal_name_match', 'director_match', 'id_document_valid',
    'documents_fresh', 'revenue_band_match', 'financials_recent', 'quote_amount_match',
    'extraction_complete')),
  ADD CONSTRAINT kyc_checks_status_check CHECK (status IN ('pass', 'warn', 'fail', 'not_applicable'));
--> statement-breakpoint
ALTER TABLE credit.risk_assessments
  ADD CONSTRAINT risk_assessments_grade_check CHECK (grade IN ('A', 'B', 'C', 'D', 'E')),
  ADD CONSTRAINT risk_assessments_uncapped_grade_check CHECK (uncapped_grade IN ('A', 'B', 'C', 'D', 'E')),
  ADD CONSTRAINT risk_assessments_score_check CHECK (score >= 0 AND score <= 100);
--> statement-breakpoint
ALTER TABLE credit.risk_overrides
  ADD CONSTRAINT risk_overrides_grade_check CHECK (grade IN ('A', 'B', 'C', 'D', 'E')),
  ADD CONSTRAINT risk_overrides_reason_check CHECK (length(trim(reason)) >= 20);
--> statement-breakpoint
ALTER TABLE credit.credit_memos
  ADD CONSTRAINT credit_memos_status_check CHECK (status IN ('draft', 'approved', 'discarded'));
--> statement-breakpoint

-- ── Rôles de revue ───────────────────────────────────────────────────────
CREATE FUNCTION app.is_reviewer() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT app.has_platform_role(ARRAY['platform_admin', 'platform_ops'])
$$;
--> statement-breakpoint

-- ── Documents : effacement par l'entreprise, revue par la plateforme ─────
CREATE OR REPLACE FUNCTION kyc.guard_document_update() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'deleted_at' - 'review_status' - 'review_note')
     IS DISTINCT FROM (to_jsonb(OLD) - 'deleted_at' - 'review_status' - 'review_note')
     OR OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'document immuable (effacement ou revue seulement)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW.review_status, NEW.review_note) IS DISTINCT FROM (OLD.review_status, OLD.review_note)
     AND NOT app.is_reviewer() THEN
    RAISE EXCEPTION 'revue réservée à la plateforme' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- ── Demandes : transitions ≡ requestMachine, qui fait quoi ───────────────
CREATE OR REPLACE FUNCTION credit.guard_request_update() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_content_changed boolean :=
    (to_jsonb(NEW) - 'status' - 'submitted_at' - 'cancelled_at' - 'updated_at' - 'version')
    IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'submitted_at' - 'cancelled_at' - 'updated_at' - 'version');
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF (OLD.status, NEW.status) NOT IN (
      ('draft', 'submitted'), ('draft', 'cancelled'),
      ('submitted', 'in_review'), ('submitted', 'cancelled'),
      ('in_review', 'needs_info'), ('in_review', 'qualified'), ('in_review', 'cancelled'),
      ('needs_info', 'submitted'), ('needs_info', 'cancelled'),
      ('qualified', 'cancelled')
    ) THEN
      RAISE EXCEPTION 'transition interdite : % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    -- Revue : plateforme seulement. Soumission et annulation : l'entreprise.
    IF NEW.status IN ('in_review', 'needs_info', 'qualified') THEN
      IF NOT app.is_reviewer() THEN
        RAISE EXCEPTION 'revue réservée à la plateforme' USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSIF NOT app.has_org_role(NEW.organization_id, ARRAY['company_owner', 'company_member']) THEN
      RAISE EXCEPTION 'action réservée à l''entreprise' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.status = 'submitted' THEN
      IF NOT EXISTS (
        SELECT 1 FROM kyc.consents c
        WHERE c.request_id = NEW.id AND c.purpose = 'processing' AND c.revoked_at IS NULL
      ) THEN
        RAISE EXCEPTION 'consentement requis avant soumission' USING ERRCODE = 'check_violation';
      END IF;
      NEW.submitted_at := now();
    ELSIF NEW.status = 'qualified' THEN
      IF NOT EXISTS (SELECT 1 FROM credit.risk_assessments a WHERE a.request_id = NEW.id)
         OR NOT EXISTS (SELECT 1 FROM credit.credit_memos m WHERE m.request_id = NEW.id AND m.status = 'approved') THEN
        RAISE EXCEPTION 'qualification : indice et note validée requis' USING ERRCODE = 'check_violation';
      END IF;
    ELSIF NEW.status = 'cancelled' THEN
      NEW.cancelled_at := now();
    END IF;
  END IF;
  IF NOT (OLD.status = ANY (ARRAY['draft', 'needs_info'])) AND v_content_changed THEN
    RAISE EXCEPTION 'demande figée pendant la revue' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- Historique : le motif (compléments demandés, anomalies examinées) est
-- passé par la transaction (app.event_note) et visible du client.
CREATE OR REPLACE FUNCTION credit.record_request_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_note text := nullif(current_setting('app.event_note', true), '');
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO credit.request_events (request_id, from_status, to_status, actor_user_id, metadata)
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
      NEW.status,
      app.current_user_id(),
      CASE WHEN v_note IS NULL THEN NULL ELSE jsonb_build_object('note', left(v_note, 1000)) END
    );
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint

-- Pièces jointes : modifiables en brouillon et pendant les compléments.
CREATE OR REPLACE FUNCTION credit.guard_request_document() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_request credit.financing_requests;
BEGIN
  SELECT * INTO v_request FROM credit.financing_requests
    WHERE id = COALESCE(NEW.request_id, OLD.request_id);
  IF v_request.status NOT IN ('draft', 'needs_info') THEN
    RAISE EXCEPTION 'pièces figées pendant la revue' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM kyc.documents d
    WHERE d.id = NEW.document_id AND d.organization_id = v_request.organization_id AND d.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'document d''une autre organisation' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END
$$;
--> statement-breakpoint

-- ── Traces et évaluations : immuables ────────────────────────────────────
CREATE FUNCTION app.deny_change() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% : enregistrement immuable', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER ai_runs_immutable BEFORE UPDATE OR DELETE ON credit.ai_runs
  FOR EACH ROW EXECUTE FUNCTION app.deny_change();
--> statement-breakpoint
CREATE TRIGGER document_extractions_immutable BEFORE UPDATE OR DELETE ON kyc.document_extractions
  FOR EACH ROW EXECUTE FUNCTION app.deny_change();
--> statement-breakpoint
CREATE TRIGGER kyc_checks_immutable BEFORE UPDATE OR DELETE ON kyc.kyc_checks
  FOR EACH ROW EXECUTE FUNCTION app.deny_change();
--> statement-breakpoint
CREATE TRIGGER risk_assessments_immutable BEFORE UPDATE OR DELETE ON credit.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION app.deny_change();
--> statement-breakpoint
CREATE TRIGGER risk_overrides_immutable BEFORE UPDATE OR DELETE ON credit.risk_overrides
  FOR EACH ROW EXECUTE FUNCTION app.deny_change();
--> statement-breakpoint

-- Note de synthèse : contenu figé ; un brouillon est approuvé ou écarté une fois.
CREATE FUNCTION credit.guard_credit_memo() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'une note ne se supprime pas' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'decided_by' - 'decided_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'decided_by' - 'decided_at')
     OR OLD.status <> 'draft' OR NEW.status NOT IN ('approved', 'discarded')
     OR NEW.decided_by IS DISTINCT FROM app.current_user_id() THEN
    RAISE EXCEPTION 'note figée (approbation ou rejet unique du brouillon)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.decided_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER credit_memos_guard BEFORE UPDATE OR DELETE ON credit.credit_memos
  FOR EACH ROW EXECUTE FUNCTION credit.guard_credit_memo();
--> statement-breakpoint

-- ── Row Level Security ───────────────────────────────────────────────────
DROP POLICY app_update ON credit.financing_requests;
--> statement-breakpoint
CREATE POLICY app_update ON credit.financing_requests FOR UPDATE TO lp_app
  USING (app.has_org_role(organization_id, ARRAY['company_owner', 'company_member']) AND status <> 'cancelled')
  WITH CHECK (app.has_org_role(organization_id, ARRAY['company_owner', 'company_member']));
--> statement-breakpoint
CREATE POLICY app_review ON credit.financing_requests FOR UPDATE TO lp_app
  USING (app.is_reviewer())
  WITH CHECK (app.is_reviewer());
--> statement-breakpoint
CREATE POLICY app_review ON kyc.documents FOR UPDATE TO lp_app
  USING (app.is_reviewer())
  WITH CHECK (app.is_reviewer());
--> statement-breakpoint

ALTER TABLE credit.ai_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE kyc.document_extractions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE kyc.kyc_checks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit.risk_assessments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit.risk_overrides ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit.credit_memos ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY app_read ON credit.ai_runs FOR SELECT TO lp_app USING (app.is_reviewer());
--> statement-breakpoint
CREATE POLICY app_insert ON credit.ai_runs FOR INSERT TO lp_app
  WITH CHECK (app.is_reviewer() AND created_by = app.current_user_id());
--> statement-breakpoint
CREATE POLICY app_read ON kyc.document_extractions FOR SELECT TO lp_app USING (app.is_reviewer());
--> statement-breakpoint
CREATE POLICY app_insert ON kyc.document_extractions FOR INSERT TO lp_app
  WITH CHECK (app.is_reviewer() AND EXISTS (
    SELECT 1 FROM kyc.documents d
    WHERE d.id = document_id AND d.organization_id = document_extractions.organization_id
  ));
--> statement-breakpoint
CREATE POLICY app_read ON kyc.kyc_checks FOR SELECT TO lp_app USING (app.is_reviewer());
--> statement-breakpoint
CREATE POLICY app_insert ON kyc.kyc_checks FOR INSERT TO lp_app
  WITH CHECK (app.is_reviewer() AND EXISTS (
    SELECT 1 FROM credit.financing_requests r
    WHERE r.id = request_id AND r.organization_id = kyc_checks.organization_id
  ));
--> statement-breakpoint
CREATE POLICY app_read ON credit.risk_assessments FOR SELECT TO lp_app USING (app.is_reviewer());
--> statement-breakpoint
CREATE POLICY app_insert ON credit.risk_assessments FOR INSERT TO lp_app
  WITH CHECK (app.is_reviewer() AND created_by = app.current_user_id() AND EXISTS (
    SELECT 1 FROM credit.financing_requests r
    WHERE r.id = request_id AND r.organization_id = risk_assessments.organization_id
  ));
--> statement-breakpoint
CREATE POLICY app_read ON credit.risk_overrides FOR SELECT TO lp_app USING (app.is_reviewer());
--> statement-breakpoint
-- Correction de l'indice : permission score.override (administrateur et opérations).
CREATE POLICY app_insert ON credit.risk_overrides FOR INSERT TO lp_app
  WITH CHECK (app.is_reviewer() AND created_by = app.current_user_id());
--> statement-breakpoint
CREATE POLICY app_read ON credit.credit_memos FOR SELECT TO lp_app USING (app.is_reviewer());
--> statement-breakpoint
CREATE POLICY app_insert ON credit.credit_memos FOR INSERT TO lp_app
  WITH CHECK (app.is_reviewer() AND created_by = app.current_user_id() AND status = 'draft');
--> statement-breakpoint
CREATE POLICY app_update ON credit.credit_memos FOR UPDATE TO lp_app
  USING (app.is_reviewer())
  WITH CHECK (app.is_reviewer());
--> statement-breakpoint

-- ── Privilèges ───────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION app.is_reviewer() FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app.deny_change() FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION credit.guard_credit_memo() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.is_reviewer() TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON credit.ai_runs, kyc.document_extractions, kyc.kyc_checks,
  credit.risk_assessments, credit.risk_overrides TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON credit.credit_memos TO lp_app;
