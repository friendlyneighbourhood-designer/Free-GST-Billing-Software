import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://wbakgbkbhorldfrateor.supabase.co';
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_7D5nHlnx2biZhYtdz_BAyw_1O1SAAFL';

export const supabase = createClient(url, publishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export { url as SUPABASE_URL, publishableKey as SUPABASE_PUBLISHABLE_KEY };
