import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Send, Bot, User, Sparkles, Loader as Loader2, Wand as Wand2, Video, Upload, TrendingUp, FileVideo, Clock, Eye, EyeOff, Users, Baby, X, CircleCheck as CheckCircle2, BarChart3, Shield, Zap, TriangleAlert as AlertTriangle, Lightbulb, Target, Activity, Calendar } from 'lucide-react';
import {
  chatWithAgent, logActivity, generateVideoMetadata, suggestBestPostTime,
  createVideo, uploadVideoFile, pushVideoToYouTube, getYouTubeChannels, getUserSettings,
  scheduleAutoPublish, getVideos, type BestTimeSuggestion,
} from '../lib/api';
import {
  agentOrchestrator, smartQueue, copyrightMonitor, channelIntelligence,
  growthHub, seoAnalyzer, learningEngine,
} from '../lib/agents';
import type { YouTubeChannel, Video as VideoType } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  intent?: string;
}

type PublishStep = 'idle' | 'analyzing' | 'review' | 'privacy' | 'kids' | 'scheduling' | 'publishing' | 'done' | 'failed';
type AgentTab = 'chat' | 'dashboard' | 'queue' | 'copyright' | 'growth';

export default function AIAgentPage() {
  const [activeTab, setActiveTab] = useState<AgentTab>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hey! I'm your AI assistant — ask me anything about your channel, video ideas, scripts, titles, or just chat. What's on your mind?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [publishStep, setPublishStep] = useState<PublishStep>('idle');
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [metadataList, setMetadataList] = useState<{ file: File; title: string; description: string; tags: string[]; hashtags: string[] }[]>([]);
  const [analyzeProgress, setAnalyzeProgress] = useState({ done: 0, total: 0 });
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private' | null>(null);
  const [madeForKids, setMadeForKids] = useState<boolean | null>(null);
  const [bestTime, setBestTime] = useState<BestTimeSuggestion | null>(null);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [publishError, setPublishError] = useState('');
  const [wasScheduled, setWasScheduled] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [publishProgress, setPublishProgress] = useState({ done: 0, total: 0 });

  // Agent Dashboard state
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [queueStats, setQueueStats] = useState({ pending: 0, inProgress: 0, completed: 0, failed: 0, scheduled: 0 });
  const [copyrightSummary, setCopyrightSummary] = useState({ total: 0, active: 0, resolved: 0, critical: 0, revenueAtRisk: 0 });
  const [channelHealth, setChannelHealth] = useState<any>(null);
  const [growthAnalysis, setGrowthAnalysis] = useState<any>(null);
  const [videos, setVideos] = useState<VideoType[]>([]);

  useEffect(() => {
    getYouTubeChannels().then((list) => {
      setChannels(list);
      if (list[0]) setSelectedChannelId(list[0].youtube_channel_id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadDashboardData = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const [fetchedVideos, qStats, cSummary] = await Promise.all([
        getVideos(50),
        smartQueue.getQueueStats(),
        copyrightMonitor.getClaimSummary(),
      ]);
      setVideos(fetchedVideos);
      setQueueStats(qStats);
      setCopyrightSummary(cSummary);

      if (channels.length > 0) {
        const health = await channelIntelligence.generateHealthReport(channels[0].id);
        setChannelHealth(health);

        if (fetchedVideos.length > 0) {
          const growth = await growthHub.analyzeGrowth(channels[0].id, fetchedVideos);
          setGrowthAnalysis(growth);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setDashboardLoading(false);
    }
  }, [channels]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [activeTab, loadDashboardData]);

  const handlePublishFilesSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const invalid = fileArray.find((f) => !f.type.startsWith('video/'));
    if (invalid) {
      setPublishError('Please select only video files');
      return;
    }

    setVideoFiles(fileArray);
    setPublishStep('analyzing');
    setPublishError('');
    setAnalyzeProgress({ done: 0, total: fileArray.length });

    try {
      const settings = await getUserSettings();
      const niche = settings?.channel_niche || undefined;
      const results: typeof metadataList = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const meta = await generateVideoMetadata(file.name, niche);
        results.push({ file, ...meta });
        setAnalyzeProgress({ done: i + 1, total: fileArray.length });
      }

      setMetadataList(results);
      setBestTime(suggestBestPostTime(niche));
      setPublishStep('review');
    } catch (error) {
      const isNoKey = error instanceof Error && error.message === 'NO_API_KEY';
      setPublishError(isNoKey
        ? 'Add your free Gemini API key in Settings first to use this feature.'
        : 'Could not analyze the videos. Please try again.');
      setPublishStep('failed');
    }
  };

  const handleConfirmPrivacy = (status: 'public' | 'unlisted' | 'private') => {
    setPrivacyStatus(status);
    setPublishStep('kids');
  };

  const handleConfirmKids = (isKids: boolean) => {
    setMadeForKids(isKids);
    setPublishStep('scheduling');
  };

  const handleScheduleBatch = async () => {
    if (!bestTime || metadataList.length === 0 || !selectedChannelId || !privacyStatus) return;
    setPublishStep('publishing');
    setPublishProgress({ done: 0, total: metadataList.length });
    try {
      let scheduled = 0;
      for (let i = 0; i < metadataList.length; i++) {
        const meta = metadataList[i];
        const video = await createVideo({
          title: meta.title, description: meta.description, tags: meta.tags,
          hashtags: meta.hashtags, privacy_status: privacyStatus, status: 'draft',
        });
        await uploadVideoFile(video.id, meta.file, undefined, meta.file.name);
        const targetTime = computeNextTargetDate(bestTime.dayOfWeek, bestTime.hour, i);
        await scheduleAutoPublish(video.id, selectedChannelId, targetTime);
        await logActivity({
          type: 'video_scheduled', title: 'Video added to auto-publish queue',
          description: `${meta.title} — ${targetTime.toLocaleString()}`, video_id: video.id,
        }).catch(() => {});
        scheduled++;
        setPublishProgress({ done: scheduled, total: metadataList.length });
      }
      setScheduledCount(scheduled);
      setWasScheduled(true);
      setPublishStep('done');
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Scheduling failed');
      setPublishStep('failed');
    }
  };

  const handlePublishNow = async () => {
    if (metadataList.length === 0 || !selectedChannelId || !privacyStatus) return;
    setPublishStep('publishing');
    setPublishProgress({ done: 0, total: metadataList.length });
    try {
      const [first, ...rest] = metadataList;
      const firstVideo = await createVideo({
        title: first.title, description: first.description, tags: first.tags,
        hashtags: first.hashtags, privacy_status: privacyStatus, status: 'draft',
      });
      await uploadVideoFile(firstVideo.id, first.file, undefined, first.file.name);
      await pushVideoToYouTube(firstVideo.id, selectedChannelId);
      await logActivity({ type: 'video_uploaded', title: 'Auto-Publish uploaded', description: first.title, video_id: firstVideo.id }).catch(() => {});
      setPublishProgress({ done: 1, total: metadataList.length });

      let scheduled = 0;
      if (bestTime) {
        for (let i = 0; i < rest.length; i++) {
          const meta = rest[i];
          const video = await createVideo({
            title: meta.title, description: meta.description, tags: meta.tags,
            hashtags: meta.hashtags, privacy_status: privacyStatus, status: 'draft',
          });
          await uploadVideoFile(video.id, meta.file, undefined, meta.file.name);
          const targetTime = computeNextTargetDate(bestTime.dayOfWeek, bestTime.hour, i + 1);
          await scheduleAutoPublish(video.id, selectedChannelId, targetTime);
          scheduled++;
          setPublishProgress({ done: 1 + scheduled, total: metadataList.length });
        }
      }
      setScheduledCount(scheduled);
      setWasScheduled(rest.length > 0);
      setPublishStep('done');
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Publish failed');
      setPublishStep('failed');
    }
  };

  const handleResetPublishAssistant = () => {
    setPublishStep('idle');
    setVideoFiles([]);
    setMetadataList([]);
    setPrivacyStatus(null);
    setMadeForKids(null);
    setBestTime(null);
    setPublishError('');
    setScheduledCount(0);
  };

  function computeNextTargetDate(dayOfWeek: number, hour: number, dayOffset = 0): Date {
    const result = new Date();
    const daysUntil = (dayOfWeek - result.getDay() + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntil + dayOffset);
    result.setHours(hour, 0, 0, 0);
    return result;
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await agentOrchestrator.chat(input);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.content,
          suggestions: response.suggestions,
          intent: response.intent,
        },
      ]);
    } catch (error) {
      const isNoKey = error instanceof Error && error.message === 'NO_API_KEY';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: isNoKey
            ? "I need a free Gemini API key to chat properly. Head to Settings and paste in a key — then ask me anything!"
            : 'Sorry, I ran into an error. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => handleSend(), 100);
  };

  const quickActions = [
    { icon: Sparkles, label: 'Generate Ideas', prompt: 'Generate video ideas for my channel' },
    { icon: Wand2, label: 'Create Titles', prompt: 'Create SEO-optimized titles' },
    { icon: Target, label: 'Analyze Growth', prompt: 'How is my channel performing?' },
    { icon: Calendar, label: 'Best Upload Time', prompt: 'When should I upload?' },
    { icon: Shield, label: 'Safety Check', prompt: 'Any copyright issues?' },
  ];

  const tabs = [
    { id: 'chat' as AgentTab, label: 'Chat', icon: Bot },
    { id: 'dashboard' as AgentTab, label: 'Dashboard', icon: BarChart3 },
    { id: 'queue' as AgentTab, label: 'Queue', icon: Upload },
    { id: 'copyright' as AgentTab, label: 'Copyright', icon: Shield },
  ];

  const videoFile = videoFiles[0];
  const metadata = metadataList[0];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="w-7 h-7 text-purple-600" /> AI Agent Dashboard
        </h1>
        <p className="text-slate-600">
          Your intelligent assistant for YouTube growth. Powered by{' '}
          <Link to="/settings" className="text-purple-600 underline">your Gemini API key</Link>.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <>
          {/* Auto-Publish Assistant */}
          <div className="bg-white rounded-2xl border-2 border-purple-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <FileVideo className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-slate-800">Auto-Publish Assistant</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Drop a video — I'll write the title, description &amp; tags, suggest the best time, then publish for you.
            </p>

            {publishStep === 'idle' && (
              <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-purple-200 hover:border-purple-400 cursor-pointer transition-colors">
                <FileVideo className="w-8 h-8 text-purple-300 mb-2" />
                <span className="text-sm text-slate-500">Click to drop video file(s)</span>
                <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => handlePublishFilesSelect(e.target.files)} />
              </label>
            )}

            {publishStep === 'analyzing' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing {analyzeProgress.total} video(s)...
                </div>
                <div className="w-full h-2 bg-purple-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600 transition-all" style={{ width: `${(analyzeProgress.done / analyzeProgress.total) * 100}%` }} />
                </div>
              </div>
            )}

            {publishStep === 'review' && metadata && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4" /> Generated metadata
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Title</label>
                  <p className="text-sm font-medium text-slate-800">{metadata.title}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {metadata.tags.map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">{t}</span>
                  ))}
                </div>
                <button onClick={() => setPublishStep('privacy')} className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors">
                  Looks good — continue
                </button>
              </div>
            )}

            {publishStep === 'privacy' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">Who should see this?</p>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => handleConfirmPrivacy('public')} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-colors">
                    <Eye className="w-5 h-5 text-slate-500" /> <span className="text-xs">Public</span>
                  </button>
                  <button onClick={() => handleConfirmPrivacy('unlisted')} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-colors">
                    <Users className="w-5 h-5 text-slate-500" /> <span className="text-xs">Unlisted</span>
                  </button>
                  <button onClick={() => handleConfirmPrivacy('private')} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-colors">
                    <EyeOff className="w-5 h-5 text-slate-500" /> <span className="text-xs">Private</span>
                  </button>
                </div>
              </div>
            )}

            {publishStep === 'kids' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Baby className="w-4 h-4 text-slate-500" />
                  <p className="text-sm text-slate-700">Made for kids?</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleConfirmKids(true)} className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-sm">Yes</button>
                  <button onClick={() => handleConfirmKids(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-sm">No</button>
                </div>
              </div>
            )}

            {publishStep === 'scheduling' && bestTime && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <Clock className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Best time: {bestTime.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{bestTime.reason}</p>
                  </div>
                </div>
                {channels.length > 0 && (
                  <select value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm">
                    {channels.map((c) => (<option key={c.id} value={c.youtube_channel_id}>{c.channel_title}</option>))}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleScheduleBatch} disabled={channels.length === 0} className="px-4 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm">
                    Schedule for this time
                  </button>
                  <button onClick={handlePublishNow} disabled={channels.length === 0} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors text-sm">
                    Publish now
                  </button>
                </div>
              </div>
            )}

            {publishStep === 'publishing' && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading {publishProgress.done}/{publishProgress.total}...
              </div>
            )}

            {publishStep === 'done' && (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-800 mb-3">
                  {wasScheduled ? `Scheduled ${metadataList.length} video(s) for auto-publish.`
                    : 'Published! Check Videos page for the link.'}
                </p>
                <button onClick={handleResetPublishAssistant} className="text-sm text-purple-600 underline">Publish more</button>
              </div>
            )}

            {publishStep === 'failed' && (
              <div className="text-center py-4">
                <X className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-red-600 mb-3">{publishError}</p>
                <button onClick={handleResetPublishAssistant} className="text-sm text-purple-600 underline">Try again</button>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {quickActions.map((action) => (
              <button key={action.label} onClick={() => handleQuickAction(action.prompt)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm whitespace-nowrap">
                <action.icon className="w-4 h-4 text-purple-600" />
                {action.label}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 p-4 mb-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'assistant' ? 'bg-purple-100' : 'bg-red-100'}`}>
                    {message.role === 'assistant' ? <Bot className="w-4 h-4 text-purple-600" /> : <User className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'assistant' ? 'bg-slate-100 text-slate-800' : 'bg-red-600 text-white'}`}>
                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.suggestions.slice(0, 3).map((suggestion, i) => (
                          <button key={i} onClick={() => handleQuickAction(suggestion)} className="px-3 py-1 bg-white/20 rounded-full text-xs hover:bg-white/30 transition-colors">
                            {suggestion.length > 40 ? suggestion.slice(0, 40) + '...' : suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything about your channel..."
              className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
            <button onClick={handleSend} disabled={loading || !input.trim()} className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2">
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="flex-1 overflow-y-auto">
          {dashboardLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Queue Stats */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-800">Queue</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Pending:</span> <span className="font-medium">{queueStats.pending}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">In Progress:</span> <span className="font-medium">{queueStats.inProgress}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Completed:</span> <span className="font-medium">{queueStats.completed}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Failed:</span> <span className="font-medium text-red-600">{queueStats.failed}</span></div>
                </div>
              </div>

              {/* Copyright */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <h3 className="font-semibold text-slate-800">Copyright</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Active Claims:</span> <span className={`font-medium ${copyrightSummary.active > 0 ? 'text-red-600' : ''}`}>{copyrightSummary.active}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Resolved:</span> <span className="font-medium text-green-600">{copyrightSummary.resolved}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Critical:</span> <span className={`font-medium ${copyrightSummary.critical > 0 ? 'text-red-600' : ''}`}>{copyrightSummary.critical}</span></div>
                </div>
              </div>

              {/* Channel Health */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-slate-800">Channel Health</h3>
                </div>
                {channelHealth ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Score:</span> <span className="font-medium">{channelHealth.overallHealth}/100</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Trend:</span> <span className={`font-medium capitalize ${channelHealth.growthTrend === 'growing' ? 'text-green-600' : channelHealth.growthTrend === 'declining' ? 'text-red-600' : ''}`}>{channelHealth.growthTrend}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Engagement:</span> <span className="font-medium">{channelHealth.engagementHealth}/100</span></div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Connect a channel to see health</p>
                )}
              </div>

              {/* Growth Analysis */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-slate-800">Growth Opportunities</h3>
                </div>
                {growthAnalysis ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Score:</span> <span className="font-medium">{growthAnalysis.overallScore}/100</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Opportunities:</span> <span className="font-medium text-purple-600">{growthAnalysis.opportunities.length}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Strengths:</span> <span className="font-medium text-green-600">{growthAnalysis.strengths.length}</span></div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Add videos for analysis</p>
                )}
              </div>

              {/* Quick Recommendations */}
              {growthAnalysis && growthAnalysis.opportunities.length > 0 && (
                <div className="md:col-span-2 lg:col-span-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-slate-800">Top Recommendations</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {growthAnalysis.opportunities.slice(0, 3).map((opp: any, i: number) => (
                      <div key={i} className="bg-white rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-1 mb-1">
                          <Zap className="w-3 h-3 text-purple-600" />
                          <span className="text-xs font-medium text-purple-600 uppercase">{opp.type.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 mb-1">{opp.title}</p>
                        <p className="text-xs text-slate-500">{opp.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" /> Upload Queue Status
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-2xl font-bold text-blue-600">{queueStats.pending}</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-xl">
              <p className="text-2xl font-bold text-yellow-600">{queueStats.inProgress}</p>
              <p className="text-xs text-slate-500">In Progress</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">{queueStats.completed}</p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-xl">
              <p className="text-2xl font-bold text-red-600">{queueStats.failed}</p>
              <p className="text-xs text-slate-500">Failed</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-xl">
              <p className="text-2xl font-bold text-purple-600">{queueStats.scheduled}</p>
              <p className="text-xs text-slate-500">Scheduled</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Use the chat to analyze queue priority or find the best upload times.
          </p>
        </div>
      )}

      {/* Copyright Tab */}
      {activeTab === 'copyright' && (
        <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" /> Copyright Monitor
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-slate-600">{copyrightSummary.total}</p>
              <p className="text-xs text-slate-500">Total Claims</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-xl">
              <p className="text-2xl font-bold text-amber-600">{copyrightSummary.active}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-xl">
              <p className="text-2xl font-bold text-red-600">{copyrightSummary.critical}</p>
              <p className="text-xs text-slate-500">Critical</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">{copyrightSummary.resolved}</p>
              <p className="text-xs text-slate-500">Resolved</p>
            </div>
          </div>
          {copyrightSummary.active > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">You have active copyright claims</p>
                <p className="text-xs text-amber-600 mt-1">Use the chat to analyze dispute options or check video safety.</p>
              </div>
            </div>
          )}
          {copyrightSummary.active === 0 && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> No active copyright claims. Your channel looks clean.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
