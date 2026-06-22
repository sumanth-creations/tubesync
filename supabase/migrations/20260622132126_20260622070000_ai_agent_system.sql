/*
# AI Agent System - Comprehensive Intelligence Infrastructure

1. New Tables:
- agent_memory: Long-term memory storage for learned facts, preferences, patterns
- agent_sessions: Conversation session management
- agent_messages: Message history with rich context
- agent_knowledge: Structured knowledge base entries
- agent_tool_logs: Tool execution logs for transparency
- seo_history: SEO performance tracking over time
- channel_history: Channel performance snapshots
- growth_intelligence: Growth predictions and insights
- copyright_reports: Copyright monitoring results
- scheduled_publishes: Auto-publish scheduling (linked to videos)

2. Security:
- Enable RLS on all tables
- Owner-scoped policies using auth.uid()
- Proper indexes for scalability

3. Notes:
- Idempotent - uses IF NOT EXISTS
- Preserves existing data
- Scalable query patterns
*/

-- ============================================
-- AGENT MEMORY TABLE (Long-term memory)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'pattern', 'insight', 'feedback', 'correction')),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.8,
  source TEXT CHECK (source IN ('user_input', 'ai_inferred', 'analytics', 'feedback', 'external')),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  context JSONB,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, category, key)
);

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_memory" ON agent_memory;
CREATE POLICY "select_own_memory" ON agent_memory FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_memory" ON agent_memory;
CREATE POLICY "insert_own_memory" ON agent_memory FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_memory" ON agent_memory;
CREATE POLICY "update_own_memory" ON agent_memory FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_memory" ON agent_memory;
CREATE POLICY "delete_own_memory" ON agent_memory FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_memory_user ON agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(user_id, category);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_active ON agent_memory(user_id, is_active) WHERE is_active = true;

-- ============================================
-- AGENT SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  session_type TEXT NOT NULL DEFAULT 'chat' CHECK (session_type IN ('chat', 'task', 'workflow', 'automation')),
  title TEXT,
  summary TEXT,
  context JSONB,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON agent_sessions;
CREATE POLICY "select_own_sessions" ON agent_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_sessions" ON agent_sessions;
CREATE POLICY "insert_own_sessions" ON agent_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_sessions" ON agent_sessions;
CREATE POLICY "update_own_sessions" ON agent_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_active ON agent_sessions(user_id, is_active) WHERE is_active = true;

-- ============================================
-- AGENT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_result JSONB,
  tokens_used INTEGER,
  model_used TEXT,
  latency_ms INTEGER,
  metadata JSONB,
  parent_message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON agent_messages;
CREATE POLICY "select_own_messages" ON agent_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_messages" ON agent_messages;
CREATE POLICY "insert_own_messages" ON agent_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_user ON agent_messages(user_id, created_at DESC);

