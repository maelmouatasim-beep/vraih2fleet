-- Phase 8 : mandats, commissions, factures. La plateforme (administrateurs)
-- gère les mandats et la facturation ; un bailleur lit son mandat, et son
-- administrateur ses commissions et factures. La commission naît dans la
-- même transaction que la mise en loyer, calculée par la base selon la
-- grille du mandat en vigueur à l'acceptation (≡ computeCommission, vérifié
-- par test). Listes de valeurs identiques à packages/domain.

-- ── Grille et calcul ─────────────────────────────────────────────────────
CREATE FUNCTION billing.valid_grid(p_grid jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT jsonb_typeof(p_grid) = 'array'
    AND jsonb_array_length(p_grid) BETWEEN 1 AND 10
    AND (p_grid -> 0 ->> 'from')::numeric = 0
    AND NOT EXISTS (
      SELECT 1
      FROM (
        SELECT (e ->> 'from')::numeric AS from_, (e ->> 'rate')::numeric AS rate,
          lag((e ->> 'from')::numeric) OVER (ORDER BY i) AS prev_from,
          lag((e ->> 'rate')::numeric) OVER (ORDER BY i) AS prev_rate
        FROM jsonb_array_elements(p_grid) WITH ORDINALITY AS t(e, i)
      ) g
      WHERE g.rate IS NULL OR g.rate < 0.001 OR g.rate > 0.05
        OR (g.prev_from IS NOT NULL AND (g.from_ <= g.prev_from OR g.rate > g.prev_rate))
    )
$$;
--> statement-breakpoint
CREATE FUNCTION billing.commission_amount(p_amount numeric, p_grid jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT round(coalesce(sum(
    g.rate * greatest(0, least(p_amount, coalesce(g.next_from, p_amount)) - g.from_)), 0), 2)
  FROM (
    SELECT (e ->> 'from')::numeric AS from_, (e ->> 'rate')::numeric AS rate,
      lead((e ->> 'from')::numeric) OVER (ORDER BY (e ->> 'from')::numeric) AS next_from
    FROM jsonb_array_elements(p_grid) AS t(e)
  ) g
$$;
--> statement-breakpoint

-- ── Contraintes ──────────────────────────────────────────────────────────
ALTER TABLE billing.mandates
  ADD CONSTRAINT mandates_status_check CHECK (status IN ('draft', 'active', 'suspended', 'terminated')),
  ADD CONSTRAINT mandates_grid_check CHECK (billing.valid_grid(grid)),
  ADD CONSTRAINT mandates_months_check CHECK (anti_circumvention_months BETWEEN 6 AND 36),
  ADD CONSTRAINT mandates_note_check CHECK (length(note) <= 2000);
--> statement-breakpoint
ALTER TABLE billing.commissions
  ADD CONSTRAINT commissions_status_check CHECK (status IN ('due', 'invoiced', 'paid', 'cancelled')),
  ADD CONSTRAINT commissions_cancel_reason_check CHECK (cancel_reason IN (
    'deal_unwound', 'billing_error', 'commercial_gesture', 'other')),
  ADD CONSTRAINT commissions_cancel_note_check CHECK (
    cancel_reason IS DISTINCT FROM 'other' OR length(trim(coalesce(cancel_note, ''))) >= 10),
  ADD CONSTRAINT commissions_amounts_check CHECK (
    financed_amount_ht > 0 AND amount_ht >= 0 AND vat >= 0 AND amount_ttc = amount_ht + vat),
  ADD CONSTRAINT commissions_invoiced_check CHECK (
    (status = ANY (ARRAY['invoiced', 'paid'])) = (invoice_id IS NOT NULL) OR status = 'cancelled'),
  ADD CONSTRAINT commissions_paid_check CHECK (
    (status = 'paid') = (paid_on IS NOT NULL AND length(trim(coalesce(payment_reference, ''))) > 0));
--> statement-breakpoint
ALTER TABLE billing.invoices
  ADD CONSTRAINT invoices_dates_check CHECK (due_on >= issued_on),
  ADD CONSTRAINT invoices_amounts_check CHECK (amount_ht >= 0 AND vat >= 0 AND amount_ttc = amount_ht + vat);
--> statement-breakpoint

-- ── Numérotation des factures : LP-F-aaaa-000001 ─────────────────────────
CREATE SEQUENCE billing.invoice_number_seq;
--> statement-breakpoint
CREATE FUNCTION billing.next_invoice_number() RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT 'LP-F-' || to_char(now() AT TIME ZONE 'Africa/Casablanca', 'YYYY') || '-'
    || lpad(nextval('billing.invoice_number_seq')::text, 6, '0')
$$;
--> statement-breakpoint

-- ── Mandats : la plateforme seule ; contenu figé hors brouillon ──────────
CREATE FUNCTION billing.guard_mandate() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'un mandat ne se supprime pas' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT app.has_platform_role(ARRAY['platform_admin']) THEN
    RAISE EXCEPTION 'mandats gérés par l''administration de la plateforme' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'un mandat naît en brouillon' USING ERRCODE = 'check_violation';
    END IF;
    NEW.created_by := app.current_user_id();
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.lessor_organization_id IS DISTINCT FROM OLD.lessor_organization_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'mandat : identité figée' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status <> 'draft' AND (to_jsonb(NEW) - 'status' - 'activated_at' - 'terminated_at' - 'updated_at' - 'note')
     IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'activated_at' - 'terminated_at' - 'updated_at' - 'note') THEN
    RAISE EXCEPTION 'mandat signé : contenu figé (créer une nouvelle version)' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF (OLD.status, NEW.status) NOT IN (
      ('draft', 'active'), ('draft', 'terminated'),
      ('active', 'suspended'), ('active', 'terminated'),
      ('suspended', 'active'), ('suspended', 'terminated')
    ) THEN
      RAISE EXCEPTION 'mandat : transition interdite % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'active' AND OLD.status = 'draft' THEN
      IF length(trim(NEW.contract_version)) = 0 OR NEW.signed_on IS NULL
         OR NEW.signed_on > (now() AT TIME ZONE 'Africa/Casablanca')::date OR NOT NEW.anti_circumvention THEN
        RAISE EXCEPTION 'mandat : version, signature et clause anti-contournement requises' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  -- Horodatages posés par la base seulement.
  NEW.activated_at := CASE WHEN NEW.status = 'active' AND OLD.status = 'draft' THEN now() ELSE OLD.activated_at END;
  NEW.terminated_at := CASE WHEN NEW.status = 'terminated' AND OLD.status <> 'terminated' THEN now() ELSE OLD.terminated_at END;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER mandates_guard BEFORE INSERT OR UPDATE OR DELETE ON billing.mandates
  FOR EACH ROW EXECUTE FUNCTION billing.guard_mandate();
--> statement-breakpoint

-- ── Commission à la mise en loyer (même transaction que l'opération) ──────
CREATE OR REPLACE FUNCTION market.sync_deal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_mandate billing.mandates;
  v_amount numeric;
  v_vat numeric;
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
      -- Mandat en vigueur à l'acceptation : c'est sous lui que l'opération a été intermédiée.
      SELECT * INTO v_mandate FROM billing.mandates m
        WHERE m.lessor_organization_id = NEW.lessor_organization_id
          AND m.activated_at IS NOT NULL AND m.activated_at <= NEW.accepted_at
          AND (m.terminated_at IS NULL OR m.terminated_at > NEW.accepted_at)
        ORDER BY m.activated_at DESC LIMIT 1;
      IF v_mandate.id IS NULL THEN
        RAISE EXCEPTION 'mise en loyer : aucun mandat en vigueur à l''acceptation' USING ERRCODE = 'check_violation';
      END IF;
      v_amount := billing.commission_amount(NEW.financed_amount_ht, v_mandate.grid);
      v_vat := round(v_amount * 0.2, 2);
      INSERT INTO billing.commissions (
        id, deal_id, request_id, lessor_organization_id, mandate_id, status, financed_amount_ht,
        grid, amount_ht, vat_rate, vat, amount_ttc, activated_on)
      VALUES (
        gen_random_uuid(), NEW.id, NEW.request_id, NEW.lessor_organization_id, v_mandate.id, 'due',
        NEW.financed_amount_ht, v_mandate.grid, v_amount, 0.2, v_vat, v_amount + v_vat, NEW.activated_on);
    ELSIF NEW.status = 'cancelled' THEN
      UPDATE credit.financing_requests SET status = 'routed' WHERE id = NEW.request_id AND status = 'accepted';
      UPDATE market.offers SET status = 'submitted' WHERE request_id = NEW.request_id AND status = 'not_retained';
    END IF;
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint

-- ── Commissions : facturation, paiement, avoir — par la plateforme ───────
CREATE FUNCTION billing.guard_commission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_invoice billing.invoices;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'une commission ne se supprime pas' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'invoice_id' - 'paid_on' - 'payment_reference' - 'cancel_reason' - 'cancel_note' - 'updated_at')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'invoice_id' - 'paid_on' - 'payment_reference' - 'cancel_reason' - 'cancel_note' - 'updated_at')
     OR (OLD.status, NEW.status) NOT IN (
       ('due', 'invoiced'), ('due', 'cancelled'),
       ('invoiced', 'paid'), ('invoiced', 'cancelled')
     ) THEN
    RAISE EXCEPTION 'commission : transition interdite % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF NOT app.has_platform_role(ARRAY['platform_admin']) THEN
    RAISE EXCEPTION 'facturation réservée à l''administration' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.status = 'invoiced' THEN
    SELECT * INTO v_invoice FROM billing.invoices WHERE id = NEW.invoice_id;
    IF v_invoice.id IS NULL OR v_invoice.lessor_organization_id <> NEW.lessor_organization_id
       OR v_invoice.amount_ht <> NEW.amount_ht OR v_invoice.amount_ttc <> NEW.amount_ttc
       OR EXISTS (SELECT 1 FROM billing.commissions c WHERE c.invoice_id = NEW.invoice_id AND c.id <> NEW.id) THEN
      RAISE EXCEPTION 'commission : facture incohérente' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.status = 'paid' THEN
    IF NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR NEW.paid_on > (now() AT TIME ZONE 'Africa/Casablanca')::date THEN
      RAISE EXCEPTION 'paiement : date ou facture invalide' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR NEW.paid_on IS NOT NULL THEN
    RAISE EXCEPTION 'avoir : facture et paiement figés' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER commissions_guard BEFORE UPDATE OR DELETE ON billing.commissions
  FOR EACH ROW EXECUTE FUNCTION billing.guard_commission();
