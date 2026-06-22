/*
# Phase 2 Agent Systems - Extended Intelligence Infrastructure

1. New Tables:
- trend_intelligence: Trending topics and opportunities
- competitor_intelligence: Competitor channel tracking
- thumbnail_intelligence: Thumbnail scoring and recommendations
- shorts_intelligence: Shorts generation and viral moments
- agent_states: Live agent status monitoring
- intelligence_decisions: Master agent approval records

2. Security:
- Enable RLS on all tables
- Owner-scoped policies using auth.uid()
*/

-- ============================================
-- TREND INTELLIGENCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS trend_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  topic TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  trend_type TEXT NOT NULL CHECK (trend_type IN ('rising', 'viral', 'emerging', 'seasonal', 'evergreen')),
  platform TEXT NOT NULL DEFAULT 'youtube',
  velocity DECIMAL(5,2) DEFAULT 0,
  volume BIGINT DEFAULT 0,
  growth_rate DECIMAL(5,2) DEFAULT 0,
  peak_time TEXT,
  related_keywords TEXT[] DEFAULT '{}',
  suggested_angles TEXT[] DEFAULT '{}',
  competition_level TEXT CHECK (competition_level IN ('low', 'medium', 'high')),
  opportunity_score INTEGER DEFAULT 0,
  detected_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_actioned BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trend_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_trends" ON trend_intelligence;
CREATE POLICY "select_own_trends" ON trend_intelligence FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_trends" ON trend_intelligence;
CREATE POLICY "insert_own_trends" ON trend_intelligence FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_trends" ON trend_intelligence;
CREATE POLICY "update_own_trends" ON trend_intelligence FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trends_user ON trend_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_trends_type ON trend_intelligence(user_id, trend_type);
CREATE INDEX IF NOT EXISTS idx_trends_score ON trend_intelligence(user_id, opportunity_score DESC);

-- ============================================
-- COMPETITOR INTELLIGENCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  competitor_channel_id TEXT NOT NULL,
  competitor_title TEXT NOT NULL,
  competitor_thumbnail TEXT,
  competitor_subscribers BIGINT DEFAULT 0,
  competitor_views BIGINT DEFAULT 0,
  competitor_video_count INTEGER DEFAULT 0,
  niche TEXT,
  content_patterns JSONB,
  upload_frequency TEXT,
  avg_video_performance DECIMAL(10,2),
  top_videos JSONB,
  growth_trend TEXT CHECK (growth_trend IN ('growing', 'stable', 'declining')),
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  content_gaps TEXT[] DEFAULT '{}',
  opportunity_areas TEXT[] DEFAULT '{}',
  last_analyzed TIMESTAMPTZ,
  is_tracking BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, competitor_channel_id)
);

ALTER TABLE competitor_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_competitors" ON competitor_intelligence;
CREATE POLICY "select_own_competitors" ON competitor_intelligence FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_competitors" ON competitor_intelligence;
CREATE POLICY "insert_own_competitors" ON competitor_intelligence FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_competitors" ON competitor_intelligence;
CREATE POLICY "update_own_competitors" ON competitor_intelligence FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_competitors" ON competitor_intelligence;
CREATE POLICY "delete_own_competitors" ON competitor_intelligence FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_competitors_user ON competitor_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_competitors_tracking ON competitor_intelligence(user_id, is_tracking) WHERE is_tracking = true;

-- ============================================
-- THUMBNAIL INTELLIGENCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS thumbnail_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  thumbnail_url TEXT,
  thumbnail_file_path TEXT,
  overall_score INTEGER DEFAULT 0,
  ctr_prediction DECIMAL(5,2) DEFAULT 0,
  engagement_potential INTEGER DEFAULT 0,
  clarity_score INTEGER DEFAULT 0,
  eye_catching_score INTEGER DEFAULT 0,
  text_readability_score INTEGER DEFAULT 0,
  color_harmony_score INTEGER DEFAULT 0,
  face_detection BOOLEAN DEFAULT false,
  emotion_detected TEXT,
  improvements_suggested JSONB,
  a_b_test_variants JSONB,
  winning_variant TEXT,
  model_used TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE thumbnail_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_thumbnails" ON thumbnail_intelligence;
