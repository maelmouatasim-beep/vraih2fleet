-- Phase 9 : droits des personnes (loi 09-08), conservation, accès support.
-- L'effacement et la purge passent par des fonctions SECURITY DEFINER qui
-- ouvrent un « mode effacement » limité à leur transaction : seules ces
-- fonctions (propriétaire) peuvent supprimer des enregistrements autrement
-- immuables (extractions, contrôles, appels IA, consentements de brouillon).
-- Listes de valeurs identiques à packages/domain (vérifiées par test).

-- ── Mode effacement ──────────────────────────────────────────────────────
-- Vrai seulement dans une fonction du propriétaire qui l'a ouvert : un rôle
-- applicatif qui pose le paramètre lui-même n'obtient rien.
CREATE FUNCTION app.erasure_mode() RETURNS boolean
LANGUAGE sql STABLE
SET search_path = pg_catalog
AS $$
  SELECT current_setting('app.erasure', true) = 'on'
    AND current_user NOT IN ('lp_app', 'lp_auth')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.deny_change() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND app.erasure_mode() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% : enregistrement immuable', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION kyc.guard_consent() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Seule la purge d'un brouillon abandonné supprime un consentement.
    IF app.erasure_mode() THEN
      RETURN OLD;
    END IF;
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
CREATE OR REPLACE FUNCTION credit.guard_credit_memo() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Effacement 09-08 : la note, rédigée à partir des pièces, part avec elles.
    IF app.erasure_mode() THEN
      RETURN OLD;
    END IF;
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
CREATE OR REPLACE FUNCTION kyc.guard_document_update() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF app.erasure_mode() THEN
    -- Effacement ou purge : nom d'origine remplacé, fichier effacé, rien d'autre.
    IF (to_jsonb(NEW) - 'deleted_at' - 'purged_at' - 'original_name')
       IS DISTINCT FROM (to_jsonb(OLD) - 'deleted_at' - 'purged_at' - 'original_name') THEN
      RAISE EXCEPTION 'document : seul l''effacement est permis' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
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

-- ── Contraintes ──────────────────────────────────────────────────────────
ALTER TABLE privacy.requests
  ADD CONSTRAINT privacy_requests_kind_check CHECK (kind IN ('erasure')),
  ADD CONSTRAINT privacy_requests_status_check CHECK (status IN ('pending', 'completed', 'rejected', 'cancelled')),
  ADD CONSTRAINT privacy_requests_reject_reason_check CHECK (reject_reason IN (
    'identity_unverified', 'legal_hold', 'other')),
  ADD CONSTRAINT privacy_requests_reject_note_check CHECK (
    reject_reason IS DISTINCT FROM 'other' OR length(trim(coalesce(reject_note, ''))) >= 10),
  ADD CONSTRAINT privacy_requests_rejected_check CHECK ((status = 'rejected') = (reject_reason IS NOT NULL)),
  ADD CONSTRAINT privacy_requests_note_check CHECK (length(note) <= 2000);
--> statement-breakpoint
-- Règles de conservation : défaut et bornes (≡ RETENTION_RULES du domaine).
CREATE FUNCTION privacy.retention_rule(p_key text, OUT default_days integer, OUT min_days integer, OUT max_days integer)
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT r.d, r.mn, r.mx FROM (VALUES
    ('outbox_messages', 30, 1, 365),
    ('read_notifications', 180, 30, 730),
    ('expired_sessions', 7, 0, 90),
    ('marketing_leads', 365, 90, 1095),
    ('draft_requests', 180, 30, 730),
    ('deleted_documents', 30, 0, 365)
  ) AS r(k, d, mn, mx)
  WHERE r.k = p_key
$$;
--> statement-breakpoint
ALTER TABLE privacy.retention_settings
  ADD CONSTRAINT retention_settings_key_check CHECK (key IN (
    'outbox_messages', 'read_notifications', 'expired_sessions', 'marketing_leads',
    'draft_requests', 'deleted_documents')),
  ADD CONSTRAINT retention_settings_days_check CHECK (
    days BETWEEN (privacy.retention_rule(key)).min_days AND (privacy.retention_rule(key)).max_days);
--> statement-breakpoint
ALTER TABLE privacy.impersonations
  ADD CONSTRAINT impersonations_reason_check CHECK (length(trim(reason)) BETWEEN 15 AND 500),
  ADD CONSTRAINT impersonations_window_check CHECK (
    expires_at > started_at AND expires_at <= started_at + interval '30 minutes'),
  ADD CONSTRAINT impersonations_end_check CHECK (ended_at IS NULL OR ended_at >= started_at);
