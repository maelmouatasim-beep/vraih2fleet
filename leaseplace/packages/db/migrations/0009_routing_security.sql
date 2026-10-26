-- Phase 6 : orientation vers les bailleurs et espace bailleur. Un bailleur
-- ne lit une demande que si elle lui a été transmise ET qu'un consentement
-- actif de l'entreprise le nomme ; il ne voit jamais les offres d'un autre.
-- Listes de valeurs identiques à packages/domain (vérifié par test).

-- ── Contraintes ──────────────────────────────────────────────────────────
ALTER TABLE credit.financing_requests DROP CONSTRAINT requests_status_check;
--> statement-breakpoint
ALTER TABLE credit.financing_requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('draft', 'submitted', 'in_review', 'needs_info', 'qualified', 'routed', 'cancelled'));
--> statement-breakpoint
ALTER TABLE kyc.legal_texts DROP CONSTRAINT legal_texts_kind_check;
--> statement-breakpoint
ALTER TABLE kyc.legal_texts ADD CONSTRAINT legal_texts_kind_check
  CHECK (kind IN ('terms', 'privacy', 'consent_processing', 'consent_routing'));
--> statement-breakpoint
ALTER TABLE credit.lessor_appetites
  ADD CONSTRAINT appetites_grade_check CHECK (min_grade IN ('A', 'B', 'C', 'D', 'E')),
  ADD CONSTRAINT appetites_amount_check CHECK (min_amount_ht > 0 AND max_amount_ht >= min_amount_ht),
  ADD CONSTRAINT appetites_duration_check CHECK (min_duration_months >= 1 AND max_duration_months >= min_duration_months AND max_duration_months <= 120),
  ADD CONSTRAINT appetites_sectors_check CHECK (sectors <@ ARRAY['transport', 'construction', 'health', 'industry', 'agriculture', 'trade', 'services', 'tech', 'tourism', 'other']::text[]),
  ADD CONSTRAINT appetites_categories_check CHECK (categories <@ ARRAY['light_vehicle', 'truck', 'trailer', 'construction_machine', 'industrial_machine', 'medical', 'it', 'agricultural', 'other']::text[]);
--> statement-breakpoint
ALTER TABLE credit.routing_decisions
  ADD CONSTRAINT routing_decisions_grade_check CHECK (grade IN ('A', 'B', 'C', 'D', 'E')),
  ADD CONSTRAINT routing_decisions_max_check CHECK (max_targets BETWEEN 3 AND 5);
--> statement-breakpoint
ALTER TABLE credit.routing_targets
  ADD CONSTRAINT routing_targets_status_check CHECK (status IN ('eligible', 'excluded', 'sent', 'viewed', 'offered', 'declined'));
--> statement-breakpoint
ALTER TABLE credit.target_declines
  ADD CONSTRAINT target_declines_reason_check CHECK (reason IN (
    'outside_appetite', 'insufficient_financials', 'sector_exposure', 'asset_risk',
    'incomplete_file', 'pricing_not_competitive', 'other')),
  ADD CONSTRAINT target_declines_note_check CHECK (reason <> 'other' OR length(trim(coalesce(note, ''))) >= 10);
