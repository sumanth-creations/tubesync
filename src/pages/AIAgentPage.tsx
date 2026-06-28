import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Send, Bot, User, Sparkles, Loader as Loader2, Wand as Wand2, Upload, BarChart3, Shield, Zap, TriangleAlert as AlertTriangle, Lightbulb, Target, Activity, Calendar, FileVideo, CheckCircle2, X, Eye, EyeOff, Users, Baby, Clock } from 'lucide-react';
import {
  agentOrchestrator, smartQueue, copyrightMonitor, channelIntelligence, growthHub, seoAnalyzer, learningEngine,
} from '../lib/agents';
import {
  getYouTubeChannels, getUserSettings, getVideos, logActivity, generateVideoMetadata, suggestBestPostTime, createVideo, uploadVideoFile, pushVideoToYouTube, scheduleAutoPublish, type BestTimeSuggestion,
} from '../lib/api';
import type { YouTubeChannel, Video as VideoType } from '../types';

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

  // States for Publish Assistant
  const [publishStep, setPublishStep] = useState<PublishStep>('idle');
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [metadataList, setMetadataList] = useState<{ file: File; title: string; description: string; tags: string[]; hashtags: string[] }[]>([]);
  const [analyzeProgress, setAnalyzeProgress] = useState({ done: 0, total: 0 });
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private' | null>(null);
  const [bestTime, setBestTime] = useState<BestTimeSuggestion | null>(null);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [publishError, setPublishError] = useState('');
  const [wasScheduled, setWasScheduled] = useState(false);
  const [publishProgress, setPublishProgress] = useState({ done: 0, total: 0 });

  // Dashboard states
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [queueStats, setQueueStats] = useState({ pending: 0, inProgress: 0, completed: 0, failed: 0, scheduled: 0 });
  const [copyrightSummary, setCopyrightSummary] = useState({ total: 0, active: 0, resolved: 0, critical: 0, revenueAtRisk: 0 });
  const [channelHealth, setChannelHealth] = useState<any>(null);
  const [growthAnalysis, setGrowthAnalysis] = useState<any>(null);

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
      const [qStats, cSummary] = await Promise.all([
        smartQueue.getQueueStats(),
        copyrightMonitor.getClaimSummary(),
      ]);
      setQueueStats(qStats);
      setCopyrightSummary(cSummary);
      if (channels.length > 0) {
        const health = await channelIntelligence.generateHealthReport(channels[0].id);
        setChannelHealth(health);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setDashboardLoading(false);
    }
  }, [channels]);

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboardData();
  }, [activeTab, loadDashboardData]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Adding delay to prevent 429 rate limit
      await delay(1000);
      const response = await agentOrchestrator.chat(input);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.content,
          suggestions: response.suggestions,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'I ran into a rate limit or error. Please wait a moment and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ... (Keep the rest of your UI/JSX structure as it was originally)
  // Since you have many functions like handlePublishFilesSelect, I recommend keeping your 
  // original JSX layout and just replacing the functions above the return() statement with these versions.
  
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Your Original JSX return block here */}
    </div>
  );
}