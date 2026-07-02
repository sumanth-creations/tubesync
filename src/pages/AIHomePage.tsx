import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

console.log("🔥 NEW AIHomePage LOADED");

export default function AIHomePage() {
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setShowChat(true);
    const userMsg = { role: 'user' as const, content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Got it! Creating your automation for: "${text}". This would connect to your n8n workflow.` 
      }]);
      setLoading(false);
    }, 1000);
  };

  if (showChat) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/10 to-slate-950 text-white">
        <div className="max-w-4xl mx-auto p-4 h-screen flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 py-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600' 
                    : 'bg-slate-800/60 backdrop-blur-xl border border-slate-700/50'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-slate-400">Thinking...</div>}
          </div>
          <div className="flex gap-2 pb-4">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="Ask anything..."
              className="flex-1 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 outline-none focus:border-purple-500/50"
            />
            <button
              onClick={() => sendMessage(input)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 font-semibold"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/10 to-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            Your AI YouTube Automation Agent
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            From idea to upload. Tell AI what to create, and watch it handle research, scripts, and publishing.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-12">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition"></div>
            <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
                placeholder="Describe your video idea... e.g. 'Create a tutorial on React hooks'"
                className="w-full bg-transparent px-6 py-4 text-lg outline-none resize-none"
                rows={3}
              />
              <div className="flex justify-between items-center px-4 pb-2">
                <span className="text-xs text-slate-500">Press Enter to send</span>
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 font-semibold disabled:opacity-50 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-16">
          <button 
            onClick={() => sendMessage("Create a viral tech tutorial video")}
            className="p-6 rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 hover:border-purple-500/50 text-left group transition-all"
          >
            <div className="text-2xl mb-2">🎬</div>
            <div className="font-semibold mb-1">Create Video from Idea</div>
            <div className="text-sm text-slate-400">AI writes, edits, and publishes</div>
          </button>
          <button 
            onClick={() => sendMessage("Analyze my YouTube channel performance")}
            className="p-6 rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 hover:border-blue-500/50 text-left group transition-all"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold mb-1">Analyze Channel</div>
            <div className="text-sm text-slate-400">Get insights & growth tips</div>
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { icon: '🤖', title: 'AI Scriptwriting', desc: 'Generate engaging scripts in seconds' },
            { icon: '🎨', title: 'Auto Editing', desc: 'Smart cuts, captions, and B-roll' },
            { icon: '🚀', title: 'One-Click Publish', desc: 'Schedule & upload to YouTube' },
          ].map((f, i) => (
            <div key={i} className="p-6 rounded-xl bg-slate-800/30 backdrop-blur-xl border border-slate-700/30">
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-semibold mb-2">{f.title}</div>
              <div className="text-sm text-slate-400">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
