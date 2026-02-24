import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../apps/web/.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function patchMissingReferrals() {
  console.log("Patching users with ACTIVE BlueCheck but missing referral ledger entries...");

  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('user_id, username, bluecheck_status');
    
  if (profileErr) {
    console.error("Error fetching profiles:", profileErr);
    return;
  }
  
  const activeProfiles = profiles.filter(p => p.bluecheck_status === 'ACTIVE');
  console.log(`Found ${activeProfiles.length} profiles with ACTIVE BlueCheck.`);

  let patchedCount = 0;

  for (const profile of activeProfiles) {
    const { data: rels } = await supabase
      .from('referral_relationships')
      .select('referrer_id')
      .eq('referee_id', profile.user_id)
      .limit(1);

    if (rels && rels.length > 0) {
      const referrerId = rels[0].referrer_id;
      
      const { data: ledgers } = await supabase
        .from('referral_ledger')
        .select('id, amount, status')
        .eq('referee_id', profile.user_id)
        .eq('source_type', 'BLUECHECK');

      if (!ledgers || ledgers.length === 0) {
        console.log(`[PATCHING] Referee: ${profile.username || profile.user_id} -> Referrer: ${referrerId}`);
        
        // Use the tx hash if available, otherwise fallback
        const sourceId = profile.bluecheck_tx_hash || `MANUAL_RECOVERY_${profile.user_id}`;
        
        // 0.005 BNB (30% of $10 at $600 BNB)
        const amountWei = "5000000000000000"; 

        const { error: insertErr } = await supabase.from('referral_ledger').insert({
          referrer_id: referrerId,
          referee_id: profile.user_id,
          source_type: 'BLUECHECK',
          source_id: sourceId,
          amount: amountWei,
          asset: '0x0000000000000000000000000000000000000000', // Native BNB
          chain: '56', // Assuming mainnet for most of these older purchases
          status: 'CLAIMED',
          claimed_at: new Date().toISOString()
        });
        
        if (insertErr) {
           console.error("Failed to insert for", profile.user_id, insertErr.message);
        } else {
           console.log("Success.");
           patchedCount++;
           
           // Activate relationship
           await supabase
            .from('referral_relationships')
            .update({ activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('referrer_id', referrerId)
            .eq('referee_id', profile.user_id)
            .is('activated_at', null);
            
           // Increment active count
           await supabase.rpc('increment_active_referral_count', { target_user_id: referrerId });
        }
      }
    }
  }
  console.log(`Patch complete. ${patchedCount} records inserted.`);
}

patchMissingReferrals();
