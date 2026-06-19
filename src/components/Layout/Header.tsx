import { useState } from 'react';
import { Menu, Bell, ChevronDown, LogOut, User, Youtube } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
  channelName?: string;
  channelThumbnail?: string;
  connected?: boolean;
}

export function Header({ onMenuClick, channelName, channelThumbnail, connected }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
          <Youtube className="w-4 h-4 text-red-600" />
          <span>TubeSync Automation</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {channelName && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200">
            {channelThumbnail ? (
              <img src={channelThumbnail} alt={channelName} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{channelName.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate">{channelName}</span>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-amber-500'}`} />
          </div>
        )}

        <button className="p-2 hover:bg-slate-100 rounded-lg relative">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="User" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-500" />
              </div>
            )}
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-200 py-2 min-w-[200px] z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-800">{user?.full_name || user?.email}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={() => { signOut(); setShowDropdown(false); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
