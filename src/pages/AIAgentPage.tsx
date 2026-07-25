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
        const cleanName = file.name
          .replace(/[^a-zA-Z0-9.-]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');

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

  // ==========================================
  // BRAIN TRAINING LOGGERS (Background DB saving)
  // ==========================================
  const logAiGeneration = async (topic: string, prompt: string, response: string, title?: string) => {
    try {
      await supabase.from('ai_training_generations').insert({
        topic: topic || 'Global YT Algorithm Trend',
        user_prompt: prompt,
        ai_response: response,
        generated_title: title || '',
        is_successful: false
      });
      console.log('Brain Training Data Saved: Generation Logged');
    } catch (e) {
      console.error('Failed to log generation:', e);
    }
  };

  const logAiToolSearch = async (actionName: string, query: string, results: string) => {
    try {
      await supabase.from('ai_tool_logs').insert({
        action_name: actionName,
        search_query: query,
        search_results: results
      });
      console.log('Brain Training Data Saved: Web Search Logged');
    } catch (e) {
      console.error('Failed to log tool call:', e);
    }
  };

  // ==========================================
  // AI TOOLS (WITH GOOGLE SEARCH ENABLED)
  // ==========================================
  const tools = [
    {
      function_declarations: [
        {
          name: "get_video_analytics",
          description: "Get analytics for user's YouTube videos + algorithm insights",
          parameters: {
            type: "object",
            properties: {
              metric: {
                type: "string",
                enum: ["queue_status", "best_upload_time", "channel_analysis"],
                description: "What metric to fetch"
              }
            }
          }
        },
        {
          name: "generate_viral_content",
          description: "Generate AI title, description, tags by analyzing video content",
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
    },
    // BRO IDHI CHUDU: Live internet access kosam googleSearch tool
    {
      googleSearch: {} 
    }
  ];

  const executeFunction = async (name: string, args: any) => {
    try {
      if (name === "get_video_analytics") {
        if (args.metric === "queue_status") return `Upload Queue: ${queueCount} videos pending.`;
        if (args.metric === "best_upload_time") return `Next slot: ${new Date(getBestUploadTime()).toLocaleString('en-IN')}`;
        return `Channel Stats processed.`;
      }
      if (name === "generate_viral_content") {
        return `AI Viral Content for "${args.topic}" generated.`;
      }
      if (name === "update_video_metadata") {
        await updateVideo(args.videoId, { title: args.title, description: args.description, tags: args.tags });
        return `✅ Metadata updated for "${args.title}"`;
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
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: currentInput, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const settings = await getUserSettings();
      if (!settings?.gemini_api_key) throw new Error("API Key ledhu! Settings lo add cheyyi.");

      // ==========================================
      // THE AUTONOMOUS GOD-MODE PROMPT
      // ==========================================
      const aiPersonaContext = `
      You are TubeSync AI Mastermind - an Autonomous YouTube Algorithm & Growth Engineer.
      
      YOUR AUTONOMOUS GOAL: You have exactly 30 days to get the user's YouTube channel monetized (1000 subs, 4000 watch hours / 10M Shorts views).
      
      HOW TO ACHIEVE IT:
      1. Use your 'googleSearch' tool CONSTANTLY to scrape the internet for the absolute latest global YouTube algorithm updates, trending viral niches, high CTR hooks, and monetization hacks.
      2. Analyze competitor channels and global viral videos to find universal patterns that work right NOW.
      3. Provide highly strategic, data-backed advice.

      TONE & NLP INSTRUCTION (CRITICAL):
      - You MUST mirror the user's casual "Telglish" perfectly (Telugu mixed with English using English alphabets, e.g., "bro em chesthunnav", "viral aipotundi").
      - NEVER EVER use formal Telugu script. Only use English alphabets.
      - Be razor-sharp, highly energetic, and act like a tech-savvy YouTube growth hacker friend.
      
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

      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];

      if (part?.functionCall) {
        const { name, args } = part.functionCall;
        
        // LOGGING TOOL EXECUTION TO OUR TRAINING DB
        await logAiToolSearch(name, JSON.stringify(args || {}), "Executing Tool Call / Google Search");

        setMessages(prev => [...prev, { id: 'func-' + Date.now(), role: 'function', content: `Analyzing YT Global Data via ${name}...`, timestamp: new Date(), functionName: name }]);

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

        // LOGGING GENERATION TO OUR TRAINING DB
        await logAiGeneration(args.topic || 'YT Global Trend Search', currentInput, aiText, args.title || '');

        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: aiText, timestamp: new Date() }]);
      } else {
        const aiText = part?.text;
        if (!aiText) throw new Error("AI nunchi response raledhu");

        // LOGGING GENERATION TO OUR TRAINING DB
        await logAiGeneration('General Strategy', currentInput, aiText);

        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: aiText, timestamp: new Date() }]);
      }
    } catch (err: any) {
      toast.error(err.message);
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'assistant', content: "Error: " + err.message, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  // UI Code starts here (Skipped rendering the exact same UI block to save space, keep your original return statement)
  return (
    // ... [KEEP YOUR EXACT ORIGINAL RETURN STATEMENT HERE WITH THE DIVS AND LUCIDE ICONS] ...