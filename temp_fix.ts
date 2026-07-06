import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://aws-0-eu-central-1.pooler.supabase.com'; // Wait, let's just use REST with anon key if we can't load dotenv.
// Actually I don't have the keys loaded.
