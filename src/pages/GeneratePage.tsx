import { useState, useEffect, useRef } from 'react'
import { createShortsFromLink, getRenderQueue } from '../lib/api'
import { Short } from '../types'
import toast from 'react-hot-toast'
import { 
  Loader2, Sparkles, Youtube, Clock, CheckCircle2, AlertCircle, 
  Download, Play, Mic, Sliders, Languages, Zap, UserCheck, Flame 
} from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function GeneratePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [shorts, setShorts] = useState<Short[]>([])
  const [renderQueue, setRenderQueue] = useState<Short[]>([])
  const renderedIds = useRef(new Set<string>())

  // Step 1 Customization States (Human Content Creator Level Engine)
  const [language, setLanguage] = useState('telugu')
  const [voiceTone, setVoiceTone] = useState('energetic')
  const [scriptStyle, setScriptStyle] = useState('hook_controversial')
  const [targetAudience, setTargetAudience] = useState('gen_z')

  useEffect(() => { 
    loadRenderQueue()
    const interval = setInterval(loadRenderQueue, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadRenderQueue = async () => {
    try { 
      const queue = await getRenderQueue()
      setRenderQueue(queue || []) 
      
      queue?.forEach((short) => {
        if(short.status === 'pending' && !renderedIds.current.has(short.id)) {
          renderedIds.current.add(short.id)
          triggerRender(short)
        }
      })
    } catch (e) { 
      console.error('Failed to load render queue', e) 
    }
  }

  const triggerRender = async (short: Short) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      await supabase.from('shorts').update({ status: 'generating' }).eq('id', short.id)

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-shorts`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          short_id: short.id,
          // Custom user preferences pampisthunnam backend algorithm push kosam
          preferences: { language, voiceTone, scriptStyle, targetAudience }
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Render failed')
      }
      console.log('Render triggered:', short.id)
      loadRenderQueue() 
      
    } catch (e: any) {
      console.error('Render trigger failed', e)
      toast.error(`Render failed: ${e.message}`)
      renderedIds.current.delete(short.id)
      await supabase.from('shorts').update({ status: 'pending' }).eq('id', short.id)
    }
  }

  const handleGenerate = async () => {
    if (!url.trim()) return toast.error('YouTube link paste chey ra boss')
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return toast.error('Valid YouTube link ivvu')
    
    setLoading(true)
    setShorts([])
    toast.loading('AI analyzing video & creating viral hooks...', {id: 'gen'})
    
    try {
      // Step 1 lo user select chesina data ni AI API ki pass chesthunam
      const result = await createShortsFromLink(url, {
        language,
        voiceTone,
        scriptStyle,
        targetAudience
      })
      console.log("API Result:", result)

      if (!result || result.length === 0) throw new Error('No shorts generated. Gemini quota or API error.')

      toast.success(`${result.length} Viral Shorts locked! Rendering started...`, {id: 'gen'})
      setShorts(result)
      setUrl('')
      
      result.forEach((short, i) => {
        if(!renderedIds.current.has(short.id)) {
          renderedIds.current.add(short.id)
          setTimeout(() => triggerRender(short), i * 1500)
        }
      })
      
    } catch (e: any) {
      console.error("Generate Error:", e)
      toast.error(e.message || 'Failed to generate shorts', {id: 'gen'})
      setShorts([])
    }
    setLoading(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5 animate-pulse" /> In Queue</span>
      case 'generating':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI Dubbing & Rendering</span>
      case 'ready':
      case 'uploaded':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Viral Ready</span>
      case 'failed':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertCircle className="w-3.5 h-3.5" /> Failed</span>
      default:
        return null
    }
  }

  const allShorts = [...shorts, ...renderQueue].filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans selection:bg-red-500 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="border-b border-slate-800/80 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Flame className="w-3.5 h-3.5" /> Algorithm War Engine v2.0
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
              Viral Shorts Generator <Sparkles className="w-7 h-7 text-amber-400" />
            </h1>
            <p className="text-slate-400 mt-1 text-sm md:text-base">
              Convert long videos into multi-language, high-retention clips engineered to monetize in 30 days.
            </p>
          </div>
        </div>

        {/* STEP 1: CONTENT CREATOR CUSTOMIZATION WAR ROOM */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-6">
            <Sliders className="w-5 h-5 text-red-500" /> Step 1: Configure AI Content Creator Engine
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Language Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Languages className="w-4 h-4 text-blue-400" /> Dubbing Language
              </label>
              <select 
                value={language} 
                onChange={e => setLanguage(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
              >
                <option value="telugu">🔥 Telugu (Viral Slang + Bold)</option>
                <option value="english">⚡ English (US Creator Style)</option>
                <option value="hindi">✨ Hindi (Mass Appeal)</option>
                <option value="original">🎧 Original Video Audio</option>
              </select>
            </div>

            {/* Voice Tone */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Mic className="w-4 h-4 text-emerald-400" /> AI Voiceover Tone
              </label>
              <select 
                value={voiceTone} 
                onChange={e => setVoiceTone(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
              >
                <option value="energetic">🚀 Hyper-Energetic (MrBeast Style)</option>
                <option value="dramatic">🎭 Deep & Dramatic (Suspense)</option>
                <option value="friendly">🤝 Casual & Friendly (UGC)</option>
                <option value="informative">🧠 Professional Tech Expert</option>
              </select>
            </div>

            {/* Script Strategy */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Zap className="w-4 h-4 text-amber-400" /> Script Hook Angle
              </label>
              <select 
                value={scriptStyle} 
                onChange={e => setScriptStyle(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
              >
                <option value="hook_controversial">🧨 Controversial / Shocking Hook</option>
                <option value="storytelling">📖 Loop Storytelling (100% Retention)</option>
                <option value="listicle">🔢 Top 3 Secret Facts</option>
                <option value="problem_solution">💡 Problem → Direct Solution</option>
              </select>
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <UserCheck className="w-4 h-4 text-purple-400" /> Target Algorithm Niche
              </label>
              <select 
                value={targetAudience} 
                onChange={e => setTargetAudience(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
              >
                <option value="gen_z">🎯 Gen-Z & College Students</option>
                <option value="techies">💻 Software & AI Enthusiasts</option>
                <option value="mass">🌐 General Mass Audience</option>
                <option value="finance">💰 Money, Career & Hustlers</option>
              </select>
            </div>
          </div>

          {/* STEP 2: LINK INPUT & LAUNCH */}
          <div className="pt-6 border-t border-slate-800/80">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Step 2: Paste Source Video URL
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  value={url} 
                  onChange={e => setUrl(e.target.value)} 
                  placeholder="https://youtube.com/watch?v=..." 
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-red-500 text-slate-100 placeholder:text-slate-600 transition-colors" 
                  disabled={loading} 
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()} 
                />
              </div>
              <button 
                onClick={handleGenerate} 
                disabled={loading || !url.trim()} 
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold px-8 py-3.5 rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-95"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {loading ? 'Analyzing AI Hooks...' : 'Launch War Mode (5 Shorts)'}
              </button>
            </div>
          </div>
        </div>

        {/* RESULTS SECTION */}
        {allShorts.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Play className="w-6 h-6 text-red-500 fill-red-500/20" /> Generated Algorithm Hooks ({allShorts.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {allShorts.map((short, i) => (
                <div key={short.id} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded mb-2 inline-block">
                          Clip #{i + 1}
                        </span>
                        <h3 className="font-bold text-lg text-slate-100 leading-snug">{short.title}</h3>
                      </div>
                      <div>{getStatusBadge(short.status)}</div>
                    </div>

                    <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/50 space-y-1.5 text-xs text-slate-400 mb-4">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-500">Duration Cut:</span>
                        <span className="text-slate-300 font-mono">{short.start_time}s → {short.end_time}s</span>
                      </div>
                      {short.hook_context && (
                        <div className="pt-1 border-t border-slate-800/50">
                          <span className="font-semibold text-slate-500 block mb-0.5">Viral Hook Strategy:</span>
                          <p className="text-amber-400/90 italic">"{short.hook_context}"</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {short.status === 'ready' && short.video_url ? (
                    <div className="space-y-3 pt-2">
                      <div className="rounded-xl overflow-hidden border border-slate-800 bg-black">
                        <video src={short.video_url} controls className="w-full max-h-80 mx-auto object-contain" />
                      </div>
                      <a 
                        href={short.video_url} 
                        download={`${short.title}.mp4`} 
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                      >
                        <Download className="w-4 h-4" /> Export High-Res Short
                      </a>
                    </div>
                  ) : short.status === 'generating' ? (
                    <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-blue-400 font-medium text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> AI Dubbing in {language.toUpperCase()} & Subtitling...
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Applying {voiceTone} creator voiceover (~30 secs)</p>
                    </div>
                  ) : short.status === 'failed' ? (
                    <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3 text-center text-xs text-rose-400 font-medium">
                      ❌ Processing error. Retrying auto-queue...
                    </div>
                  ) : (
                    <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-center text-xs text-amber-400 font-medium flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 animate-pulse" /> Waiting in GPU render pipeline...
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}