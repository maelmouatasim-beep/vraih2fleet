-- Demandes de contact du site public : écriture par fonction seulement
-- (validation, limitation de débit), lecture par la plateforme seulement.

ALTER TABLE marketing.leads
  ADD CONSTRAINT leads_kind_check CHECK (kind IN ('lessor', 'company')),
  ADD CONSTRAINT leads_status_check CHECK (status IN ('new', 'contacted', 'closed')),
  ADD CONSTRAINT leads_locale_check CHECK (locale IN ('fr', 'ar', 'en')),
  ADD CONSTRAINT leads_email_check CHECK (email ~ '^[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}$' AND length(email) <= 254),
  ADD CONSTRAINT leads_lengths_check CHECK (
    length(organization_name) BETWEEN 2 AND 200
    AND length(contact_name) BETWEEN 2 AND 120
    AND (phone IS NULL OR length(phone) <= 30)
    AND (message IS NULL OR length(message) <= 2000)
  );
--> statement-breakpoint

CREATE FUNCTION marketing.submit_lead(
  p_kind text,
  p_organization_name text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_message text,
  p_locale text,
  p_consent_version text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_ip inet := nullif(current_setting('app.ip', true), '')::inet;
  v_email text := lower(trim(p_email));
  v_id uuid;
BEGIN
  IF p_consent_version IS NULL OR p_consent_version = '' THEN
    RAISE EXCEPTION 'consentement requis' USING ERRCODE = 'check_violation';
  END IF;
  -- Limitation de débit : 5 demandes par heure et par IP, 3 par jour et par adresse.
  IF v_ip IS NOT NULL AND (
    SELECT count(*) FROM marketing.leads
    WHERE ip = v_ip AND created_at > now() - interval '1 hour'
  ) >= 5 THEN
    RAISE EXCEPTION 'trop de demandes' USING ERRCODE = 'P0429';
  END IF;
  IF (
    SELECT count(*) FROM marketing.leads
    WHERE email = v_email AND created_at > now() - interval '1 day'
  ) >= 3 THEN
    RAISE EXCEPTION 'trop de demandes' USING ERRCODE = 'P0429';
  END IF;

  INSERT INTO marketing.leads (
    kind, organization_name, contact_name, email, phone, message, locale,
    consent_version, consented_at, ip
  ) VALUES (
    p_kind, trim(p_organization_name), trim(p_contact_name), v_email,
    nullif(trim(p_phone), ''), nullif(trim(p_message), ''), p_locale,
    p_consent_version, now(), v_ip
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;
--> statement-breakpoint

ALTER TABLE marketing.leads ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_read ON marketing.leads FOR SELECT TO lp_app
  USING (app.has_platform_role(ARRAY['platform_admin', 'platform_ops']));
--> statement-breakpoint
REVOKE ALL ON SCHEMA marketing FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA marketing FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA marketing TO lp_app;
--> statement-breakpoint
GRANT SELECT ON marketing.leads TO lp_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION marketing.submit_lead(text, text, text, text, text, text, text, text) TO lp_app;
