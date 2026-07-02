import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Youtube, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Loader as Loader2, Unlink, ExternalLink, Shield, RefreshCw, Users, Eye, Video, Settings, Key, LogOut, Trash2, Power } from 'lucide-react';
import {
  getYouTubeChannels, disconnectYouTube, refreshYouTubeToken,
  getYouTubeConnectUrl, handleYouTubeCallback, getUploadSchedules,
  createUploadSchedule, updateUploadSchedule, deleteUploadSchedule,
  getUserSettings, saveGeminiApiKey, saveChannelNiche,
} from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { YouTubeChannel, UploadSchedule } from '../lib/database';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState<UploadSchedule[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [niche, setNiche] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);

  useEffect(() => {
    getUserSettings()
      .then((s) => {
        if (s?.gemini_api_key) setGeminiKey(s.gemini_api_key);
        if (s?.channel_niche) setNiche(s.channel_niche);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // Check for OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleCallback(code);
    }
  }, []);

  async function handleCallback(code: string) {
    setConnecting(true);
    try {
      const result = await handleYouTubeCallback(code);
      if (result.success && result.channel) {
        toast.success('YouTube channel connected!');
      }
      window.history.replaceState({}, '', window.location.pathname);
      await loadData();
    } catch (error) {
      console.error('OAuth callback error:', error);
      toast.error('Failed to connect YouTube channel');
    } finally {
      setConnecting(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [channelData, scheduleData] = await Promise.all([
        getYouTubeChannels(),
        getUploadSchedules().catch(() => []),
      ]);
      setChannels(channelData);
      setSchedules(scheduleData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const { authUrl } = await getYouTubeConnectUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error getting connect URL:', error);
      toast.error('Failed to initiate YouTube connection');
    } finally {
      setConnecting(false);
    }
  }

  async function handleRefresh(channelId: string) {
    setRefreshing(true);
    try {
      await refreshYouTubeToken(channelId);
      await loadData();
      toast.success('Token refreshed successfully');
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast.error('Failed to refresh token');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDisconnect(channelId: string) {
    if (!confirm('Are you sure you want to disconnect this channel?')) return;

    setDisconnecting(true);
    try {
      await disconnectYouTube(channelId);
      await loadData();
      toast.success('Channel disconnected');
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSaveAiSettings() {
    setSavingKey(true);
    try {
      if (geminiKey.trim()) await saveGeminiApiKey(geminiKey.trim());
      if (niche.trim()) await saveChannelNiche(niche.trim());
      toast.success('AI settings saved');
    } catch (error) {
      toast.error('Failed to save AI settings');
    } finally {
      setSavingKey(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your YouTube connections and account</p>
      </div>

      {/* Account Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" /> Account
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-slate-900">{user?.full_name || user?.email}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-4 flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* YouTube Connection */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <Youtube className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">YouTube Channels</h2>
            <p className="text-sm text-slate-500">Connect your YouTube account to enable uploads</p>
          </div>
        </div>

        <div className="p-6">
          {channels.length > 0 ? (
            <div className="space-y-6">
              {channels.map((channel) => (
                <div key={channel.id} className="space-y-6">
                  {/* Channel Info */}
                  <div className="flex items-start gap-4">
                    {channel.channel_thumbnail ? (
                      <img
                        src={channel.channel_thumbnail}
                        alt={channel.channel_title}
                        className="w-16 h-16 rounded-full border-2 border-red-500"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                        <span className="text-2xl font-bold text-white">
                          {channel.channel_title?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-800">{channel.channel_title}</h3>
                      <p className="text-sm text-slate-500 mb-2">ID: {channel.youtube_channel_id}</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">Connected</span>
                        <span className="text-xs text-slate-400">since {formatDate(channel.connected_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Channel Stats */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="text-center">
                      <Users className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                      <p className="text-xl font-bold text-slate-800">{formatNumber(channel.subscriber_count)}</p>
                      <p className="text-xs text-slate-500">Subscribers</p>
                    </div>
                    <div className="text-center">
                      <Eye className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                      <p className="text-xl font-bold text-slate-800">{formatNumber(channel.view_count)}</p>
                      <p className="text-xs text-slate-500">Views</p>
                    </div>
                    <div className="text-center">
                      <Video className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                      <p className="text-xl font-bold text-slate-800">{formatNumber(channel.video_count)}</p>
                      <p className="text-xs text-slate-500">Videos</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => handleRefresh(channel.id)}
                      disabled={refreshing}
                      className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Refresh Token
                    </button>
                    <a
                      href={`https://youtube.com/channel/${channel.youtube_channel_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Channel
                    </a>
                    <button
                      onClick={() => handleDisconnect(channel.id)}
                      disabled={disconnecting}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-red-400 hover:text-red-500 transition-colors flex items-center justify-center gap-2"
              >
                <Youtube className="w-5 h-5" />
                Connect Another Channel
              </button>
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-red-100 flex items-center justify-center mb-4">
                <Youtube className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Connect Your YouTube Channel</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                Link your YouTube account to upload videos, manage your channel, and automate your content workflow.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Youtube className="w-5 h-5" />}
                Connect with YouTube
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Permissions Info */}
      {channels.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Permissions Granted</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-800">YouTube Upload Access</p>
                <p className="text-sm text-slate-500">Upload videos to your YouTube channel on your behalf</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-800">YouTube Read Access</p>
                <p className="text-sm text-slate-500">View your channel info and video list</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Settings (BYOK Gemini key) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <Key className="w-5 h-5 text-red-600" />
          <h2 className="font-semibold text-slate-800">AI Settings</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Add your own free Gemini API key to unlock real AI-generated titles, descriptions, scripts, and the AI Agent chat — at no cost to you.{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-red-600 underline inline-flex items-center gap-1"
          >
            Get a free key <ExternalLink className="w-3 h-3" />
          </a>
        </p>

        <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API Key</label>
        <div className="flex gap-2 mb-4">
          <input
            type={keyVisible ? 'text' : 'password'}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Paste your Gemini API key"
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
          />
          <button
            type="button"
            onClick={() => setKeyVisible((v) => !v)}
            className="px-3 rounded-xl border border-slate-300 text-slate-500 hover:bg-slate-50"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-1">Channel Niche (optional)</label>
        <input
          type="text"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="e.g. tech facts, motivational quotes, cooking tips"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none mb-4"
        />

        <button
          onClick={handleSaveAiSettings}
          disabled={savingKey}
          className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {savingKey ? 'Saving...' : 'Save AI Settings'}
        </button>
      </div>
    </div>
  );
}
