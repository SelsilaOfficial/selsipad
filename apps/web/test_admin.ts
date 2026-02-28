import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function check() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const address = '0x178cf582e811b30205cbf4bb7be45a9df31aac4a'.toLowerCase();

  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('address', address)
    .single();

  console.log('Wallet Data:', wallet);
  console.log('Wallet Error:', walletError);

  if (wallet) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', wallet.user_id)
      .single();
    
    console.log('Profile Data:', profile);
    console.log('Profile Error:', profileError);
  }
}
check();
