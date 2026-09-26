import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://wbakgbkbhorldfrateor.supabase.co';
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_7D5nHlnx2biZhYtdz_BAyw_1O1SAAFL';

if (!url || !publishableKey) {
  console.warn('Supabase configuration is missing.');
}

export const supabase = createClient(url, publishableKey);
