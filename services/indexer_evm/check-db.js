import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../apps/web/.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabase.from('bonding_pools').select('*').limit(1);
  if (error) {
    console.error('Error fetching bonding_pools:', error);
  } else {
    console.log('Columns existing in bonding_pools remotely:');
    if (data.length > 0) {
      console.log(Object.keys(data[0]));
    } else {
      console.log('Table is empty, trying an insert to see if we get a specific error...');
      const { error: err2 } = await supabase.from('bonding_pools').insert({ id: '00000000-0000-0000-0000-000000000000' });
      console.log(err2);
    }
  }
}

check();
