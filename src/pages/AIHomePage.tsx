/**
 * AI-First Home Page
 *
 * Replaces the traditional dashboard as the entry point.
 * Features:
 * - Large animated Intelligence Orb as centerpiece
 * - Live AI status updates
 * - Proactive AI greetings
 * - AI recommendations on startup
 * - Direct conversation interface
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntelligenceOrb, DemoOrb } from '../components/IntelligenceOrb';
import { agentOrchestrator, youtubeIntelligence, getIntelligenceReport, getAgentStates, initializeAgentStates } from '../lib/agents';

type OrbState = 'idle' | 'thinking' | 'listening' | 'learning' | 'researching';

interface AgentStatus {
  name: string;
  agent_type: string;
  status: string;
  current_task: string | null;
  tasks_completed: number;
  last_activity: string | null;
}

interface Recommendation {
  type: 'trend' | 'upload' | 'content' | 'seo' | 'growth';
  title: string;
  description: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  link?: string;
}

const greetingMessages = [
  "Good to see you! I've been analyzing your channel while you were away.",
  "Welcome back! I found some opportunities for your channel.",
  "Hey! I have a few recommendations ready for you today.",
  "Ready when you are! I've been preparing insights for your content.",
  "Hi there! I've detected some trends you might want to know about.",
];

const quickActions = [
  { label: 'Analyze my channel', icon: '📊', action: 'analyze' },
  { label: 'Find trending topics', icon: '🔥', action: 'trends' },
  { label: 'Check upload queue', icon: '📤', action: 'queue' },
  { label: 'Review recommendations', icon: '💡', action: 'recommendations' },
  { label: 'Generate video ideas', icon: '✨', action: 'ideas' },
  { label: 'Check SEO health', icon: '🔍', action: 'seo' },
];

export default function AIHomePage() {
  const navigate = useNavigate();
  const [orbState, setOrbState] = useState<OrbState>('listening');
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [report, setReport] = useState<{
    pendingDecisions: number;
    activeTrends: number;
    trackingCompetitors: number;
    pendingShortsJobs: number;
    thumbnailQueue: number;
  } | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  // Initialize on mount
  useEffect(() => {
    initializeHome();
  }, []);

  const initializeHome = async () => {
    setOrbState('thinking');

    // Set greeting
    const hour = new Date().getHours();
    let timeGreeting = 'Hello';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    const randomGreeting = greetingMessages[Math.floor(Math.random() * greetingMessages.length)];
    setGreeting(`${timeGreeting}! ${randomGreeting}`);

    try {
      // Initialize agent states
      await initializeAgentStates();

      // Get system report
      const systemReport = await getIntelligenceReport();
      setReport(systemReport);

      // Get agent statuses
      const statuses = await getAgentStates();
      setAgentStatuses(statuses);

      // Generate startup recommendations based on report
      const startupRecs = generateStartupRecommendations(systemReport);
      setRecommendations(startupRecs);

      setOrbState('listening');
    } catch (error) {
      console.error('Failed to initialize home:', error);
      setOrbState('idle');
    }
  };

  const generateStartupRecommendations = (reportData: typeof report): Recommendation[] => {
    const recs: Recommendation[] = [];

    if (reportData && reportData.pendingDecisions > 0) {
      recs.push({
        type: 'content',
        title: 'Pending Decisions',
        description: `You have ${reportData.pendingDecisions} decisions awaiting your approval.`,
        action: 'Review now',
        priority: 'high',
        link: '/agent',
      });
    }

    if (reportData && reportData.activeTrends > 0) {
      recs.push({
        type: 'trend',
        title: 'Trending Opportunities',
        description: `${reportData.activeTrends} trending topics detected. Potential content opportunities.`,
        action: 'Explore trends',
        priority: 'medium',
        link: '/agent',
      });
    }

    if (reportData && reportData.pendingShortsJobs > 0) {
      recs.push({
        type: 'upload',
        title: 'Shorts Processing',
        description: `${reportData.pendingShortsJobs} shorts jobs in queue.`,
        action: 'Check status',
        priority: 'medium',
        link: '/shorts',
      });
    }

    recs.push({
      type: 'growth',
      title: 'Content Strategy',
      description: 'Analyze your channel growth and get personalized recommendations.',
      action: 'Analyze now',
      priority: 'low',
      link: '/agent',
    });

    return recs;
  };

  const handleSubmit = useCallback(async () => {
    if (!message.trim() || isProcessing) return;

    const userMessage = message.trim();
    setMessage('');
    setConversation(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);
    setOrbState('thinking');

    try {
      const response = await agentOrchestrator.chat(userMessage);

      setConversation(prev => [...prev, { role: 'assistant', content: response.content }]);
      setOrbState('listening');
    } catch (error) {
      setConversation(prev => [...prev, {
        role: 'assistant',
        content: 'I encountered an error. Please try again.'
      }]);
      setOrbState('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [message, isProcessing]);

  const handleQuickAction = async (action: string) => {
    const actionPrompts: Record<string, string> = {
      analyze: 'Analyze my channel health and performance',
      trends: 'What are the current trending opportunities for my channel?',
      queue: 'What\'s the status of my upload queue?',
      recommendations: 'Show me your top recommendations for my channel',
      ideas: 'Generate 5 video content ideas for my channel',
      seo: 'Analyze my SEO performance and suggest improvements',
    };

    const prompt = actionPrompts[action];
    if (prompt) {
      setMessage(prompt);
      // Auto-submit
      setTimeout(() => {
        handleSubmit();
      }, 100);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header with agent status bar */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-slate-400">AI Intelligence Active</span>
          </div>
          <div className="flex items-center gap-4">
            {agentStatuses.slice(0, 4).map((agent) => (
              <div key={agent.agent_type} className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    agent.status === 'active' ? 'bg-green-500' :
                    agent.status === 'thinking' ? 'bg-purple-500 animate-pulse' :
                    agent.status === 'error' ? 'bg-red-500' : 'bg-slate-500'
                  }`}
                />
                <span className="text-xs text-slate-500">{agent.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Orb and greeting section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-8">
            <IntelligenceOrb
              state={orbState}
              size="xl"
              pulseOnIdle
              showStatus
            />
          </div>

          <h1 className="text-2xl font-light text-slate-300 mb-2">
            {greeting || 'Initializing...'}
          </h1>

          {/* Quick stats */}
          {report && (
            <div className="flex justify-center gap-8 mt-6">
              <div className="text-center">
                <div className="text-3xl font-light text-cyan-400">{report.activeTrends}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">Trends</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-light text-emerald-400">{report.pendingDecisions}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-light text-amber-400">{report.trackingCompetitors}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">Competitors</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-light text-pink-400">{report.pendingShortsJobs}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">Shorts</div>
              </div>
            </div>
          )}
        </div>

        {/* Two-column layout: Chat and Recommendations */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Chat section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Conversation */}
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="h-80 overflow-y-auto p-6 space-y-4">
                {conversation.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-slate-500 mb-4">
                      Start a conversation with your AI assistant
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {quickActions.map((action) => (
                        <button
                          key={action.action}
                          onClick={() => handleQuickAction(action.action)}
                          className="px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                        >
                          <span className="mr-2">{action.icon}</span>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  conversation.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-cyan-600/20 text-cyan-100 border border-cyan-600/30'
                            : 'bg-slate-800/50 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/50 rounded-2xl px-4 py-3 border border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-slate-500 text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-slate-800 p-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    onFocus={() => {
                      setInputFocused(true);
                      if (orbState === 'idle' || orbState === 'listening') {
                        setOrbState('listening');
                      }
                    }}
                    onBlur={() => setInputFocused(false)}
                    placeholder="Ask me anything about your channel..."
                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    disabled={isProcessing}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || isProcessing}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Recommendations */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-slate-300 mb-4">Recommendations</h2>
              <div className="space-y-3">
                {recommendations.map((rec, i) => (
                  <button
                    key={i}
                    onClick={() => rec.link && handleNavigate(rec.link)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      rec.priority === 'high'
                        ? 'bg-amber-900/20 border-amber-700/50 hover:border-amber-600'
                        : rec.priority === 'medium'
                        ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">
                        {rec.type === 'trend' ? '🔥' :
                         rec.type === 'upload' ? '📤' :
                         rec.type === 'content' ? '💡' :
                         rec.type === 'seo' ? '🔍' : '📈'}
                      </span>
                      <div>
                        <h3 className="font-medium text-slate-200">{rec.title}</h3>
                        <p className="text-sm text-slate-400 mt-1">{rec.description}</p>
                        <span className="text-xs text-cyan-500 mt-2 inline-block">{rec.action} →</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick navigation */}
            <div>
              <h2 className="text-lg font-medium text-slate-300 mb-4">Navigate</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleNavigate('/videos')}
                  className="p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition-colors"
                >
                  <div className="text-2xl mb-2">📹</div>
                  <div className="text-sm text-slate-300">Videos</div>
                </button>
                <button
                  onClick={() => handleNavigate('/shorts')}
                  className="p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition-colors"
                >
                  <div className="text-2xl mb-2">⚡</div>
                  <div className="text-sm text-slate-300">Shorts</div>
                </button>
                <button
                  onClick={() => handleNavigate('/calendar')}
                  className="p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition-colors"
                >
                  <div className="text-2xl mb-2">📅</div>
                  <div className="text-sm text-slate-300">Calendar</div>
                </button>
                <button
                  onClick={() => handleNavigate('/settings')}
                  className="p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition-colors"
                >
                  <div className="text-2xl mb-2">⚙️</div>
                  <div className="text-sm text-slate-300">Settings</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Agent status footer */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <h3 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wide">Agent Network</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {agentStatuses.map((agent) => (
              <div
                key={agent.agent_type}
                className="p-3 bg-slate-900/30 border border-slate-800 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      agent.status === 'thinking' ? 'bg-purple-500 animate-pulse' :
                      agent.status === 'active' ? 'bg-green-500' :
                      agent.status === 'error' ? 'bg-red-500' : 'bg-slate-600'
                    }`}
                  />
                  <span className="text-sm text-slate-400">{agent.name}</span>
                </div>
                {agent.current_task && (
                  <p className="text-xs text-slate-600 truncate">{agent.current_task}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
