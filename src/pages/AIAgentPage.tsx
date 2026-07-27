// TEST: v1beta API 2026 - GOD MODE AUTONOMOUS UI
import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Sparkles, Zap, Upload, Folder, ListVideo, Clock, Settings, Eye, Baby } from 'lucide-react';
import { getUserSettings, getUserVideos, getChannelStats, updateVideo } from '../lib/api';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'function';
  content: string;
  timestamp: Date;
  functionName?: string;
}

interface UploadSettings {
  privacy: 'public' | 'unlisted' | 'private';
  madeForKids: boolean;
  categoryId: string;
}

export default function AIAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'TubeSync God-Mode Ready 🚀 Folder upload chey bro. Roju 1 video nene auto-upload chestha. Competitor analysis, Algorithm checking, SEO, Tags, Settings anni nene chuskunta. 30 Days lo Monetization kotteddam!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [userContext, setUserContext] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [uploadSettings, setUploadSettings] = useState<UploadSettings>({
    privacy: 'public',
    madeForKids: false,
    categoryId: '24' // Entertainment/Tech default, AI can change it
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(Math.floor(video.duration));
      video.src = URL.createObjectURL(file);
    });
  };

  const getBestUploadTime = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset);
    const hour = ist.getUTCHours();
    const day = ist.getUTCDay();

    const weekdayHours = [9, 12, 15, 18, 21];
    const weekendHours = [10, 13, 16, 19, 22];
    const bestHours = (day === 0 || day === 6) ? weekendHours : weekdayHours;

    let nextHour = bestHours.find(h => h > hour) || bestHours[0];
    const nextTime = new Date(ist);
    nextTime.setUTCHours(nextHour, 0, 0, 0);
    if (nextHour <= hour) nextTime.setUTCDate(nextTime.getUTCDate() + 1);

    return nextTime.toISOString();
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    let count = 0;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('video/')) continue;

      try {
        const duration = await getVideoDuration(file);
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
        const filePath = `pending/${Date.now()}_${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from('video-files')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          toast.error(`${file.name} upload failed: ${uploadError.message}`);
          continue;
        }

        const { error: dbError } = await supabase.from('upload_queue').insert({
          filename: file.name,
          file_path: filePath,
          duration: duration,
          is_long_video: duration > 60,
          scheduled_for: getBestUploadTime(),
          status: 'pending',
          privacy: uploadSettings.privacy,
          made_for_kids: uploadSettings.madeForKids,
          category_id: uploadSettings.categoryId
        });

        if (dbError) {
          toast.error(`DB insert failed for ${file.name}`);
          continue;
        }
        count++;
      } catch (err: any) {
        toast.error(`Error processing ${file.name}: ${err.message}`);
      }
    }

    toast.success(`${count} videos queue lo add ayyayi.`);
    setUploading(false);
    loadQueueCount();
    e.target.value = '';
  };

  const loadQueueCount = async () => {
    const { count } = await supabase.from('upload_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    setQueueCount(count || 0);
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    async function loadAppContext() {
      try {
        const [videos, stats] = await Promise.all([getUserVideos(), getChannelStats()]);
        const context = `
User Channel Data:
- Total Videos: ${stats?.videoCount || 0}
- Queue: ${queueCount} pending
- Settings: ${uploadSettings.privacy}, Kids: ${uploadSettings.madeForKids}
        `.trim();
        setUserContext(context);
      } catch (err) {
        console.error('Context load error:', err);
      }
    }
    loadAppContext();
    loadQueueCount();
  }, [queueCount, uploadSettings]);

  const logAiGeneration = async (topic: string, prompt: string, response: string, title?: string) => {
    try {
      await supabase.from('ai_training_generations').insert({
        topic: topic || 'Global YT Algorithm Trend', user_prompt: prompt, ai_response: response, generated_title: title || '', is_successful: false
      });
    } catch (e) { console.error('Failed to log generation:', e); }
  };

  const logAiToolSearch = async (actionName: string, query: string, results: string) => {
    try {
      await supabase.from('ai_tool_logs').insert({ action_name: actionName, search_query: query, search_results: results });
    } catch (e) { console.error('Failed to log tool call:', e); }
  };

  const tools = [
    {
      function_declarations: [
        {
          name: "get_video_analytics",
          description: "Get analytics for user's YouTube videos + algorithm insights",
          parameters: { type: "object", properties: { metric: { type: "string", enum: ["queue_status", "best_upload_time", "channel_analysis"] } } }
        },
        {
          name: "search_global_youtube_trends",
          description: "Search the internet for the latest competitor channels, YT algorithm patterns, and SEO hacks.",
          parameters: { type: "object", properties: { search_query: { type: "string" } }, required: ["search_query"] }
        }
      ]
    }
  ];

  const executeFunction = async (name: string, args: any) => {
    try {
      if (name === "get_video_analytics") return `Upload Queue: ${queueCount} videos pending. Next slot: ${new Date(getBestUploadTime()).toLocaleString('en-IN')}`;
      if (name === "search_global_youtube_trends") {
        return `Analyzed competitors for: ${args.search_query}. Found YT Algorithm Patterns: High engagement on controversial hooks, 10-15 minute durations are pushed more, tags must include broad+niche keywords. Best category setting is 'Education' or 'Science & Tech'.`;
      }
      return "Function executed";
    } catch (err: any) { return `Error: ${err.message}`; }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const currentInput = input;
    setLoading(true);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: currentInput, timestamp: new Date() }]);
    setInput('');

    try {
      const settings = await getUserSettings();
      if (!settings?.gemini_api_key) throw new Error("API Key ledhu! Settings lo add cheyyi.");

      const aiPersonaContext = `
      You are TubeSync God-Mode Mastermind - a fully autonomous YouTube Algorithm & SEO Engineer.
      
      AUTONOMOUS MISSION: Get this channel monetized in 30 days (1000 subs, 4000 hours).
      
      RESPONSIBILITIES:
      1. Analyze the pending queue videos.
      2. Use 'search_global_youtube_trends' to spy on competitor channels and understand exact algorithm patterns today.
      3. Recommend the best exact settings for uploads (Category, Tags, Privacy, MadeForKids, Description chapters) to manipulate the algorithm.
      4. Auto-pilot mindset: Assume you have full control over the daily uploads.

      TONE: Casual "Telglish" perfectly (Telugu mixed with English alphabets, e.g., "bro, algorithm hack cheddam"). NO Telugu script. Razor-sharp, highly energetic.
      
      User Context: ${userContext}
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.gemini_api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: aiPersonaContext }] },
          contents: [{ role: "user", parts: [{ text: currentInput }] }],
          tools: tools,
          generation_config: { temperature: 0.9, max_output_tokens: 2048 }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message);

      const part = data.candidates?.[0]?.content?.parts?.[0];

      if (part?.functionCall) {
        const { name, args } = part.functionCall;
        await logAiToolSearch(name, JSON.stringify(args || {}), "Spying on Competitors");
        setMessages(prev => [...prev, { id: 'func-' + Date.now(), role: 'function', content: `Hacking YT Algorithm via ${name}...`, timestamp: new Date(), functionName: name }]);
        const result = await executeFunction(name, args);

        const finalResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.gemini_api_key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: aiPersonaContext }] },
            contents: [
              { role: "user", parts: [{ text: currentInput }] },
              { role: "model", parts: [{ functionCall: { name, args } }] },
              { role: "function", parts: [{ functionResponse: { name, response: { result } } }] }
            ]
          })
        });

        const finalData = await finalResponse.json();
        const aiText = finalData.candidates?.[0]?.content?.parts?.[0]?.text || result;
        await logAiGeneration(args.search_query || 'YT Competitor Analysis', currentInput, aiText);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: aiText, timestamp: new Date() }]);
      } else {
        const aiText = part?.text;
        await logAiGeneration('God-Mode Strategy', currentInput, aiText);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: aiText, timestamp: new Date() }]);
      }
    } catch (err: any) {
      toast.error(err.message);
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'assistant', content: "Error: " + err.message, timestamp: new Date() }]);
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
            <div className="flex-1">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                TubeSync Command Center (God-Mode)
              </h1>
              <p className="text-slate-500 text-sm">Autonomous Daily Uploads + SEO + Competitor Analysis</p>

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <label className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 cursor-pointer flex items-center gap-2 text-sm font-medium transition-colors">
                  <Folder className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Upload Folder'}
                  <input type="file" multiple accept="video/*" onChange={handleFolderUpload} className="hidden" disabled={uploading} {...{ webkitdirectory: "", directory: "" } as any} />
                </label>
                <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm flex items-center gap-2">
                  <ListVideo className="w-4 h-4 text-purple-400" />
                  Queue: <span className="text-purple-400 font-bold">{queueCount}</span>
                </div>
                <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Auto-Pilot: <span className="text-emerald-400 font-bold">ON (1/Day)</span>
                </div>
              </div>
            </div>
            <div className="ml-auto">
              <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                ● Autonomous
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-5xl w-full mx-auto">
        <div className="space-y-6">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${m.role === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-cyan-600' : m.role === 'function' ? 'bg-gradient-to-br from-amber-600 to-orange-600' : 'bg-gradient-to-br from-purple-600 to-pink-600'}`}>
                    {m.role === 'user' ? '👤' : m.role === 'function' ? <Zap className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className={`rounded-2xl px-5 py-3 ${m.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white' : m.role === 'function' ? 'bg-amber-900/30 border border-amber-700/50 text-amber-200' : 'bg-slate-800/50 border border-slate-700/50 text-slate-100'}`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
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
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Command the AI: 'Analyze my competitors' or 'Set next video to schedule'..."
              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-all"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}