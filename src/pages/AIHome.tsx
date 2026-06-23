/**
 * AI Home - Full Conversational AI Experience
 *
 * The entire application becomes a conversation with AI.
 * No dashboard. No menus. Just talk to your AI YouTube Manager.
 *
 * Features:
 * - Large animated Intelligence Orb as the soul of the app
 * - Proactive AI greetings and recommendations
 * - Everything accessed through conversation
 * - Dark futuristic glassmorphism theme
 * - Real-time agent status
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntelligenceOrb } from '../components/IntelligenceOrb';
import {
  agentOrchestrator,
  getIntelligenceReport,
  getAgentStates,
  initializeAgentStates,
} from '../lib/agents';
import { getVideos, getYouTubeChannels, getUserSettings } from '../lib/api';

type OrbState = 'idle' | 'thinking' | 'listening' | 'learning' | 'researching';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIHome() {
  const navigate = useNavigate();
  const [orbState, setOrbState] = useState<OrbState>('listening');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [report, setReport] = useState<{
    pendingDecisions: number;
    activeTrends: number;
    trackingCompetitors: number;
    pendingShortsJobs: number;
    thumbnailQueue: number;
  } | null>(null);
  const [agentCount, setAgentCount] = useState(0);
  const [onlineAgents, setOnlineAgents] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize AI experience
  useEffect(() => {
    initializeExperience();
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 500);
  }, []);

  const initializeExperience = async () => {
    setOrbState('thinking');

    // Generate time-based greeting
    const hour = new Date().getHours();
    let timeGreeting = 'Hello';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    try {
      // Get user's name from settings
      const settings = await getUserSettings();
      const niche = settings?.channel_niche;

      // Initialize agent states
      await initializeAgentStates();

      // Get intelligence report
      const systemReport = await getIntelligenceReport();
      setReport(systemReport);

      // Get agent statuses
      const statuses = await getAgentStates();
      setAgentCount(statuses.length);
      setOnlineAgents(statuses.filter(s => s.status !== 'error').length);

      // Build proactive greeting with insights
      const insights: string[] = [];
      if (systemReport.activeTrends > 0) {
        insights.push(`${systemReport.activeTrends} trending opportunities`);
      }
      if (systemReport.pendingDecisions > 0) {
        insights.push(`${systemReport.pendingDecisions} items needing your attention`);
      }

      const greetingText = insights.length > 0
        ? `${timeGreeting}. I've prepared ${insights.join(' and ')} for you today. What would you like to focus on?`
        : `${timeGreeting}. I'm ready to help you grow your channel. What's on your mind?`;

      setGreeting(greetingText);

      // Add AI greeting as first message
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: greetingText,
        timestamp: new Date(),
      }]);

      setOrbState('listening');
    } catch (error) {
      console.error('[AIHome] Init error:', error);
      setGreeting(`${timeGreeting}. I'm ready to help you grow your channel.`);
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: `${timeGreeting}. I'm ready to help. What would you like to work on?`,
        timestamp: new Date(),
      }]);
      setOrbState('listening');
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);
    setIsProcessing(true);
    setOrbState('thinking');

    try {
      // Check for special commands that navigate
      const lowerMessage = userMessage.toLowerCase();

      if (lowerMessage.includes('show analytics') || lowerMessage.includes('open analytics') || lowerMessage.includes('show dashboard')) {
        const response = 'Opening analytics view for you...';
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        }]);
        setOrbState('listening');
        setIsProcessing(false);
        setTimeout(() => navigate('/dashboard'), 1000);
        return;
      }

      if (lowerMessage.includes('show videos') || lowerMessage.includes('open videos')) {
        const response = 'Opening your video library...';
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        }]);
        setOrbState('listening');
        setIsProcessing(false);
        setTimeout(() => navigate('/videos'), 1000);
        return;
      }

      if (lowerMessage.includes('show shorts') || lowerMessage.includes('open shorts')) {
        const response = 'Opening Shorts Factory...';
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        }]);
        setOrbState('listening');
        setIsProcessing(false);
        setTimeout(() => navigate('/shorts'), 1000);
        return;
      }

      if (lowerMessage.includes('show calendar') || lowerMessage.includes('open calendar')) {
        const response = 'Opening your upload calendar...';
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        }]);
        setOrbState('listening');
        setIsProcessing(false);
        setTimeout(() => navigate('/calendar'), 1000);
        return;
      }

      // Regular AI conversation
      const response = await agentOrchestrator.chat(userMessage);

      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      }]);
      setOrbState('listening');
    } catch (error) {
      console.error('[AIHome] Chat error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const isNoKey = errorMsg === 'NO_API_KEY';
      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: isNoKey
          ? 'I need your Gemini API key to provide intelligent responses. Please add it in Settings.'
          : `I encountered an issue: ${errorMsg}. Could you try again?`,
        timestamp: new Date(),
      }]);
      setOrbState('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const quickActions = [
    { label: 'Analyze my channel growth', icon: '📈' },
    { label: 'Find trending content ideas', icon: '🔥' },
    { label: 'Check upload queue status', icon: '📤' },
    { label: 'Review SEO performance', icon: '🔍' },
    { label: 'Generate 5 video titles', icon: '✨' },
    { label: 'What should I upload today?', icon: '💡' },
  ];

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Intelligence Orb - Centerpiece */}
      <div className="flex-shrink-0 py-8 flex justify-center">
        <IntelligenceOrb
          state={orbState}
          size="lg"
          pulseOnIdle
          showStatus
        />
      </div>

      {/* Agent Status Bar */}
      {agentCount > 0 && (
        <div className="flex-shrink-0 px-4 mb-4">
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>{onlineAgents} agents online</span>
            </div>
            {report && (
              <>
                <span className="text-slate-600">|</span>
                <span>{report.activeTrends} trends</span>
                <span className="text-slate-600">|</span>
                <span>{report.pendingDecisions} pending</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 backdrop-blur-xl ${
                  msg.role === 'user'
                    ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-100'
                    : 'bg-slate-800/50 border border-slate-700/50 text-slate-200'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-5 py-3 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions - only show when conversation is minimal */}
      {messages.length <= 1 && (
        <div className="flex-shrink-0 px-4 mb-4">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs text-slate-500 text-center mb-3">Quick actions</p>
            <div className="flex flex-wrap justify-center gap-2">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(action.label);
                    setTimeout(() => handleSubmit(), 100);
                  }}
                  className="px-4 py-2 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl text-sm text-slate-300 hover:bg-slate-700/50 hover:border-slate-600 transition-all"
                >
                  <span className="mr-2">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 bg-slate-900/50 backdrop-blur-xl border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Talk to your AI assistant..."
              disabled={isProcessing}
              className="flex-1 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl px-5 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isProcessing}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-colors"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-slate-600 text-center mt-2">
            Say "show analytics", "show videos", "show calendar", or "show shorts" to open views
          </p>
        </div>
      </div>
    </div>
  );
}
