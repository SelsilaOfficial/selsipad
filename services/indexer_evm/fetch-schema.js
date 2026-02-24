import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: '../../apps/web/.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testProj() {
  const { error } = await supabase.from('profiles').upsert({
    user_id: "90b76496-c03f-48d6-bd14-f97405b03dbc",
    display_name: "E2E Tester Broken"
  });
  console.log("Profiles insertion error:", error);
}

testProj().catch(console.error);
