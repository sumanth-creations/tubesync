/**
 * AI Experience Layout - Full-Screen Conversational Interface
 *
 * No sidebar. No menus. Just AI conversation.
 * Tools and views appear only when the user requests them through chat.
 */

import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Menu, X, Settings, LogOut, User } from 'lucide-react';

interface AIExperienceLayoutProps {
  showTools?: boolean;
  onCloseTools?: () => void;
}

export default function AIExperienceLayout({ showTools = false, onCloseTools }: AIExperienceLayoutProps) {
  const [user, setUser] = useState<{ email: string; avatar_url?: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email || '',
          avatar_url: data.user.user_metadata?.avatar_url,
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          email: session.user.email || '',
          avatar_url: session.user.user_metadata?.avatar_url,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isAIHome = location.pathname === '/ai-home';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Minimal header - only for critical actions */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-light text-slate-300">
              TubeSync <span className="text-cyan-400">Intelligence</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick access to other views */}
            <button
              onClick={() => navigate('/command-center')}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Command Center
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-800 transition-colors"
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <User className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800/95 backdrop-blur-xl rounded-xl border border-slate-700 shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700">
                      <p className="text-xs text-slate-500">Signed in as</p>
                      <p className="text-sm text-slate-300 truncate">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { navigate('/settings'); setMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                      >
                        <Settings className="w-4 h-4" /> Settings
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-slate-700/50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content area - full screen */}
      <div className="pt-12 h-screen flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
