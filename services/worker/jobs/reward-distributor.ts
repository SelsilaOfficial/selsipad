/**
 * Reward Distributor Worker
 * Processes fee_splits and creates referral_ledger entries
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function runRewardDistributor() {
  console.log('[Reward Distributor] Starting...');

  try {
    // Get unprocessed fee splits
    const { data: feeSplits, error } = await supabase
      .from('fee_splits')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[Reward Distributor] Error fetching fee splits:', error);
      return;
    }

    console.log(`[Reward Distributor] Found ${feeSplits?.length || 0} unprocessed fee splits`);

    for (const split of feeSplits || []) {
      try {
        console.log(`[Reward Distributor] Processing fee split ${split.id} (${split.source_type})`);

        // Get referrer for this source
        let referrerId: string | null = null;

        if (split.source_type === 'BLUECHECK') {
          // Get user from bluecheck purchase
          const { data: purchase } = await supabase
            .from('bluecheck_purchases')
            .select('user_id')
            .eq('id', split.source_id)
            .single();

          if (purchase) {
            // Check if this user was referred
            const { data: relationship } = await supabase
              .from('referral_relationships')
              .select('referrer_id')
              .eq('referee_id', purchase.user_id)
              .not('activated_at', 'is', null)
              .single();

            referrerId = relationship?.referrer_id || null;
          }
        } else if (split.source_type === 'PRESALE' || split.source_type === 'FAIRLAUNCH') {
          // source_id is the round_id — find all contributors with referrers
          const { data: contributions } = await supabase
            .from('contributions')
            .select('user_id, amount')
            .eq('round_id', split.source_id)
            .eq('status', 'CONFIRMED')
            .not('user_id', 'is', null);

          if (contributions && contributions.length > 0) {
            // Find all contributors who have referrers
            const totalRaised = contributions.reduce((sum, c) => sum + Number(c.amount), 0);
            let anyReferrerFound = false;

            for (const contribution of contributions) {
              const { data: relationship } = await supabase
                .from('referral_relationships')
                .select('referrer_id')
                .eq('referee_id', contribution.user_id)
                .not('activated_at', 'is', null)
                .single();

              if (relationship?.referrer_id) {
                anyReferrerFound = true;
                // Calculate proportional referral amount based on contribution share
                const share = Number(contribution.amount) / totalRaised;
                const proportionalAmount = Math.floor(
                  Number(split.referral_pool_amount) * share
                ).toString();

                const { error: ledgerError } = await supabase.from('referral_ledger').insert({
                  referrer_id: relationship.referrer_id,
                  source_type: split.source_type,
                  source_id: split.source_id,
                  amount: proportionalAmount,
                  asset: split.asset,
                  chain: split.chain,
                  status: 'CLAIMABLE',
                });

                if (ledgerError) {
                  if (ledgerError.code === '23505') {
                    console.log(
                      `[Reward Distributor] Ledger entry already exists for referrer ${relationship.referrer_id}`
                    );
                  } else {
                    console.error(`[Reward Distributor] Error creating ledger entry:`, ledgerError);
                  }
                } else {
                  console.log(
                    `[Reward Distributor] ✅ Distributed ${proportionalAmount} to referrer ${relationship.referrer_id} (contributor ${contribution.user_id})`
                  );
                }
              }
            }

            if (!anyReferrerFound) {
              console.log(
                `[Reward Distributor] No referrers found for any contributors in split ${split.id}`
              );
            }
          }
        }

        if (split.source_type !== 'PRESALE' && split.source_type !== 'FAIRLAUNCH' && !referrerId) {
          console.log(
            `[Reward Distributor] No referrer for split ${split.id}, marking as processed`
          );
        }

        // Mark split as processed
        await supabase
          .from('fee_splits')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', split.id);

        console.log(`[Reward Distributor] ✅ Split ${split.id} marked as processed`);
      } catch (err) {
        console.error(`[Reward Distributor] Error processing split ${split.id}:`, err);
      }
    }

    console.log('[Reward Distributor] Completed');
  } catch (error) {
    console.error('[Reward Distributor] Fatal error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  runRewardDistributor()
    .then(() => {
      console.log('[Reward Distributor] Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Reward Distributor] Fatal error:', error);
      process.exit(1);
    });
}
