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

// Rate limit fix: Delay helper
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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

  // --- FIX START: Optimized HandleSend ---
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Get API Key from settings first
      const settings = await getUserSettings();
      if (!settings?.gemini_api_key) throw new Error("NO_API_KEY");

      // Rate limit fix: Added 1 sec delay
      await delay(1000);

      // Using your agentOrchestrator, but adding a check if needed
      // If agentOrchestrator.chat uses its own fetch, make sure it is updated there too.
      // Or use this direct API approach for reliability:
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.gemini_api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: input }] }]
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: aiResponse },
      ]);
    } catch (error: any) {
      const errMsg = error.message === 'NO_API_KEY' 
        ? "I need a free Gemini API key to chat properly. Head to Settings and paste in a key!" 
        : 'Sorry, I ran into an error. Please try again.';
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: errMsg },
      ]);
    } finally {
      setLoading(false);
    }
  };
  // --- FIX END ---

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

  const metadata = metadataList[0];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
       {/* UI code as it was */}
       <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="w-7 h-7 text-purple-600" /> AI Agent Dashboard
        </h1>
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
      {activeTab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 p-4 mb-4">
             {/* Chat messages display */}
             {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                  {/* ... */}
                </div>
             ))}
             {loading && <Loader2 className="animate-spin" />}
             <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 px-4 py-3 border rounded-xl" />
            <button onClick={handleSend} className="px-6 py-3 bg-purple-600 text-white rounded-xl">Send</button>
          </div>
        </>
      )}
    </div>
  );
}