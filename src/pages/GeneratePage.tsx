import { useState, useEffect } from 'react'
import { createShortsFromLink, getRenderQueue } from '../lib/api'
import { Short } from '../types'
import toast from 'react-hot-toast'
import { Loader2, Sparkles, Youtube, Clock, CheckCircle2, AlertCircle, Download, Play } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function GeneratePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [shorts, setShorts] = useState<Short[]>([])
  const [renderQueue, setRenderQueue] = useState<Short[]>([])

  useEffect(() => { 
    loadRenderQueue()
    const interval = setInterval(loadRenderQueue, 5000) // 5s ki 1 sari refresh chey
    return () => clearInterval(interval)
  }, [])

  const loadRenderQueue = async () => {
    try { 
      const queue = await getRenderQueue()
      setRenderQueue(queue || []) 
    } catch (e) { 
      console.error('Failed to load render queue', e) 
    }
  }

  const triggerRender = async (short: Short) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-shorts`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          short_id: short.id,
          // youtube_url, start_time ikkada avasaram ledu. DB lo untundi
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Render failed')
      }

      const data = await res.json()
      console.log('Render triggered:', data)
      
    } catch (e: any) {
      console.error('Render trigger failed', e)
      toast.error(`Render failed: ${e.message}`)
    }
  }

  const handleGenerate = async () => {
    if (!url.trim()) return toast.error('YouTube link paste chey ra')
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return toast.error('Valid YouTube link ivvu')
    setLoading(true)
    setShorts([])
    try {
      const result = await createShortsFromLink(url)
      if (!result || result.length === 0) throw new Error('No shorts generated')
      
      setShorts(result)
      toast.success(`${result.length} Shorts found! Rendering started...`)
      setUrl('')
      
      // Ventane render trigger chey with 1s delay
      result.forEach((short, i) => {
        setTimeout(() => triggerRender(short), i * 1000) // 1s gap ivvadam valla rate limit pothundi
      })
      
      setTimeout(loadRenderQueue, 3000)
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate shorts')
      setShorts([])
    }
    setLoading(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-orange-600 bg-orange-50'
      case 'generating': return 'text-blue-600 bg-blue-50'
      case 'ready': return 'text-green-600 bg-green-50'
      case 'uploaded': return 'text-purple-600 bg-purple-50'
      case 'failed': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'generating': return <Loader2 className="w-4 h-4 animate-spin" />
      case 'ready': return <CheckCircle2 className="w-4 h-4" />
      case 'uploaded': return <CheckCircle2 className="w-4 h-4" />
      case 'failed': return <AlertCircle className="w-4 h-4" />
      default: return null
    }
  }

  const allShorts = [...shorts, ...renderQueue].filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i) // duplicates remove

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Sparkles className="w-8 h-8 text-red-600" />Link → 5 Shorts War Mode</h1>
        <p className="text-gray-600">Paste any YouTube link. AI will find 5 viral moments + auto render with AI voiceover.</p>
      </div>
      
      <div className="bg-white rounded-2xl border-gray-200 p-6 mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 outline-none" disabled={loading} onKeyDown={e => e.key === 'Enter' && handleGenerate()} />
          </div>
          <button onClick={handleGenerate} disabled={loading || !url.trim()} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? 'Generating...' : 'Generate 5 Shorts'}
          </button>
        </div>
      </div>

      {allShorts.length > 0 && (
        <div className="bg-white rounded-2xl border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Play className="w-6 h-6 text-red-600" />Your Shorts - {allShorts.length}</h2>
          <div className="space-y-4">
            {allShorts.map((short, i) => (
              <div key={short.id} className="border border-gray-200 p-4 rounded-xl bg-gray-50">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="font-semibold text-lg mb-1">{i + 1}. {short.title}</div>
                    <div className="text-sm text-gray-600 mb-1"><span className="font-medium">Clip:</span> {short.start_time}s - {short.end_time}s</div>
                    {short.hook_context && <div className="text-xs text-gray-500"><span className="font-medium">Hook:</span> {short.hook_context}</div>}
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium h-fit ${getStatusColor(short.status)}`}>
                    {getStatusIcon(short.status)}
                    {short.status.replace('_', ' ')}
                  </div>
                </div>

                {/* VIDEO PREVIEW */}
                {short.status === 'ready' && short.video_url ? (
                  <div className="mt-3">
                    <video 
                      src={short.video_url} 
                      controls 
                      className="w-full rounded-lg border bg-black"
                      style={{maxHeight: '400px'}}
                    />
                    <a 
                      href={short.video_url} 
                      download={`${short.title}.mp4`}
                      className="mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Download Short
                    </a>
                  </div>
                ) : short.status === 'generating' ? (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Rendering with AI voiceover... ~30s
                  </div>
                ) : (
                  <div className="mt-3 p-3 bg-orange-50 rounded-lg text-sm text-orange-700">
                    ⏳ Waiting to render...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}