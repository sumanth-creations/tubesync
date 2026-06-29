import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Video,
  Calendar,
  BarChart3,
  Settings,
  Youtube,
  LogOut,
  X,
  Bot,
  Sparkles,
  Brain,
  TrendingUp,
  FolderOpen,
  Bell,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  connected?: boolean;
}

export function Sidebar({
  isOpen,
  onClose,
  connected = false,
}: SidebarProps) {
  const { user, signOut } = useAuth();

  const navigationItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Upload, label: 'Upload Center', path: '/upload' },
    { icon: Video, label: 'Video Library', path: '/videos' },
    { icon: Calendar, label: 'Content Planner', path: '/calendar' },
    { icon: Bot, label: 'AI Command', path: '/agent' },
    { icon: Brain, label: 'AI Agents', path: '/agents' },
    { icon: Sparkles, label: 'AI Studio', path: '/generate' },
    { icon: TrendingUp, label: 'Growth Center', path: '/growth' },
    { icon: BarChart3, label: 'Analytics', path: '/seo' },
    { icon: FolderOpen, label: 'Assets', path: '/assets' },
    { icon: Users, label: 'Team', path: '/team' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-[#050816] border-r border-white/10 text-white flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="h-20 flex items-center px-6 border-b border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-blue-600 flex items-center justify-center shadow-lg">
            <Youtube className="w-6 h-6" />
          </div>

          <div className="ml-3">
            <h1 className="font-bold text-xl">TubeSync</h1>
            <p className="text-xs text-slate-400">AI Operating System</p>
          </div>

          <button onClick={onClose} className="ml-auto lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-5">
          <div className="rounded-2xl p-4 bg-gradient-to-r from-fuchsia-600/20 to-blue-600/20 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">AI Agents</span>
              <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              SEO • Research • Upload • Analytics
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-fuchsia-600 to-blue-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10">
          {user && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-white/5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-600 to-blue-600 flex items-center justify-center">
                {(user.full_name || user.email)?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{user.full_name || 'Creator'}</p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
            </div>
          )}

          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}