--> statement-breakpoint

-- ── Demandes d'effacement ────────────────────────────────────────────────
-- Déposée par le titulaire de l'entreprise ; retirée par lui ; refusée
-- (motif) par un administrateur ; exécutée par privacy.erase_organization.
CREATE FUNCTION privacy.guard_request() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_user uuid := app.current_user_id();
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'demande : enregistrement conservé' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT app.has_org_role(NEW.organization_id, ARRAY['company_owner'])
       OR NEW.requested_by IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION 'demande réservée au titulaire de l''entreprise' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.status <> 'pending' OR NEW.decided_by IS NOT NULL OR NEW.summary IS NOT NULL THEN
      RAISE EXCEPTION 'demande : statut initial « pending »' USING ERRCODE = 'check_violation';
    END IF;
    NEW.requested_at := now();
    NEW.due_on := (now() AT TIME ZONE 'Africa/Casablanca')::date + 30;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'decided_by' - 'decided_at' - 'reject_reason' - 'reject_note' - 'summary')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'decided_by' - 'decided_at' - 'reject_reason' - 'reject_note' - 'summary') THEN
    RAISE EXCEPTION 'demande : contenu figé' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (OLD.status, NEW.status) NOT IN (
    ('pending', 'completed'), ('pending', 'rejected'), ('pending', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'transition interdite : % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'completed' AND NOT app.erasure_mode() THEN
    RAISE EXCEPTION 'effacement : par privacy.erase_organization seulement' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.status = 'rejected' AND NOT app.has_platform_role(ARRAY['platform_admin']) THEN
    RAISE EXCEPTION 'refus réservé aux administrateurs' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.status = 'cancelled' AND NOT app.has_org_role(OLD.organization_id, ARRAY['company_owner']) THEN
    RAISE EXCEPTION 'retrait réservé au titulaire' USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.decided_at := now();
  IF NOT app.erasure_mode() THEN
    NEW.decided_by := v_user;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER requests_guard BEFORE INSERT OR UPDATE OR DELETE ON privacy.requests
  FOR EACH ROW EXECUTE FUNCTION privacy.guard_request();
--> statement-breakpoint

-- ── Effacement d'une entreprise ──────────────────────────────────────────
-- Efface : comptes exclusifs à l'organisation (anonymisés, accès supprimés),
-- adhésions, notifications, prospects et courriels liés, pièces (nom
-- remplacé, fichier à purger par l'application), extractions, contrôles,
-- notes de synthèse et appels IA. Conserve (obligation légale, preuve) : demandes, consentements,
-- offres, opérations, commissions, factures, journal d'audit — rendus
-- pseudonymes par l'anonymisation des comptes.
CREATE FUNCTION privacy.erase_organization(p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_req privacy.requests;
  v_users uuid[];
  v_emails text[];
  v_summary jsonb;
  v_storage jsonb;
  n_users integer; n_members integer; n_documents integer; n_extractions integer;
  n_checks integer; n_ai integer; n_memos integer; n_notifications integer; n_leads integer;
BEGIN
  IF NOT app.has_platform_role(ARRAY['platform_admin']) THEN
    RAISE EXCEPTION 'effacement réservé aux administrateurs' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_req FROM privacy.requests WHERE id = p_request FOR UPDATE;
  IF v_req.id IS NULL OR v_req.status <> 'pending' OR v_req.kind <> 'erasure' THEN
    RAISE EXCEPTION 'effacement : demande introuvable ou déjà traitée' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM credit.financing_requests r
    WHERE r.organization_id = v_req.organization_id
      AND r.status = ANY (ARRAY['submitted', 'in_review', 'qualified', 'routed', 'accepted'])
  ) OR EXISTS (
    SELECT 1 FROM market.deals d
    WHERE d.company_organization_id = v_req.organization_id
      AND d.status = ANY (ARRAY['accepted', 'signed', 'delivered'])
  ) THEN
    RAISE EXCEPTION 'effacement : dossiers ou opérations en cours' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('app.erasure', 'on', true);

  SELECT coalesce(array_agg(m.user_id), '{}') INTO v_users
  FROM identity.memberships m
  WHERE m.organization_id = v_req.organization_id
    AND NOT EXISTS (
      SELECT 1 FROM identity.memberships o
      WHERE o.user_id = m.user_id AND o.organization_id <> v_req.organization_id
    );
  SELECT coalesce(array_agg(lower(u.email)), '{}') INTO v_emails
  FROM identity.users u WHERE u.id = ANY (v_users);

  DELETE FROM kyc.document_extractions x
  USING kyc.documents d
  WHERE x.document_id = d.id AND d.organization_id = v_req.organization_id;
  GET DIAGNOSTICS n_extractions = ROW_COUNT;
  DELETE FROM kyc.kyc_checks c WHERE c.organization_id = v_req.organization_id;
  GET DIAGNOSTICS n_checks = ROW_COUNT;
  DELETE FROM credit.credit_memos cm
  USING credit.financing_requests r
  WHERE cm.request_id = r.id AND r.organization_id = v_req.organization_id;
  GET DIAGNOSTICS n_memos = ROW_COUNT;
  DELETE FROM credit.ai_runs a
  WHERE a.request_id IN (
      SELECT r.id FROM credit.financing_requests r WHERE r.organization_id = v_req.organization_id)
    OR a.document_id IN (
      SELECT d.id FROM kyc.documents d WHERE d.organization_id = v_req.organization_id);
  GET DIAGNOSTICS n_ai = ROW_COUNT;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'key', d.storage_key)), '[]')
    INTO v_storage
  FROM kyc.documents d
  WHERE d.organization_id = v_req.organization_id AND d.purged_at IS NULL;
  UPDATE kyc.documents d
  SET deleted_at = coalesce(d.deleted_at, now()), original_name = 'piece-effacee'
  WHERE d.organization_id = v_req.organization_id
    AND (d.deleted_at IS NULL OR d.original_name <> 'piece-effacee');
  GET DIAGNOSTICS n_documents = ROW_COUNT;

  DELETE FROM identity.notifications n
  WHERE n.user_id = ANY (v_users) OR n.organization_id = v_req.organization_id;
  GET DIAGNOSTICS n_notifications = ROW_COUNT;
  DELETE FROM identity.notification_preferences p WHERE p.user_id = ANY (v_users);
  DELETE FROM marketing.leads l WHERE lower(l.email) = ANY (v_emails);
  GET DIAGNOSTICS n_leads = ROW_COUNT;
  DELETE FROM dev.outbox o WHERE lower(o."to") = ANY (v_emails);
  DELETE FROM identity.invitations i
  WHERE i.organization_id = v_req.organization_id OR lower(i.email) = ANY (v_emails);
  DELETE FROM identity.verifications v
  WHERE EXISTS (SELECT 1 FROM unnest(v_emails) e WHERE position(e IN lower(v.identifier)) > 0);
  DELETE FROM identity.sessions s WHERE s.user_id = ANY (v_users);
  DELETE FROM identity.accounts a WHERE a.user_id = ANY (v_users);
  DELETE FROM identity.two_factors t WHERE t.user_id = ANY (v_users);
  DELETE FROM identity.memberships m WHERE m.organization_id = v_req.organization_id;
  GET DIAGNOSTICS n_members = ROW_COUNT;
  UPDATE identity.users u
  SET name = 'Compte effacé',
      email = 'efface-' || u.id::text || '@leaseplace.invalid',
      email_verified = false, image = NULL, two_factor_enabled = false, updated_at = now()
  WHERE u.id = ANY (v_users);
  GET DIAGNOSTICS n_users = ROW_COUNT;

  v_summary := jsonb_build_object(
    'users', n_users, 'memberships', n_members, 'documents', n_documents,
    'extractions', n_extractions, 'checks', n_checks, 'memos', n_memos, 'aiRuns', n_ai,
    'notifications', n_notifications, 'leads', n_leads);
  UPDATE privacy.requests
  SET status = 'completed', decided_by = app.current_user_id(), summary = v_summary
  WHERE id = p_request;
  PERFORM audit.record('privacy.erasure_completed', 'organization',
    v_req.organization_id::text, NULL, NULL,
    jsonb_build_object('requestId', p_request, 'summary', v_summary));
  RETURN jsonb_build_object('summary', v_summary, 'storage', v_storage);