--> statement-breakpoint
ALTER TABLE market.offers
  ADD CONSTRAINT offers_status_check CHECK (status IN ('submitted', 'withdrawn')),
  ADD CONSTRAINT offers_periodicity_check CHECK (periodicity IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  ADD CONSTRAINT offers_timing_check CHECK (timing IN ('advance', 'arrears')),
  ADD CONSTRAINT offers_amounts_check CHECK (
    financed_amount_ht > 0 AND rent_ht > 0 AND first_rent_ht >= 0 AND residual_value_ht >= 0
    AND file_fees_ht >= 0 AND insurance_per_period_ht >= 0 AND paid_ttc > 0),
  ADD CONSTRAINT offers_rate_check CHECK (annual_rate > 0 AND annual_rate <= 0.3 AND vat_rate >= 0 AND vat_rate < 1),
  ADD CONSTRAINT offers_duration_check CHECK (duration_months BETWEEN 12 AND 120),
  ADD CONSTRAINT offers_conditions_check CHECK (length(conditions) <= 2000);
--> statement-breakpoint

-- Consentement de transmission (loi 09-08), nominatif : les destinataires
-- sont enregistrés dans kyc.consent_recipients.
INSERT INTO kyc.legal_texts (kind, version, locale, body, body_sha256)
SELECT kind, version, locale, body, encode(sha256(convert_to(body, 'UTF8')), 'hex')
FROM (VALUES
  ('consent_routing', '2026-10-26', 'fr',
   'J’autorise LeasePlace à transmettre mon dossier (profil de l’entreprise, demande, pièces justificatives, note de synthèse et indice d’orientation) aux seules sociétés de crédit-bail que j’ai sélectionnées ci-dessus, afin qu’elles étudient ma demande et me fassent une offre. Je peux retirer ce consentement à tout moment : le retrait met fin à l’accès des bailleurs à mon dossier (loi 09-08).'),
  ('consent_routing', '2026-10-26', 'en',
   'I authorise LeasePlace to send my file (company profile, request, supporting documents, credit memo and orientation index) only to the leasing companies I have selected above, so that they can study my request and make me an offer. I can withdraw this consent at any time: withdrawal ends the lessors’ access to my file (Law 09-08).'),
  ('consent_routing', '2026-10-26', 'ar',
   'أأذن لـ LeasePlace بإرسال ملفي (معطيات المقاولة والطلب والوثائق المثبتة ومذكرة التركيب ومؤشر التوجيه) إلى شركات الائتمان الإيجاري التي اخترتها أعلاه دون غيرها، لكي تدرس طلبي وتقدم لي عرضًا. يمكنني سحب هذه الموافقة في أي وقت، ويُنهي السحب ولوج المؤجرين إلى ملفي (القانون 09-08).')
) AS t(kind, version, locale, body);
--> statement-breakpoint

-- ── Visibilité bailleur ──────────────────────────────────────────────────
CREATE FUNCTION app.lessor_sees_request(p_request uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM credit.routing_targets t
    JOIN identity.memberships m
      ON m.organization_id = t.lessor_organization_id AND m.user_id = app.current_user_id()
    WHERE t.request_id = p_request
      AND t.status IN ('sent', 'viewed', 'offered', 'declined')
      AND EXISTS (
        SELECT 1 FROM kyc.consents c
        JOIN kyc.consent_recipients cr ON cr.consent_id = c.id
        WHERE c.request_id = p_request AND c.purpose = 'routing' AND c.revoked_at IS NULL
          AND cr.lessor_organization_id = t.lessor_organization_id
      )
  )
$$;
--> statement-breakpoint
CREATE FUNCTION app.lessor_sees_organization(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM credit.financing_requests r
    WHERE r.organization_id = p_org AND app.lessor_sees_request(r.id)
  )
$$;
--> statement-breakpoint
-- Pièces visibles : le coffre-fort de l'entreprise (hors devis) et les
-- pièces jointes de la demande transmise.
CREATE FUNCTION app.lessor_sees_document(p_document uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM kyc.documents d
    WHERE d.id = p_document AND d.deleted_at IS NULL AND d.status = 'clean'
      AND (
        (d.type <> 'quote' AND app.lessor_sees_organization(d.organization_id))
        OR EXISTS (
          SELECT 1 FROM credit.request_documents rd
          WHERE rd.document_id = d.id AND app.lessor_sees_request(rd.request_id)
        )
      )
  )
$$;
--> statement-breakpoint

-- ── Demandes : orientation par l'entreprise ──────────────────────────────
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
      ('qualified', 'routed'), ('qualified', 'cancelled'),
      ('routed', 'cancelled')
    ) THEN
      RAISE EXCEPTION 'transition interdite : % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = ANY (ARRAY['in_review', 'needs_info', 'qualified']) THEN
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
    ELSIF NEW.status = 'routed' THEN
      IF NOT EXISTS (SELECT 1 FROM credit.routing_targets t WHERE t.request_id = NEW.id AND t.status = 'sent') THEN
        RAISE EXCEPTION 'orientation : au moins un bailleur destinataire' USING ERRCODE = 'check_violation';
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

