import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://kcopylyytmhponytpqwa.supabase.co', 'sb_publishable_4Ntd1Y4Smy6_c5RZLcrjkA_KR5Uh2hr');

async function run() {
  const { data } = await supabase.from('global_settings').select('*').single();
  console.log(data);
}
run();
