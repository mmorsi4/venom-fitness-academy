import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://kcopylyytmhponytpqwa.supabase.co', 'sb_publishable_4Ntd1Y4Smy6_c5RZLcrjkA_KR5Uh2hr');

async function run() {
  const { data: base } = await supabase.from('finance_base_balances').select('*').eq('month', 7).eq('year', 2026).single();
  const { data: invoices } = await supabase.from('invoices').select('*').gte('created_at', '2026-07-01').lt('created_at', '2026-08-01');
  const { data: payments } = await supabase.from('invoice_payments').select('*').gte('paid_at', '2026-07-01').lt('paid_at', '2026-08-01');
  const { data: expenses } = await supabase.from('expenses').select('*').gte('date', '2026-07-01').lt('date', '2026-08-01');
  
  console.log('Base Balances:', base);
  
  let cashIn = 0;
  let visaIn = 0;
  let instaIn = 0;
  
  payments.forEach(p => {
    if (p.payment_method === 'Cash') cashIn += p.amount;
    if (p.payment_method === 'Visa') visaIn += p.amount;
    if (p.payment_method === 'InstaPay') instaIn += p.amount;
  });

  let cashOut = 0;
  let visaOut = 0;
  let instaOut = 0;

  expenses.forEach(e => {
    if (e.payment_method === 'Cash') cashOut += e.amount;
    if (e.payment_method === 'Visa') visaOut += e.amount;
    if (e.payment_method === 'InstaPay') instaOut += e.amount;
  });

  console.log('IN  Cash:', cashIn, 'Visa:', visaIn, 'Instapay:', instaIn);
  console.log('OUT Cash:', cashOut, 'Visa:', visaOut, 'Instapay:', instaOut);
  
  const finalCash = (base?.cash || 0) + cashIn - cashOut;
  const finalVisa = (base?.visa || 0) + visaIn - visaOut;
  const finalInsta = (base?.instapay || 0) + instaIn - instaOut;
  
  console.log('FINAL Cash:', finalCash, 'Visa:', finalVisa, 'Instapay:', finalInsta);
}
run();
