import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRenderQueue, approveAndUploadShort, getYouTubeChannels } from '../lib/api'
import { Short, YouTubeChannel } from '../types' // FIXED
import toast from 'react-hot-toast'
import { Play, Edit3, Upload, ArrowLeft, Sparkles, Clock } from 'lucide-react'

export default function PreviewPage() {
  const [shorts, setShorts] = useState<Short[]>([]) // FIXED
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [selectedChannel, setSelectedChannel] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [queue, ch] = await Promise.all([getRenderQueue(), getYouTubeChannels()])
    setShorts(queue)
    setChannels(ch)
    if (ch.length > 0) setSelectedChannel(ch[0].id)
  }

  const handleApprove = async (shortId: string) => {
    if (!selectedChannel) return toast.error('YouTube channel select chey')
    setLoading(true)
    try {
      await approveAndUploadShort(shortId, selectedChannel)
      toast.success('Short upload ki queue lo padda!')
      setShorts(shorts.filter(s => s.id!== shortId))
    } catch (e: any) {
      toast.error(e.message)
    }
    setLoading(false)
  }

  const updateShortField = (id: string, field: keyof Short, value: string) => {
    setShorts(shorts.map(s => s.id === id? {...s, [field]: value } : s))
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <button onClick={() => navigate('/generate')} className="flex items-center gap-2 text-gray-600 mb-6 hover:text-black">
        <ArrowLeft className="w-5 h-5" /> Back to Generate
      </button>

      <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
        <Sparkles className="w-8 h-8 text-red-600" />
        Preview & Approve Shorts
      </h1>

      <div className="bg-white rounded-xl border p-4 mb-6">
        <label className="text-sm font-medium">Upload to Channel:</label>
        <select
          value={selectedChannel}
          onChange={e => setSelectedChannel(e.target.value)}
          className="w-full mt-2 p-2 border rounded-lg"
        >
          {channels.map(c => <option key={c.id} value={c.id}>{c.channel_title}</option>)} {/* FIXED */}
        </select>
      </div>

      {shorts.length === 0? (
        <div className="text-center py-20">
          <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No shorts ready for preview</p>
        </div>
      ) : (
        <div className="space-y-6">
          {shorts.map((short, i) => (
            <div key={short.id} className="bg-white rounded-2xl border p-6">
              <div className="flex gap-6">
                {/* Video Preview */}
                <div className="w-80">
                  <div className="w-full h-48 bg-gray-200 rounded-xl flex items-center justify-center">
                    <Play className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">Duration: {short.duration}s</p>
                </div>

                {/* Details */}
                <div className="flex-1">
                  <div className="font-bold text-xl mb-3">Short {i + 1}</div>

                  <label className="text-sm font-medium">Title</label>
                  <input
                    value={short.title}
                    onChange={e => updateShortField(short.id, 'title', e.target.value)}
                    className="w-full p-2 border rounded-lg mb-3"
                  />

                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={short.description || ''}
                    onChange={e => updateShortField(short.id, 'description', e.target.value)}
                    rows={3}
                    className="w-full p-2 border rounded-lg mb-3"
                  />

                  <label className="text-sm font-medium">Clip: {short.start_time}s to {short.end_time}s</label>

                  <button
                    onClick={() => handleApprove(short.id)}
                    disabled={loading}
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    {loading? 'Uploading...' : 'Approve & Upload'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}