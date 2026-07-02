import { useState, useEffect, useCallback } from 'react';
import { getVideos } from '../lib/api';
import type { Video } from '../types';

export function useVideos(limit = 100, status?: string) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getVideos(limit, status);
      setVideos(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, [limit, status]);

  useEffect(() => {
    loadVideos();
    const interval = setInterval(loadVideos, 10000);
    return () => clearInterval(interval);
  }, [loadVideos]);

  return { videos, loading, error, refresh: loadVideos };
}
