import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Find coach ibrahim
  const { data: coaches, error: coachErr } = await supabase
    .from('coaches')
    .select('*')
    .ilike('name', '%ibrahim%');

  if (coachErr) {
    console.error('Error finding coach:', coachErr);
    return;
  }

  if (!coaches || coaches.length === 0) {
    console.log('Coach Ibrahim not found!');
    return;
  }

  const coach = coaches[0];
  console.log(`Found coach: ${coach.name} (ID: ${coach.id})`);

  // 2. Add 2 substitute sessions for yesterday (July 22)
  // One at 6 PM, one at 7 PM
  // Wait, does substitute session mean we need to check him into classes?
  // The system uses 'coach_check_ins' which just takes coach_id and check_in_date
  const session1Date = '2026-07-22T18:00:00+03:00';
  const session2Date = '2026-07-22T19:00:00+03:00';

  const { data, error } = await supabase
    .from('coach_check_ins')
    .insert([
      { coach_id: coach.id, check_in_date: session1Date },
      { coach_id: coach.id, check_in_date: session2Date }
    ]);

  if (error) {
    console.error('Error inserting check-ins:', error);
  } else {
    console.log('Successfully added 2 check-ins for Coach Ibrahim on July 22 for Boxing at 6 PM and 7 PM!');
  }
}

main();
