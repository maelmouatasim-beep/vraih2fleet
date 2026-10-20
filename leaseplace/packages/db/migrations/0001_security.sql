-- Sécurité de la base (ADR 0003 et 0004).
--
-- Trois rôles :
--   * propriétaire (celui qui migre) : possède tables et fonctions ;
--   * lp_auth : utilisé par Better-Auth, accès aux seules tables identity ;
--   * lp_app  : utilisé par l'application, SANS BYPASSRLS, ne voit que ce
--     que les policies autorisent pour l'utilisateur placé dans le contexte
--     de la transaction (`app.user_id`, posé par withActor()).
-- Les rôles sont créés NOLOGIN ; le mot de passe et LOGIN sont posés par
-- environnement (scripts/db-local.sh, docs/deploiement.md).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lp_app') THEN
    CREATE ROLE lp_app NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lp_auth') THEN
    CREATE ROLE lp_auth NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint

-- ── Contraintes que Drizzle n'exprime pas ────────────────────────────────
ALTER TABLE identity.organizations
  ADD CONSTRAINT organizations_type_check
  CHECK (type IN ('company', 'lessor', 'prescriber', 'supplier', 'platform'));
--> statement-breakpoint
ALTER TABLE identity.users
  ADD CONSTRAINT users_locale_check CHECK (locale IN ('fr', 'ar', 'en'));
--> statement-breakpoint
ALTER TABLE identity.users
  ADD CONSTRAINT users_email_lowercase_check CHECK (email = lower(email));
--> statement-breakpoint
ALTER TABLE identity.role_catalog
  ADD CONSTRAINT role_catalog_type_check
  CHECK (organization_type IN ('company', 'lessor', 'prescriber', 'supplier', 'platform'));
--> statement-breakpoint
ALTER TABLE identity.sessions
  ADD CONSTRAINT sessions_active_organization_fk
  FOREIGN KEY (active_organization_id) REFERENCES identity.organizations (id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE audit.events
  ADD CONSTRAINT events_action_format_check
  CHECK (action ~ '^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$');
--> statement-breakpoint

-- Catalogue rôle ↔ type (identique à packages/domain/src/rbac/roles.ts,
-- vérifié par packages/db/src/__tests__/catalogue.test.ts).
INSERT INTO identity.role_catalog (organization_type, role) VALUES
  ('company', 'company_owner'),
  ('company', 'company_member'),
  ('lessor', 'lessor_admin'),
  ('lessor', 'lessor_analyst'),
  ('lessor', 'lessor_viewer'),
  ('prescriber', 'prescriber_admin'),
  ('prescriber', 'prescriber_member'),
  ('supplier', 'supplier_admin'),
  ('supplier', 'supplier_member'),
  ('platform', 'platform_admin'),
  ('platform', 'platform_ops'),
  ('platform', 'platform_support');
--> statement-breakpoint

-- Un rôle n'est valide que dans son type d'organisation.
CREATE FUNCTION identity.check_membership_role() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM identity.role_catalog c
    JOIN identity.organizations o ON o.type = c.organization_type
    WHERE o.id = NEW.organization_id AND c.role = NEW.role
  ) THEN
    RAISE EXCEPTION 'rôle % invalide pour cette organisation', NEW.role
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER memberships_role_check
  BEFORE INSERT OR UPDATE OF role, organization_id ON identity.memberships
  FOR EACH ROW EXECUTE FUNCTION identity.check_membership_role();
--> statement-breakpoint

-- ── Contexte de transaction ──────────────────────────────────────────────
CREATE SCHEMA app;
--> statement-breakpoint
CREATE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE
SET search_path = pg_catalog
AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE FUNCTION app.current_organization_id() RETURNS uuid
LANGUAGE sql STABLE
SET search_path = pg_catalog
AS $$ SELECT nullif(current_setting('app.organization_id', true), '')::uuid $$;
--> statement-breakpoint

-- Fonctions d'appartenance : SECURITY DEFINER pour lire memberships sans
-- récursion de RLS ; elles ne renvoient qu'un booléen sur l'utilisateur du
-- contexte, jamais de données.
CREATE FUNCTION app.is_member(p_organization_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM identity.memberships m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = app.current_user_id()
  )
$$;
--> statement-breakpoint
CREATE FUNCTION app.has_platform_role(p_roles text[] DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM identity.memberships m
    JOIN identity.organizations o ON o.id = m.organization_id
    WHERE o.type = 'platform'
      AND m.user_id = app.current_user_id()
      AND (p_roles IS NULL OR m.role = ANY (p_roles))
  )
