-- Phase 7 : acceptation d'une offre, opération suivie par le bailleur,
-- messagerie et notifications. Les effets croisés (acceptation → autres
-- offres non retenues → demande acceptée ; mise en loyer → demande financée ;
-- annulation → offres rouvertes) passent par des triggers qui vérifient
-- l'ÉTAT de l'opération, jamais la seule identité de l'appelant.
-- Listes de valeurs identiques à packages/domain (vérifié par test).

-- ── Contraintes ──────────────────────────────────────────────────────────
ALTER TABLE credit.financing_requests DROP CONSTRAINT requests_status_check;
--> statement-breakpoint
ALTER TABLE credit.financing_requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('draft', 'submitted', 'in_review', 'needs_info', 'qualified', 'routed', 'accepted', 'financed', 'cancelled'));
--> statement-breakpoint
ALTER TABLE market.offers DROP CONSTRAINT offers_status_check;
--> statement-breakpoint
ALTER TABLE market.offers ADD CONSTRAINT offers_status_check
  CHECK (status IN ('submitted', 'withdrawn', 'accepted', 'not_retained'));
--> statement-breakpoint
ALTER TABLE market.deals
  ADD CONSTRAINT deals_status_check CHECK (status IN ('accepted', 'signed', 'delivered', 'active', 'cancelled')),
  ADD CONSTRAINT deals_product_check CHECK (product IN ('lease', 'ijara')),
  ADD CONSTRAINT deals_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT deals_amount_check CHECK (financed_amount_ht > 0),
  ADD CONSTRAINT deals_cancel_side_check CHECK (cancel_side IN ('lessor', 'company')),
  ADD CONSTRAINT deals_cancel_reason_check CHECK (cancel_reason IN (
    'credit_refused', 'documents_incomplete', 'supplier_issue', 'other',
    'project_abandoned', 'financed_elsewhere')),
  ADD CONSTRAINT deals_cancel_note_check CHECK (
    cancel_reason IS DISTINCT FROM 'other' OR length(trim(coalesce(cancel_note, ''))) >= 10),
  ADD CONSTRAINT deals_cancelled_check CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  ADD CONSTRAINT deals_dates_check CHECK (
    (signed_on IS NULL OR delivered_on IS NULL OR delivered_on >= signed_on)
    AND (delivered_on IS NULL OR activated_on IS NULL OR activated_on >= delivered_on));
--> statement-breakpoint
ALTER TABLE market.messages
  ADD CONSTRAINT messages_body_check CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  ADD CONSTRAINT messages_flags_check CHECK (contact_flags <@ ARRAY['email', 'phone', 'url']::text[]);
--> statement-breakpoint
ALTER TABLE identity.notifications
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'request_needs_info', 'request_qualified', 'offer_received', 'message_from_lessor',
    'deal_signed', 'deal_delivered', 'deal_activated', 'deal_cancelled_by_lessor',
    'request_received', 'message_from_company', 'offer_accepted', 'offer_not_retained',
    'deal_cancelled_by_company')),
  ADD CONSTRAINT notifications_path_check CHECK (path ~ '^/[a-z0-9/_?=&-]*$' AND path !~ '//');
--> statement-breakpoint
ALTER TABLE identity.notification_preferences
  ADD CONSTRAINT notification_preferences_phone_check CHECK (phone ~ '^\+212[67][0-9]{8}$'),
  ADD CONSTRAINT notification_preferences_mobile_check CHECK (NOT (sms OR whatsapp) OR phone IS NOT NULL);
--> statement-breakpoint
ALTER TABLE dev.outbox ADD CONSTRAINT outbox_channel_check CHECK (channel IN ('email', 'sms', 'whatsapp'));
--> statement-breakpoint

