import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Video, CircleCheck as CheckCircle, Clock, CircleAlert as AlertCircle, Calendar, Youtube, TrendingUp, Eye, Users, Play, BarChart3, Zap, Lightbulb, ArrowRight, Loader as Loader2, Sparkles, Upload, Scissors, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useChannels } from '../hooks/useChannels';
import { useVideos } from '../hooks/useVideos';
import { getDashboardStats, getActivities } from '../lib/api';
import type { Activity } from '../types';

interface DashboardStats {
  totalVideos: number;
  uploadedCount: number;
  pendingCount: number;
  failedCount: number;
  scheduledCount: number;
  channelCount: number;
  recentActivity: Activity[];
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { channels, loading: channelsLoading } = useChannels();
  const { videos, loading: videosLoading } = useVideos();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const [dashStats, recentActivities] = await Promise.all([
          getDashboardStats(),
          getActivities(5),
        ]);
        setStats(dashStats);
        setActivities(recentActivities);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const primaryChannel = channels && channels.length > 0 ? channels[0] : null;

  const uploadedCount = stats?.uploadedCount || 0;
  const pendingCount = stats?.pendingCount || 0;
  const failedCount = stats?.failedCount || 0;
  const totalStatus = uploadedCount + pendingCount + failedCount;

  const getActivityIcon = (type: Activity['type']) => {
    const iconProps = { className: 'w-4 h-4' };
    switch (type) {
      case 'video_uploaded':
        return <CheckCircle {...iconProps} />;
      case 'video_scheduled':
        return <Calendar {...iconProps} />;
      case 'video_failed':
        return <AlertCircle {...iconProps} />;
      case 'channel_connected':
        return <Youtube {...iconProps} />;
      case 'ai_generated':
        return <Zap {...iconProps} />;
      case 'shorts_created':
        return <Play {...iconProps} />;
      case 'upload_queued':
        return <Clock {...iconProps} />;
      default:
        return <Video {...iconProps} />;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'video_uploaded':
        return 'text-green-500 bg-green-50';
      case 'video_scheduled':
        return 'text-blue-500 bg-blue-50';
      case 'video_failed':
        return 'text-red-500 bg-red-50';
      case 'channel_connected':
        return 'text-red-500 bg-red-50';
      case 'ai_generated':
        return 'text-yellow-500 bg-yellow-50';
      case 'shorts_created':
        return 'text-orange-500 bg-orange-50';
      default:
        return 'text-slate-500 bg-slate-50';
    }
  };

