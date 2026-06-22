/**
 * Agent Command Center - Visualize All Agents and Live Status
 *
 * Features:
 * - All agent visualization
 * - Live status monitoring
 * - Activity feed
 * - Performance metrics
 * - Agent controls
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DemoOrb } from '../components/IntelligenceOrb';
import {
  getAgentStates,
  getIntelligenceReport,
  getPendingDecisions,
  getTrends,
  getCompetitors,
  getShortsJobs,
  getThumbnailAnalyses,
  initializeAgentStates,
} from '../lib/agents';

interface AgentStatus {
  id: string;
  agent_name: string;
  agent_type: string;
  status: 'idle' | 'active' | 'thinking' | 'error';
  current_task: string | null;
  tasks_completed: number;
  tasks_failed: number;
  last_activity: string | null;
  activity_timestamp: string | null;
  last_error: string | null;
  is_active: boolean;
}

interface ActivityEvent {
  id: string;
  agent: string;
  action: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
}

const agentIcons: Record<string, string> = {
  youtube_intelligence: '🧠',
  trend_research: '🔥',
  competitor_intel: '🔭',
  thumbnail_intel: '🖼️',
  shorts_factory: '⚡',
  seo_analyzer: '🔍',
  channel_history: '📊',
  growth_hub: '📈',
  copyright_monitor: '🛡️',
  smart_queue: '📤',
};

const agentDescriptions: Record<string, string> = {
  youtube_intelligence: 'Master decision-making brain',
  trend_research: 'Detects trending topics and opportunities',
  competitor_intel: 'Analyzes competitor channels',
  thumbnail_intel: 'Scores thumbnails and predicts CTR',
  shorts_factory: 'Generates YouTube Shorts from content',
  seo_analyzer: 'Tracks keyword performance',
  channel_history: 'Monitors channel growth',
  growth_hub: 'Identifies growth opportunities',
  copyright_monitor: 'Checks for copyright risks',
  smart_queue: 'Manages upload scheduling',
};

export default function AgentCommandCenter() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [report, setReport] = useState<{
    pendingDecisions: number;
    activeTrends: number;
    trackingCompetitors: number;
    pendingShortsJobs: number;
    thumbnailQueue: number;
  } | null>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Initialize and set up real-time updates
  useEffect(() => {
    loadCommandCenter();
    const interval = setInterval(loadCommandCenter, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadCommandCenter = async () => {
    try {
      // Initialize agents if needed
      await initializeAgentStates();

      // Load all data
      const [agentStates, systemReport, pendingDecisions, trends, shorts, thumbnails] = await Promise.all([
        getAgentStates(),
        getIntelligenceReport(),
        getPendingDecisions(10),
        getTrends(10),
        getShortsJobs(10),
        getThumbnailAnalyses(10),
      ]);

      setAgents(agentStates);
      setReport(systemReport);

      // Build activity feed from recent events
      const activityEvents: ActivityEvent[] = [];

      // Add recent trend detections
      trends.slice(0, 3).forEach((t, i) => {
        activityEvents.push({
          id: `trend-${t.id}`,
          agent: 'Trend Research',
          action: `Detected trend: ${t.topic}`,
          timestamp: t.created_at,
          status: 'success',
        });
      });

      // Add pending decisions
      pendingDecisions.slice(0, 3).forEach((d) => {
        activityEvents.push({
          id: `decision-${d.id}`,
          agent: 'YouTube Intelligence',
          action: `Pending ${d.decision_type} approval`,
          timestamp: d.created_at,
          status: 'pending',
        });
      });

      // Add shorts jobs
      shorts.slice(0, 3).forEach((s) => {
        activityEvents.push({
          id: `shorts-${s.id}`,
          agent: 'Shorts Factory',
          action: `${s.processing_status} - ${s.generated_short_count || 0} shorts generated`,
          timestamp: s.created_at,
          status: s.processing_status === 'completed' ? 'success' : s.processing_status === 'failed' ? 'error' : 'pending',
        });
      });

      // Sort by timestamp
      activityEvents.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(activityEvents);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load command center:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: AgentStatus['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'thinking': return 'bg-purple-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const getActivityStatusIcon = (status: ActivityEvent['status']) => {
    switch (status) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'pending': return '⏳';
    }
  };

  const getActivityStatusColor = (status: ActivityEvent['status']) => {
    switch (status) {
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      case 'pending': return 'text-amber-500';
    }
  };

  const totalTasksCompleted = agents.reduce((sum, a) => sum + (a.tasks_completed || 0), 0);
  const totalTasksFailed = agents.reduce((sum, a) => sum + (a.tasks_failed || 0), 0);
  const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'thinking').length;
  const errorAgents = agents.filter(a => a.status === 'error').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Initializing Agent Network...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-light text-slate-200">Agent Command Center</h1>
              <p className="text-slate-500 mt-1">Monitor and control your AI agent network</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
              >
                Back to Home
              </button>
              <button
                onClick={loadCommandCenter}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-3xl font-light text-cyan-400">{agents.length}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Total Agents</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-3xl font-light text-green-400">{activeAgents}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Active</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-3xl font-light text-emerald-400">{totalTasksCompleted}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Completed</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className={`text-3xl font-light ${errorAgents > 0 ? 'text-red-400' : 'text-slate-600'}`}>
              {errorAgents}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Errors</div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Agent grid */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-medium text-slate-300">Agent Network</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                  className={`relative p-4 rounded-xl border transition-all text-left ${
                    selectedAgent === agent.id
                      ? 'bg-cyan-900/20 border-cyan-600/50'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Status indicator */}
                  <div className="absolute top-3 right-3">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                  </div>

                  {/* Icon */}
                  <div className="text-3xl mb-3">
                    {agentIcons[agent.agent_type] || '🤖'}
                  </div>

                  {/* Name */}
                  <div className="text-sm font-medium text-slate-200 mb-1">
                    {agent.agent_name}
                  </div>

                  {/* Status text */}
                  <div className="text-xs text-slate-500 capitalize">
                    {agent.status}
                    {agent.current_task && ` - ${agent.current_task.substring(0, 20)}...`}
                  </div>

                  {/* Tasks */}
                  <div className="mt-3 flex gap-3 text-xs">
                    <span className="text-green-500">{agent.tasks_completed || 0} done</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-red-500">{agent.tasks_failed || 0} failed</span>
                  </div>

                  {/* Description on selection */}
                  {selectedAgent === agent.id && (
                    <div className="mt-4 pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-400">
                        {agentDescriptions[agent.agent_type] || 'AI Agent'}
                      </p>
                      {agent.last_error && (
                        <p className="text-xs text-red-400 mt-2">
                          Error: {agent.last_error}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Intelligence Report */}
            {report && (
              <div className="mt-8">
                <h2 className="text-lg font-medium text-slate-300 mb-4">Intelligence Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="text-2xl font-light text-amber-400">{report.pendingDecisions}</div>
                    <div className="text-xs text-slate-500">Pending Decisions</div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="text-2xl font-light text-cyan-400">{report.activeTrends}</div>
                    <div className="text-xs text-slate-500">Active Trends</div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="text-2xl font-light text-purple-400">{report.trackingCompetitors}</div>
                    <div className="text-xs text-slate-500">Competitors</div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="text-2xl font-light text-pink-400">{report.pendingShortsJobs}</div>
                    <div className="text-xs text-slate-500">Shorts Jobs</div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="text-2xl font-light text-orange-400">{report.thumbnailQueue}</div>
                    <div className="text-xs text-slate-500">Thumbnail Queue</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-slate-300">Activity Feed</h2>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="h-96 overflow-y-auto">
                {activities.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    No recent activity
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {activities.map((activity) => (
                      <div key={activity.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`text-lg ${getActivityStatusColor(activity.status)}`}>
                            {getActivityStatusIcon(activity.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-300 truncate">
                              {activity.action}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {activity.agent} • {new Date(activity.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-medium text-slate-300 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/')}
                  className="w-full p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-left text-sm text-slate-300 transition-colors"
                >
                  Open AI Assistant
                </button>
                <button
                  onClick={() => navigate('/videos')}
                  className="w-full p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-left text-sm text-slate-300 transition-colors"
                >
                  View Videos
                </button>
                <button
                  onClick={() => navigate('/shorts')}
                  className="w-full p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-left text-sm text-slate-300 transition-colors"
                >
                  Shorts Factory
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-left text-sm text-slate-300 transition-colors"
                >
                  Agent Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
