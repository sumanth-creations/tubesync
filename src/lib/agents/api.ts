/**
 * AI Agent System - Unified API Layer
 *
 * Central service for all agent-related database operations.
 * Provides type-safe, cached, and error-resilient access to agent data.
 */

import { supabase } from '../supabase';
import type {
  AgentMemory, AgentSession, AgentMessage, AgentKnowledge,
  AgentToolLog, SEOHistory, ChannelHistory, GrowthIntelligence,
  CopyrightReport, ScheduledPublish, UserSettings,
} from '../../types';

// Helper for error logging
function logError(operation: string, error: { message?: string; code?: string } | null): void {
  if (error) {
    console.error(`[${operation}] Supabase error:`, error.code, error.message);
  }
}

// ============ MEMORY MANAGEMENT ============

export async function getMemories(category?: string, limit = 50): Promise<AgentMemory[]> {
  try {
    let query = supabase
      .from('agent_memory')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      logError('getMemories', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getMemories] Exception:', err);
    return [];
  }
}

export async function getMemoryByKey(category: string, key: string): Promise<AgentMemory | null> {
  try {
    const { data, error } = await supabase
      .from('agent_memory')
      .select('*')
      .eq('category', category)
      .eq('key', key)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      logError('getMemoryByKey', error);
      return null;
    }

    if (data) {
      await supabase
        .from('agent_memory')
        .update({
          access_count: (data.access_count || 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', data.id);
    }

    return data;
  } catch (err) {
    console.error('[getMemoryByKey] Exception:', err);
    return null;
  }
}

export async function storeMemory(memory: Partial<AgentMemory>): Promise<AgentMemory | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('agent_memory')
      .upsert({
        user_id: user.id,
        memory_type: memory.memory_type || 'fact',
        category: memory.category || 'general',
        key: memory.key || `memory_${Date.now()}`,
        value: memory.value || '',
        confidence: memory.confidence || 0.8,
        source: memory.source || 'user_input',
        video_id: memory.video_id || null,
        context: memory.context || null,
        is_active: true,
      }, {
        onConflict: 'user_id,category,key',
      })
      .select()
      .single();

    if (error) {
      logError('storeMemory', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[storeMemory] Exception:', err);
    return null;
  }
}

export async function deleteMemory(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('agent_memory')
      .update({ is_active: false })
      .eq('id', id);
    if (error) logError('deleteMemory', error);
  } catch (err) {
    console.error('[deleteMemory] Exception:', err);
  }
}

export async function searchMemories(query: string, limit = 20): Promise<AgentMemory[]> {
  try {
    const { data, error } = await supabase
      .from('agent_memory')
      .select('*')
      .eq('is_active', true)
      .or(`key.ilike.%${query}%,value.ilike.%${query}%`)
      .limit(limit);

    if (error) {
      logError('searchMemories', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[searchMemories] Exception:', err);
    return [];
  }
}

// ============ SESSION MANAGEMENT ============

export async function createSession(
  sessionType: AgentSession['session_type'] = 'chat',
  title?: string,
  context?: Record<string, unknown>
): Promise<AgentSession | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('agent_sessions')
      .insert({
        user_id: user.id,
        session_type: sessionType,
        title: title || `Session ${new Date().toLocaleDateString()}`,
        context: context || {},
        is_active: true,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logError('createSession', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[createSession] Exception:', err);
    return null;
  }
}

export async function getSession(sessionId: string): Promise<AgentSession | null> {
  try {
    const { data, error } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) {
      logError('getSession', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[getSession] Exception:', err);
    return null;
  }
}

export async function getActiveSessions(limit = 20): Promise<AgentSession[]> {
  try {
    const { data, error } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logError('getActiveSessions', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getActiveSessions] Exception:', err);
    return [];
  }
}

export async function endSession(sessionId: string, summary?: string): Promise<void> {
  try {
    const updates: Partial<AgentSession> = {
      is_active: false,
      ended_at: new Date().toISOString(),
    };
    if (summary) updates.summary = summary;

    const { error } = await supabase
      .from('agent_sessions')
      .update(updates)
      .eq('id', sessionId);

    if (error) logError('endSession', error);
  } catch (err) {
    console.error('[endSession] Exception:', err);
  }
}

// ============ MESSAGE MANAGEMENT ============

export async function addMessage(
  sessionId: string | null,
  role: AgentMessage['role'],
  content: string,
  options?: {
    toolName?: string;
    toolResult?: Record<string, unknown>;
    tokensUsed?: number;
    modelUsed?: string;
    latencyMs?: number;
    metadata?: Record<string, unknown>;
    parentMessageId?: string;
  }
): Promise<AgentMessage | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('agent_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role,
        content,
        tool_name: options?.toolName || null,
        tool_result: options?.toolResult || null,
        tokens_used: options?.tokensUsed || null,
        model_used: options?.modelUsed || null,
        latency_ms: options?.latencyMs || null,
        metadata: options?.metadata || null,
        parent_message_id: options?.parentMessageId || null,
      })
      .select()
      .single();

    if (error) {
      logError('addMessage', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[addMessage] Exception:', err);
    return null;
  }
}

export async function getSessionMessages(sessionId: string, limit = 100): Promise<AgentMessage[]> {
  try {
    const { data, error } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      logError('getSessionMessages', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getSessionMessages] Exception:', err);
    return [];
  }
}

export async function getRecentMessages(limit = 50): Promise<AgentMessage[]> {
  try {
    const { data, error } = await supabase
      .from('agent_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logError('getRecentMessages', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getRecentMessages] Exception:', err);
    return [];
  }
}

// ============ KNOWLEDGE BASE ============

export async function getKnowledge(domain?: string, limit = 50): Promise<AgentKnowledge[]> {
  try {
    let query = supabase
      .from('agent_knowledge')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (domain) {
      query = query.eq('domain', domain);
    }

    const { data, error } = await query;
    if (error) {
      logError('getKnowledge', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getKnowledge] Exception:', err);
    return [];
  }
}

export async function addKnowledge(knowledge: Partial<AgentKnowledge>): Promise<AgentKnowledge | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('agent_knowledge')
      .insert({
        user_id: user.id,
        knowledge_type: knowledge.knowledge_type || 'best_practice',
        domain: knowledge.domain || 'general',
        title: knowledge.title || 'Untitled',
        content: knowledge.content || '',
        tags: knowledge.tags || [],
        effectiveness_score: knowledge.effectiveness_score || null,
        usage_count: 0,
        source_session_id: knowledge.source_session_id || null,
        is_verified: false,
      })
      .select()
      .single();

    if (error) {
      logError('addKnowledge', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[addKnowledge] Exception:', err);
    return null;
  }
}

export async function incrementKnowledgeUsage(id: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_knowledge_usage', { knowledge_id: id });
    if (error) {
      const { data } = await supabase.from('agent_knowledge').select('usage_count').eq('id', id).single();
      await supabase
        .from('agent_knowledge')
        .update({ usage_count: (data?.usage_count || 0) + 1, last_used_at: new Date().toISOString() })
        .eq('id', id);
    }
  } catch (err) {
    console.error('[incrementKnowledgeUsage] Exception:', err);
  }
}

// ============ TOOL LOGGING ============

export async function logToolExecution(
  sessionId: string | null,
  messageId: string | null,
  toolName: string,
  toolAction: string,
  input: Record<string, unknown> | null,
  output: Record<string, unknown> | null,
  success: boolean,
  durationMs?: number,
  errorMessage?: string
): Promise<AgentToolLog | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('agent_tool_logs')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        message_id: messageId,
        tool_name: toolName,
        tool_action: toolAction,
        input_data: input,
        output_data: output,
        success,
        error_message: errorMessage || null,
        duration_ms: durationMs || null,
      })
      .select()
      .single();

    if (error) {
      logError('logToolExecution', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[logToolExecution] Exception:', err);
    return null;
  }
}

// ============ SEO HISTORY ============

export async function getSEOHistory(videoId?: string, limit = 100): Promise<SEOHistory[]> {
  try {
    let query = supabase
      .from('seo_history')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);

    if (videoId) {
      query = query.eq('video_id', videoId);
    }

    const { data, error } = await query;
    if (error) {
      logError('getSEOHistory', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getSEOHistory] Exception:', err);
    return [];
  }
}

export async function recordSEOMetrics(metrics: Partial<SEOHistory>): Promise<SEOHistory | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('seo_history')
      .insert({
        user_id: user.id,
        video_id: metrics.video_id || null,
        keyword: metrics.keyword || '',
        position: metrics.position || null,
        impressions: metrics.impressions || 0,
        clicks: metrics.clicks || 0,
        ctr: metrics.ctr || null,
        average_position: metrics.average_position || null,
        search_appearance_type: metrics.search_appearance_type || null,
        country: metrics.country || null,
        date: metrics.date || new Date().toISOString().split('T')[0],
        metadata: metrics.metadata || null,
      })
      .select()
      .single();

    if (error) {
      logError('recordSEOMetrics', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[recordSEOMetrics] Exception:', err);
    return null;
  }
}

// ============ CHANNEL HISTORY ============

export async function getChannelHistory(channelId?: string, limit = 90): Promise<ChannelHistory[]> {
  try {
    let query = supabase
      .from('channel_history')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(limit);

    if (channelId) {
      query = query.eq('channel_id', channelId);
    }

    const { data, error } = await query;
    if (error) {
      logError('getChannelHistory', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getChannelHistory] Exception:', err);
    return [];
  }
}

export async function recordChannelSnapshot(snapshot: Partial<ChannelHistory>): Promise<ChannelHistory | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('channel_history')
      .upsert({
        user_id: user.id,
        channel_id: snapshot.channel_id || null,
        snapshot_date: snapshot.snapshot_date || new Date().toISOString().split('T')[0],
        subscriber_count: snapshot.subscriber_count || null,
        view_count: snapshot.view_count || null,
        video_count: snapshot.video_count || null,
        subscriber_change: snapshot.subscriber_change || 0,
        view_change: snapshot.view_change || 0,
        engagement_rate: snapshot.engagement_rate || null,
        avg_views_per_video: snapshot.avg_views_per_video || null,
        top_video_id: snapshot.top_video_id || null,
        metadata: snapshot.metadata || null,
      }, {
        onConflict: 'user_id,channel_id,snapshot_date',
      })
      .select()
      .single();

    if (error) {
      logError('recordChannelSnapshot', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[recordChannelSnapshot] Exception:', err);
    return null;
  }
}

// ============ GROWTH INTELLIGENCE ============

export async function getGrowthInsights(insightType?: GrowthIntelligence['insight_type'], limit = 50): Promise<GrowthIntelligence[]> {
  try {
    let query = supabase
      .from('growth_intelligence')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (insightType) {
      query = query.eq('insight_type', insightType);
    }

    const { data, error } = await query;
    if (error) {
      logError('getGrowthInsights', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getGrowthInsights] Exception:', err);
    return [];
  }
}

export async function createGrowthInsight(insight: Partial<GrowthIntelligence>): Promise<GrowthIntelligence | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('growth_intelligence')
      .insert({
        user_id: user.id,
        channel_id: insight.channel_id || null,
        insight_type: insight.insight_type || 'recommendation',
        category: insight.category || 'general',
        title: insight.title || 'Untitled Insight',
        description: insight.description || '',
        metric_name: insight.metric_name || null,
        current_value: insight.current_value || null,
        predicted_value: insight.predicted_value || null,
        confidence: insight.confidence || null,
        time_frame: insight.time_frame || null,
        action_items: insight.action_items || null,
        related_videos: insight.related_videos || [],
        priority: insight.priority || 5,
        expires_at: insight.expires_at || null,
      })
      .select()
      .single();

    if (error) {
      logError('createGrowthInsight', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[createGrowthInsight] Exception:', err);
    return null;
  }
}

export async function markInsightActioned(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('growth_intelligence')
      .update({
        is_actioned: true,
        actioned_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) logError('markInsightActioned', error);
  } catch (err) {
    console.error('[markInsightActioned] Exception:', err);
  }
}

// ============ COPYRIGHT REPORTS ============

export async function getCopyrightReports(status?: CopyrightReport['status'], limit = 50): Promise<CopyrightReport[]> {
  try {
    let query = supabase
      .from('copyright_reports')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      logError('getCopyrightReports', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getCopyrightReports] Exception:', err);
    return [];
  }
}

export async function createCopyrightReport(report: Partial<CopyrightReport>): Promise<CopyrightReport | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('copyright_reports')
      .insert({
        user_id: user.id,
        video_id: report.video_id || null,
        youtube_video_id: report.youtube_video_id || null,
        report_type: report.report_type || 'content_id_match',
        claimant: report.claimant || null,
        claim_type: report.claim_type || null,
        asset_title: report.asset_title || null,
        status: report.status || 'active',
        severity: report.severity || 'low',
        affected_content: report.affected_content || null,
        restrictions: report.restrictions || null,
        resolution_notes: report.resolution_notes || null,
        detected_at: report.detected_at || new Date().toISOString(),
        expires_at: report.expires_at || null,
        metadata: report.metadata || null,
      })
      .select()
      .single();

    if (error) {
      logError('createCopyrightReport', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[createCopyrightReport] Exception:', err);
    return null;
  }
}

export async function resolveCopyrightReport(id: string, resolutionNotes?: string): Promise<void> {
  try {
    const updates: Partial<CopyrightReport> = {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    };
    if (resolutionNotes) updates.resolution_notes = resolutionNotes;

    const { error } = await supabase
      .from('copyright_reports')
      .update(updates)
      .eq('id', id);

    if (error) logError('resolveCopyrightReport', error);
  } catch (err) {
    console.error('[resolveCopyrightReport] Exception:', err);
  }
}

// ============ SCHEDULED PUBLISHES ============

export async function getScheduledPublishes(status?: ScheduledPublish['status'], limit = 50): Promise<ScheduledPublish[]> {
  try {
    let query = supabase
      .from('scheduled_publishes')
      .select('*')
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      logError('getScheduledPublishes', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getScheduledPublishes] Exception:', err);
    return [];
  }
}

export async function cancelScheduledPublish(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('scheduled_publishes')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) logError('cancelScheduledPublish', error);
  } catch (err) {
    console.error('[cancelScheduledPublish] Exception:', err);
  }
}

// ============ USER SETTINGS ============

export async function getUserAgentSettings(): Promise<UserSettings | null> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .maybeSingle();

    if (error) {
      logError('getUserAgentSettings', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[getUserAgentSettings] Exception:', err);
    return null;
  }
}

export async function upsertUserAgentSettings(settings: Partial<UserSettings>): Promise<UserSettings | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        gemini_api_key: settings.gemini_api_key,
        channel_niche: settings.channel_niche,
        ai_preferences: settings.ai_preferences || {},
        notification_preferences: settings.notification_preferences || {},
        automation_enabled: settings.automation_enabled ?? true,
        learning_enabled: settings.learning_enabled ?? true,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      logError('upsertUserAgentSettings', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[upsertUserAgentSettings] Exception:', err);
    return null;
  }
}