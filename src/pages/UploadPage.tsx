import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Upload, Clock, CircleAlert as AlertCircle, Loader as Loader2, Play, RefreshCw, Trash2, Calendar, CircleCheck as CheckCircle } from 'lucide-react';
import { getUploadQueue, getVideos, retryUpload, deleteVideo } from '../lib/api';
import type { UploadQueue, Video } from '../types';

interface QueueItem extends UploadQueue {
  video?: Video;
}

export default function UploadPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState({ queued: 0, uploading: 0, failed: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const [queueData, videosData] = await Promise.all([
        getUploadQueue(),
        getVideos(100),
      ]);

      const merged = queueData.map((item) => ({
        ...item,
        video: videosData.find((v) => v.id === item.video_id),
      }));

      setQueue(merged);
      calculateStats(merged);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (items: QueueItem[]) => {
    setStats({
      queued: items.filter((i) => i.status === 'queued').length,
      uploading: items.filter((i) => i.status === 'uploading').length,
      failed: items.filter((i) => i.status === 'failed').length,
      completed: items.filter((i) => i.status === 'completed').length,
    });
  };

  const handleRetry = async (videoId: string) => {
    try {
      await retryUpload(videoId);
      toast.success('Retry initiated');
      fetchQueue();
    } catch (error) {
      toast.error('Failed to retry');
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!confirm('Remove from queue?')) return;
    try {
      await deleteVideo(videoId);
      toast.success('Removed');
      fetchQueue();
    } catch (error) {
      toast.error('Failed to remove');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed': return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'uploading': return <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />;
      case 'queued': return <Clock className="w-5 h-5 text-blue-600" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'uploading': return 'bg-yellow-100 text-yellow-800';
      case 'queued': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Queue</h1>
        <p className="text-slate-500 mt-1">Manage your video uploads and scheduling</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Queued', value: stats.queued, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Uploading', value: stats.uploading, icon: Loader2, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Failed', value: stats.failed, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">{s.label}</p>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Queue List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Upload Queue</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
          </div>
        ) : queue.length === 0 ? (
          <div className="p-12 text-center">
            <Upload className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Queue is empty</h3>
            <p className="text-slate-600">No videos in queue. Create a video to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {queue.map((item) => (
              <div key={item.id} className="p-5 flex items-center gap-4 hover:bg-slate-50 transition">
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Play className="w-5 h-5 text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{item.video?.title || 'Untitled'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(item.status)}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                    {item.progress > 0 && item.status === 'uploading' && (
                      <span className="text-xs text-slate-500">{item.progress}%</span>
                    )}
                  </div>
                </div>

                {item.status === 'uploading' && (
                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                    <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {item.status === 'failed' && (
                    <button
                      onClick={() => item.video_id && handleRetry(item.video_id)}
                      className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                      title="Retry"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => item.video_id && handleDelete(item.video_id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
