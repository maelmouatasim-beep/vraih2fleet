-- Ajouter colonnes pour le contrôle d'accès API aux clés existantes
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT '{"read:scenarios","read:results"}';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_per_hour integer DEFAULT 100;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS request_count integer DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_reset_at timestamptz DEFAULT now();

-- Créer table webhooks pour notifications sortantes
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT 'Mon webhook',
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  is_active boolean DEFAULT true,
  last_triggered_at timestamptz,
  failure_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activer RLS sur webhooks
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Politique: les utilisateurs gèrent leurs propres webhooks
CREATE POLICY "Users can view own webhooks" ON webhooks
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own webhooks" ON webhooks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own webhooks" ON webhooks
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own webhooks" ON webhooks
  FOR DELETE USING (user_id = auth.uid());

-- Trigger pour updated_at sur webhooks
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table pour historique des webhooks envoyés
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid REFERENCES webhooks(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  success boolean NOT NULL DEFAULT false,
  delivered_at timestamptz DEFAULT now()
);

-- RLS pour webhook_deliveries
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhook deliveries" ON webhook_deliveries
  FOR SELECT USING (
    webhook_id IN (SELECT id FROM webhooks WHERE user_id = auth.uid())
  );

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);