-- ── Demandes : acceptation, réouverture, financement ─────────────────────
-- Les trois transitions de la phase 7 se fondent sur l'état de l'opération :
-- elles ne sont atteignables que par les triggers de market.deals.
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
      ('routed', 'accepted'), ('routed', 'cancelled'),
      ('accepted', 'routed'), ('accepted', 'financed')
    ) THEN
      RAISE EXCEPTION 'transition interdite : % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'accepted' THEN
      IF NOT EXISTS (SELECT 1 FROM market.deals d WHERE d.request_id = NEW.id AND d.status = 'accepted') THEN
        RAISE EXCEPTION 'acceptation : aucune offre acceptée' USING ERRCODE = 'check_violation';
      END IF;
    ELSIF NEW.status = 'financed' THEN
      IF NOT EXISTS (SELECT 1 FROM market.deals d WHERE d.request_id = NEW.id AND d.status = 'active') THEN
        RAISE EXCEPTION 'financement : mise en loyer non constatée' USING ERRCODE = 'check_violation';
      END IF;
    ELSIF OLD.status = 'accepted' THEN
      IF EXISTS (SELECT 1 FROM market.deals d WHERE d.request_id = NEW.id AND d.status <> 'cancelled') THEN
        RAISE EXCEPTION 'réouverture : opération en cours' USING ERRCODE = 'check_violation';
      END IF;
    ELSIF NEW.status = ANY (ARRAY['in_review', 'needs_info', 'qualified']) THEN
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
    ELSIF NEW.status = 'routed' AND OLD.status = 'qualified' THEN
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

