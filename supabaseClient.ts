import { createClient } from '@supabase/supabase-js';
import { Database } from './types_db';

// Use proper environment variables with fallbacks
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logging for development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.log('🔍 Environment Check:', {
    supabaseUrl: supabaseUrl ? '✅ Found' : '❌ Missing',
    supabaseAnonKey: supabaseAnonKey ? '✅ Found' : '❌ Missing',
    processEnv: !!process.env.REACT_APP_SUPABASE_URL,
    importMeta: !!(import.meta.env?.VITE_SUPABASE_URL)
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `
🚨 Supabase Configuration Error:
- REACT_APP_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}
- REACT_APP_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}

Please check:
1. Your .env file exists in the project root
2. Variables are prefixed with REACT_APP_
3. No extra spaces or quotes in .env file
4. Restart your development server after adding .env

Current working directory: ${typeof window !== 'undefined' ? window.location.origin : 'Server'}
  `;
  
  console.error(errorMessage);
  throw new Error('Supabase credentials are not configured. See console for details.');
}

// Create Supabase client with security configurations
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'integral-app'
    }
  }
});