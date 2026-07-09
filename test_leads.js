import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://kcopylyytmhponytpqwa.supabase.co', 'sb_publishable_4Ntd1Y4Smy6_c5RZLcrjkA_KR5Uh2hr');

async function run() {
  const { data, error } = await supabase.from('leads').insert({
    name: 'Test',
    phone: '01000000',
    source: 'Walk-in',
    status: 'New',
    assigned_to: '08c305a8-ebd6-46d5-9b43-40892cc87361' // user ID
  });
  console.log('User ID Error:', error);

  const { data: d2, error: e2 } = await supabase.from('leads').insert({
    name: 'Test',
    phone: '01000000',
    source: 'Walk-in',
    status: 'New',
    assigned_to: '489bdf3d-e6b7-4a0b-930b-04414f5cfd9d' // employee ID
  });
  console.log('Employee ID Error:', e2);
}
run();
