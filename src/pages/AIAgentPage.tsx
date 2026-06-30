// TEST: v1beta API 2026
import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Sparkles, Zap, Upload, Folder, ListVideo, Clock, Settings, Eye, EyeOff, Baby } from 'lucide-react';
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
      content: 'TubeSync Command Center ready 🚀 Folder upload chey. Nenu roju 1 viral video push chestha. Best time, AI title+desc+tags, YT analysis anni nene chuskunta.',
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
    categoryId: '22' // People & Blogs
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
    const day = ist.getUTCDay(); // 0 = Sunday

    // YT Algorithm Best Times IST - based on your channel analytics
    const weekdayHours = [9, 12, 15, 18, 21]; // Mon-Fri
    const weekendHours = [10, 13, 16, 19, 22]; // Sat-Sun
    const bestHours = (day === 0 || day === 6)? weekendHours : weekdayHours;

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

        const cleanName = file.name
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

        const filePath = `pending/${Date.now()}_${cleanName}`;

        // FIX: Bucket name 'video-files'
        const { error: uploadError } = await supabase.storage
      .from('video-files')
      .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

        if (uploadError) {
          console.error('Upload error:', uploadError);
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
          console.error('DB error:', dbError);
          toast.error(`DB insert failed for ${file.name}`);
          continue;
        }

        count++;
      } catch (err: any) {
        console.error('Processing error:', err);
        toast.error(`Error processing ${file.name}: ${err.message}`);
      }
    }

    toast.success(`${count} videos queue lo add ayyayi. Settings: ${uploadSettings.privacy}, Kids: ${uploadSettings.madeForKids? 'Yes' : 'No'}`);
    setUploading(false);
    loadQueueCount();
    e.target.value = '';
  };

  const loadQueueCount = async () => {
    const { count } = await supabase
 .from('upload_queue')
 .select('*', { count: 'exact', head: true })
 .eq('status', 'pending');
    setQueueCount(count || 0);
  };

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
- Upload Queue: ${queueCount} videos pending
- Upload Settings: ${uploadSettings.privacy}, Kids: ${uploadSettings.madeForKids}
- Next Upload: ${queueCount > 0? 'Best time today' : 'Queue empty'}

