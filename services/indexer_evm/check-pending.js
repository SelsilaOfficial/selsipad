import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../apps/web/.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMissingReferrals() {
  console.log("Scanning for users with ACTIVE BlueCheck but missing referral ledger entries...");

  // 1. Get all profiles with ACTIVE bluecheck
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('user_id, username, bluecheck_status');
    
  if (profileErr) {
    console.error("Error fetching profiles:", profileErr);
    return;
  }
  
  const activeProfiles = profiles.filter(p => p.bluecheck_status === 'ACTIVE');
  console.log(`Found ${activeProfiles.length} profiles with ACTIVE BlueCheck.`);

  for (const profile of activeProfiles) {
    // 2. See if this user was referred by someone
    const { data: rels } = await supabase
      .from('referral_relationships')
      .select('referrer_id')
      .eq('referee_id', profile.user_id)
      .limit(1);

    if (rels && rels.length > 0) {
      const referrerId = rels[0].referrer_id;
      
      // 3. See if there is a BlueCheck referral ledger entry for this referee
      const { data: ledgers } = await supabase
        .from('referral_ledger')
        .select('id, amount, status')
        .eq('referee_id', profile.user_id)
        .eq('source_type', 'BLUECHECK');

      if (!ledgers || ledgers.length === 0) {
        console.log(`[MISSING REWARD] User ${profile.username || profile.user_id} has ACTIVE BlueCheck, but their referrer (${referrerId}) has NO ledger entry!`);
      } else {
        const peningLedger = ledgers.find(l => l.status === 'PENDING');
        if (peningLedger) {
           console.log(`[PENDING REWARD] User ${profile.username || profile.user_id} has ACTIVE BlueCheck, but ledger ${peningLedger.id} is PENDING!`);
        }
      }
    }
  }
  console.log("Scan complete.");
}

checkMissingReferrals();
