import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../apps/web/.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('referral_ledger').select('*').order('created_at', { ascending: false }).limit(3);
  console.log(JSON.stringify(data, null, 2));
}

check();
