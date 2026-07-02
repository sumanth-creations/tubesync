import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Video as VideoIcon } from 'lucide-react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import toast from 'react-hot-toast';
import { getScheduledVideos } from '../lib/api';
import type { Video } from '../types';

export default function CalendarPage() {
  const [date, setDate] = useState<Date>(new Date());
  const [scheduledVideos, setScheduledVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScheduledVideos();
  }, []);

  const fetchScheduledVideos = async () => {
    try {
      setLoading(true);
      const data = await getScheduledVideos();
      setScheduledVideos(data);
    } catch (error) {
      toast.error('Failed to load scheduled videos');
    } finally {
      setLoading(false);
    }
  };

  const getDateColor = (checkDate: Date) => {
    const dateStr = checkDate.toDateString();
    const videosForDate = scheduledVideos.filter((v) => {
      if (!v.scheduled_publish_at) return false;
      return new Date(v.scheduled_publish_at).toDateString() === dateStr;
    });
    if (videosForDate.length === 0) return null;
    if (videosForDate.some((v) => v.status === 'failed')) return '#ef4444';
    if (videosForDate.some((v) => v.status === 'uploaded')) return '#22c55e';
    return '#3b82f6';
  };

  const selectedDateVideos = scheduledVideos.filter((v) => {
    if (!v.scheduled_publish_at) return false;
    return new Date(v.scheduled_publish_at).toDateString() === date.toDateString();
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Content Calendar</h1>
        <p className="text-slate-500 mt-1">View and manage your scheduled uploads</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <Calendar
              value={date}
              onChange={(value) => setDate(value as Date)}
              tileContent={({ date: tileDate }) => {
                const color = getDateColor(tileDate);
                if (color) {
                  return (
                    <div className="w-2 h-2 rounded-full mx-auto mt-1" style={{ backgroundColor: color }} />
                  );
                }
                return null;
              }}
              className="w-full border-none"
            />
            <div className="flex gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span>Uploaded</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /><span>Scheduled</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span>Failed</span></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>

            {loading ? (
              <p className="text-slate-600 text-sm">Loading...</p>
            ) : selectedDateVideos.length === 0 ? (
              <div className="text-center py-8">
                <VideoIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-600 text-sm">No videos scheduled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateVideos.map((video) => (
                  <div key={video.id} className={`p-3 rounded-lg border border-slate-200 ${getStatusColor(video.status)}`}>
                    <p className="font-medium text-sm line-clamp-2">{video.title}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs">
                      <Clock className="w-3 h-3" />
                      {video.scheduled_publish_at && new Date(video.scheduled_publish_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
