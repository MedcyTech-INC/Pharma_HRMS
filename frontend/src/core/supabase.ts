import { createClient } from '@supabase/supabase-js';

// Production fallbacks ensure deployed Docker/cloud builds never crash on empty build-args
const FALLBACK_SUPABASE_URL = 'https://srv1674496.hstgr.cloud';
const FALLBACK_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc4ODY5MDUxLCJleHAiOjIwOTQyMjkwNTF9.NiS-C4ehy7uR_O1KVimHDL-HiDacCQ7WbohsiGNP5ak';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const SUPABASE_URL = (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '') 
  ? rawUrl.trim() 
  : FALLBACK_SUPABASE_URL;

const SUPABASE_ANON_KEY = (rawKey && typeof rawKey === 'string' && rawKey.trim() !== '') 
  ? rawKey.trim() 
  : FALLBACK_SUPABASE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
