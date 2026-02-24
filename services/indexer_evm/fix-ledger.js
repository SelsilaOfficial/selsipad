import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../apps/web/.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { data: records } = await supabase
    .from('referral_ledger')
    .select('*')
    .eq('source_type', 'BONDING')
    .eq('chain', 'bscTestnet');

  for (const record of records || []) {
    // If the amount is less than 1 BNB (1e18) but is literally '75000' or similar
    if (BigInt(record.amount) < 1000000000000000n) {
        const correctAmount = BigInt(record.amount) * 1000000000n;
        const { error } = await supabase
            .from('referral_ledger')
            .update({ amount: correctAmount.toString() })
            .eq('id', record.id);
        
        console.log(`Updated ${record.id}: ${record.amount} -> ${correctAmount.toString()}`);
    }
  }
}

fix();