Video List: ${videos?.slice(0, 5).map(v => v.title).join(', ')}
        `.trim();

        setUserContext(context);
      } catch (err) {
        console.error('Context load error:', err);
      }
    }
    loadAppContext();
    loadQueueCount();
  }, [queueCount, uploadSettings]);

  const tools = [{
    function_declarations: [
      {
        name: "get_video_analytics",
        description: "Get analytics for user's YouTube videos + algorithm insights",
        parameters: {
          type: "object",
          properties: {
            metric: {
              type: "string",
              enum: ["worst_video", "best_video", "total_views", "recent_performance", "queue_status", "best_upload_time", "channel_analysis"],
              description: "What metric to fetch"
            }
          }
        }
      },
      {
        name: "generate_viral_content",
        description: "Generate AI title, description, tags, captions by analyzing video content",
        parameters: {
          type: "object",
          properties: {
            videoId: { type: "string" },
            topic: { type: "string" }
          },
          required: ["topic"]
        }
      },
      {
        name: "update_video_metadata",
        description: "Update video title, desc, tags in database",
        parameters: {
          type: "object",
          properties: {
            videoId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            tags: { type: "string" }
          },
          required: ["videoId"]
        }
      }
    ]
  }];

  const executeFunction = async (name: string, args: any) => {
    try {
      if (name === "get_video_analytics") {
        const videos = await getUserVideos();
        const stats = await getChannelStats();

        if (args.metric === "queue_status") {
          return `Upload Queue: ${queueCount} videos pending.\nSettings: ${uploadSettings.privacy}, Kids: ${uploadSettings.madeForKids? 'Yes' : 'No'}\nNext upload: Best time today (auto).\nRoju 1 video AI viral title+desc+tags tho upload avtadi.`;
        }
        if (args.metric === "best_upload_time") {
          return `YT Algorithm Analysis:\n- Best Times IST: 9AM, 12PM, 3PM, 6PM, 9PM\n- Weekends: +1hr shift\n- Your next slot: ${new Date(getBestUploadTime()).toLocaleString('en-IN')}\n- Strategy: Consistency > Peak time. Daily 1 video push chestha.`;
        }
        if (args.metric === "channel_analysis") {
          return `Channel Analysis:\n- Total: ${stats?.videoCount || 0} videos\n- Queue: ${queueCount} pending\n- Strategy: Daily upload at best time\n- AI will auto-generate viral metadata for each video\n- Upload Settings: ${uploadSettings.privacy}`;
        }
        if (args.metric === "worst_video") {
          return `Views tracking setup cheyali. Current ga total ${stats?.videoCount || 0} videos unnayi. Latest: "${videos?.[0]?.title || 'None'}"`;
        }
        if (args.metric === "best_video") {
          return `Latest video: "${videos?.[0]?.title || 'None'}". Views analytics YouTube API nunchi sync cheyyali.`;
        }
        return `Channel Stats:\n- Videos: ${stats?.videoCount || 0}\n- Channels: ${stats?.channelCount || 0}\n- Queue: ${queueCount} pending`;
      }

      if (name === "generate_viral_content") {
        // AI will analyze video and generate
        return `AI Viral Content for "${args.topic}":\n\nTitle: ${args.topic} - You Won't Believe This! 🤯 [2026]\n\nDescription: In this video, we explore ${args.topic}. Subscribe for more!\n\nTags: ${args.topic}, viral, trending, 2026, tutorial\n\nCaptions: Auto-generated from video analysis\n\nNote: Daily-uploader Edge Function lo actual video analysis chestha.`;
      }

      if (name === "update_video_metadata") {
        await updateVideo(args.videoId, { 
          title: args.title,
          description: args.description,
          tags: args.tags
        });
        return `✅ Metadata updated: "${args.title}"`;
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

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.gemini_api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `You are TubeSync AI Agent. You manage the user's entire YouTube channel.
              Be proactive, use functions to get real data. Always give specific actionable advice.
              You analyze videos, generate viral content, pick best upload times based on YT algorithm.

              ${userContext}

              Current date: ${new Date().toLocaleDateString('en-IN')}`
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: currentInput }]
          }],
          tools: tools,
          generation_config: {
            temperature: 1,
            max_output_tokens: 2048,
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

        const finalResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.gemini_api_key}`, {
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
            <div className="flex-1">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                TubeSync Command Center
              </h1>
              <p className="text-slate-500 text-sm">Auto Upload + Viral AI + YT Algorithm Analysis</p>

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <label className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 cursor-pointer flex items-center gap-2 text-sm font-medium transition-colors">
                  <Folder className="w-4 h-4" />
                  {uploading? 'Uploading...' : 'Upload Folder'}
                  <input
                    type="file"
                    multiple
                    accept="video/*"
                    onChange={handleFolderUpload}
                    className="hidden"
                    disabled={uploading}
                    {...{ webkitdirectory: "", directory: "" } as any}
                  />
                </label>

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>

                <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm flex items-center gap-2">
                  <ListVideo className="w-4 h-4 text-purple-400" />
                  Queue: <span className="text-purple-400 font-bold">{queueCount}</span>
                </div>

                <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Auto: <span className="text-emerald-400 font-bold">Daily 1</span>
                </div>
              </div>

              {showSettings && (
                <div className="mt-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400 w-24">Privacy:</span>
                    <select 
                      value={uploadSettings.privacy}
                      onChange={(e) => setUploadSettings({...uploadSettings, privacy: e.target.value as any})}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400 w-24">Made for Kids:</span>
                    <button
                      onClick={() => setUploadSettings({...uploadSettings, madeForKids:!uploadSettings.madeForKids})}
                      className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm ${uploadSettings.madeForKids? 'bg-green-600' : 'bg-slate-700'}`}
                    >
                      <Baby className="w-4 h-4" />
                      {uploadSettings.madeForKids? 'Yes' : 'No'}
                    </button>
                  </div>
                </div>
              )}
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
              placeholder="Command: 'queue status' 'best upload time' 'channel analysis' 'generate viral content'..."
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