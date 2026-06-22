/**
 * Extended Agent API - Phase 2 Systems
 *
 * API layer for new agent systems:
 * - Trend Intelligence
 * - Competitor Intelligence
 * - Thumbnail Intelligence
 * - Shorts Intelligence
 * - Agent States
 * - Intelligence Decisions
 */

import { supabase } from '../supabase';
import type {
  TrendIntelligence, CompetitorIntelligence, ThumbnailIntelligence,
  ShortsIntelligence, AgentState, IntelligenceDecision,
} from '../../types';

// ============ TREND INTELLIGENCE ============

export async function getTrends(limit = 50, trendType?: string): Promise<TrendIntelligence[]> {
  let query = supabase
    .from('trend_intelligence')
    .select('*')
    .order('opportunity_score', { ascending: false })
    .limit(limit);

  if (trendType) {
    query = query.eq('trend_type', trendType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createTrend(trend: Partial<TrendIntelligence>): Promise<TrendIntelligence> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('trend_intelligence')
    .insert({
      user_id: user.id,
      topic: trend.topic || 'Unknown Topic',
      category: trend.category || 'general',
      trend_type: trend.trend_type || 'emerging',
      platform: trend.platform || 'youtube',
      velocity: trend.velocity || 0,
      volume: trend.volume || 0,
      growth_rate: trend.growth_rate || 0,
      peak_time: trend.peak_time || null,
      related_keywords: trend.related_keywords || [],
      suggested_angles: trend.suggested_angles || [],
      competition_level: trend.competition_level || null,
      opportunity_score: trend.opportunity_score || 0,
      expires_at: trend.expires_at || null,
      metadata: trend.metadata || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function actionTrend(id: string): Promise<void> {
  const { error } = await supabase
    .from('trend_intelligence')
    .update({ is_actioned: true })
    .eq('id', id);
  if (error) throw error;
}

// ============ COMPETITOR INTELLIGENCE ============

export async function getCompetitors(limit = 20): Promise<CompetitorIntelligence[]> {
  const { data, error } = await supabase
    .from('competitor_intelligence')
    .select('*')
    .eq('is_tracking', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function addCompetitor(competitor: Partial<CompetitorIntelligence>): Promise<CompetitorIntelligence> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('competitor_intelligence')
    .upsert({
      user_id: user.id,
      competitor_channel_id: competitor.competitor_channel_id || '',
      competitor_title: competitor.competitor_title || 'Unknown',
      competitor_thumbnail: competitor.competitor_thumbnail || null,
      competitor_subscribers: competitor.competitor_subscribers || 0,
      competitor_views: competitor.competitor_views || 0,
      competitor_video_count: competitor.competitor_video_count || 0,
      niche: competitor.niche || null,
      content_patterns: competitor.content_patterns || null,
      upload_frequency: competitor.upload_frequency || null,
      avg_video_performance: competitor.avg_video_performance || null,
      top_videos: competitor.top_videos || null,
      growth_trend: competitor.growth_trend || null,
      strengths: competitor.strengths || [],
      weaknesses: competitor.weaknesses || [],
      content_gaps: competitor.content_gaps || [],
      opportunity_areas: competitor.opportunity_areas || [],
      is_tracking: true,
      last_analyzed: new Date().toISOString(),
    }, {
      onConflict: 'user_id,competitor_channel_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeCompetitor(id: string): Promise<void> {
  const { error } = await supabase
    .from('competitor_intelligence')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============ THUMBNAIL INTELLIGENCE ============

export async function getThumbnailAnalyses(limit = 50): Promise<ThumbnailIntelligence[]> {
  const { data, error } = await supabase
    .from('thumbnail_intelligence')
    .select('*')
    .order('analyzed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function createThumbnailAnalysis(analysis: Partial<ThumbnailIntelligence>): Promise<ThumbnailIntelligence> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('thumbnail_intelligence')
    .insert({
      user_id: user.id,
      video_id: analysis.video_id || null,
      thumbnail_url: analysis.thumbnail_url || null,
      thumbnail_file_path: analysis.thumbnail_file_path || null,
      overall_score: analysis.overall_score || 0,
      ctr_prediction: analysis.ctr_prediction || 0,
      engagement_potential: analysis.engagement_potential || 0,
      clarity_score: analysis.clarity_score || 0,
      eye_catching_score: analysis.eye_catching_score || 0,
      text_readability_score: analysis.text_readability_score || 0,
      color_harmony_score: analysis.color_harmony_score || 0,
      face_detection: analysis.face_detection || false,
      emotion_detected: analysis.emotion_detected || null,
      improvements_suggested: analysis.improvements_suggested || null,
      a_b_test_variants: analysis.a_b_test_variants || null,
      model_used: analysis.model_used || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ SHORTS INTELLIGENCE ============

export async function getShortsJobs(limit = 50): Promise<ShortsIntelligence[]> {
  const { data, error } = await supabase
    .from('shorts_intelligence')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function createShortsJob(job: Partial<ShortsIntelligence>): Promise<ShortsIntelligence> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('shorts_intelligence')
    .insert({
      user_id: user.id,
      source_video_id: job.source_video_id || null,
      source_youtube_url: job.source_youtube_url || null,
      transcript: job.transcript || null,
      detected_moments: job.detected_moments || null,
      selected_moments: job.selected_moments || null,
      generated_short_count: job.generated_short_count || 0,
      short_ids: job.short_ids || [],
      hook_scores: job.hook_scores || null,
      viral_potential: job.viral_potential || 0,
      processing_status: job.processing_status || 'pending',
      metadata: job.metadata || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateShortsJob(id: string, updates: Partial<ShortsIntelligence>): Promise<void> {
  const { error } = await supabase
    .from('shorts_intelligence')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

// ============ AGENT STATES ============

export async function getAgentStates(): Promise<AgentState[]> {
  const { data, error } = await supabase
    .from('agent_states')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

export async function updateAgentState(
  agentName: string,
  agentType: AgentState['agent_type'],
  updates: {
    status?: AgentState['status'];
    currentTask?: string | null;
    lastActivity?: string | null;
    tasksCompleted?: number;
    tasksFailed?: number;
    lastError?: string | null;
  }
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('agent_states')
    .upsert({
      user_id: user.id,
      agent_name: agentName,
      agent_type: agentType,
      ...updates,
      activity_timestamp: new Date().toISOString(),
      is_active: true,
    }, {
      onConflict: 'user_id,agent_name',
    });

  if (error) throw error;
}

export async function initializeAgentStates(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const agents: { name: string; type: AgentState['agent_type'] }[] = [
    { name: 'YouTube Intelligence', type: 'youtube_intelligence' },
    { name: 'Trend Research', type: 'trend_research' },
    { name: 'Competitor Intel', type: 'competitor_intel' },
    { name: 'Thumbnail Intel', type: 'thumbnail_intel' },
    { name: 'Shorts Factory', type: 'shorts_factory' },
    { name: 'SEO Analyzer', type: 'seo_analyzer' },
    { name: 'Channel History', type: 'channel_history' },
    { name: 'Growth Hub', type: 'growth_hub' },
    { name: 'Copyright Monitor', type: 'copyright_monitor' },
    { name: 'Smart Queue', type: 'smart_queue' },
  ];

  for (const agent of agents) {
    await supabase
      .from('agent_states')
      .upsert({
        user_id: user.id,
        agent_name: agent.name,
        agent_type: agent.type,
        status: 'idle',
        is_active: true,
      }, {
        onConflict: 'user_id,agent_name',
      });
  }
}

// ============ INTELLIGENCE DECISIONS ============

export async function getPendingDecisions(limit = 20): Promise<IntelligenceDecision[]> {
  const { data, error } = await supabase
    .from('intelligence_decisions')
    .select('*')
    .or('user_decision.eq.pending,user_decision.is.null')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function createDecision(decision: Partial<IntelligenceDecision>): Promise<IntelligenceDecision> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('intelligence_decisions')
    .insert({
      user_id: user.id,
      decision_type: decision.decision_type || 'content_strategy',
      context: decision.context || {},
      proposed_action: decision.proposed_action || {},
      agent_recommendation: decision.agent_recommendation || '',
      confidence: decision.confidence || 0,
      reasoning: decision.reasoning || null,
      expires_at: decision.expires_at || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function resolveDecision(
  id: string,
  userDecision: 'approved' | 'rejected' | 'modified',
  feedback?: string
): Promise<void> {
  const { error } = await supabase
    .from('intelligence_decisions')
    .update({
      user_decision: userDecision,
      user_feedback: feedback || null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

// ============ INTELLIGENCE REPORT ============

export async function getIntelligenceReport(): Promise<{
  pendingDecisions: number;
  activeTrends: number;
  trackingCompetitors: number;
  pendingShortsJobs: number;
  thumbnailQueue: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const [decisions, trends, competitors, shorts, thumbnails] = await Promise.all([
    supabase.from('intelligence_decisions').select('id', { count: 'exact', head: true })
      .or('user_decision.eq.pending,user_decision.is.null'),
    supabase.from('trend_intelligence').select('id', { count: 'exact', head: true })
      .eq('is_actioned', false),
    supabase.from('competitor_intelligence').select('id', { count: 'exact', head: true })
      .eq('is_tracking', true),
    supabase.from('shorts_intelligence').select('id', { count: 'exact', head: true })
      .eq('processing_status', 'pending'),
    supabase.from('thumbnail_intelligence').select('id', { count: 'exact', head: true })
      .lt('overall_score', 50),
  ]);

  return {
    pendingDecisions: decisions.count || 0,
    activeTrends: trends.count || 0,
    trackingCompetitors: competitors.count || 0,
    pendingShortsJobs: shorts.count || 0,
    thumbnailQueue: thumbnails.count || 0,
  };
}