$$;
--> statement-breakpoint
CREATE FUNCTION app.shares_organization(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM identity.memberships mine
    JOIN identity.memberships theirs ON theirs.organization_id = mine.organization_id
    WHERE mine.user_id = app.current_user_id()
      AND theirs.user_id = p_user_id
  )
$$;
--> statement-breakpoint

-- ── Journal d'audit ──────────────────────────────────────────────────────
CREATE FUNCTION audit.row_digest(
  p_prev_hash bytea,
  p_occurred_at timestamptz,
  p_actor_user_id uuid,
  p_actor_organization_id uuid,
  p_impersonator_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb,
  p_metadata jsonb,
  p_ip inet,
  p_user_agent text,
  p_trace_id text
) RETURNS bytea
LANGUAGE sql STABLE
SET search_path = pg_catalog
AS $$
  SELECT sha256(
    coalesce(p_prev_hash, ''::bytea) ||
    convert_to(
      jsonb_build_array(
        to_char(p_occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        p_actor_user_id, p_actor_organization_id, p_impersonator_user_id,
        p_action, p_entity_type, p_entity_id,
        p_before, p_after, p_metadata,
        host(p_ip), p_user_agent, p_trace_id
      )::text,
      'UTF8'
    )
  )
$$;
--> statement-breakpoint

-- Seule porte d'écriture. Acteur, organisation, usurpation (support), IP,
-- agent et trace viennent du contexte de transaction : un appelant ne peut
-- pas écrire au nom d'un autre.
CREATE FUNCTION audit.record(
  p_action text,
  p_entity_type text,
  p_entity_id text DEFAULT NULL,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_prev bytea;
  v_at timestamptz := clock_timestamp();
  v_actor uuid := app.current_user_id();
  v_org uuid := app.current_organization_id();
  v_impersonator uuid := nullif(current_setting('app.impersonator_id', true), '')::uuid;
  v_ip inet := nullif(current_setting('app.ip', true), '')::inet;
  v_ua text := nullif(current_setting('app.user_agent', true), '');
  v_trace text := nullif(current_setting('app.trace_id', true), '');
  v_id bigint;
BEGIN
  -- Sérialise les écritures pour une chaîne linéaire.
  PERFORM pg_advisory_xact_lock(hashtext('audit.events'));
  SELECT e.hash INTO v_prev FROM audit.events e ORDER BY e.id DESC LIMIT 1;

  INSERT INTO audit.events (
    occurred_at, actor_user_id, actor_organization_id, impersonator_user_id,
    action, entity_type, entity_id, before, after, metadata,
    ip, user_agent, trace_id, prev_hash, hash
  ) VALUES (
    v_at, v_actor, v_org, v_impersonator,
    p_action, p_entity_type, p_entity_id, p_before, p_after, p_metadata,
    v_ip, v_ua, v_trace, v_prev,
    audit.row_digest(v_prev, v_at, v_actor, v_org, v_impersonator,
      p_action, p_entity_type, p_entity_id, p_before, p_after, p_metadata,
      v_ip, v_ua, v_trace)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;
--> statement-breakpoint

-- Renvoie l'identifiant de la première ligne altérée, ou NULL si la chaîne
-- est intacte.
-- SECURITY INVOKER : appelée par lp_app, elle ne lit que ce que la RLS laisse
-- voir (tout le journal pour les rôles audit.read, refus pour les autres).
CREATE FUNCTION audit.verify_chain() RETURNS bigint
LANGUAGE plpgsql STABLE
SET search_path = pg_catalog
AS $$
DECLARE
  r audit.events;
  v_prev bytea := NULL;
BEGIN
  -- Appel applicatif réservé aux rôles portant audit.read.
  IF current_user = 'lp_app' AND NOT app.has_platform_role(ARRAY['platform_admin', 'platform_ops']) THEN
    RAISE EXCEPTION 'audit.verify_chain réservé à la plateforme' USING ERRCODE = 'insufficient_privilege';
  END IF;
  FOR r IN SELECT * FROM audit.events ORDER BY id LOOP
    IF r.prev_hash IS DISTINCT FROM v_prev
       OR r.hash <> audit.row_digest(r.prev_hash, r.occurred_at, r.actor_user_id,
            r.actor_organization_id, r.impersonator_user_id, r.action, r.entity_type,
            r.entity_id, r.before, r.after, r.metadata, r.ip, r.user_agent, r.trace_id)
    THEN
      RETURN r.id;
    END IF;
    v_prev := r.hash;
  END LOOP;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE FUNCTION audit.forbid_mutation() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'audit.events est append-only (% refusé)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER events_no_update_delete
  BEFORE UPDATE OR DELETE ON audit.events
  FOR EACH ROW EXECUTE FUNCTION audit.forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER events_no_truncate
  BEFORE TRUNCATE ON audit.events
  FOR EACH STATEMENT EXECUTE FUNCTION audit.forbid_mutation();
--> statement-breakpoint

-- ── Row Level Security ───────────────────────────────────────────────────
ALTER TABLE identity.users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.accounts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.verifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.two_factors ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.invitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.role_catalog ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE identity.rate_limits ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit.events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE dev.outbox ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- lp_auth : Better-Auth gère l'identité, il voit toutes les tables identity
-- (et rien d'autre : aucune table métier, aucun journal en lecture).
CREATE POLICY auth_all ON identity.users FOR ALL TO lp_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all ON identity.sessions FOR ALL TO lp_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all ON identity.accounts FOR ALL TO lp_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all ON identity.verifications FOR ALL TO lp_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all ON identity.two_factors FOR ALL TO lp_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all ON identity.organizations FOR ALL TO lp_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all ON identity.memberships FOR ALL TO lp_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all ON identity.invitations FOR ALL TO lp_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_read ON identity.role_catalog FOR SELECT TO lp_auth USING (true);
--> statement-breakpoint
CREATE POLICY auth_all ON identity.rate_limits FOR ALL TO lp_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all ON dev.outbox FOR ALL TO lp_auth USING (true) WITH CHECK (true);
--> statement-breakpoint

-- lp_app : lecture seule de l'identité, filtrée par l'utilisateur du contexte.
CREATE POLICY app_read ON identity.users FOR SELECT TO lp_app
  USING (id = app.current_user_id() OR app.shares_organization(id) OR app.has_platform_role());
--> statement-breakpoint
CREATE POLICY app_read ON identity.organizations FOR SELECT TO lp_app
  USING (app.is_member(id) OR app.has_platform_role());
--> statement-breakpoint
CREATE POLICY app_read ON identity.memberships FOR SELECT TO lp_app
  USING (app.is_member(organization_id) OR app.has_platform_role());
--> statement-breakpoint
CREATE POLICY app_read ON identity.invitations FOR SELECT TO lp_app
  USING (app.is_member(organization_id) OR app.has_platform_role());
--> statement-breakpoint
CREATE POLICY app_read ON identity.role_catalog FOR SELECT TO lp_app USING (true);
--> statement-breakpoint
-- Lecture du journal : rôles portant la permission audit.read (domain).
CREATE POLICY app_read ON audit.events FOR SELECT TO lp_app
  USING (app.has_platform_role(ARRAY['platform_admin', 'platform_ops']));
--> statement-breakpoint

-- ── Privilèges ───────────────────────────────────────────────────────────
-- Les fonctions sont exécutables par PUBLIC par défaut : on retire tout.
REVOKE ALL ON SCHEMA app, audit, identity, dev FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app, audit, identity FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app, identity, audit TO lp_app, lp_auth;
--> statement-breakpoint
GRANT USAGE ON SCHEMA dev TO lp_auth;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  app.current_user_id(), app.current_organization_id(), app.is_member(uuid),
  app.has_platform_role(text[]), app.shares_organization(uuid)
  TO lp_app, lp_auth;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION audit.record(text, text, text, jsonb, jsonb, jsonb) TO lp_app, lp_auth;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION audit.verify_chain(), audit.row_digest(bytea, timestamptz, uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb, inet, text, text) TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  identity.users, identity.sessions, identity.accounts, identity.verifications,
  identity.two_factors, identity.organizations, identity.memberships,
  identity.invitations, identity.rate_limits, dev.outbox
  TO lp_auth;
--> statement-breakpoint
GRANT SELECT ON identity.role_catalog TO lp_auth, lp_app;
--> statement-breakpoint
GRANT SELECT ON identity.users, identity.organizations, identity.memberships, identity.invitations
  TO lp_app;
--> statement-breakpoint
GRANT SELECT ON audit.events TO lp_app;
