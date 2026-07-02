/**
 * AI Home - TubeSync Landing + AI Chat
 *
 * Features:
 * - Hero landing section with CTA
 * - Features showcase
 * - How it works steps
 * - Integrated AI chat
 * - Glassmorphism + Gradient UI
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIHome() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeAgent();
    checkUser();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const initializeAgent = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('agent_states').upsert({
      user_id: user.id,
      agent_name: 'YouTube Intelligence',
      agent_type: 'youtube_intelligence',
      status: 'idle',
      is_active: true,
    }, { onConflict: 'user_id,agent_name' });
  };

  const startChat = () => {
    setShowChat(true);
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hey! I'm TubeSync AI 👋 I can help you automate your YouTube channel. Upload a folder of videos and I'll handle titles, descriptions, tags & upload timing. Want to try?"
      }]);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    try {
      const { data: settings } = await supabase.from('user_settings').select('gemini_api_key').maybeSingle();

      if (!settings?.gemini_api_key) {
        throw new Error("API Key missing. Please add it in Settings to chat with AI.");
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.gemini_api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `You are TubeSync AI, a YouTube automation assistant. User asks: ${userMessage}. Reply in friendly Telugu-English mix, short & helpful.` }]
          }]
        }),
      });

      if (response.status === 429) {
        throw new Error("Rate limit hit bro. Konchem wait chey.");
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, ardam kaledu. Malli cheppava?";

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' &&!e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (showChat) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
        {/* Chat Header */}
        <div className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-950/50 p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowChat(false)}
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
              >
                ←
              </button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xl">
                🤖
              </div>
              <div>
                <h2 className="font-bold text-white">TubeSync AI</h2>
                <p className="text-xs text-emerald-400">● Online</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/command-center')}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-sm font-semibold transition-all"
            >
              Command Center
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user'? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl ${
                  m.role === 'user'
                   ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white'
                    : 'bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 text-slate-200'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 p-4 rounded-2xl">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat Input */}
        <div className="border-t border-slate-800/50 backdrop-blur-xl bg-slate-950/50 p-4">
          <div className="max-w-4xl mx-auto flex gap-3">
            <input
              className="flex-1 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 p-4 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about YouTube automation..."
              disabled={isProcessing}
            />
            <button
              onClick={handleSubmit}
              disabled={isProcessing ||!input.trim()}
              className="px-8 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30 disabled:shadow-none"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-950/30 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-purple-500/30">
              🤖
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              TubeSync AI
            </span>
          </div>
          <div className="flex items-center gap-3">
            {user? (
              <button
                onClick={() => navigate('/command-center')}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-purple-500/30"
              >
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-semibold transition-all"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-blue-600/10" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-block mb-6 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-semibold">
              ✨ AI-Powered YouTube Automation
            </div>

            <h1 className="text-5xl lg:text-7xl font-black mb-6 leading-tight">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Roju 1 Video,
              </span>
              <br />
              <span className="text-white">AI Tho Auto Upload</span>
            </h1>

            <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
              Folder lo videos upload chey. AI title, description, tags, thumbnail & best upload time decide chesi <span className="text-purple-400 font-semibold">auto upload</span> chestadi. Nuvvu chill avvu.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={startChat}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl text-lg font-bold transition-all shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 hover:scale-105"
              >
                Start Chatting with AI 💬
              </button>
              <button
                onClick={() => navigate('/command-center')}
                className="px-8 py-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 backdrop-blur-sm rounded-xl text-lg font-bold transition-all"
              >
                View Dashboard →
              </button>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Free Gemini API</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Auto Scheduling</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>SEO Optimized</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black mb-4">
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Superpowers Unleash Chey
            </span>
          </h2>
          <p className="text-slate-400 text-lg">10 AI agents nee channel 24/7 manage chestaru</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: '🧠',
              title: 'Smart Analysis',
              desc: 'Gemini AI video content analyze chesi viral title, description, 15 tags generate chestadi',
              color: 'from-purple-500 to-pink-500'
            },
            {
              icon: '⏰',
              title: 'Auto Scheduling',
              desc: 'Audience peak time detect chesi best time lo auto upload. Roju 1 video guaranteed',
              color: 'from-blue-500 to-cyan-500'
            },
            {
              icon: '🎯',
              title: 'SEO Optimization',
              desc: 'Trending keywords, competitor analysis, CTR boost cheyadaniki AI suggestions',
              color: 'from-emerald-500 to-green-500'
            },
            {
              icon: '🖼️',
              title: 'Thumbnail AI',
              desc: 'Click-worthy thumbnail text & design ideas. A/B test cheyadaniki multiple options',
              color: 'from-orange-500 to-red-500'
            },
            {
              icon: '⚡',
              title: 'Shorts Factory',
              desc: 'Long videos nunchi viral shorts auto generate. Hooks, captions anni ready',
              color: 'from-pink-500 to-purple-500'
            },
            {
              icon: '📊',
              title: 'Growth Tracking',
              desc: 'Channel analytics, competitor insights, growth opportunities real-time lo',
              color: 'from-cyan-500 to-blue-500'
            },
          ].map((feature, i) => (
            <div key={i} className="group relative p-8 rounded-2xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-sm hover:border-slate-700 transition-all hover:scale-105">
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity rounded-2xl`} />
              <div className="relative z-10">
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black mb-4 text-white">3 Steps Lo Start Chey</h2>
          <p className="text-slate-400 text-lg">2 minutes setup. Lifetime automation.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Connect Gemini', desc: 'Free API key add chey settings lo. 1500 requests/day free.' },
            { step: '02', title: 'Upload Folder', desc: '50 videos aina okesari drag-drop chey. Queue lo add avutayi.' },
            { step: '03', title: 'AI Takes Over', desc: 'Roju 1 video analyze, optimize chesi best time lo upload. Chill.' },
          ].map((item, i) => (
            <div key={i} className="relative">
              <div className="text-8xl font-black text-slate-800/50 absolute -top-6 -left-2">{item.step}</div>
              <div className="relative z-10 pt-12">
                <h3 className="text-2xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Footer */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-slate-900/90 to-slate-950/90 backdrop-blur-xl p-12 lg:p-16 text-center">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />

          <div className="relative z-10">
            <h2 className="text-4xl lg:text-5xl font-black mb-6 text-white">
              Ready to Automate Your Channel?
            </h2>
            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              Thousands of creators already using TubeSync AI. Join them now.
            </p>
            <button
              onClick={startChat}
              className="px-10 py-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl text-xl font-bold transition-all shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 hover:scale-105"
            >
              Start Free - Talk to AI →
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/50 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-500 text-sm">
          <p>Built with ❤️ using React + Supabase + Gemini AI</p>
        </div>
      </div>
    </div>
  );
}