END
$$;
--> statement-breakpoint

-- ── Purge des fichiers : marquée une fois le fichier chiffré supprimé ─────
CREATE FUNCTION privacy.mark_purged_core(p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  n integer;
BEGIN
  PERFORM set_config('app.erasure', 'on', true);
  UPDATE kyc.documents SET purged_at = now()
  WHERE id = ANY (p_ids) AND deleted_at IS NOT NULL AND purged_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;
--> statement-breakpoint
CREATE FUNCTION privacy.mark_purged(p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT app.has_platform_role(ARRAY['platform_admin']) THEN
    RAISE EXCEPTION 'purge réservée aux administrateurs' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN privacy.mark_purged_core(p_ids);
END
$$;
--> statement-breakpoint

-- ── Conservation : purge planifiée ───────────────────────────────────────
CREATE FUNCTION privacy.retention_days(p_key text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT coalesce(
    (SELECT s.days FROM privacy.retention_settings s WHERE s.key = p_key),
    (privacy.retention_rule(p_key)).default_days)
$$;
--> statement-breakpoint
-- Cœur de la purge : appelé par la tâche planifiée (propriétaire) ou par
-- privacy.apply_retention_as_admin. Renvoie les comptes et les fichiers à
-- supprimer du stockage (l'application les supprime puis marque la purge).
CREATE FUNCTION privacy.apply_retention() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now timestamptz := now();
  n_outbox integer; n_notifications integer; n_sessions integer; n_verifications integer;
  n_leads integer; n_drafts integer;
  v_files jsonb;
  v_result jsonb;
BEGIN
  PERFORM set_config('app.erasure', 'on', true);
  DELETE FROM dev.outbox
  WHERE created_at < v_now - make_interval(days => privacy.retention_days('outbox_messages'));
  GET DIAGNOSTICS n_outbox = ROW_COUNT;
  DELETE FROM identity.notifications
  WHERE read_at IS NOT NULL
    AND read_at < v_now - make_interval(days => privacy.retention_days('read_notifications'));
  GET DIAGNOSTICS n_notifications = ROW_COUNT;
  DELETE FROM identity.sessions
  WHERE expires_at < v_now - make_interval(days => privacy.retention_days('expired_sessions'));
  GET DIAGNOSTICS n_sessions = ROW_COUNT;
  DELETE FROM identity.verifications
  WHERE expires_at < v_now - make_interval(days => privacy.retention_days('expired_sessions'));
  GET DIAGNOSTICS n_verifications = ROW_COUNT;
  DELETE FROM marketing.leads
  WHERE created_at < v_now - make_interval(days => privacy.retention_days('marketing_leads'));
  GET DIAGNOSTICS n_leads = ROW_COUNT;
  -- Brouillons jamais soumis : rien n'a été transmis (aucune offre, aucun routage).
  DELETE FROM credit.financing_requests r
  WHERE r.status = 'draft'
    AND r.submitted_at IS NULL
    AND r.updated_at < v_now - make_interval(days => privacy.retention_days('draft_requests'));
  GET DIAGNOSTICS n_drafts = ROW_COUNT;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'key', d.storage_key)), '[]')
    INTO v_files
  FROM kyc.documents d
  WHERE d.deleted_at IS NOT NULL AND d.purged_at IS NULL
    AND d.deleted_at < v_now - make_interval(days => privacy.retention_days('deleted_documents'));
  v_result := jsonb_build_object(
    'outbox', n_outbox, 'notifications', n_notifications, 'sessions', n_sessions,
    'verifications', n_verifications, 'leads', n_leads, 'drafts', n_drafts,
    'files', jsonb_array_length(v_files));
  PERFORM audit.record('retention.applied', 'retention', NULL, NULL, NULL, v_result);
  RETURN v_result || jsonb_build_object('storage', v_files);
END
$$;
--> statement-breakpoint
CREATE FUNCTION privacy.apply_retention_as_admin() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT app.has_platform_role(ARRAY['platform_admin']) THEN
    RAISE EXCEPTION 'purge réservée aux administrateurs' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN privacy.apply_retention();
END
$$;
--> statement-breakpoint

-- ── Droit d'accès : actions journalisées de l'utilisateur ────────────────
CREATE FUNCTION privacy.my_audit_events()
RETURNS TABLE (occurred_at timestamptz, action text, entity_type text, entity_id text, ip inet)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT e.occurred_at, e.action, e.entity_type, e.entity_id, e.ip
  FROM audit.events e
  WHERE e.actor_user_id = app.current_user_id() AND app.current_user_id() IS NOT NULL
  ORDER BY e.id DESC
  LIMIT 5000
$$;
--> statement-breakpoint

-- ── Accès support : lecture seule, motivé, 30 minutes ────────────────────
CREATE FUNCTION privacy.guard_impersonation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user uuid := app.current_user_id();
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'accès support : historique conservé' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.actor_user_id IS DISTINCT FROM v_user
       OR NOT app.has_platform_role(ARRAY['platform_admin', 'platform_support']) THEN
      RAISE EXCEPTION 'accès support réservé au support' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM identity.sessions s
      WHERE s.id = NEW.actor_session_id AND s.user_id = v_user AND s.expires_at > now()
    ) THEN
      RAISE EXCEPTION 'accès support : session de l''agent invalide' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.target_user_id = v_user OR EXISTS (
      SELECT 1 FROM identity.memberships m
      JOIN identity.organizations o ON o.id = m.organization_id
      WHERE m.user_id = NEW.target_user_id AND o.type = 'platform'
    ) OR NOT EXISTS (
      SELECT 1 FROM identity.memberships m
      WHERE m.user_id = NEW.target_user_id AND m.organization_id = NEW.target_organization_id
    ) THEN
      RAISE EXCEPTION 'accès support : compte cible refusé' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.started_at := now();
    NEW.expires_at := now() + interval '30 minutes';
    NEW.ended_at := NULL;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'ended_at') IS DISTINCT FROM (to_jsonb(OLD) - 'ended_at')
     OR OLD.ended_at IS NOT NULL OR NEW.ended_at IS NULL
     OR OLD.actor_user_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'accès support : seule la fin est enregistrée' USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.ended_at := least(now(), OLD.expires_at);
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER impersonations_guard BEFORE INSERT OR UPDATE OR DELETE ON privacy.impersonations
  FOR EACH ROW EXECUTE FUNCTION privacy.guard_impersonation();
