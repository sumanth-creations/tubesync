import { useState, useEffect, useCallback } from 'react';
import { getYouTubeChannels } from '../lib/api';
import type { YouTubeChannel } from '../lib/database';

export function useChannels() {
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getYouTubeChannels();
      setChannels(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  return { channels, loading, error, refresh: loadChannels };
}