-- ============================================
-- AGENT KNOWLEDGE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('best_practice', 'template', 'workflow', 'optimization', 'lesson_learned')),
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  effectiveness_score DECIMAL(3,2),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  source_session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_knowledge" ON agent_knowledge;
CREATE POLICY "select_own_knowledge" ON agent_knowledge FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_knowledge" ON agent_knowledge;
CREATE POLICY "insert_own_knowledge" ON agent_knowledge FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_knowledge" ON agent_knowledge;
CREATE POLICY "update_own_knowledge" ON agent_knowledge FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_knowledge" ON agent_knowledge;
CREATE POLICY "delete_own_knowledge" ON agent_knowledge FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_user ON agent_knowledge(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_domain ON agent_knowledge(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_type ON agent_knowledge(user_id, knowledge_type);

-- ============================================
-- AGENT TOOL LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tool_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES agent_messages(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_action TEXT NOT NULL,
  input_data JSONB,
  output_data JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_tool_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tool_logs" ON agent_tool_logs;
CREATE POLICY "select_own_tool_logs" ON agent_tool_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_tool_logs" ON agent_tool_logs;
CREATE POLICY "insert_own_tool_logs" ON agent_tool_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_tool_logs_session ON agent_tool_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_logs_user ON agent_tool_logs(user_id, created_at DESC);

-- ============================================
-- SEO HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS seo_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  position INTEGER,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,2),
  average_position DECIMAL(6,2),
  search_appearance_type TEXT,
  country TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE seo_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_seo_history" ON seo_history;
CREATE POLICY "select_own_seo_history" ON seo_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_seo_history" ON seo_history;
CREATE POLICY "insert_own_seo_history" ON seo_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_seo_history_user ON seo_history(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_history_video ON seo_history(video_id);
CREATE INDEX IF NOT EXISTS idx_seo_history_keyword ON seo_history(user_id, keyword);
CREATE INDEX IF NOT EXISTS idx_seo_history_date ON seo_history(user_id, date DESC);

-- ============================================
-- CHANNEL HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS channel_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  channel_id UUID REFERENCES youtube_channels(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subscriber_count BIGINT,
  view_count BIGINT,
  video_count INTEGER,
  subscriber_change INTEGER DEFAULT 0,
  view_change BIGINT DEFAULT 0,
  engagement_rate DECIMAL(5,2),
  avg_views_per_video BIGINT,
  top_video_id UUID REFERENCES videos(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, channel_id, snapshot_date)
);

ALTER TABLE channel_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_channel_history" ON channel_history;
CREATE POLICY "select_own_channel_history" ON channel_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_channel_history" ON channel_history;
CREATE POLICY "insert_own_channel_history" ON channel_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_channel_history_user ON channel_history(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_history_channel ON channel_history(channel_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_channel_history_date ON channel_history(user_id, snapshot_date DESC);

-- ============================================
-- GROWTH INTELLIGENCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS growth_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  channel_id UUID REFERENCES youtube_channels(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('prediction', 'recommendation', 'anomaly', 'opportunity', 'benchmark')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metric_name TEXT,
  current_value DECIMAL(15,2),
  predicted_value DECIMAL(15,2),
  confidence DECIMAL(3,2),
  time_frame TEXT,
  action_items JSONB,
  related_videos UUID[] DEFAULT '{}',
  priority INTEGER DEFAULT 5,
  is_actioned BOOLEAN DEFAULT false,
  actioned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE growth_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_growth" ON growth_intelligence;
CREATE POLICY "select_own_growth" ON growth_intelligence FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_growth" ON growth_intelligence;
CREATE POLICY "insert_own_growth" ON growth_intelligence FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_growth" ON growth_intelligence;
CREATE POLICY "update_own_growth" ON growth_intelligence FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_growth_intelligence_user ON growth_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_intelligence_channel ON growth_intelligence(channel_id);
CREATE INDEX IF NOT EXISTS idx_growth_intelligence_type ON growth_intelligence(user_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_growth_intelligence_priority ON growth_intelligence(user_id, priority DESC);

-- ============================================
-- COPYRIGHT REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS copyright_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  youtube_video_id TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('claim', 'takedown', 'strike', 'warning', 'content_id_match', 'manual_check')),
  claimant TEXT,
  claim_type TEXT,
  asset_title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'disputed', 'appealed', 'expired')),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  affected_content TEXT,
  restrictions JSONB,
  resolution_notes TEXT,
  detected_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE copyright_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_copyright" ON copyright_reports;
CREATE POLICY "select_own_copyright" ON copyright_reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_copyright" ON copyright_reports;
CREATE POLICY "insert_own_copyright" ON copyright_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_copyright" ON copyright_reports;
CREATE POLICY "update_own_copyright" ON copyright_reports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_copyright_reports_user ON copyright_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_copyright_reports_video ON copyright_reports(video_id);
CREATE INDEX IF NOT EXISTS idx_copyright_reports_status ON copyright_reports(user_id, status);

-- ============================================
-- SCHEDULED PUBLISHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_publishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  youtube_channel_id TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 5,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  metadata JSONB,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scheduled_publishes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scheduled" ON scheduled_publishes;
CREATE POLICY "select_own_scheduled" ON scheduled_publishes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_scheduled" ON scheduled_publishes;
CREATE POLICY "insert_own_scheduled" ON scheduled_publishes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_scheduled" ON scheduled_publishes;
CREATE POLICY "update_own_scheduled" ON scheduled_publishes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_scheduled" ON scheduled_publishes;
CREATE POLICY "delete_own_scheduled" ON scheduled_publishes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_publishes_user ON scheduled_publishes(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_publishes_status ON scheduled_publishes(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_publishes_due ON scheduled_publishes(scheduled_for) 
  WHERE status = 'pending';

-- ============================================
-- USER SETTINGS TABLE (for AI/Agent configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() UNIQUE,
  gemini_api_key TEXT,
  channel_niche TEXT,
  ai_preferences JSONB DEFAULT '{}',
  notification_preferences JSONB DEFAULT '{}',
  automation_enabled BOOLEAN DEFAULT true,
  learning_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON user_settings;
CREATE POLICY "select_own_settings" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_settings" ON user_settings;
CREATE POLICY "insert_own_settings" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_settings" ON user_settings;
CREATE POLICY "update_own_settings" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- ============================================
-- FUNCTION: Update timestamps automatically
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'agent_memory_updated_at') THEN
    CREATE TRIGGER agent_memory_updated_at BEFORE UPDATE ON agent_memory
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'agent_sessions_updated_at') THEN
    CREATE TRIGGER agent_sessions_updated_at BEFORE UPDATE ON agent_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'agent_knowledge_updated_at') THEN
    CREATE TRIGGER agent_knowledge_updated_at BEFORE UPDATE ON agent_knowledge
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'growth_intelligence_updated_at') THEN
    CREATE TRIGGER growth_intelligence_updated_at BEFORE UPDATE ON growth_intelligence
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'copyright_reports_updated_at') THEN
    CREATE TRIGGER copyright_reports_updated_at BEFORE UPDATE ON copyright_reports
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'scheduled_publishes_updated_at') THEN
    CREATE TRIGGER scheduled_publishes_updated_at BEFORE UPDATE ON scheduled_publishes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'user_settings_updated_at') THEN
    CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- ENABLE REALTIME FOR NEW TABLES
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'agent_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_sessions;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'agent_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_messages;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'scheduled_publishes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_publishes;
  END IF;
END $$;
