/**
 * supabase-config.js
 * Supabase client configuration and initialization for StudyPilot.
 *
 * You can provide your project credentials by either:
 * 1. Replacing DEFAULT_SUPABASE_URL and DEFAULT_SUPABASE_ANON_KEY below, OR
 * 2. Entering them in the "Supabase Connection" dialog in Settings.
 */

// Default credentials
const DEFAULT_SUPABASE_URL = 'https://gvheyvetftmiveuvhlch.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_aY7hIGyZbVEOioPWztN1Dg_-ZfJxgZ5';

const SP_CONFIG_KEYS = {
  URL: 'sp_supabase_url',
  KEY: 'sp_supabase_anon_key',
};

/** Get the active Supabase URL (custom localStorage value or default) */
function getSupabaseUrl() {
  try {
    const saved = localStorage.getItem(SP_CONFIG_KEYS.URL);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) { /* ignore */ }
  return DEFAULT_SUPABASE_URL;
}

/** Get the active Supabase Anon Key (custom localStorage value or default) */
function getSupabaseAnonKey() {
  try {
    const saved = localStorage.getItem(SP_CONFIG_KEYS.KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) { /* ignore */ }
  return DEFAULT_SUPABASE_ANON_KEY;
}

/** Check if valid Supabase credentials have been configured */
function isSupabaseConfigured() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return (
    Boolean(url) &&
    Boolean(key) &&
    !url.includes('YOUR_PROJECT_ID') &&
    !key.includes('YOUR_SUPABASE_ANON_KEY') &&
    url.startsWith('https://')
  );
}

/** Save custom Supabase credentials */
function saveSupabaseCredentials(url, key) {
  try {
    localStorage.setItem(SP_CONFIG_KEYS.URL, (url || '').trim());
    localStorage.setItem(SP_CONFIG_KEYS.KEY, (key || '').trim());
    initSupabaseClient();
    return true;
  } catch (e) {
    console.error('Failed to save Supabase credentials', e);
    return false;
  }
}

/** Clear saved custom credentials */
function clearSupabaseCredentials() {
  try {
    localStorage.removeItem(SP_CONFIG_KEYS.URL);
    localStorage.removeItem(SP_CONFIG_KEYS.KEY);
    initSupabaseClient();
  } catch (e) { /* ignore */ }
}

// Global Supabase client instance
window.supabaseClient = null;

/** Initialize the Supabase Client */
function initSupabaseClient() {
  if (typeof window.supabase === 'undefined') {
    console.warn('StudyPilot: Supabase JS library is not loaded.');
    window.supabaseClient = null;
    return null;
  }

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (isSupabaseConfigured()) {
    try {
      window.supabaseClient = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      return window.supabaseClient;
    } catch (e) {
      console.error('StudyPilot: Error initializing Supabase client:', e);
      window.supabaseClient = null;
      return null;
    }
  } else {
    window.supabaseClient = null;
    return null;
  }
}

// Automatically initialize on script evaluation
initSupabaseClient();