CREATE POLICY "select_own_thumbnails" ON thumbnail_intelligence FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_thumbnails" ON thumbnail_intelligence;
CREATE POLICY "insert_own_thumbnails" ON thumbnail_intelligence FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_thumbnails" ON thumbnail_intelligence;
CREATE POLICY "update_own_thumbnails" ON thumbnail_intelligence FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_thumbnails_user ON thumbnail_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_thumbnails_video ON thumbnail_intelligence(video_id);

-- ============================================
-- SHORTS INTELLIGENCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shorts_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  source_video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  source_youtube_url TEXT,
  transcript TEXT,
  detected_moments JSONB,
  selected_moments JSONB,
  generated_short_count INTEGER DEFAULT 0,
  short_ids UUID[] DEFAULT '{}',
  hook_scores JSONB,
  viral_potential DECIMAL(5,2) DEFAULT 0,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'transcribing', 'analyzing', 'generating', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shorts_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_shorts_intel" ON shorts_intelligence;
CREATE POLICY "select_own_shorts_intel" ON shorts_intelligence FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_shorts_intel" ON shorts_intelligence;
CREATE POLICY "insert_own_shorts_intel" ON shorts_intelligence FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_shorts_intel" ON shorts_intelligence;
CREATE POLICY "update_own_shorts_intel" ON shorts_intelligence FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_shorts_intel_user ON shorts_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_shorts_intel_status ON shorts_intelligence(user_id, processing_status);

-- ============================================
-- AGENT STATES TABLE (Live Monitoring)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN (
    'youtube_intelligence', 'trend_research', 'competitor_intel',
    'thumbnail_intel', 'shorts_factory', 'seo_analyzer',
    'channel_history', 'growth_hub', 'copyright_monitor', 'smart_queue'
  )),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'thinking', 'listening', 'researching', 'learning', 'processing', 'error')),
  current_task TEXT,
  last_activity TEXT,
  activity_timestamp TIMESTAMPTZ,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  last_error TEXT,
  uptime_seconds BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, agent_name)
);

ALTER TABLE agent_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_agent_states" ON agent_states;
CREATE POLICY "select_own_agent_states" ON agent_states FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_agent_states" ON agent_states;
CREATE POLICY "insert_own_agent_states" ON agent_states FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_agent_states" ON agent_states;
CREATE POLICY "update_own_agent_states" ON agent_states FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_states_user ON agent_states(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_states_active ON agent_states(user_id, is_active) WHERE is_active = true;

-- ============================================
-- INTELLIGENCE DECISIONS TABLE (Master Agent Approvals)
-- ============================================
CREATE TABLE IF NOT EXISTS intelligence_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'seo_approval', 'upload_approval', 'thumbnail_approval',
    'shorts_approval', 'growth_recommendation', 'content_strategy'
  )),
  context JSONB NOT NULL,
  proposed_action JSONB NOT NULL,
  agent_recommendation TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0,
  reasoning TEXT,
  user_decision TEXT CHECK (user_decision IN ('approved', 'rejected', 'modified', 'pending')),
  user_feedback TEXT,
  outcome_data JSONB,
  is_actionable BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE intelligence_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_decisions" ON intelligence_decisions;
CREATE POLICY "select_own_decisions" ON intelligence_decisions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_decisions" ON intelligence_decisions;
CREATE POLICY "insert_own_decisions" ON intelligence_decisions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_decisions" ON intelligence_decisions;
CREATE POLICY "update_own_decisions" ON intelligence_decisions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_decisions_user ON intelligence_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_pending ON intelligence_decisions(user_id, user_decision) WHERE user_decision = 'pending' OR user_decision IS NULL;

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trend_intelligence_updated_at') THEN
    CREATE TRIGGER trend_intelligence_updated_at BEFORE UPDATE ON trend_intelligence
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'competitor_intelligence_updated_at') THEN
    CREATE TRIGGER competitor_intelligence_updated_at BEFORE UPDATE ON competitor_intelligence
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'thumbnail_intelligence_updated_at') THEN
    CREATE TRIGGER thumbnail_intelligence_updated_at BEFORE UPDATE ON thumbnail_intelligence
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'shorts_intelligence_updated_at') THEN
    CREATE TRIGGER shorts_intelligence_updated_at BEFORE UPDATE ON shorts_intelligence
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'agent_states_updated_at') THEN
    CREATE TRIGGER agent_states_updated_at BEFORE UPDATE ON agent_states
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'intelligence_decisions_updated_at') THEN
    CREATE TRIGGER intelligence_decisions_updated_at BEFORE UPDATE ON intelligence_decisions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
