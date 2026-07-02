// src/pages/GeneratePage.tsx
import { useState, useEffect } from 'react'
import { createShortsFromLink, getRenderQueue } from '../lib/api'
import { Video } from '../lib/database'
import toast from 'react-hot-toast'
import { Loader2, Sparkles, Youtube, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

export default function GeneratePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [shorts, setShorts] = useState<Video[]>([])
  const [renderQueue, setRenderQueue] = useState<Video[]>([])

  useEffect(() => {
    loadRenderQueue()
  }, [])

  const loadRenderQueue = async () => {
    try {
      const queue = await getRenderQueue()
      setRenderQueue(queue)
    } catch (e) {
      console.error('Failed to load render queue', e)
    }
  }

  const handleGenerate = async () => {
    if (!url.trim()) return toast.error('YouTube link paste chey ra')
    if (!url.includes('youtube.com') &&!url.includes('youtu.be')) {
      return toast.error('Valid YouTube link ivvu')
    }
    
    setLoading(true)
    try {
      const result = await createShortsFromLink(url)
      setShorts(result)
      toast.success(`${result.length} Shorts queue lo padday!`)
      setUrl('')
      await loadRenderQueue()
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate shorts')
    }
    setLoading(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_render': return 'text-orange-600 bg-orange-50'
      case 'rendering': return 'text-blue-600 bg-blue-50'
      case 'ready': return 'text-green-600 bg-green-50'
      case 'failed': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_render': return <Clock className="w-4 h-4" />
      case 'rendering': return <Loader2 className="w-4 h-4 animate-spin" />
      case 'ready': return <CheckCircle2 className="w-4 h-4" />
      case 'failed': return <AlertCircle className="w-4 h-4" />
      default: return null
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-red-600" />
          Link → 5 Shorts War Mode
        </h1>
        <p className="text-gray-600">Paste any YouTube link. AI will find 5 viral 3-sec moments + create 21s shorts with accurate script.</p>
      </div>
      
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              disabled={loading}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          <button 
            onClick={handleGenerate} 
            disabled={loading ||!url.trim()}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {loading? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading? 'Generating...' : 'Generate 5 Shorts'}
          </button>
        </div>
      </div>

      {shorts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            Just Generated - {shorts.length} Shorts
          </h2>
          <div className="space-y-3">
            {shorts.map((short, i) => (
              <div key={short.id} className="border border-gray-200 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-lg mb-1">{i + 1}. {short.title}</div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Hook:</span> {short.hook_context} @ {short.hook_start_time}
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">Scheduled:</span> {short.scheduled_time? new Date(short.scheduled_time).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(short.status)}`}>
                    {getStatusIcon(short.status)}
                    {short.status.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {renderQueue.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6 text-orange-600" />
            Render Queue - {renderQueue.length} Pending
          </h2>
          <div className="space-y-3">
            {renderQueue.map((video, i) => (
              <div key={video.id} className="border border-gray-200 p-4 rounded-xl bg-orange-50/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold mb-1">{video.title}</div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Hook:</span> {video.hook_context} @ {video.hook_start_time}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Created: {new Date(video.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(video.status)}`}>
                    {getStatusIcon(video.status)}
                    {video.status.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {shorts.length === 0 && renderQueue.length === 0 && (
        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
          <Youtube className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No shorts generated yet</p>
          <p className="text-gray-400 text-sm mt-1">Paste a YouTube link above to get started</p>
        </div>
      )}
    </div>
  )
}