-- ── Offres : retrait par le bailleur ; acceptation, mise à l'écart et
-- réouverture déduites de l'opération ──────────────────────────────────────
CREATE OR REPLACE FUNCTION market.guard_offer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
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
       OR NOT (v_target.status = ANY (ARRAY['sent', 'viewed'])) THEN
      RAISE EXCEPTION 'offre : dossier non reçu ou déjà traité' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.valid_until <= now() OR NEW.status <> 'submitted' THEN
      RAISE EXCEPTION 'offre : validité ou statut invalide' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'withdrawn_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'withdrawn_at')
     OR (OLD.status, NEW.status) NOT IN (
       ('submitted', 'withdrawn'), ('submitted', 'accepted'), ('submitted', 'not_retained'),
       ('not_retained', 'submitted')
     ) THEN
    RAISE EXCEPTION 'offre figée' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.status = 'withdrawn' THEN
    IF NOT app.has_org_role(NEW.lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst']) THEN
      RAISE EXCEPTION 'retrait réservé au bailleur' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.withdrawn_at := now();
  ELSIF NEW.status = 'accepted' THEN
    IF NOT EXISTS (SELECT 1 FROM market.deals d WHERE d.offer_id = NEW.id AND d.status = 'accepted') THEN
      RAISE EXCEPTION 'acceptation : aucune opération pour cette offre' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NEW.status = 'not_retained' THEN
    IF NOT EXISTS (
      SELECT 1 FROM market.deals d
      WHERE d.request_id = NEW.request_id AND d.offer_id <> NEW.id AND d.status <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'mise à l''écart : aucune autre offre acceptée' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM market.deals d WHERE d.request_id = NEW.request_id AND d.status <> 'cancelled') THEN
    RAISE EXCEPTION 'réouverture : opération en cours' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- ── Opérations ───────────────────────────────────────────────────────────
-- Création = acceptation par le dirigeant d'une offre active et valable sur
-- une demande transmise ; les étapes sont datées par le bailleur ;
-- l'entreprise annule avant la signature seulement.
CREATE FUNCTION market.guard_deal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_offer market.offers;
  v_request credit.financing_requests;
  v_today date := (now() AT TIME ZONE 'Africa/Casablanca')::date;
  v_previous date;
  v_on date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'une opération ne se supprime pas' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_offer FROM market.offers WHERE id = NEW.offer_id FOR UPDATE;
    SELECT * INTO v_request FROM credit.financing_requests WHERE id = v_offer.request_id FOR UPDATE;
    IF v_request.id IS NULL OR NOT app.has_org_role(v_request.organization_id, ARRAY['company_owner']) THEN
      RAISE EXCEPTION 'acceptation réservée au dirigeant de l''entreprise' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_offer.status <> 'submitted' OR v_offer.valid_until < now() OR v_request.status <> 'routed' THEN
      RAISE EXCEPTION 'acceptation : offre indisponible ou demande non ouverte' USING ERRCODE = 'check_violation';
    END IF;
    NEW.request_id := v_request.id;
    NEW.company_organization_id := v_request.organization_id;
    NEW.lessor_organization_id := v_offer.lessor_organization_id;
    NEW.financed_amount_ht := v_offer.financed_amount_ht;
    NEW.status := 'accepted';
    NEW.accepted_at := now();
    NEW.accepted_by := app.current_user_id();
    NEW.signed_on := NULL;
    NEW.delivered_on := NULL;
    NEW.activated_on := NULL;
    NEW.cancelled_at := NULL;
    NEW.cancelled_by := NULL;
    NEW.cancel_side := NULL;
    NEW.cancel_reason := NULL;
    NEW.cancel_note := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'status' - 'signed_on' - 'delivered_on' - 'activated_on' - 'financed_amount_ht'
        - 'cancelled_at' - 'cancelled_by' - 'cancel_side' - 'cancel_reason' - 'cancel_note' - 'updated_at')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'signed_on' - 'delivered_on' - 'activated_on' - 'financed_amount_ht'
        - 'cancelled_at' - 'cancelled_by' - 'cancel_side' - 'cancel_reason' - 'cancel_note' - 'updated_at')
     OR (OLD.status, NEW.status) NOT IN (
       ('accepted', 'signed'), ('accepted', 'cancelled'),
       ('signed', 'delivered'), ('signed', 'cancelled'),
       ('delivered', 'active'), ('delivered', 'cancelled')
     ) THEN
    RAISE EXCEPTION 'opération : transition interdite % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  -- Chaque date ne se pose qu'à son étape ; le montant, à la mise en loyer.
  IF NEW.signed_on IS DISTINCT FROM OLD.signed_on AND NEW.status <> 'signed'
     OR NEW.delivered_on IS DISTINCT FROM OLD.delivered_on AND NEW.status <> 'delivered'
     OR NEW.activated_on IS DISTINCT FROM OLD.activated_on AND NEW.status <> 'active'
     OR NEW.financed_amount_ht IS DISTINCT FROM OLD.financed_amount_ht AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'opération : date ou montant hors de son étape' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'cancelled' THEN
    IF NEW.cancel_side = 'lessor' THEN
      IF NOT app.has_org_role(NEW.lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst'])
         OR NOT (NEW.cancel_reason = ANY (ARRAY['credit_refused', 'documents_incomplete', 'supplier_issue', 'other'])) THEN
        RAISE EXCEPTION 'annulation réservée au bailleur' USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSIF NEW.cancel_side = 'company' THEN
      IF OLD.status <> 'accepted'
         OR NOT app.has_org_role(NEW.company_organization_id, ARRAY['company_owner'])
         OR NOT (NEW.cancel_reason = ANY (ARRAY['project_abandoned', 'financed_elsewhere', 'other'])) THEN
        RAISE EXCEPTION 'annulation : avant signature, par le dirigeant' USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSE
      RAISE EXCEPTION 'annulation : partie inconnue' USING ERRCODE = 'check_violation';
    END IF;
    NEW.cancelled_at := now();
    NEW.cancelled_by := app.current_user_id();
  ELSE
    IF NOT app.has_org_role(NEW.lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst']) THEN
      RAISE EXCEPTION 'étapes constatées par le bailleur' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.cancel_side IS NOT NULL OR NEW.cancel_reason IS NOT NULL OR NEW.cancel_note IS NOT NULL THEN
      RAISE EXCEPTION 'opération : motif sans annulation' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'signed' THEN
      v_on := NEW.signed_on;
      v_previous := (OLD.accepted_at AT TIME ZONE 'Africa/Casablanca')::date;
    ELSIF NEW.status = 'delivered' THEN
      v_on := NEW.delivered_on;
      v_previous := OLD.signed_on;
    ELSE
      v_on := NEW.activated_on;
      v_previous := OLD.delivered_on;
    END IF;
    IF v_on IS NULL OR v_on > v_today OR v_on < v_previous THEN
      RAISE EXCEPTION 'opération : date d''étape invalide' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER deals_guard BEFORE INSERT OR UPDATE OR DELETE ON market.deals
  FOR EACH ROW EXECUTE FUNCTION market.guard_deal();
--> statement-breakpoint

-- Effets de l'opération : historique, offres, demande. SECURITY DEFINER :
-- les gardes ci-dessus (offres, demande) vérifient l'état, pas l'appelant.
CREATE FUNCTION market.sync_deal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO market.deal_events (deal_id, from_status, to_status, occurred_on, actor_user_id)
    VALUES (NEW.id, NULL, 'accepted', (NEW.accepted_at AT TIME ZONE 'Africa/Casablanca')::date, app.current_user_id());
    UPDATE market.offers SET status = 'accepted' WHERE id = NEW.offer_id;
    UPDATE market.offers SET status = 'not_retained'
      WHERE request_id = NEW.request_id AND id <> NEW.offer_id AND status = 'submitted';
    UPDATE credit.financing_requests SET status = 'accepted' WHERE id = NEW.request_id;
    RETURN NULL;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO market.deal_events (deal_id, from_status, to_status, occurred_on, actor_user_id, metadata)
    VALUES (
      NEW.id, OLD.status, NEW.status,
      CASE NEW.status
        WHEN 'signed' THEN NEW.signed_on
        WHEN 'delivered' THEN NEW.delivered_on
        WHEN 'active' THEN NEW.activated_on
        ELSE (now() AT TIME ZONE 'Africa/Casablanca')::date
      END,
      app.current_user_id(),
      CASE WHEN NEW.status = 'cancelled'
        THEN jsonb_build_object('side', NEW.cancel_side, 'reason', NEW.cancel_reason, 'note', NEW.cancel_note)
      END
    );
    IF NEW.status = 'active' THEN
      UPDATE credit.financing_requests SET status = 'financed' WHERE id = NEW.request_id;
    ELSIF NEW.status = 'cancelled' THEN
      UPDATE credit.financing_requests SET status = 'routed' WHERE id = NEW.request_id AND status = 'accepted';
      UPDATE market.offers SET status = 'submitted' WHERE request_id = NEW.request_id AND status = 'not_retained';
    END IF;
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER deals_sync AFTER INSERT OR UPDATE ON market.deals
  FOR EACH ROW EXECUTE FUNCTION market.sync_deal();
--> statement-breakpoint
CREATE TRIGGER deal_events_immutable BEFORE UPDATE OR DELETE ON market.deal_events
  FOR EACH ROW EXECUTE FUNCTION app.deny_change();
--> statement-breakpoint

-- ── Messagerie ───────────────────────────────────────────────────────────
-- Un fil existe pour un bailleur qui a reçu la demande ; il est lisible par
-- l'entreprise, par ce bailleur (consentement actif) et par la plateforme.
CREATE FUNCTION market.thread_visible(p_request uuid, p_lessor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT app.has_platform_role()
    OR (app.is_member(p_lessor) AND app.lessor_sees_request(p_request))
    OR EXISTS (
      SELECT 1
      FROM credit.financing_requests r
      JOIN credit.routing_targets t ON t.request_id = r.id AND t.lessor_organization_id = p_lessor
      WHERE r.id = p_request
        AND app.is_member(r.organization_id)
        AND t.status = ANY (ARRAY['sent', 'viewed', 'offered', 'declined'])
    )
$$;
--> statement-breakpoint
CREATE FUNCTION market.guard_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_thread market.threads;
  v_company uuid;
BEGIN
  SELECT * INTO v_thread FROM market.threads WHERE id = NEW.thread_id;
  SELECT r.organization_id INTO v_company FROM credit.financing_requests r WHERE r.id = v_thread.request_id;
  IF NEW.author_user_id IS DISTINCT FROM app.current_user_id()
     OR NOT market.thread_visible(v_thread.request_id, v_thread.lessor_organization_id) THEN
    RAISE EXCEPTION 'message : fil inaccessible' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.author_organization_id = v_company THEN
    IF NOT app.has_org_role(v_company, ARRAY['company_owner', 'company_member']) THEN
      RAISE EXCEPTION 'message : rôle insuffisant' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NEW.author_organization_id = v_thread.lessor_organization_id THEN
    IF NOT app.has_org_role(v_thread.lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst']) THEN
      RAISE EXCEPTION 'message : rôle insuffisant' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    RAISE EXCEPTION 'message : auteur étranger au fil' USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.created_at := now();
  UPDATE market.threads SET last_message_at = NEW.created_at WHERE id = NEW.thread_id;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER messages_guard BEFORE INSERT ON market.messages
  FOR EACH ROW EXECUTE FUNCTION market.guard_message();
--> statement-breakpoint
CREATE TRIGGER messages_immutable BEFORE UPDATE OR DELETE ON market.messages
  FOR EACH ROW EXECUTE FUNCTION app.deny_change();
--> statement-breakpoint
CREATE FUNCTION market.guard_thread() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.lessor_organization_id IS DISTINCT FROM OLD.lessor_organization_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'fil figé' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER threads_guard BEFORE UPDATE OR DELETE ON market.threads
  FOR EACH ROW EXECUTE FUNCTION market.guard_thread();
--> statement-breakpoint

-- ── Notifications : seul « lu » change ; supprimées avec leur destinataire
-- (cascade), jamais par l'application (aucun droit DELETE) ───────────────
CREATE FUNCTION identity.guard_notification() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF (to_jsonb(NEW) - 'read_at') IS DISTINCT FROM (to_jsonb(OLD) - 'read_at')
     OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at) THEN
    RAISE EXCEPTION 'notification figée' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER notifications_guard BEFORE UPDATE ON identity.notifications
  FOR EACH ROW EXECUTE FUNCTION identity.guard_notification();
--> statement-breakpoint

-- ── Row Level Security ───────────────────────────────────────────────────
ALTER TABLE market.deals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE market.deal_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE market.threads ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE market.messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE market.thread_reads ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.notification_preferences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Offres : l'entreprise voit aussi les offres acceptées et non retenues de
-- ses demandes (jamais les offres retirées).
DROP POLICY app_read ON market.offers;
--> statement-breakpoint
CREATE POLICY app_read ON market.offers FOR SELECT TO lp_app
  USING (
    app.has_platform_role()
    OR app.is_member(lessor_organization_id)
    OR (status <> 'withdrawn' AND EXISTS (
      SELECT 1 FROM credit.financing_requests r WHERE r.id = request_id AND app.is_member(r.organization_id)))
  );
--> statement-breakpoint

CREATE POLICY app_read ON market.deals FOR SELECT TO lp_app
  USING (app.has_platform_role() OR app.is_member(company_organization_id) OR app.is_member(lessor_organization_id));
--> statement-breakpoint
CREATE POLICY app_accept ON market.deals FOR INSERT TO lp_app
  WITH CHECK (app.has_org_role(company_organization_id, ARRAY['company_owner']) AND accepted_by = app.current_user_id());
--> statement-breakpoint
CREATE POLICY app_update ON market.deals FOR UPDATE TO lp_app
  USING (
    app.has_org_role(lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst'])
    OR app.has_org_role(company_organization_id, ARRAY['company_owner']))
  WITH CHECK (
    app.has_org_role(lessor_organization_id, ARRAY['lessor_admin', 'lessor_analyst'])
    OR app.has_org_role(company_organization_id, ARRAY['company_owner']));
--> statement-breakpoint
CREATE POLICY app_read ON market.deal_events FOR SELECT TO lp_app
  USING (EXISTS (SELECT 1 FROM market.deals d WHERE d.id = deal_id));
--> statement-breakpoint

CREATE POLICY app_read ON market.threads FOR SELECT TO lp_app
  USING (market.thread_visible(request_id, lessor_organization_id));
--> statement-breakpoint
CREATE POLICY app_open ON market.threads FOR INSERT TO lp_app
  WITH CHECK (market.thread_visible(request_id, lessor_organization_id) AND NOT app.has_platform_role());
--> statement-breakpoint
CREATE POLICY app_read ON market.messages FOR SELECT TO lp_app
  USING (EXISTS (SELECT 1 FROM market.threads t WHERE t.id = thread_id));
--> statement-breakpoint
CREATE POLICY app_send ON market.messages FOR INSERT TO lp_app
  WITH CHECK (author_user_id = app.current_user_id() AND EXISTS (SELECT 1 FROM market.threads t WHERE t.id = thread_id));
--> statement-breakpoint
CREATE POLICY app_own ON market.thread_reads FOR ALL TO lp_app
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id() AND EXISTS (SELECT 1 FROM market.threads t WHERE t.id = thread_id));
--> statement-breakpoint

CREATE POLICY app_own ON identity.notifications FOR SELECT TO lp_app
  USING (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY app_mark_read ON identity.notifications FOR UPDATE TO lp_app
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY auth_insert ON identity.notifications FOR INSERT TO lp_auth WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY app_own ON identity.notification_preferences FOR ALL TO lp_app
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY auth_read ON identity.notification_preferences FOR SELECT TO lp_auth USING (true);
--> statement-breakpoint

-- ── Privilèges ───────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION market.guard_deal(), market.sync_deal(), market.guard_message(),
  market.guard_thread(), market.thread_visible(uuid, uuid), identity.guard_notification() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION market.thread_visible(uuid, uuid) TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON market.deals TO lp_app;
--> statement-breakpoint
GRANT SELECT ON market.deal_events TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON market.threads, market.messages TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON market.thread_reads TO lp_app;
--> statement-breakpoint
GRANT SELECT, UPDATE (read_at) ON identity.notifications TO lp_app;
--> statement-breakpoint
GRANT INSERT ON identity.notifications TO lp_auth;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON identity.notification_preferences TO lp_app;
--> statement-breakpoint
GRANT SELECT ON identity.notification_preferences TO lp_auth;
