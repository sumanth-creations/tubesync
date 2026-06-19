import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { getYouTubeChannels } from '../../lib/api';
import type { YouTubeChannel } from '../../types';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadChannels() {
      try {
        const data = await getYouTubeChannels();
        setChannels(data);
      } catch {
        setChannels([]);
      } finally {
        setLoading(false);
      }
    }
    loadChannels();
    const interval = setInterval(loadChannels, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sidebarOpen && mainRef.current && mainRef.current.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  const primaryChannel = channels[0];
  const connected = channels.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex" ref={mainRef}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        connected={connected}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          channelName={primaryChannel?.channel_title}
          channelThumbnail={primaryChannel?.channel_thumbnail || undefined}
          connected={connected}
        />

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
