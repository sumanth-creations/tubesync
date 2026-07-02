import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Activity, Video as VideoIcon, CircleCheck as CheckCircle, Clock, CircleAlert as AlertCircle, Sparkles, Scissors, Youtube, Loader as Loader2 } from 'lucide-react';
import { getActivities } from '../lib/api';
import type { Activity as ActivityType } from '../types';

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const data = await getActivities(50);
      setActivities(data);
    } catch (error) {
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: ActivityType['type']) => {
    const icons: Record<string, typeof VideoIcon> = {
      'video_created': VideoIcon,
      'video_uploaded': CheckCircle,
      'video_scheduled': Clock,
      'video_failed': AlertCircle,
      'channel_connected': Youtube,
      'ai_generated': Sparkles,
      'shorts_created': Scissors,
      'upload_queued': Clock,
    };
    return icons[type] || Activity;
  };

  const getActivityColor = (type: ActivityType['type']) => {
    const colors: Record<string, string> = {
      'video_created': 'text-blue-600 bg-blue-100',
      'video_uploaded': 'text-green-600 bg-green-100',
      'video_scheduled': 'text-blue-600 bg-blue-100',
      'video_failed': 'text-red-600 bg-red-100',
      'channel_connected': 'text-red-600 bg-red-100',
      'ai_generated': 'text-yellow-600 bg-yellow-100',
      'shorts_created': 'text-orange-600 bg-orange-100',
      'upload_queued': 'text-amber-600 bg-amber-100',
    };
    return colors[type] || 'text-slate-600 bg-slate-100';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Activity Feed</h1>
        <p className="text-slate-500 mt-1">Recent events and upload history</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Activity Feed</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activities.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const colorClass = getActivityColor(activity.type);
              return (
                <div key={activity.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{activity.title}</p>
                    {activity.description && (
                      <p className="text-xs text-slate-500 truncate">{activity.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{formatTime(activity.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
