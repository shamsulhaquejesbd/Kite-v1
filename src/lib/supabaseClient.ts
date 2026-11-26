import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isBrowserSupabaseConfigured = Boolean(url && anonKey);

export const supabaseBrowser: SupabaseClient | null = isBrowserSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
