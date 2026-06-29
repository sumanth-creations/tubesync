import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { getYouTubeChannels } from '../../lib/api';
import type { YouTubeChannel } from '../../types';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadChannels() {
      try {
        const data = await getYouTubeChannels();
        setChannels(data);
      } catch {
        setChannels([]);
      }
    }

    loadChannels();

    const interval = setInterval(loadChannels, 30000);

    return () => clearInterval(interval);
  }, []);

  const primaryChannel = channels[0];
  const connected = channels.length > 0;

  return (
    <div
      className="
      min-h-screen
      flex
      bg-[#050816]
      text-white
      overflow-hidden
    "
      ref={mainRef}
    >
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        connected={connected}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          channelName={primaryChannel?.channel_title}
          channelThumbnail={primaryChannel?.channel_thumbnail || undefined}
          connected={connected}
        />

        <main
          className="
          flex-1
          overflow-auto
          p-6
          lg:p-8
          bg-gradient-to-br
          from-[#050816]
          via-[#0B1020]
          to-[#111827]
        "
        >
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}