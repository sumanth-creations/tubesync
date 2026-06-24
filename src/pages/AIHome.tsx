/**
 * AI Home - Full Conversational AI Experience
 *
 * The entire application is a conversation with your AI YouTube Manager.
 * No dashboard. No menus. Just talk to your AI.
 *
 * CRITICAL: All database operations have defensive error handling.
 * The page MUST load even if agent_states table is inaccessible.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// Helper to log errors with context
function logError(operation: string, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[AIHome] ${operation}:`, msg);
}

// Intelligence report type
interface IntelligenceReport {
  pendingDecisions: number;
  activeTrends: number;
  trackingCompetitors: number;
  pendingShortsJobs: number;
  thumbnailQueue: number;
}

// Agent state type
interface AgentState {
  id: string;
  agent_name: string;
  status: string;
  is_active: boolean;
}

// Get intelligence report with full error handling
async function getIntelligenceReport(): Promise<IntelligenceReport> {
  const emptyReport: IntelligenceReport = {
    pendingDecisions: 0,
    activeTrends: 0,
    trackingCompetitors: 0,
    pendingShortsJobs: 0,
    thumbnailQueue: 0,
  };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[getIntelligenceReport] No authenticated user');
      return emptyReport;
    }

    // Query each table individually with error handling
    const results = await Promise.allSettled([
      supabase.from('intelligence_decisions').select('id', { count: 'exact', head: true }),
      supabase.from('trend_intelligence').select('id', { count: 'exact', head: true }),
      supabase.from('competitor_intelligence').select('id', { count: 'exact', head: true }),
      supabase.from('shorts_intelligence').select('id', { count: 'exact', head: true }),
      supabase.from('thumbnail_intelligence').select('id', { count: 'exact', head: true }),
    ]);

    return {
      pendingDecisions: results[0].status === 'fulfilled' ? (results[0].value.count || 0) : 0,
      activeTrends: results[1].status === 'fulfilled' ? (results[1].value.count || 0) : 0,
      trackingCompetitors: results[2].status === 'fulfilled' ? (results[2].value.count || 0) : 0,
      pendingShortsJobs: results[3].status === 'fulfilled' ? (results[3].value.count || 0) : 0,
      thumbnailQueue: results[4].status === 'fulfilled' ? (results[4].value.count || 0) : 0,
    };
  } catch (error) {
    logError('getIntelligenceReport', error);
    return emptyReport;
  }
}

// Get agent states with full error handling
async function getAgentStates(): Promise<AgentState[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[getAgentStates] No authenticated user');
      return [];
    }

    const { data, error } = await supabase
      .from('agent_states')
      .select('*')
      .eq('is_active', true);

    if (error) {
      // Check if it's a table not found error
      if (error.code === 'PGRST205' || error.message?.includes('Could not find')) {
        console.warn('[getAgentStates] Table agent_states not found - using empty state');
        return [];
      }
      logError('getAgentStates query', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logError('getAgentStates', error);
    return [];
  }
}

// Initialize agent states - creates default agents if needed
async function initializeAgentStates(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[initializeAgentStates] No authenticated user');
      return;
    }

    const agents = [
      { name: 'YouTube Intelligence', type: 'youtube_intelligence' },
      { name: 'Trend Research', type: 'trend_research' },
      { name: 'Competitor Intel', type: 'competitor_intel' },
      { name: 'Thumbnail Intel', type: 'thumbnail_intel' },
      { name: 'Shorts Factory', type: 'shorts_factory' },
      { name: 'SEO Analyzer', type: 'seo_analyzer' },
      { name: 'Channel History', type: 'channel_history' },
      { name: 'Growth Hub', type: 'growth_hub' },
      { name: 'Copyright Monitor', type: 'copyright_monitor' },
      { name: 'Smart Queue', type: 'smart_queue' },
    ];

    for (const agent of agents) {
      try {
        await supabase
          .from('agent_states')
          .upsert({
            user_id: user.id,
            agent_name: agent.name,
            agent_type: agent.type,
            status: 'idle',
            is_active: true,
          }, {
            onConflict: 'user_id,agent_name',
          });
      } catch (err) {
        // Log individual agent failure but continue
        logError(`initializeAgentStates(${agent.name})`, err);
      }
    }
  } catch (error) {
    logError('initializeAgentStates', error);
  }
}

// Get user settings with error handling
async function getUserSettings(): Promise<{ channel_niche?: string; gemini_api_key?: string } | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_settings')
      .select('channel_niche, gemini_api_key')
      .maybeSingle();

    if (error) {
      logError('getUserSettings', error);
      return null;
    }
    return data;
  } catch (error) {
    logError('getUserSettings', error);
    return null;
  }
}

// AI Chat with Gemini
async function chatWithAI(message: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: `You are TubeSync Intelligence, a helpful AI YouTube channel manager. Be friendly, concise, and actionable. User says: ${message}` }]
      }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not generate a response.';
}

// Main AI Home component
export default function AIHome() {
  const [orbState, setOrbState] = useState<'idle' | 'thinking' | 'listening'>('listening');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [agentCount, setAgentCount] = useState(0);
  const [onlineAgents, setOnlineAgents] = useState(0);
  const [geminiKey, setGeminiKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize on mount
  useEffect(() => {
    initializeExperience();
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 500);
  }, []);

  const initializeExperience = async () => {
    setOrbState('thinking');

    const hour = new Date().getHours();
    let timeGreeting = 'Hello';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    try {
      // Get Gemini API key
      const settings = await getUserSettings();
      if (settings?.gemini_api_key) {
        setGeminiKey(settings.gemini_api_key);
      }

      // Initialize agent states (will fail gracefully if table doesn't exist)
      await initializeAgentStates();

      // Get intelligence report
      const systemReport = await getIntelligenceReport();
      setReport(systemReport);

      // Get agent statuses
      const statuses = await getAgentStates();
      setAgentCount(statuses.length);
      setOnlineAgents(statuses.filter(s => s.status !== 'error').length);

      // Build greeting
      const insights: string[] = [];
      if (systemReport.activeTrends > 0) insights.push(`${systemReport.activeTrends} trending opportunities`);
      if (systemReport.pendingDecisions > 0) insights.push(`${systemReport.pendingDecisions} items needing attention`);

      const greeting = insights.length > 0
        ? `${timeGreeting}. I've prepared ${insights.join(' and ')} for you. What would you like to focus on?`
        : `${timeGreeting}. I'm ready to help you grow your channel. What's on your mind?`;

      setMessages([{ role: 'assistant', content: greeting }]);
      setOrbState('listening');
    } catch (error) {
      logError('initializeExperience', error);
      setMessages([{
        role: 'assistant',
        content: `${timeGreeting}. I'm ready to help. What would you like to work on?`
      }]);
      setOrbState('listening');
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);
    setOrbState('thinking');

    try {
      // Check for navigation commands
      const lowerMessage = userMessage.toLowerCase();
      if (lowerMessage.includes('show analytics') || lowerMessage.includes('show dashboard')) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Opening analytics view...' }]);
        setOrbState('listening');
        setIsProcessing(false);
        return;
      }

      // Check for Gemini API key
      if (!geminiKey) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I need your Gemini API key to provide intelligent responses. Please add it in Settings.'
        }]);
        setOrbState('idle');
        setIsProcessing(false);
        return;
      }

      // Chat with AI
      const response = await chatWithAI(userMessage, geminiKey);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setOrbState('listening');
    } catch (error) {
      logError('handleSubmit', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I encountered an issue: ${errorMsg}. Could you try again?`
      }]);
      setOrbState('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, geminiKey]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const quickActions = [
    { label: 'Analyze my channel growth', icon: '📈' },
    { label: 'Find trending content ideas', icon: '🔥' },
    { label: 'Check upload queue status', icon: '📤' },
    { label: 'Generate 5 video titles', icon: '✨' },
  ];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Intelligence Orb */}
      <div className="flex-shrink-0 py-8 flex justify-center">
        <div className="relative">
          <div
            className={`w-32 h-32 rounded-full transition-all duration-1000 ${
              orbState === 'thinking'
                ? 'bg-gradient-to-br from-purple-600 to-cyan-600 animate-pulse'
                : orbState === 'listening'
                ? 'bg-gradient-to-br from-cyan-500 to-purple-500'
                : 'bg-gradient-to-br from-slate-600 to-slate-700'
            }`}
          >
            <div className="absolute inset-2 rounded-full bg-slate-950/50 backdrop-blur-xl flex items-center justify-center">
              <div
                className={`w-4 h-4 rounded-full ${
                  orbState === 'thinking'
                    ? 'bg-purple-400 animate-ping'
                    : orbState === 'listening'
                    ? 'bg-cyan-400'
                    : 'bg-slate-600'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Agent Status */}
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 ${
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
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-5 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="flex-shrink-0 px-4 mb-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap justify-center gap-2">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(action.label);
                    setTimeout(() => handleSubmit(), 100);
                  }}
                  className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-300 hover:bg-slate-700/50 transition-all"
                >
                  <span className="mr-2">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-4 bg-slate-900/50 border-t border-slate-800/50">
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
              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isProcessing}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 rounded-xl font-medium text-white transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