  const isLoading = authLoading || loading || channelsLoading || videosLoading;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
          Welcome back, {user?.full_name?.split(' ')[0] || 'Creator'}
        </h1>
        <p className="text-slate-600">Your YouTube automation dashboard</p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Video className="w-5 h-5 text-slate-700" />
            </div>
            {(stats?.totalVideos || 0) > (stats?.uploadedCount || 0) && (
              <div className="flex items-center text-green-600 text-xs font-semibold">
                <TrendingUp className="w-3 h-3 mr-1" />
                +3
              </div>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{stats?.totalVideos || 0}</p>
          <p className="text-sm text-slate-600">Total Videos</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{stats?.uploadedCount || 0}</p>
          <p className="text-sm text-slate-600">Uploaded</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{stats?.pendingCount || 0}</p>
          <p className="text-sm text-slate-600">Pending</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{stats?.failedCount || 0}</p>
          <p className="text-sm text-slate-600">Failed</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
            <Calendar className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{stats?.scheduledCount || 0}</p>
          <p className="text-sm text-slate-600">Scheduled</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center mb-4">
            <Youtube className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{stats?.channelCount || 0}</p>
          <p className="text-sm text-slate-600">Channels</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Channel Overview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Channel Overview</h2>

            {primaryChannel ? (
              <div className="space-y-6">
                <div className="flex items-start gap-6">
                  {primaryChannel.channel_thumbnail && (
                    <img
                      src={primaryChannel.channel_thumbnail}
                      alt={primaryChannel.channel_title}
                      className="w-20 h-20 rounded-full border-2 border-slate-200 object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-1">{primaryChannel.channel_title}</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Connected {formatDistanceToNow(new Date(primaryChannel.connected_at), { addSuffix: true })}
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-semibold text-slate-900">
                            {primaryChannel.subscriber_count.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">Subscribers</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Eye className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-semibold text-slate-900">
                            {primaryChannel.view_count.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">Views</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Video className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-semibold text-slate-900">
                            {primaryChannel.video_count}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">Videos</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Youtube className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-4">No YouTube channel connected</p>
                <Link
                  to="/settings"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium hover:shadow-lg transition-shadow"
                >
                  <Youtube className="w-4 h-4" />
                  Connect Channel
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Upload Status */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Upload Status</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-slate-700">Uploaded</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{uploadedCount}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: totalStatus > 0 ? `${(uploadedCount / totalStatus) * 100}%` : '0%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium text-slate-700">Pending</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{pendingCount}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: totalStatus > 0 ? `${(pendingCount / totalStatus) * 100}%` : '0%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-slate-700">Failed</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{failedCount}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all"
                  style={{ width: totalStatus > 0 ? `${(failedCount / totalStatus) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Link to="/generate" className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600" />
            <div className="relative z-10">
              <Sparkles className="w-6 h-6 text-white mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-white font-semibold mb-1">Generate</h3>
              <p className="text-red-100 text-sm">AI-powered ideas</p>
            </div>
          </Link>

          <Link to="/upload" className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600" />
            <div className="relative z-10">
              <Upload className="w-6 h-6 text-white mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-white font-semibold mb-1">Upload</h3>
              <p className="text-blue-100 text-sm">Queue a video</p>
            </div>
          </Link>

          <Link to="/videos" className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600" />
            <div className="relative z-10">
              <BarChart3 className="w-6 h-6 text-white mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-white font-semibold mb-1">Videos</h3>
              <p className="text-emerald-100 text-sm">Manage library</p>
            </div>
          </Link>

          <Link to="/calendar" className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600" />
            <div className="relative z-10">
              <Calendar className="w-6 h-6 text-white mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-white font-semibold mb-1">Calendar</h3>
              <p className="text-amber-100 text-sm">Schedule uploads</p>
            </div>
          </Link>

          <Link to="/agent" className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-600" />
            <div className="relative z-10">
              <MessageSquare className="w-6 h-6 text-white mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-white font-semibold mb-1">AI Agent</h3>
              <p className="text-purple-100 text-sm">Chat with agent</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              <Link to="/activity" className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1">
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="space-y-4">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.type)}`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 mb-1">{activity.title}</p>
                      {activity.description && (
                        <p className="text-sm text-slate-600 mb-1">{activity.description}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-600">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-sm p-6 text-white">
          <div className="flex items-center gap-2 mb-6">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold">AI Suggestions</h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-white/10 backdrop-blur p-4 border border-white/20 hover:bg-white/20 transition-colors">
              <h3 className="font-semibold mb-1 text-sm">Optimize Upload Times</h3>
              <p className="text-xs text-slate-200">Upload during peak hours (8-10 PM) for better initial traction</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur p-4 border border-white/20 hover:bg-white/20 transition-colors">
              <h3 className="font-semibold mb-1 text-sm">Trending Content</h3>
              <p className="text-xs text-slate-200">Mix trending topics with your niche for maximum reach</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur p-4 border border-white/20 hover:bg-white/20 transition-colors">
              <h3 className="font-semibold mb-1 text-sm">Engagement Boost</h3>
              <p className="text-xs text-slate-200">Add 3-5 second hooks to the first 10 seconds of videos</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur p-4 border border-white/20 hover:bg-white/20 transition-colors">
              <h3 className="font-semibold mb-1 text-sm">Shorts Strategy</h3>
              <p className="text-xs text-slate-200">Create 3 shorts per long-form video for cross-promotion</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
