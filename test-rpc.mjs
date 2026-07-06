import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kcopylyytmhponytpqwa.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'test'; // I need the actual anon key or service key

console.log("Need anon key to test via HTTP RPC");
