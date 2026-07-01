import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('members')
    .select('*, coaches(name), classes(id, name, schedules, sports(name), coaches(name)), invoices(created_at, package_id)')
    .limit(1);

  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log("SUCCESS");
  }
}

test();