--> statement-breakpoint

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE privacy.requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE privacy.retention_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE privacy.impersonations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_read ON privacy.requests FOR SELECT TO lp_app
  USING (app.has_org_role(organization_id, ARRAY['company_owner'])
    OR app.has_platform_role(ARRAY['platform_admin']));
--> statement-breakpoint
CREATE POLICY app_request ON privacy.requests FOR INSERT TO lp_app
  WITH CHECK (app.has_org_role(organization_id, ARRAY['company_owner']));
--> statement-breakpoint
CREATE POLICY app_decide ON privacy.requests FOR UPDATE TO lp_app
  USING (app.has_org_role(organization_id, ARRAY['company_owner'])
    OR app.has_platform_role(ARRAY['platform_admin']));
--> statement-breakpoint
CREATE POLICY app_read ON privacy.retention_settings FOR SELECT TO lp_app
  USING (app.has_platform_role(ARRAY['platform_admin', 'platform_ops']));
--> statement-breakpoint
CREATE POLICY app_write ON privacy.retention_settings FOR INSERT TO lp_app
  WITH CHECK (app.has_platform_role(ARRAY['platform_admin']) AND updated_by = app.current_user_id());
--> statement-breakpoint
CREATE POLICY app_update ON privacy.retention_settings FOR UPDATE TO lp_app
  USING (app.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (updated_by = app.current_user_id());
--> statement-breakpoint
CREATE POLICY app_read ON privacy.impersonations FOR SELECT TO lp_app
  USING (actor_user_id = app.current_user_id() OR app.has_platform_role(ARRAY['platform_admin']));
--> statement-breakpoint
CREATE POLICY app_start ON privacy.impersonations FOR INSERT TO lp_app
  WITH CHECK (actor_user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY app_end ON privacy.impersonations FOR UPDATE TO lp_app
  USING (actor_user_id = app.current_user_id());
--> statement-breakpoint

-- ── Privilèges ───────────────────────────────────────────────────────────
REVOKE ALL ON SCHEMA privacy FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA privacy FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app.erasure_mode() FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA privacy TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON privacy.requests TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON privacy.retention_settings TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON privacy.impersonations TO lp_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.erasure_mode() TO lp_app, lp_auth;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION privacy.retention_rule(text), privacy.erase_organization(uuid),
  privacy.mark_purged(uuid[]), privacy.apply_retention_as_admin(), privacy.my_audit_events()
  TO lp_app;
