import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. `npm run dev` uses .env.development (local stack); for production create .env.prod.local (see .env.example) and run `npm run dev:prod`.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
