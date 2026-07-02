import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader as Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session) {
          toast.success('Signed in successfully!');
          // Navigate to root to trigger dynamic RootRedirect logic
          navigate('/', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      } catch {
        toast.error('Authentication failed');
        navigate('/login', { replace: true });
      }
    }
    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
        <p className="text-white text-lg font-medium">Completing sign in...</p>
      </div>
    </div>
  );
}
