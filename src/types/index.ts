// src/types/index.ts - SINGLE SOURCE OF TRUTH

export interface YouTubeChannel {
  id: string;
  user_id: string;
  youtube_channel_id: string;
  channel_title: string;
  channel_thumbnail: string | null;
  subscriber_count: number;
  video_count: number;
  view_count: number;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  connected_at: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  script?: string;
  status: 'draft' | 'rendering' | 'scheduled' | 'posted' | 'failed' | 'uploaded' | 'generating' | 'queued' | 'uploading' | 'completed' | 'ready' | 'processing';
  thumbnail_url?: string;
  youtube_video_id?: string;
  scheduled_publish_at?: string;
  progress?: number;
  error_message?: string;
  is_short?: boolean;
  video_id?: string;
  viral_score?: number;
  seo_score?: number;
  tags?: string[];
  priority?: number;
  retry_count?: number;
  created_at: string;
  updated_at: string;
}

export interface UploadQueue {
  id: string;
  user_id: string;
  video_id: string | null;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';
  priority: number;
  progress: number;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AIGeneration {
  id: string;
  user_id: string;
  video_id: string | null;
  type: 'title' | 'description' | 'tags' | 'thumbnail_idea' | 'script' | 'hashtags' | 'seo_keywords' | 'video_idea' | 'trending_topic';
  content: string;
  score: number | null;
  used: boolean;
  created_at: string;
}

export interface VideoJob {
  id: string;
  user_id: string;
  video_id: string | null;
  job_type: 'generate' | 'upload' | 'process' | 'shorts' | 'caption';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result_data: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface UploadSchedule {
  id: string;
  user_id: string;
  youtube_channel_id: string | null;
  name: string;
  frequency: 'daily' | 'every_2_days' | 'every_3_days' | 'weekly' | 'custom';
  custom_days: number[] | null;
  start_time: string;
  timezone: string;
  is_active: boolean;
  next_upload_at: string | null;
  videos_count: number;
  created_at: string;
  updated_at: string;
}

export interface Short {
  id: string;
  user_id: string;
  source_video_id: string | null;
  title: string;
  description: string | null;
  start_time: number | null;
  end_time: number | null;
  duration: number | null;
  viral_score: number | null;
  captions: string[] | null;
  thumbnail_text: string | null;
  status: 'pending' | 'generating' | 'ready' | 'uploaded' | 'failed';
  file_path: string | null;
  youtube_video_id: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface Analytics {
  id: string;
  user_id: string;
  youtube_channel_id: string | null;
  date: string;
  views: number;
  subscribers_gained: number;
  subscribers_lost: number;
  likes: number;
  comments: number;
  watch_time_minutes: number;
  impressions: number;
  click_through_rate: number | null;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  type: 'video_created' | 'video_uploaded' | 'video_scheduled' | 'video_failed' | 'channel_connected' | 'ai_generated' | 'shorts_created' | 'upload_queued';
  title: string;
  description: string | null;
  video_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AIContent {
  titles: string[];
  descriptions: string[];
  tags: string[];
  hashtags: string[];
  seo_keywords: string[];
  thumbnail_ideas: string[];
  scripts: string[];
  video_ideas: string[];
  trending_topics: string[];
  viral_scores: number[];
}

export interface ChannelStats {
  subscriber_count: number;
  view_count: number;
  video_count: number;
  total_videos: number;
  uploaded_count: number;
  pending_count: number;
  failed_count: number;
  scheduled_count: number;
}

export interface AppUser {
  id: string;
  email: string;
  created_at: string;
  avatar_url?: string;
  full_name?: string;
}

// ============ AI AGENT SYSTEM TYPES ============

export interface AgentMemory {
  id: string;
  user_id: string;
  memory_type: 'fact' | 'preference' | 'pattern' | 'insight' | 'feedback' | 'correction';
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: 'user_input' | 'ai_inferred' | 'analytics' | 'feedback' | 'external' | null;
  video_id: string | null;
  context: Record<string, unknown> | null;
  access_count: number;
  last_accessed_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentSession {
  id: string;
  user_id: string;
  session_type: 'chat' | 'task' | 'workflow' | 'automation';
  title: string | null;
  summary: string | null;
  context: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  session_id: string | null;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_name: string | null;
  tool_result: Record<string, unknown> | null;
  tokens_used: number | null;
  model_used: string | null;
  latency_ms: number | null;
  metadata: Record<string, unknown> | null;
  parent_message_id: string | null;
  created_at: string;
}

export interface AgentKnowledge {
  id: string;
  user_id: string;
  knowledge_type: 'best_practice' | 'template' | 'workflow' | 'optimization' | 'lesson_learned';
  domain: string;
  title: string;
  content: string;
  tags: string[];
  effectiveness_score: number | null;
  usage_count: number;
  last_used_at: string | null;
  source_session_id: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentToolLog {
  id: string;
  user_id: string;
  session_id: string | null;
  message_id: string | null;
  tool_name: string;
  tool_action: string;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  success: boolean;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface SEOHistory {
  id: string;
  user_id: string;
  video_id: string | null;
  keyword: string;
  position: number | null;
  impressions: number;
  clicks: number;
  ctr: number | null;
  average_position: number | null;
  search_appearance_type: string | null;
  country: string | null;
  date: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ChannelHistory {
  id: string;
  user_id: string;
  channel_id: string | null;
  snapshot_date: string;
  subscriber_count: number | null;
  view_count: number | null;
  video_count: number | null;
  subscriber_change: number;
  view_change: number;
  engagement_rate: number | null;
  avg_views_per_video: number | null;
  top_video_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GrowthIntelligence {
  id: string;
  user_id: string;
  channel_id: string | null;
  insight_type: 'prediction' | 'recommendation' | 'anomaly' | 'opportunity' | 'benchmark';
  category: string;
  title: string;
  description: string;
  metric_name: string | null;
  current_value: number | null;
  predicted_value: number | null;
  confidence: number | null;
  time_frame: string | null;
  action_items: Record<string, unknown>[] | null;
  related_videos: string[];
  priority: number;
  is_actioned: boolean;
  actioned_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CopyrightReport {
  id: string;
  user_id: string;
  video_id: string | null;
  youtube_video_id: string | null;
  report_type: 'claim' | 'takedown' | 'strike' | 'warning' | 'content_id_match' | 'manual_check';
  claimant: string | null;
  claim_type: string | null;
  asset_title: string | null;
  status: 'active' | 'resolved' | 'disputed' | 'appealed' | 'expired';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affected_content: string | null;
  restrictions: Record<string, unknown> | null;
  resolution_notes: string | null;
  detected_at: string;
  resolved_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledPublish {
  id: string;
  user_id: string;
  video_id: string | null;
  youtube_channel_id: string;
  scheduled_for: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  gemini_api_key: string | null;
  channel_niche: string | null;
  ai_preferences: Record<string, unknown>;
  notification_preferences: Record<string, unknown>;
  automation_enabled: boolean;
  learning_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============ PHASE 2 AGENT SYSTEM TYPES ============

export interface TrendIntelligence {
  id: string;
  user_id: string;
  topic: string;
  category: string;
  trend_type: 'rising' | 'viral' | 'emerging' | 'seasonal' | 'evergreen' | 'stable';
  platform: string;
  velocity: number;
  volume: number;
  growth_rate: number;
  peak_time: string | null;
  related_keywords: string[];
  suggested_angles: string[];
  competition_level: 'low' | 'medium' | 'high' | null;
  opportunity_score: number;
  detected_at: string;
  expires_at: string | null;
  is_actioned: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitorIntelligence {
  id: string;
  user_id: string;
  competitor_channel_id: string;
  competitor_title: string;
  competitor_thumbnail: string | null;
  competitor_subscribers: number;
  competitor_views: number;
  competitor_video_count: number;
  niche: string | null;
  content_patterns: Record<string, unknown> | null;
  upload_frequency: string | null;
  avg_video_performance: number | null;
  top_videos: Record<string, unknown>[] | null;
  growth_trend: 'growing' | 'stable' | 'declining' | null;
  strengths: string[];
  weaknesses: string[];
  content_gaps: string[];
  opportunity_areas: string[];
  last_analyzed: string | null;
  is_tracking: boolean;
  created_at: string;
  updated_at: string;
}

export interface ThumbnailIntelligence {
  id: string;
  user_id: string;
  video_id: string | null;
  thumbnail_url: string | null;
  thumbnail_file_path: string | null;
  overall_score: number;
  ctr_prediction: number;
  engagement_potential: number;
  clarity_score: number;
  eye_catching_score: number;
  text_readability_score: number;
  color_harmony_score: number;
  face_detection: boolean;
  emotion_detected: string | null;
  improvements_suggested: Record<string, unknown>[] | null;
  a_b_test_variants: Record<string, unknown>[] | null;
  winning_variant: string | null;
  model_used: string | null;
  analyzed_at: string;
  created_at: string;
  updated_at: string;
}

export interface ShortsIntelligence {
  id: string;
  user_id: string;
  source_video_id: string | null;
  source_youtube_url: string | null;
  transcript: string | null;
  detected_moments: Record<string, unknown>[] | null;
  selected_moments: Record<string, unknown>[] | null;
  generated_short_count: number;
  short_ids: string[];
  hook_scores: Record<string, unknown> | null;
  viral_potential: number;
  processing_status: 'pending' | 'transcribing' | 'analyzing' | 'generating' | 'completed' | 'failed' | 'processing';
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentState {
  id: string;
  user_id: string;
  agent_name: string;
  agent_type: 'youtube_intelligence' | 'trend_research' | 'competitor_intel' | 'thumbnail_intel' | 'shorts_factory' | 'seo_analyzer' | 'channel_history' | 'growth_hub' | 'copyright_monitor' | 'smart_queue';
  status: 'idle' | 'thinking' | 'listening' | 'researching' | 'learning' | 'processing' | 'error' | 'analyzing';
  current_task: string | null;
  last_activity: string | null;
  activity_timestamp: string | null;
  tasks_completed: number;
  tasks_failed: number;
  last_error: string | null;
  uptime_seconds: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntelligenceDecision {
  id: string;
  user_id: string;
  decision_type: 'seo_approval' | 'upload_approval' | 'thumbnail_approval' | 'shorts_approval' | 'growth_recommendation' | 'content_strategy';
  context: Record<string, unknown>;
  proposed_action: Record<string, unknown>;
  agent_recommendation: string;
  confidence: number;
  reasoning: string | null;
  user_decision: 'approved' | 'rejected' | 'modified' | 'pending' | null;
  user_feedback: string | null;
  outcome_data: Record<string, unknown> | null;
  is_actionable: boolean;
  expires_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViralMoment {
  startTime: number;
  endTime: number;
  hookType: string;
  viralityScore: number;
  reason: string;
  suggestedTitle: string;
}

export interface DetectedTrend {
  topic: string;
  velocity: number;
  volume: number;
  platform: string;
  category: string;
  opportunityScore: number;
}

export interface ThumbnailScore {
  overall: number;
  ctr: number;
  clarity: number;
  eyeCatching: number;
  textReadability: number;
  colorHarmony: number;
}

export interface AgentStatusReport {
  agentName: string;
  agentType: string;
  status: AgentState['status'];
  currentTask: string | null;
  tasksCompleted: number;
  lastActivity: string | null;
  isActive: boolean;
}

export interface IntelligenceReport {
  pendingDecisions: number;
  activeTrends: number;
  trackingCompetitors: number;
  pendingShorts: number;
  thumbnailQueue: number;
  overallHealth: number;
}