--> statement-breakpoint
CREATE FUNCTION billing.guard_invoice() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'une facture émise est immuable (avoir pour l''annuler)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT app.has_platform_role(ARRAY['platform_admin']) THEN
    RAISE EXCEPTION 'facturation réservée à l''administration' USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.number := billing.next_invoice_number();
  NEW.created_by := app.current_user_id();
  NEW.created_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER invoices_guard BEFORE INSERT OR UPDATE OR DELETE ON billing.invoices
  FOR EACH ROW EXECUTE FUNCTION billing.guard_invoice();
--> statement-breakpoint

-- ── Row Level Security ───────────────────────────────────────────────────
ALTER TABLE billing.mandates ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE billing.commissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE billing.invoices ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_read ON billing.mandates FOR SELECT TO lp_app
  USING (app.has_platform_role() OR app.is_member(lessor_organization_id));
--> statement-breakpoint
CREATE POLICY app_manage ON billing.mandates FOR ALL TO lp_app
  USING (app.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (app.has_platform_role(ARRAY['platform_admin']));
--> statement-breakpoint
CREATE POLICY app_read ON billing.commissions FOR SELECT TO lp_app
  USING (app.has_platform_role() OR app.has_org_role(lessor_organization_id, ARRAY['lessor_admin']));
--> statement-breakpoint
CREATE POLICY app_manage ON billing.commissions FOR UPDATE TO lp_app
  USING (app.has_platform_role(ARRAY['platform_admin']))
  WITH CHECK (app.has_platform_role(ARRAY['platform_admin']));
--> statement-breakpoint
CREATE POLICY app_read ON billing.invoices FOR SELECT TO lp_app
  USING (app.has_platform_role() OR app.has_org_role(lessor_organization_id, ARRAY['lessor_admin']));
--> statement-breakpoint
CREATE POLICY app_issue ON billing.invoices FOR INSERT TO lp_app
  WITH CHECK (app.has_platform_role(ARRAY['platform_admin']));
--> statement-breakpoint

-- ── Privilèges ───────────────────────────────────────────────────────────
REVOKE ALL ON SCHEMA billing FROM PUBLIC;
--> statement-breakpoint
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA billing FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA billing TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON billing.mandates TO lp_app;
--> statement-breakpoint
GRANT SELECT, UPDATE ON billing.commissions TO lp_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON billing.invoices TO lp_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION billing.valid_grid(jsonb), billing.commission_amount(numeric, jsonb),
  billing.next_invoice_number() TO lp_app;
