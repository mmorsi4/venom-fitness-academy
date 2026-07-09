import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://kcopylyytmhponytpqwa.supabase.co', 'sb_publishable_4Ntd1Y4Smy6_c5RZLcrjkA_KR5Uh2hr');

async function run() {
  const { data, error } = await supabase.from('leads').select('*').limit(1);
  console.log('Error:', error);
}
run();
