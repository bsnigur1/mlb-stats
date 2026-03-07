import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Log env var status (will show in browser console)
if (typeof window !== 'undefined') {
  console.log('Supabase config:', {
    urlSet: !!supabaseUrl,
    keySet: !!supabaseAnonKey,
    urlPrefix: supabaseUrl?.substring(0, 30),
    keyLength: supabaseAnonKey?.length,
    keyPrefix: supabaseAnonKey?.substring(0, 20),
    keySuffix: supabaseAnonKey?.substring(supabaseAnonKey.length - 10),
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!', {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'SET' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'SET' : 'MISSING',
  });
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
