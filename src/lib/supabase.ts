import { createClient } from '@supabase/supabase-js';

// Environment variables check (Production safe)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Rebuild: Better client configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Auto-save user session in LocalStorage
    autoRefreshToken: true, // Auto-refresh JWT before it expires
    detectSessionInUrl: true, // Crucial for Google OAuth redirects
  },
  global: {
    headers: {
      'x-application-name': 'TubeSync-OS',
    },
  },
});
