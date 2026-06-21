import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Send, Bot, User, Sparkles, Loader as Loader2, Wand as Wand2, Video, Upload, TrendingUp,
  FileVideo, Clock, Eye, EyeOff, Users, Baby, X, CheckCircle2,
} from 'lucide-react';
import {
  chatWithAgent, logActivity, generateVideoMetadata, suggestBestPostTime,
  createVideo, uploadVideoFile, pushVideoToYouTube, getYouTubeChannels, getUserSettings,
  scheduleAutoPublish, type BestTimeSuggestion,
} from '../lib/api';
import type { YouTubeChannel } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

type PublishStep = 'idle' | 'analyzing' | 'review' | 'privacy' | 'kids' | 'scheduling' | 'publishing' | 'done' | 'failed';

export default function AIAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hey! I\'m your AI assistant — ask me anything about your channel, video ideas, scripts, titles, or just chat. I understand Telugu, English, or a mix of both. What\'s on your mind?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-Publish Assistant state
  const [publishStep, setPublishStep] = useState<PublishStep>('idle');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<{ title: string; description: string; tags: string[]; hashtags: string[] } | null>(null);
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private' | null>(null);
  const [madeForKids, setMadeForKids] = useState<boolean | null>(null);
  const [bestTime, setBestTime] = useState<BestTimeSuggestion | null>(null);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [publishError, setPublishError] = useState('');
  const [wasScheduled, setWasScheduled] = useState(false);

  useEffect(() => {
    getYouTubeChannels().then((list) => {
      setChannels(list);
      if (list[0]) setSelectedChannelId(list[0].youtube_channel_id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handlePublishFileSelect = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setPublishError('Please select a video file');
      return;
    }
    setVideoFile(file);
    setPublishStep('analyzing');
    setPublishError('');
    try {
      const settings = await getUserSettings();
      const meta = await generateVideoMetadata(file.name, settings?.channel_niche || undefined);
      setMetadata(meta);
      const time = suggestBestPostTime(settings?.channel_niche || undefined);
      setBestTime(time);
      setPublishStep('review');
    } catch (error) {
      const isNoKey = error instanceof Error && error.message === 'NO_API_KEY';
      setPublishError(isNoKey
        ? 'Add your free Gemini API key in Settings first to use this feature.'
        : 'Could not analyze the video. Please try again.');
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

  const handleScheduleAndWait = async () => {
    if (!bestTime || !videoFile || !metadata || !selectedChannelId || !privacyStatus) return;
    setPublishStep('publishing');
    try {
      const video = await createVideo({
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        hashtags: metadata.hashtags,
        privacy_status: privacyStatus,
        status: 'draft',
      });
      // Upload the file now — the cron worker will publish it later at
      // the scheduled time, even if this browser tab is closed.
      await uploadVideoFile(video.id, videoFile, undefined, videoFile.name);

      const targetTime = computeNextTargetDate(bestTime.dayOfWeek, bestTime.hour);
      await scheduleAutoPublish(video.id, selectedChannelId, targetTime);

      await logActivity({
        type: 'video_scheduled',
        title: 'Video scheduled for auto-publish',
        description: `${metadata.title} — scheduled for ${bestTime.label}`,
        video_id: video.id,
      }).catch(() => {});

      setWasScheduled(true);
      setPublishStep('done');
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Scheduling failed');
      setPublishStep('failed');
    }
  };

  const handlePublishNow = () => {
    handleFinalPublish();
  };

  const handleFinalPublish = async () => {
    if (!videoFile || !metadata || !selectedChannelId || !privacyStatus) return;
    setPublishStep('publishing');
    try {
      const video = await createVideo({
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        hashtags: metadata.hashtags,
        privacy_status: privacyStatus,
        status: 'draft',
      });
      await uploadVideoFile(video.id, videoFile, undefined, videoFile.name);
      await pushVideoToYouTube(video.id, selectedChannelId);
      await logActivity({
        type: 'video_uploaded',
        title: 'Auto-Publish Assistant uploaded a video',
        description: metadata.title,
        video_id: video.id,
      }).catch(() => {});
      setWasScheduled(false);
      setPublishStep('done');
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Publish failed');
      setPublishStep('failed');
    }
  };

  const handleResetPublishAssistant = () => {
    setPublishStep('idle');
    setVideoFile(null);
    setMetadata(null);
    setPrivacyStatus(null);
    setMadeForKids(null);
    setBestTime(null);
    setPublishError('');
  };

  function computeNextTargetDate(dayOfWeek: number, hour: number): Date {
    const result = new Date();
    const daysUntil = (dayOfWeek - result.getDay() + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntil);
    result.setHours(hour, 0, 0, 0);
    return result;
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    const historyForApi = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const replyText = await chatWithAgent(input, historyForApi);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: replyText },
      ]);
      await logActivity({
        type: 'ai_generated',
        title: 'AI Agent chat',
        description: input.substring(0, 100),
      }).catch(() => {});
    } catch (error) {
      const isNoKey = error instanceof Error && error.message === 'NO_API_KEY';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: isNoKey
            ? 'I need a free Gemini API key to chat properly. Head to Settings and paste in a key (it only takes a minute and it\'s free) — then come back and ask me anything!'
            : 'Sorry, I ran into an error talking to the AI service. Please try again in a moment.',
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
    { icon: Video, label: 'Write Script', prompt: 'Write a video script' },
    { icon: Upload, label: 'Schedule Upload', prompt: 'Help me schedule uploads' },
    { icon: TrendingUp, label: 'Trending Topics', prompt: 'What are trending topics?' },
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="w-7 h-7 text-purple-600" /> AI YouTube Agent
        </h1>
        <p className="text-slate-600">
          Your intelligent assistant for YouTube growth and automation. Powered by your own free{' '}
          <Link to="/settings" className="text-purple-600 underline">Gemini API key</Link>.
        </p>
      </div>

      {/* Auto-Publish Assistant */}
      <div className="bg-white rounded-2xl border-2 border-purple-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <FileVideo className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold text-slate-800">Auto-Publish Assistant</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Drop a video — I'll write the title, description &amp; tags, ask a couple quick questions, suggest the best time to post, then publish it for you.
        </p>

        {publishStep === 'idle' && (
          <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-purple-200 hover:border-purple-400 cursor-pointer transition-colors">
            <FileVideo className="w-8 h-8 text-purple-300 mb-2" />
            <span className="text-sm text-slate-500">Click to drop a video file</span>
            <input type="file" accept="video/*" className="hidden" onChange={(e) => handlePublishFileSelect(e.target.files?.[0] || null)} />
          </label>
        )}

        {publishStep === 'analyzing' && (
          <div className="flex items-center gap-2 text-sm text-slate-600 p-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing "{videoFile?.name}" and writing your title, description &amp; tags...
          </div>
        )}

        {publishStep === 'review' && metadata && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4" /> Generated metadata for "{videoFile?.name}"
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Title</label>
              <p className="text-sm font-medium text-slate-800">{metadata.title}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Description</label>
              <p className="text-sm text-slate-600">{metadata.description}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {metadata.tags.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">{t}</span>
              ))}
            </div>
            <button
              onClick={() => setPublishStep('privacy')}
              className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
            >
              Looks good — continue
            </button>
          </div>
        )}

        {publishStep === 'privacy' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">Who should be able to see this video?</p>
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
              <p className="text-sm text-slate-700">Is this video made for kids?</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleConfirmKids(true)} className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-sm">Yes, made for kids</button>
              <button onClick={() => handleConfirmKids(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-sm">No</button>
            </div>
          </div>
        )}

        {publishStep === 'scheduling' && bestTime && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <Clock className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Best time to post: {bestTime.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{bestTime.reason}</p>
              </div>
            </div>

            {channels.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
                No YouTube channel connected. Go to Settings to connect one first.
              </p>
            ) : (
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.youtube_channel_id}>{c.channel_title}</option>
                ))}
              </select>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleScheduleAndWait}
                disabled={channels.length === 0}
                className="px-4 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm"
              >
                Schedule for this time
              </button>
              <button
                onClick={handlePublishNow}
                disabled={channels.length === 0}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors text-sm"
              >
                Publish right now
              </button>
            </div>
            <p className="text-xs text-slate-500">
              "Schedule for this time" uploads the video now and publishes it automatically at the scheduled time — this works even if you close this tab or turn off your computer.
            </p>
          </div>
        )}

        {publishStep === 'publishing' && (
          <div className="flex items-center gap-2 text-sm text-slate-600 p-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Publishing to YouTube...
          </div>
        )}

        {publishStep === 'done' && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-800 mb-3">
              {wasScheduled
                ? `Scheduled! It'll publish automatically at ${bestTime?.label} — no need to keep this open.`
                : 'Published! Check the Videos page for the link.'}
            </p>
            <button onClick={handleResetPublishAssistant} className="text-sm text-purple-600 underline">Publish another video</button>
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
          <button
            key={action.label}
            onClick={() => handleQuickAction(action.prompt)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm whitespace-nowrap"
          >
            <action.icon className="w-4 h-4 text-purple-600" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'assistant' ? 'bg-purple-100' : 'bg-red-100'
              }`}>
                {message.role === 'assistant' ? (
                  <Bot className="w-4 h-4 text-purple-600" />
                ) : (
                  <User className="w-4 h-4 text-red-600" />
                )}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'assistant'
                  ? 'bg-slate-100 text-slate-800'
                  : 'bg-red-600 text-white'
              }`}>
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                {message.suggestions && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickAction(`Use this idea: ${suggestion}`)}
                        className="px-3 py-1 bg-white/20 rounded-full text-xs hover:bg-white/30 transition-colors"
                      >
                        {suggestion.substring(0, 40)}...
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
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask me anything about YouTube automation..."
          className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </div>
    </div>
  );
}