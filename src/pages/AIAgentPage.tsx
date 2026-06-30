import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Sparkles, Zap } from 'lucide-react';
import { getUserSettings, getUserVideos, getChannelStats, updateVideo } from '../lib/api';
import { toast } from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'function';
  content: string;
  timestamp: Date;
  functionName?: string;
}

export default function AIAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'TubeSync Command Center ready 🚀 Naa tho channel manage cheyyochu. "Worst video edi?" "Title optimize chey" "Analytics chupinchu" lanti commands try chey.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userContext, setUserContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    async function loadAppContext() {
      try {
        const [videos, stats] = await Promise.all([
          getUserVideos(),
          getChannelStats()
        ]);

        const context = `
User Channel Data:
- Total Videos: ${stats?.videoCount || 0}
- Latest Video: "${videos?.[0]?.title || 'None'}"
- Total Views: ${stats?.totalViews || 0}
- Channels: ${stats?.channelCount || 0}

Video List: ${videos?.slice(0, 5).map(v => v.title).join(', ')}
        `.trim();

        setUserContext(context);
      } catch (err) {
        console.error('Context load error:', err);
      }
    }
    loadAppContext();
  }, []);

  const tools = [{
    functionDeclarations: [
      {
        name: "get_video_analytics",
        description: "Get analytics for user's YouTube videos",
        parameters: {
          type: "object",
          properties: {
            metric: {
              type: "string",
              enum: ["worst_video", "best_video", "total_views", "recent_performance"],
              description: "What metric to fetch"
            }
          }
        }
      },
      {
        name: "optimize_video_title",
        description: "Generate 5 SEO optimized title suggestions",
        parameters: {
          type: "object",
          properties: {
            currentTitle: { type: "string" },
            topic: { type: "string" }
          },
          required: ["topic"]
        }
      },
      {
        name: "update_video_title",
        description: "Update a video title in the database",
        parameters: {
          type: "object",
          properties: {
            videoId: { type: "string" },
            newTitle: { type: "string" }
          },
          required: ["videoId", "newTitle"]
        }
      }
    ]
  }];

  const executeFunction = async (name: string, args: any) => {
    try {
      if (name === "get_video_analytics") {
        const videos = await getUserVideos();
        const stats = await getChannelStats();

        if (args.metric === "worst_video") {
          return `Views tracking setup cheyali. Current ga total ${stats?.videoCount || 0} videos unnayi. Latest: "${videos?.[0]?.title || 'None'}"`;
        }
        if (args.metric === "best_video") {
          return `Latest video: "${videos?.[0]?.title || 'None'}". Views analytics YouTube API nunchi sync cheyyali.`;
        }
        if (args.metric === "total_views") {
          return `Total Videos: ${stats?.videoCount || 0}. Views tracking setup cheyyali.`;
        }
        return `Channel Stats:\n- Videos: ${stats?.videoCount || 0}\n- Channels: ${stats?.channelCount || 0}`;
      }

      if (name === "optimize_video_title") {
        return `Here are 5 optimized titles for "${args.topic}":\n1. ${args.topic} - Complete Guide 2026\n2. How to ${args.topic} Fast [Step by Step]\n3. ${args.topic} Secrets Nobody Tells You\n4. I Tried ${args.topic} for 30 Days\n5. ${args.topic} Explained in 5 Minutes`;
      }

      if (name === "update_video_title") {
        await updateVideo(args.videoId, { title: args.newTitle });
        return `✅ Title updated to: "${args.newTitle}"`;
      }

      return "Function executed";
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const currentInput = input;
    setLoading(true);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const settings = await getUserSettings();
      if (!settings?.gemini_api_key) {
        throw new Error("API Key ledhu! Settings lo add cheyyi.");
      }

      // FIXED: gemini-1.5-flash-002
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${settings.gemini_api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `You are TubeSync AI Agent. You manage the user's entire YouTube channel.
              Be proactive, use functions to get real data. Always give specific actionable advice.

              ${userContext}

              Current date: ${new Date().toLocaleDateString('en-IN')}`
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: currentInput }]
          }],
          tools: tools,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message);

      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];

      if (part?.functionCall) {
        const { name, args } = part.functionCall;

        setMessages(prev => [...prev, {
          id: 'func-' + Date.now(),
          role: 'function',
          content: `Calling ${name}...`,
          timestamp: new Date(),
          functionName: name
        }]);

        const result = await executeFunction(name, args);

        // FIXED: gemini-1.5-flash-002
        const finalResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${settings.gemini_api_key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: `You are TubeSync AI Agent. User context: ${userContext}` }]
            },
            contents: [
              { role: "user", parts: [{ text: currentInput }] },
              { role: "model", parts: [{ functionCall: { name, args } }] },
              { role: "function", parts: [{ functionResponse: { name, response: { result } } }] }
            ]
          })
        });

        const finalData = await finalResponse.json();
        const aiText = finalData.candidates?.[0]?.content?.parts?.[0]?.text;

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: aiText || result,
          timestamp: new Date()
        }]);
      } else {
        const aiText = part?.text;
        if (!aiText) throw new Error("AI nunchi response raledhu");

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: aiText,
          timestamp: new Date()
        }]);
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      toast.error(err.message);
      setMessages(prev => [...prev, {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: "Error: " + err.message,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/10 to-slate-950 text-white flex flex-col">
      <div className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-950/50 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                TubeSync Command Center
              </h1>
              <p className="text-slate-500 text-sm">Powered by Gemini 1.5 Flash + Functions</p>
            </div>
            <div className="ml-auto">
              <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                ● Online
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-5xl w-full mx-auto">
        <div className="space-y-6">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user'? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${m.role === 'user'? 'order-2' : 'order-1'}`}>
                <div className={`flex items-start gap-3 ${m.role === 'user'? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    m.role === 'user'
        ? 'bg-gradient-to-br from-blue-600 to-cyan-600'
                      : m.role === 'function'
        ? 'bg-gradient-to-br from-amber-600 to-orange-600'
                      : 'bg-gradient-to-br from-purple-600 to-pink-600'
                  }`}>
                    {m.role === 'user'? '👤' : m.role === 'function'? <Zap className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className={`rounded-2xl px-5 py-3 ${
                      m.role === 'user'
        ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white'
                        : m.role === 'function'
        ? 'bg-amber-900/30 border border-amber-700/50 text-amber-200'
                        : 'bg-slate-800/50 border border-slate-700/50 text-slate-100'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 px-1">
                      {m.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-5 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-slate-800/50 backdrop-blur-xl bg-slate-950/50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' &&!e.shiftKey && handleSend()}
              placeholder="Command ivvu: 'worst video edi?' 'title optimize chey' 'views chupinchu'..."
              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading ||!input.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30 flex items-center gap-2"
            >
              {loading? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}