-- ── Cibles : transitions ≡ targetMachine, qui fait quoi, délais ──────────
CREATE FUNCTION credit.guard_routing_target() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'une cible ne se supprime pas' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'sent_at' - 'sla_due_at' - 'first_viewed_at' - 'responded_at' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'sent_at' - 'sla_due_at' - 'first_viewed_at' - 'responded_at' - 'updated_at') THEN
    RAISE EXCEPTION 'cible figée (statut seulement)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF (OLD.status, NEW.status) NOT IN (
      ('eligible', 'sent'),
      ('sent', 'viewed'), ('sent', 'offered'), ('sent', 'declined'),
      ('viewed', 'offered'), ('viewed', 'declined'),
      ('offered', 'viewed')
    ) THEN
      RAISE EXCEPTION 'transition interdite : % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    SELECT organization_id INTO v_org FROM credit.financing_requests WHERE id = NEW.request_id;
    IF NEW.status = 'sent' THEN
      -- Envoi : l'entreprise, avec un consentement actif qui nomme ce bailleur.
      IF NOT app.has_org_role(v_org, ARRAY['company_owner']) OR NOT EXISTS (
        SELECT 1 FROM kyc.consents c
        JOIN kyc.consent_recipients cr ON cr.consent_id = c.id
        WHERE c.request_id = NEW.request_id AND c.purpose = 'routing' AND c.revoked_at IS NULL
          AND cr.lessor_organization_id = NEW.lessor_organization_id
      ) THEN
        RAISE EXCEPTION 'envoi : consentement nominatif du dirigeant requis' USING ERRCODE = 'insufficient_privilege';
      END IF;
      NEW.sent_at := now();
      NEW.sla_due_at := now() + interval '72 hours';
    ELSE
      IF NOT app.has_org_role(NEW.lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst']) THEN
        RAISE EXCEPTION 'action réservée au bailleur destinataire' USING ERRCODE = 'insufficient_privilege';
      END IF;
      IF NEW.status = 'viewed' AND OLD.first_viewed_at IS NULL THEN
        NEW.first_viewed_at := now();
      END IF;
      IF NEW.status = ANY (ARRAY['offered', 'declined']) AND OLD.responded_at IS NULL THEN
        NEW.responded_at := now();
      END IF;
    END IF;
  ELSE
    NEW.sent_at := OLD.sent_at;
    NEW.sla_due_at := OLD.sla_due_at;
    NEW.first_viewed_at := OLD.first_viewed_at;
    NEW.responded_at := OLD.responded_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER routing_targets_guard BEFORE UPDATE OR DELETE ON credit.routing_targets
  FOR EACH ROW EXECUTE FUNCTION credit.guard_routing_target();
--> statement-breakpoint
CREATE TRIGGER routing_decisions_immutable BEFORE UPDATE OR DELETE ON credit.routing_decisions
  FOR EACH ROW EXECUTE FUNCTION app.deny_change();
--> statement-breakpoint
CREATE TRIGGER target_declines_immutable BEFORE UPDATE OR DELETE ON credit.target_declines
  FOR EACH ROW EXECUTE FUNCTION app.deny_change();
--> statement-breakpoint
CREATE TRIGGER consent_recipients_immutable BEFORE UPDATE OR DELETE ON kyc.consent_recipients
  FOR EACH ROW EXECUTE FUNCTION app.deny_change();
--> statement-breakpoint

-- Offre : sur une cible reçue par son bailleur ; seule la révocation est permise.
CREATE FUNCTION market.guard_offer() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_target credit.routing_targets;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'une offre ne se supprime pas' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT app.has_org_role(NEW.lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst']) THEN
      RAISE EXCEPTION 'offre réservée au bailleur destinataire' USING ERRCODE = 'insufficient_privilege';
    END IF;
    SELECT * INTO v_target FROM credit.routing_targets WHERE id = NEW.target_id;
    IF v_target.lessor_organization_id IS DISTINCT FROM NEW.lessor_organization_id
       OR v_target.request_id IS DISTINCT FROM NEW.request_id
       OR v_target.status NOT IN ('sent', 'viewed') THEN
      RAISE EXCEPTION 'offre : dossier non reçu ou déjà traité' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.valid_until <= now() OR NEW.status <> 'submitted' THEN
      RAISE EXCEPTION 'offre : validité ou statut invalide' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'withdrawn_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'withdrawn_at')
     OR OLD.status <> 'submitted' OR NEW.status <> 'withdrawn' THEN
    RAISE EXCEPTION 'offre figée (retrait seulement)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.withdrawn_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER offers_guard BEFORE INSERT OR UPDATE OR DELETE ON market.offers
  FOR EACH ROW EXECUTE FUNCTION market.guard_offer();
--> statement-breakpoint

-- ── Row Level Security ───────────────────────────────────────────────────
ALTER TABLE credit.lessor_appetites ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit.routing_decisions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit.routing_targets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE credit.target_declines ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE kyc.consent_recipients ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE market.offers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Noms des bailleurs : lisibles par une entreprise seulement s'ils sont
-- éligibles pour l'une de ses demandes (cloisonnement de la phase 1 intact).
CREATE FUNCTION app.company_sees_lessor(p_lessor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM credit.routing_targets t
    JOIN credit.financing_requests r ON r.id = t.request_id
    WHERE t.lessor_organization_id = p_lessor AND t.status <> 'excluded'
      AND app.is_member(r.organization_id)
  )
$$;
--> statement-breakpoint
CREATE POLICY app_read_lessors ON identity.organizations FOR SELECT TO lp_app
  USING (type = 'lessor' AND app.company_sees_lessor(id));
--> statement-breakpoint
CREATE POLICY app_read_routed ON identity.organizations FOR SELECT TO lp_app
  USING (app.lessor_sees_organization(id));
--> statement-breakpoint

CREATE POLICY app_read ON credit.lessor_appetites FOR SELECT TO lp_app
  USING (app.is_member(organization_id) OR app.has_platform_role());
--> statement-breakpoint
CREATE POLICY app_insert ON credit.lessor_appetites FOR INSERT TO lp_app
  WITH CHECK (app.has_org_role(organization_id, ARRAY['lessor_admin']) AND updated_by = app.current_user_id());
--> statement-breakpoint
CREATE POLICY app_update ON credit.lessor_appetites FOR UPDATE TO lp_app
  USING (app.has_org_role(organization_id, ARRAY['lessor_admin']))
  WITH CHECK (app.has_org_role(organization_id, ARRAY['lessor_admin']) AND updated_by = app.current_user_id());
--> statement-breakpoint

CREATE POLICY app_read ON credit.routing_decisions FOR SELECT TO lp_app
  USING (app.is_reviewer() OR EXISTS (
    SELECT 1 FROM credit.financing_requests r WHERE r.id = request_id AND app.is_member(r.organization_id)));
--> statement-breakpoint
CREATE POLICY app_insert ON credit.routing_decisions FOR INSERT TO lp_app
  WITH CHECK (app.is_reviewer() AND created_by = app.current_user_id());
--> statement-breakpoint

-- Cibles : la plateforme ; l'entreprise (bailleurs éligibles de ses demandes) ;
-- le bailleur (ses propres cibles reçues).
CREATE POLICY app_read ON credit.routing_targets FOR SELECT TO lp_app
  USING (
    app.is_reviewer()
    OR (status <> 'excluded' AND EXISTS (
      SELECT 1 FROM credit.financing_requests r WHERE r.id = request_id AND app.is_member(r.organization_id)))
    OR (app.is_member(lessor_organization_id) AND app.lessor_sees_request(request_id))
  );
--> statement-breakpoint
CREATE POLICY app_insert ON credit.routing_targets FOR INSERT TO lp_app
  WITH CHECK (app.is_reviewer() AND status IN ('eligible', 'excluded'));
--> statement-breakpoint
CREATE POLICY app_send ON credit.routing_targets FOR UPDATE TO lp_app
  USING (EXISTS (
    SELECT 1 FROM credit.financing_requests r
    WHERE r.id = request_id AND app.has_org_role(r.organization_id, ARRAY['company_owner'])))
  WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_respond ON credit.routing_targets FOR UPDATE TO lp_app
  USING (app.has_org_role(lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst'])
         AND app.lessor_sees_request(request_id))
  WITH CHECK (app.has_org_role(lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst']));
--> statement-breakpoint

CREATE POLICY app_read ON credit.target_declines FOR SELECT TO lp_app
  USING (app.is_reviewer() OR EXISTS (
    SELECT 1 FROM credit.routing_targets t WHERE t.id = target_id AND app.is_member(t.lessor_organization_id)));
--> statement-breakpoint
CREATE POLICY app_insert ON credit.target_declines FOR INSERT TO lp_app
  WITH CHECK (declined_by = app.current_user_id() AND EXISTS (
    SELECT 1 FROM credit.routing_targets t
    WHERE t.id = target_id AND app.has_org_role(t.lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst'])
      AND app.lessor_sees_request(t.request_id)));
--> statement-breakpoint

CREATE POLICY app_read ON kyc.consent_recipients FOR SELECT TO lp_app
  USING (app.has_platform_role() OR app.is_member(lessor_organization_id) OR EXISTS (
    SELECT 1 FROM kyc.consents c WHERE c.id = consent_id AND app.is_member(c.organization_id)));
--> statement-breakpoint
CREATE POLICY app_insert ON kyc.consent_recipients FOR INSERT TO lp_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM kyc.consents c
    WHERE c.id = consent_id AND c.purpose = 'routing' AND c.granted_by = app.current_user_id()
      AND app.has_org_role(c.organization_id, ARRAY['company_owner'])));
--> statement-breakpoint

-- Offres : le bailleur (les siennes) ; l'entreprise (offres actives sur ses
-- demandes) ; la plateforme.
CREATE POLICY app_read ON market.offers FOR SELECT TO lp_app
  USING (
    app.has_platform_role()
    OR app.is_member(lessor_organization_id)
    OR (status = 'submitted' AND EXISTS (
      SELECT 1 FROM credit.financing_requests r WHERE r.id = request_id AND app.is_member(r.organization_id)))
  );
--> statement-breakpoint
CREATE POLICY app_insert ON market.offers FOR INSERT TO lp_app
  WITH CHECK (
    app.has_org_role(lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst'])
    AND submitted_by = app.current_user_id()
    AND app.lessor_sees_request(request_id)
  );
--> statement-breakpoint
CREATE POLICY app_withdraw ON market.offers FOR UPDATE TO lp_app
  USING (app.has_org_role(lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst']))
  WITH CHECK (app.has_org_role(lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst']));
--> statement-breakpoint

-- Lecture bailleur des données d'un dossier transmis.
CREATE POLICY app_read_lessor ON credit.financing_requests FOR SELECT TO lp_app
  USING (app.lessor_sees_request(id));
--> statement-breakpoint
CREATE POLICY app_read_lessor ON kyc.companies FOR SELECT TO lp_app
  USING (app.lessor_sees_organization(organization_id));
--> statement-breakpoint
CREATE POLICY app_read_lessor ON kyc.documents FOR SELECT TO lp_app
  USING (app.lessor_sees_document(id));
--> statement-breakpoint
CREATE POLICY app_read_lessor ON credit.risk_assessments FOR SELECT TO lp_app
  USING (app.lessor_sees_request(request_id));
--> statement-breakpoint
CREATE POLICY app_read_lessor ON credit.risk_overrides FOR SELECT TO lp_app
  USING (EXISTS (
    SELECT 1 FROM credit.risk_assessments a WHERE a.id = assessment_id AND app.lessor_sees_request(a.request_id)));
--> statement-breakpoint
CREATE POLICY app_read_lessor ON credit.credit_memos FOR SELECT TO lp_app
  USING (status = 'approved' AND app.lessor_sees_request(request_id));
--> statement-breakpoint
CREATE POLICY app_read_lessor ON kyc.kyc_checks FOR SELECT TO lp_app
  USING (app.lessor_sees_request(request_id));
--> statement-breakpoint

-- ── Privilèges ───────────────────────────────────────────────────────────
REVOKE ALL ON SCHEMA market FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA market FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app.lessor_sees_request(uuid), app.lessor_sees_organization(uuid),
  app.lessor_sees_document(uuid), app.company_sees_lessor(uuid), credit.guard_routing_target() FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA market TO lp_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.lessor_sees_request(uuid), app.lessor_sees_organization(uuid),
  app.lessor_sees_document(uuid), app.company_sees_lessor(uuid) TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON credit.lessor_appetites, credit.routing_targets, market.offers TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON credit.routing_decisions, credit.target_declines, kyc.consent_recipients TO lp_app;
