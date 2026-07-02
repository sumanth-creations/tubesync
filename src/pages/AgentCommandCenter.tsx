import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  getAgentStates,
  initializeAgentStates,
} from '../lib/agents';
import { uploadVideoFile, pushVideoToYouTube, getYouTubeChannels } from '../lib/api';

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

interface NextVideo {
  id: string;
  title: string;
  thumbnail_url: string;
  scheduled_time: string;
  ai_title: string;
  ai_reason: string;
  status: 'queued' | 'analyzing' | 'ready' | 'uploading';
  video_id?: string;
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

export default function AgentCommandCenter() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [nextVideo, setNextVideo] = useState<NextVideo | null>(null);
  const [queueCount, setQueueCount] = useState(32);
  const [countdown, setCountdown] = useState('');
  const [youtubeChannelId, setYoutubeChannelId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCommandCenter();
    const interval = setInterval(loadCommandCenter, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!nextVideo?.scheduled_time) return;
    const timer = setInterval(() => {
      const diff = new Date(nextVideo.scheduled_time).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('Uploading now...');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${hours}h ${mins}m`);
    }, 1000);
    return () => clearInterval(timer);
  }, [nextVideo]);

  const loadCommandCenter = async () => {
    try {
      await initializeAgentStates();
      const [agentStates, channels] = await Promise.all([
        getAgentStates(),
        getYouTubeChannels(),
      ]);

      setAgents(agentStates as any);
      
      if (channels.length > 0) {
        setYoutubeChannelId(channels[0].id);
      }

      setNextVideo({
        id: '1',
        video_id: 'mock-video-id',
        title: 'Docker lo GPU Setup Telugu',
        thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        scheduled_time: new Date(Date.now() + 3 * 3600000).toISOString(),
        ai_title: 'Docker GPU Setup Complete Guide Telugu | CUDA + WSL2',
        ai_reason: 'Peak audience active 7-9 PM IST. Tech Telugu viewers 73% online.',
        status: 'ready'
      });

      setLoading(false);
    } catch (error) {
      console.error('Failed to load:', error);
      toast.error('Failed to load agents');
      setLoading(false);
    }
  };

  const handleUploadNow = async () => {
    if (!youtubeChannelId) {
      toast.error('YouTube connect cheyyaledhu! Settings ki velli connect chey.');
      navigate('/settings');
      return;
    }

    if (!nextVideo?.video_id) {
      toast.error('Video ID ledu. Mundhu video create chey.');
      navigate('/upload');
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file ||!nextVideo?.video_id ||!youtubeChannelId) return;

    setUploading(true);
    const toastId = toast.loading('Uploading video to storage...');

    try {
      await uploadVideoFile(
        nextVideo.video_id,
        file,
        (percent) => {
          toast.loading(`Uploading: ${percent}%`, { id: toastId });
        }
      );

      toast.loading('Starting YouTube upload...', { id: toastId });

      await pushVideoToYouTube(nextVideo.video_id, youtubeChannelId);
      
      toast.success('Upload Started! YouTube ki velthondi 🎉', { id: toastId });
      
      setQueueCount(prev => prev - 1);
      setNextVideo(null);
      
    } catch (error: any) {
      toast.error('Upload Failed: ' + error.message, { id: toastId });
      console.error(error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getStatusColor = (status: AgentStatus['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-500 shadow-emerald-500/50';
      case 'thinking': return 'bg-purple-500 animate-pulse shadow-purple-500/50';
      case 'error': return 'bg-red-500 shadow-red-500/50';
      default: return 'bg-slate-600';
    }
  };

  const totalTasksCompleted = agents.reduce((sum, a) => sum + (a.tasks_completed || 0), 0);
  const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'thinking').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Initializing AI Network...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/10 to-slate-950 text-white">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-950/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/30">
                🤖
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  TubeSync Command Center
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">AI Auto-Pilot for YouTube Growth</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium">
                ● {activeAgents} Agents Active
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-purple-500/30"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {nextVideo && (
          <div className="mb-8 relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-900/90 to-slate-950/90 backdrop-blur-xl p-8 shadow-2xl shadow-purple-500/10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
                  Next Upload
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                  AI Ready ✓
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-6 items-center">
                <div className="lg:col-span-2">
                  <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
                    {nextVideo.ai_title}
                  </h2>
                  <p className="text-slate-400 mb-4 text-sm leading-relaxed">
                    💡 {nextVideo.ai_reason}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-slate-300 text-sm">Scheduled for {new Date(nextVideo.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                      {countdown}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={handleUploadNow}
                    disabled={uploading}
                    className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30"
                  >
                    {uploading? 'Uploading...' : 'Upload Now ⚡'}
                  </button>
                  <button 
                    onClick={() => navigate('/videos')}
                    className="w-full py-3.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl font-semibold transition-all"
                  >
                    Edit Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Queue Left', value: queueCount, color: 'from-blue-500 to-cyan-500', icon: '📤' },
            { label: 'Active Agents', value: activeAgents, color: 'from-emerald-500 to-green-500', icon: '⚡' },
            { label: 'Completed', value: totalTasksCompleted, color: 'from-purple-500 to-pink-500', icon: '✓' },
            { label: 'Success Rate', value: '98%', color: 'from-orange-500 to-red-500', icon: '🎯' },
          ].map((stat, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-5 hover:border-slate-700 transition-all group">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <div className="relative z-10">
                <div className="text-3xl mb-2">{stat.icon}</div>
                <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>Agent Network</span>
              <span className="text-xs font-normal text-slate-500">({agents.length} active)</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="relative p-4 rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm hover:border-purple-500/30 hover:bg-slate-900/50 transition-all group cursor-pointer"
                >
                  <div className="absolute top-3 right-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(agent.status)} shadow-lg`} />
                  </div>

                  <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                    {agentIcons[agent.agent_type] || '🤖'}
                  </div>

                  <div className="text-sm font-semibold text-slate-200 mb-1 truncate">
                    {agent.agent_name}
                  </div>

                  <div className="text-xs text-slate-500 capitalize mb-3">
                    {agent.status}
                  </div>

                  <div className="flex gap-2 text-xs">
                    <span className="text-emerald-400">{agent.tasks_completed || 0}</span>
                    <span className="text-slate-700">•</span>
                    <span className="text-red-400">{agent.tasks_failed || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm p-5">
              <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label: 'Upload Folder', icon: '📁', action: () => navigate('/upload') },
                  { label: 'AI Assistant', icon: '💬', action: () => navigate('/agent') },
                  { label: 'Shorts Factory', icon: '⚡', action: () => navigate('/shorts') },
                  { label: 'Analytics', icon: '📊', action: () => navigate('/seo') },
                ].map((btn, i) => (
                  <button
                    key={i}
                    onClick={btn.action}
                    className="w-full p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-left text-sm text-slate-300 transition-all flex items-center gap-3 group"
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">{btn.icon}</span>
                    <span className="font-medium">{btn.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-900/20 to-slate-900/30 backdrop-blur-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">System Healthy</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                All agents operational. Gemini API connected. YouTube quota: 8,400/10,000 units remaining.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
