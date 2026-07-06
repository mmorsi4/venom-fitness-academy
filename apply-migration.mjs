import { Client } from 'pg';
import * as fs from 'fs';

const connectionString = 'postgresql://postgres.kcopylyytmhponytpqwa:xVRVqSV008y88tku@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  const sql = fs.readFileSync('c:/Users/ahmed/OneDrive/Desktop/venom/venom-fitness-academy/supabase/migrations/053_coach_deductions.sql', 'utf8');
  await client.query(sql);
  
  console.log('Migration applied successfully.');
  await client.end();
}

main().catch(console.error);
