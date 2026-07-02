import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  Youtube,
  ArrowRight,
  Loader2,
  Chrome,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('Please fill in all fields');
        toast.error('Please fill in all fields');
        setLoading(false);
        return;
      }

      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) throw signInError;

      toast.success('Login successful!');
      // Navigate to root to trigger dynamic RootRedirect logic
      navigate('/', { replace: true });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Login failed. Please try again.';

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const { error: oauthError } =
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'https://tubesync.pages.dev/auth/callback',
          },
        });

      if (oauthError) throw oauthError;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Google sign-in failed. Please try again.';

      setError(message);
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="w-full max-w-md p-8 bg-slate-800 rounded-xl">

        <div className="flex items-center gap-2 mb-6">
          <Youtube className="text-red-500" />
          <h1 className="text-2xl font-bold">TubeSync Login</h1>
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-3">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="flex items-center bg-slate-700 p-3 rounded">
            <Mail className="mr-2" />
            <input
              type="email"
              placeholder="Email"
              className="bg-transparent w-full outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex items-center bg-slate-700 p-3 rounded">
            <Lock className="mr-2" />
            <input
              type="password"
              placeholder="Password"
              className="bg-transparent w-full outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 p-3 rounded flex justify-center items-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                Login <ArrowRight />
              </>
            )}
          </button>
        </form>

        <div className="my-4 text-center text-slate-400">OR</div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white text-black p-3 rounded flex items-center justify-center gap-2"
        >
          <Chrome />
          Continue with Google
        </button>

        <p className="text-center mt-4 text-sm text-slate-400">
          Don’t have account?{' '}
          <Link to="/register" className="text-red-400">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
