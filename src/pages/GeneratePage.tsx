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

  // Customization States
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
    } catch (e) { console.error('Failed to load queue', e) }
  }

  const triggerRender = async (short: Short) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase.from('shorts').update({ status: 'generating' }).eq('id', short.id)
      
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-shorts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ short_id: short.id, preferences: { language, voiceTone, scriptStyle, targetAudience } })
      })
      if (!res.ok) throw new Error('Render failed')
      loadRenderQueue() 
    } catch (e: any) {
      toast.error(`Render failed: ${e.message}`)
      renderedIds.current.delete(short.id)
      await supabase.from('shorts').update({ status: 'pending' }).eq('id', short.id)
    }
  }

  const handleGenerate = async () => {
    if (!url.trim()) return toast.error('Paste a valid YouTube link')
    setLoading(true)
    toast.loading('Analyzing video...', {id: 'gen'})
    try {
      const result = await createShortsFromLink(url, { language, voiceTone, scriptStyle, targetAudience })
      if (!result) throw new Error('No shorts generated')
      toast.success('Rendering started!', {id: 'gen'})
      setShorts(result)
      setUrl('')
      result.forEach((short, i) => {
        if(!renderedIds.current.has(short.id)) {
          renderedIds.current.add(short.id)
          setTimeout(() => triggerRender(short), i * 1500)
        }
      })
    } catch (e: any) {
      toast.error(e.message, {id: 'gen'})
    }
    setLoading(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="text-amber-400 text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3 animate-pulse" /> In Queue</span>
      case 'generating': return <span className="text-blue-400 text-xs font-bold flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Rendering...</span>
      case 'ready': return <span className="text-emerald-400 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ready</span>
      default: return <span className="text-rose-400 text-xs font-bold"><AlertCircle className="w-3 h-3" /> Failed</span>
    }
  }

  const allShorts = [...shorts, ...renderQueue].filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-4xl font-extrabold flex items-center gap-3">Viral Shorts Generator <Sparkles className="text-amber-400" /></h1>
        
        {/* CONFIGURATION PANEL */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm"><option value="telugu">Telugu</option><option value="english">English</option><option value="hindi">Hindi</option></select>
              <select value={voiceTone} onChange={e => setVoiceTone(e.target.value)} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm"><option value="energetic">Energetic</option><option value="dramatic">Dramatic</option></select>
              <select value={scriptStyle} onChange={e => setScriptStyle(e.target.value)} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm"><option value="hook_controversial">Controversial Hook</option><option value="storytelling">Storytelling</option></select>
              <select value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm"><option value="gen_z">Gen-Z</option><option value="techies">Techies</option></select>
           </div>
           <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste YouTube link here..." className="w-full bg-slate-950 p-4 rounded-xl mb-4 border border-slate-700" />
           <button onClick={handleGenerate} disabled={loading} className="w-full bg-red-600 py-4 rounded-xl font-bold hover:bg-red-500 transition-all">Launch War Mode</button>
        </div>

        {/* SHORTS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {allShorts.map((short: any) => (
            <div key={short.id} className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
              <div className="flex justify-between mb-4">
                <h3 className="font-bold truncate">{short.title}</h3>
                {getStatusBadge(short.status)}
              </div>

              <div className="rounded-xl overflow-hidden bg-black mb-4">
                {short.video_url?.includes('http') ? (
                   <video src={short.video_url} controls className="w-full h-60" />
                ) : (
                   <div className="h-60 flex items-center justify-center text-slate-600">Video will appear here when ready...</div>
                )}
              </div>

              {short.hook_context?.includes('AUDIO_URL:') && (
                <div className="mb-4 bg-slate-950 p-3 rounded-xl border border-emerald-900">
                  <p className="text-[10px] text-emerald-400 uppercase font-bold mb-1">🎙️ AI Dubbed Audio</p>
                  <audio controls src={short.hook_context.split('AUDIO_URL:')[1]} className="w-full h-8" />
                </div>
              )}

              <textarea defaultValue={short.script || "Generating script..."} className="w-full bg-slate-950 p-3 rounded-lg text-xs border border-slate-800" rows={3} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}