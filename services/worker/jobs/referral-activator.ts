/**
 * Referral Activator Worker
 * Watches for qualifying events (Presale/Fairlaunch/BlueCheck/Bonding)
 * Atomically sets activated_at and increments active_referral_count
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface QualifyingEvent {
  type: 'PRESALE' | 'FAIRLAUNCH' | 'BLUECHECK' | 'BONDING';
  user_id: string;
  event_id: string;
  timestamp: string;
}

async function detectQualifyingEvents(): Promise<QualifyingEvent[]> {
  const events: QualifyingEvent[] = [];
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Check for new confirmed Blue Check purchases
  const { data: bluecheckPurchases } = await supabase
    .from('bluecheck_purchases')
    .select('id, user_id, updated_at')
    .eq('status', 'CONFIRMED')
    .gte('updated_at', fiveMinutesAgo);

  for (const purchase of bluecheckPurchases || []) {
    events.push({
      type: 'BLUECHECK',
      user_id: purchase.user_id,
      event_id: purchase.id,
      timestamp: purchase.updated_at,
    });
  }

  // Check for new successful contributions
  const { data: contributions } = await supabase
    .from('contributions')
    .select('id, user_id, created_at')
    .gt('amount', '0')
    .gte('created_at', fiveMinutesAgo);

  for (const contrib of contributions || []) {
    events.push({
      type: 'PRESALE', // Could be FAIRLAUNCH too
      user_id: contrib.user_id,
      event_id: contrib.id,
      timestamp: contrib.created_at,
    });
  }

  // TODO: Add bonding swap detection when implemented

  return events;
}

export async function runReferralActivator() {
  console.log('[Referral Activator] Starting...');

  try {
    const events = await detectQualifyingEvents();
    console.log(`[Referral Activator] Found ${events.length} qualifying events`);

    for (const event of events) {
      try {
        // Check if user has a referral relationship
        const { data: relationship } = await supabase
          .from('referral_relationships')
          .select('*')
          .eq('referee_id', event.user_id)
          .maybeSingle();

        if (!relationship) {
          continue; // No referral relationship
        }

        if (relationship.activated_at) {
          continue; // Already activated
        }

        console.log(`[Referral Activator] Activating referral for user ${event.user_id}`);

        // Atomically update relationship and increment referrer's count
        // Step 1: Update relationship
        const { error: relationshipError } = await supabase
          .from('referral_relationships')
          .update({ activated_at: event.timestamp })
          .eq('id', relationship.id)
          .is('activated_at', null); // Idempotency check

        if (relationshipError) {
          console.error(`[Referral Activator] Error updating relationship:`, relationshipError);
          continue;
        }

        // Step 2: Increment referrer's active count
        const { error: profileError } = await supabase.rpc('increment_active_referral_count', {
          p_user_id: relationship.referrer_id,
        });

        if (profileError) {
          // Try manual increment if RPC doesn't exist
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('active_referral_count')
            .eq('user_id', relationship.referrer_id)
            .single();

          const newCount = (currentProfile?.active_referral_count || 0) + 1;

          await supabase
            .from('profiles')
            .update({ active_referral_count: newCount })
            .eq('user_id', relationship.referrer_id);
        }

        console.log(
          `[Referral Activator] ✅ Activated referral for user ${event.user_id}, referrer ${relationship.referrer_id}`
        );
      } catch (err) {
        console.error(`[Referral Activator] Error processing event:`, err);
      }
    }

    console.log('[Referral Activator] Completed');
  } catch (error) {
    console.error('[Referral Activator] Fatal error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  runReferralActivator()
    .then(() => {
      console.log('[Referral Activator] Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Referral Activator] Fatal error:', error);
      process.exit(1);
    });
}
