import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Delete the incorrect check-ins I made earlier today
  await supabase
    .from('coach_check_ins')
    .delete()
    .eq('coach_id', '4824be72-b31f-433e-9268-08243e33d918')
    .in('check_in_date', ['2026-07-22T18:00:00+03:00', '2026-07-22T19:00:00+03:00']);

  const session1Date = '2026-07-22T18:00:00+03:00';
  const session2Date = '2026-07-22T19:00:00+03:00';

  const boxingKidsId = '35e6903c-10be-41e0-a162-edcae98e1e1e';
  const boxingAdultsId = '0327175a-133c-4bb4-9c67-ec2a00d059d8';
  const ibrahimId = '4824be72-b31f-433e-9268-08243e33d918';

  const { data, error } = await supabase
    .from('coach_check_ins')
    .insert([
      { 
        coach_id: ibrahimId, 
        check_in_date: session1Date,
        class_id: boxingKidsId,
        is_substitute: true,
        session_type: 'group'
      },
      { 
        coach_id: ibrahimId, 
        check_in_date: session2Date,
        class_id: boxingAdultsId,
        is_substitute: true,
        session_type: 'group'
      }
    ]);

  if (error) {
    console.error('Error inserting check-ins:', error);
  } else {
    console.log('Successfully added 2 substitute check-ins for Coach Ibrahim!');
  }
}

main();
