-- ============================================================================
-- ROADMAP BUILDER SCHEMA
-- Version: 1.0
-- Date: 2026-01-11
-- Description: Tables pour planification transition de flottes
-- ============================================================================

-- ============================================================================
-- TABLE 1: transition_roadmaps
-- ============================================================================
CREATE TABLE IF NOT EXISTS transition_roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_budget NUMERIC(12,2),
  currency TEXT DEFAULT 'CAD',
  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  generated_automatically BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_roadmaps_project ON transition_roadmaps(project_id);
CREATE INDEX idx_roadmaps_dates ON transition_roadmaps(start_date, end_date);
CREATE INDEX idx_roadmaps_status ON transition_roadmaps(status);

CREATE TRIGGER update_roadmaps_updated_at
  BEFORE UPDATE ON transition_roadmaps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 2: roadmap_phases
-- ============================================================================
CREATE TABLE IF NOT EXISTS roadmap_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES transition_roadmaps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  color TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget_allocated NUMERIC(12,2),
  budget_spent NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'planned',
  completion_percentage INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_phase_order UNIQUE(roadmap_id, order_index)
);

CREATE INDEX idx_phases_roadmap ON roadmap_phases(roadmap_id);
CREATE INDEX idx_phases_dates ON roadmap_phases(start_date, end_date);
CREATE INDEX idx_phases_status ON roadmap_phases(status);

CREATE TRIGGER update_phases_updated_at
  BEFORE UPDATE ON roadmap_phases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 3: roadmap_milestones
-- ============================================================================
CREATE TABLE IF NOT EXISTS roadmap_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES roadmap_phases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  due_date DATE NOT NULL,
  completion_date DATE,
  duration_days INTEGER DEFAULT 1,
  is_critical BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium',
  cost_estimate NUMERIC(12,2),
  cost_actual NUMERIC(12,2),
  dependencies JSONB DEFAULT '[]',
  status TEXT DEFAULT 'not_started',
  progress_percentage INTEGER DEFAULT 0,
  assigned_to UUID,
  assigned_team TEXT,
  metadata JSONB DEFAULT '{}',
  alert_days_before INTEGER,
  alert_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_milestones_phase ON roadmap_milestones(phase_id);
CREATE INDEX idx_milestones_due_date ON roadmap_milestones(due_date);
CREATE INDEX idx_milestones_status ON roadmap_milestones(status);
CREATE INDEX idx_milestones_type ON roadmap_milestones(type);
CREATE INDEX idx_milestones_assigned ON roadmap_milestones(assigned_to);
CREATE INDEX idx_milestones_critical ON roadmap_milestones(is_critical) WHERE is_critical = true;
CREATE INDEX idx_milestones_metadata ON roadmap_milestones USING GIN (metadata);

CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON roadmap_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 4: roadmap_cash_flow
-- ============================================================================
CREATE TABLE IF NOT EXISTS roadmap_cash_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES transition_roadmaps(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES roadmap_milestones(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'CAD',
  is_actual BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cash_flow_roadmap ON roadmap_cash_flow(roadmap_id);
CREATE INDEX idx_cash_flow_date ON roadmap_cash_flow(date);
CREATE INDEX idx_cash_flow_type ON roadmap_cash_flow(type);
CREATE INDEX idx_cash_flow_actual ON roadmap_cash_flow(is_actual);

-- ============================================================================
-- TABLE 5: reference_timelines
-- ============================================================================
CREATE TABLE IF NOT EXISTS reference_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  typical_duration_days INTEGER NOT NULL,
  min_duration_days INTEGER,
  max_duration_days INTEGER,
  region TEXT,
  city TEXT,
  source_url TEXT,
  source_type TEXT,
  reliability_score INTEGER,
  last_verified DATE,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ref_timelines_category ON reference_timelines(category);
CREATE INDEX idx_ref_timelines_region ON reference_timelines(region);
CREATE INDEX idx_ref_timelines_active ON reference_timelines(is_active) WHERE is_active = true;
CREATE INDEX idx_ref_timelines_metadata ON reference_timelines USING GIN (metadata);

CREATE TRIGGER update_ref_timelines_updated_at
  BEFORE UPDATE ON reference_timelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 6: roadmap_alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS roadmap_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES transition_roadmaps(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES roadmap_milestones(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  action_label TEXT,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trigger_date DATE,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  assigned_to UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_roadmap ON roadmap_alerts(roadmap_id);
CREATE INDEX idx_alerts_milestone ON roadmap_alerts(milestone_id);
CREATE INDEX idx_alerts_assigned ON roadmap_alerts(assigned_to);
CREATE INDEX idx_alerts_unread ON roadmap_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_alerts_severity ON roadmap_alerts(severity);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- transition_roadmaps
ALTER TABLE transition_roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view roadmaps for their projects" ON transition_roadmaps
  FOR SELECT USING (
    is_project_owner(project_id) OR 
    EXISTS (SELECT 1 FROM project_collaborators WHERE project_collaborators.project_id = transition_roadmaps.project_id AND project_collaborators.user_id = auth.uid())
  );

CREATE POLICY "Users can create roadmaps for their projects" ON transition_roadmaps
  FOR INSERT WITH CHECK (is_project_owner(project_id));

CREATE POLICY "Users can update roadmaps for their projects" ON transition_roadmaps
  FOR UPDATE USING (
    is_project_owner(project_id) OR 
    EXISTS (SELECT 1 FROM project_collaborators WHERE project_collaborators.project_id = transition_roadmaps.project_id AND project_collaborators.user_id = auth.uid() AND project_collaborators.role IN ('owner', 'editor'))
  );

CREATE POLICY "Users can delete roadmaps for their projects" ON transition_roadmaps
  FOR DELETE USING (is_project_owner(project_id));

-- roadmap_phases (inherits from roadmap)
ALTER TABLE roadmap_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view phases for accessible roadmaps" ON roadmap_phases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM transition_roadmaps WHERE transition_roadmaps.id = roadmap_phases.roadmap_id)
  );

CREATE POLICY "Users can manage phases for accessible roadmaps" ON roadmap_phases
  FOR ALL USING (
    EXISTS (SELECT 1 FROM transition_roadmaps WHERE transition_roadmaps.id = roadmap_phases.roadmap_id)
  );

-- roadmap_milestones
ALTER TABLE roadmap_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view milestones for accessible phases" ON roadmap_milestones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM roadmap_phases WHERE roadmap_phases.id = roadmap_milestones.phase_id)
  );

CREATE POLICY "Users can manage milestones for accessible phases" ON roadmap_milestones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM roadmap_phases WHERE roadmap_phases.id = roadmap_milestones.phase_id)
  );

-- roadmap_cash_flow
ALTER TABLE roadmap_cash_flow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cash flow for accessible roadmaps" ON roadmap_cash_flow
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM transition_roadmaps WHERE transition_roadmaps.id = roadmap_cash_flow.roadmap_id)
  );

CREATE POLICY "Users can manage cash flow for accessible roadmaps" ON roadmap_cash_flow
  FOR ALL USING (
    EXISTS (SELECT 1 FROM transition_roadmaps WHERE transition_roadmaps.id = roadmap_cash_flow.roadmap_id)
  );

-- reference_timelines (public read, admin write)
ALTER TABLE reference_timelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reference timelines" ON reference_timelines
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert reference timelines" ON reference_timelines
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update reference timelines" ON reference_timelines
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete reference timelines" ON reference_timelines
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- roadmap_alerts
ALTER TABLE roadmap_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts for accessible roadmaps" ON roadmap_alerts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM transition_roadmaps WHERE transition_roadmaps.id = roadmap_alerts.roadmap_id)
  );

CREATE POLICY "Users can manage alerts for accessible roadmaps" ON roadmap_alerts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM transition_roadmaps WHERE transition_roadmaps.id = roadmap_alerts.roadmap_id)
  );