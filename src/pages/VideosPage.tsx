import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Search, Filter, Trash2, RefreshCw, ExternalLink, Play, Clock, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Loader as Loader2, Video as VideoIcon, Calendar } from 'lucide-react';
import { getVideos, deleteVideo, retryUpload } from '../lib/api';
import type { Video } from '../types';

type StatusFilter = 'all' | 'draft' | 'ready' | 'queued' | 'uploading' | 'uploaded' | 'failed' | 'scheduled';

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    fetchVideos();
    const interval = setInterval(fetchVideos, 10000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const data = await getVideos(100, statusFilter === 'all' ? undefined : statusFilter);
      setVideos(data);
    } catch (error) {
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video?')) return;
    try {
      await deleteVideo(id);
      setVideos(videos.filter((v) => v.id !== id));
      toast.success('Deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryUpload(id);
      toast.success('Retry initiated');
      fetchVideos();
    } catch (error) {
      toast.error('Failed to retry');
    }
  };

  const getStatusBadge = (status: Video['status']) => {
    const styles: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-600',
      ready: 'bg-blue-100 text-blue-600',
      queued: 'bg-amber-100 text-amber-600',
      generating: 'bg-purple-100 text-purple-600',
      uploading: 'bg-purple-100 text-purple-600',
      uploaded: 'bg-green-100 text-green-600',
      failed: 'bg-red-100 text-red-600',
      scheduled: 'bg-blue-100 text-blue-600',
    };
    const icons: Record<string, typeof Clock> = {
      draft: Clock, ready: CheckCircle, queued: Clock,
      generating: Loader2, uploading: Loader2, uploaded: CheckCircle,
      failed: AlertCircle, scheduled: Calendar,
    };
    const Icon = icons[status] || Clock;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100'}`}>
        <Icon className={`w-3.5 h-3.5 ${status === 'uploading' || status === 'generating' ? 'animate-spin' : ''}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'ready', label: 'Ready' },
    { value: 'queued', label: 'Queued' },
    { value: 'uploading', label: 'Uploading' },
    { value: 'uploaded', label: 'Uploaded' },
    { value: 'failed', label: 'Failed' },
    { value: 'scheduled', label: 'Scheduled' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Videos</h1>
        <p className="text-slate-500 mt-1">Manage all your videos</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="pl-12 pr-10 py-3 border border-slate-300 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none appearance-none bg-white cursor-pointer min-w-[180px]"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Videos Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <VideoIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600">No videos found</h3>
          <p className="text-slate-400 mt-1">
            {searchQuery || statusFilter !== 'all' ? 'Try adjusting filters' : 'Generate your first video'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((video) => (
            <div key={video.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 relative flex items-center justify-center">
                <Play className="w-10 h-10 text-white/40" />
                {video.is_short && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-purple-600 text-white text-xs font-medium rounded">SHORT</span>
                )}
                <div className="absolute top-2 right-2">{getStatusBadge(video.status)}</div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-slate-800 truncate mb-2">{video.title}</h3>
                <p className="text-xs text-slate-500 mb-3">
                  {new Date(video.created_at).toLocaleDateString()}
                </p>

                {['queued', 'uploading', 'generating'].includes(video.status) && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>{video.status === 'uploading' ? 'Uploading...' : video.status === 'generating' ? 'Generating...' : 'Queued'}</span>
                      <span>{video.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 transition-all" style={{ width: `${video.progress}%` }} />
                    </div>
                  </div>
                )}

                {video.status === 'failed' && video.error_message && (
                  <p className="text-xs text-red-600 mb-3 truncate">{video.error_message}</p>
                )}

                <div className="flex items-center gap-2">
                  {video.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(video.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-yellow-600 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry
                    </button>
                  )}
                  {video.youtube_video_id && (
                    <a
                      href={`https://youtube.com/watch?v=${video.youtube_video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
