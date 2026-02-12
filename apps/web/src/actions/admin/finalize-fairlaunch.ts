'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';
import { ethers } from 'ethers';
import { recordLPLock } from './record-lp-lock';

export type FairlaunchAction =
  | 'finalize'
  | 'distributeFee'
  | 'addLiquidity'
  | 'lockLP'
  | 'distributeFunds';

export interface FairlaunchState {
  finalizeStep: number;
  isFinalized: boolean;
  status: number;
  lpLocker: string;
}

/**
 * Get current on-chain state of the Fairlaunch contract
 */
export async function getFairlaunchState(
  roundId: string
): Promise<{ success: boolean; state?: FairlaunchState; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session) return { success: false, error: 'Not authenticated' };

    const supabase = createServiceRoleClient();
    const { data: round, error } = await supabase
      .from('launch_rounds')
      .select('chain, contract_address')
      .eq('id', roundId)
      .single();

    if (error || !round?.contract_address)
      return { success: false, error: 'Round not found or no contract' };

    const rpcUrls: Record<string, string> = {
      '97': process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com',
      '56': process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
    };
    const rpcUrl = rpcUrls[round.chain];
    if (!rpcUrl) return { success: false, error: 'Unsupported chain' };

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(
      round.contract_address,
      [
        'function finalizeStep() view returns (uint8)',
        'function isFinalized() view returns (bool)',
        'function status() view returns (uint8)',
        'function lpLockerAddress() view returns (address)',
      ],
      provider
    );

    const [finalizeStep, isFinalized, status, lpLocker] = await Promise.all([
      (contract as any).finalizeStep().catch(() => 0n),
      (contract as any).isFinalized().catch(() => false),
      (contract as any).status().catch(() => 0n),
      (contract as any).lpLockerAddress().catch(() => ethers.ZeroAddress),
    ]);

    return {
      success: true,
      state: {
        finalizeStep: Number(finalizeStep),
        isFinalized,
        status: Number(status),
        lpLocker,
      },
    };
  } catch (err: any) {
    console.error('getFairlaunchState error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Admin action to finalize a fairlaunch or execute specific steps
 */
export async function finalizeFairlaunch(roundId: string, action: FairlaunchAction = 'finalize') {
  try {
    // Verify admin
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createServiceRoleClient();

    // Get round details
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select(
        'id, status, chain, contract_address, total_raised, params, start_at, end_at, project_id'
      )
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return { success: false, error: 'Round not found' };
    }

    if (!round.contract_address) {
      return { success: false, error: 'No contract address' };
    }

    // Identify Softcap status (for DB update later)
    const softcap = parseFloat(round.params?.softcap || '0');
    const totalRaised = parseFloat(round.total_raised || '0');
    const softcapReached = totalRaised >= softcap;

    // Use DEPLOYER_PRIVATE_KEY
    const adminPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!adminPrivateKey) {
      return { success: false, error: 'DEPLOYER_PRIVATE_KEY not configured' };
    }

    // Setup provider
    const rpcUrls: Record<string, string> = {
      '97': process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com',
      '56': process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
      '11155111': process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
      '84532': process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    };

    const rpcUrl = rpcUrls[round.chain];
    if (!rpcUrl) {
      return { success: false, error: `Unsupported chain: ${round.chain}` };
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

    // ABI
    const fairlaunchAbi = [
      'function finalize() external',
      'function isFinalized() view returns (bool)',
      'function status() view returns (uint8)',
      'function finalizeStep() view returns (uint8)',
      'function totalRaised() view returns (uint256)',
      // Admin steps
      'function adminDistributeFee() external',
      'function adminAddLiquidity() external',
      'function adminLockLP() external',
      'function adminDistributeFunds() external',
      // Views
      'function startTime() view returns (uint256)',
      'function endTime() view returns (uint256)',
      'function lpLockerAddress() view returns (address)',
    ];

    const contract = new ethers.Contract(round.contract_address, fairlaunchAbi, adminWallet);

    console.log(`[finalizeFairlaunch] Action: ${action} on ${round.contract_address}`);
    console.log(
      `[finalizeFairlaunch] Softcap: ${softcap}, Raised: ${totalRaised}, Reached: ${softcapReached}`
    );

    // Execute logic based on action
    let tx;
    const gasLimit = 5000000; // Safe limit

    try {
      if (action === 'finalize') {
        tx = await (contract as any).finalize({ gasLimit });
      } else if (action === 'distributeFee') {
        tx = await (contract as any).adminDistributeFee({ gasLimit });
      } else if (action === 'addLiquidity') {
        tx = await (contract as any).adminAddLiquidity({ gasLimit });
      } else if (action === 'lockLP') {
        tx = await (contract as any).adminLockLP({ gasLimit });
      } else if (action === 'distributeFunds') {
        tx = await (contract as any).adminDistributeFunds({ gasLimit });
      } else {
        return { success: false, error: 'Invalid action' };
      }

      console.log(`[finalizeFairlaunch] ${action} TX sent:`, tx.hash);
      const receipt = await tx.wait();
      console.log(`[finalizeFairlaunch] ${action} TX confirmed:`, receipt.blockNumber);
    } catch (contractError: any) {
      console.error(`[finalizeFairlaunch] ${action} failed:`, contractError);
      const reason =
        contractError.reason ||
        contractError.shortMessage ||
        contractError.message ||
        'Contract call failed';
      return { success: false, error: reason };
    }

    // Post-Execution: Check on-chain state
    const [isFinalizedNow, currentStep] = await Promise.all([
      (contract as any).isFinalized().catch(() => false),
      (contract as any).finalizeStep().catch(() => 0n),
    ]);

    console.log(
      `[finalizeFairlaunch] Post-execution: isFinalized=${isFinalizedNow}, step=${currentStep}`
    );

    // Record LP Lock if lockLP was executed (step 3 → 4) or full finalize completed
    if (action === 'lockLP' || (action === 'finalize' && Number(currentStep) >= 4)) {
      try {
        const txReceipt = await provider.getTransactionReceipt(tx.hash);
        if (txReceipt) {
          const lockResult = await recordLPLock(txReceipt, roundId, round.chain || '');
          if (lockResult.success) {
            console.log(`[finalizeFairlaunch] LP Lock recorded: lockId=${lockResult.lockId}`);
          } else {
            console.warn('[finalizeFairlaunch] LP Lock recording skipped:', lockResult.error);
          }
        }
      } catch (lockErr) {
        console.warn('[finalizeFairlaunch] LP Lock recording error (non-fatal):', lockErr);
      }
    }

    // Update DB if fully finalized
    if (isFinalizedNow) {
      const newResult = softcapReached ? 'SUCCESS' : 'FAILED';

      // Calculate final price for successful fairlaunches
      const tokensForSale = parseFloat(round.params?.tokens_for_sale || '0');
      const finalPrice = tokensForSale > 0 ? totalRaised / tokensForSale : 0;

      const updateData: Record<string, unknown> = {
        status: newResult, // SUCCESS or FAILED — not ENDED
        result: newResult,
        finalized_at: new Date().toISOString(),
        finalized_by: session.userId,
      };

      // Save final price for successful launches
      if (newResult === 'SUCCESS' && finalPrice > 0) {
        updateData.params = { ...round.params, final_price: finalPrice };
      }

      await supabase.from('launch_rounds').update(updateData).eq('id', roundId);

      console.log(`[finalizeFairlaunch] DB updated: status=${newResult}, result=${newResult}`);

      // Update project status
      const newProjectStatus = newResult === 'SUCCESS' ? 'FINALIZED' : 'FAILED';
      await supabase
        .from('projects')
        .update({ status: newProjectStatus, updated_at: new Date().toISOString() })
        .eq('id', round.project_id);

      console.log(`[finalizeFairlaunch] Project status updated: ${newProjectStatus}`);

      // Create allocations for SUCCESS
      if (newResult === 'SUCCESS') {
        const { data: contributions } = await supabase
          .from('contributions')
          .select('user_id, amount')
          .eq('round_id', roundId)
          .eq('status', 'CONFIRMED');

        if (contributions?.length) {
          // Filter out contributions without user_id (anonymous/guest)
          const validContributions = contributions.filter((c) => c.user_id != null);

          if (validContributions.length > 0) {
            const allocations = validContributions.map((c) => {
              const amountNum = Number(c.amount);
              const tokens = tokensForSale > 0 ? (amountNum / totalRaised) * tokensForSale : 0;
              return {
                round_id: roundId,
                user_id: c.user_id,
                contributed_amount: amountNum,
                allocation_tokens: tokens,
                claimable_tokens: 0,
                refund_amount: 0,
                claim_status: 'PENDING',
                refund_status: 'NONE',
              };
            });

            const { error: allocError } = await supabase
              .from('round_allocations')
              .upsert(allocations, { onConflict: 'round_id,user_id' });

            if (allocError) {
              console.error(`[finalizeFairlaunch] Allocation error:`, allocError);
            } else {
              console.log(`[finalizeFairlaunch] Created ${allocations.length} allocations`);
            }
          }

          if (validContributions.length < contributions.length) {
            console.warn(
              `[finalizeFairlaunch] Skipped ${contributions.length - validContributions.length} contributions with null user_id`
            );
          }
        }
      }

      // Create refund records for FAILED
      if (newResult === 'FAILED') {
        const { data: contributions } = await supabase
          .from('contributions')
          .select('user_id, amount')
          .eq('round_id', roundId)
          .eq('status', 'CONFIRMED');

        if (contributions?.length) {
          const refunds = contributions.map((c) => ({
            round_id: roundId,
            user_id: c.user_id,
            amount: c.amount,
            status: 'PENDING',
            chain: round.chain,
          }));
          const { error: refundError } = await supabase.from('refunds').insert(refunds);
          if (refundError) {
            console.error('[finalizeFairlaunch] Refund creation error:', refundError);
          }
          console.log(`[finalizeFairlaunch] Created ${refunds.length} refund records`);
        }
      }

      // Process fee splits → referral_ledger (auto-pilot)
      if (isFinalizedNow) {
        try {
          const { data: feeSplits } = await supabase
            .from('fee_splits')
            .select('*')
            .eq('source_id', roundId)
            .eq('processed', false);

          if (feeSplits?.length) {
            for (const split of feeSplits) {
              // Get all confirmed contributions for this round with user_ids
              const { data: contribs } = await supabase
                .from('contributions')
                .select('user_id, amount')
                .eq('round_id', roundId)
                .eq('status', 'CONFIRMED')
                .not('user_id', 'is', null);

              if (contribs?.length) {
                // BigInt math to avoid precision loss on large amounts
                const totalContributed = contribs.reduce(
                  (sum, c) => sum + BigInt(c.amount || '0'),
                  0n
                );
                const referralPool = BigInt(split.referral_pool_amount || '0');

                for (const contrib of contribs) {
                  // Check if contributor was referred
                  const { data: rel } = await supabase
                    .from('referral_relationships')
                    .select('referrer_id')
                    .eq('referee_id', contrib.user_id)
                    .not('activated_at', 'is', null)
                    .single();

                  if (rel?.referrer_id) {
                    // BigInt proportional: (pool * contribution) / total
                    const contribAmount = BigInt(contrib.amount || '0');
                    const proportionalAmount =
                      totalContributed > 0n
                        ? ((referralPool * contribAmount) / totalContributed).toString()
                        : '0';

                    const { error: ledgerErr } = await supabase.from('referral_ledger').insert({
                      referrer_id: rel.referrer_id,
                      referee_id: contrib.user_id,
                      source_type: split.source_type,
                      source_id: split.source_id,
                      amount: proportionalAmount,
                      asset: split.asset,
                      chain: split.chain,
                      status: 'CLAIMABLE',
                    });

                    if (!ledgerErr) {
                      console.log(
                        `[finalizeFairlaunch] Referral reward ${proportionalAmount} → referrer ${rel.referrer_id}`
                      );
                    } else if (ledgerErr.code !== '23505') {
                      console.error('[finalizeFairlaunch] Ledger insert error:', ledgerErr);
                    }
                  }
                }
              }

              // Mark split as processed
              await supabase
                .from('fee_splits')
                .update({ processed: true, processed_at: new Date().toISOString() })
                .eq('id', split.id);

              console.log(`[finalizeFairlaunch] Fee split ${split.id} processed`);
            }
          }
        } catch (feeErr) {
          console.error('[finalizeFairlaunch] Fee split processing error:', feeErr);
          // Non-fatal — don't fail the whole finalize
        }
      }
    }

    return {
      success: true,
      message: `${action} executed successfully.${isFinalizedNow ? ' Fairlaunch fully finalized!' : ` Step ${currentStep} complete.`}`,
      txHash: tx?.hash,
      isFinalized: isFinalizedNow,
      currentStep: Number(currentStep),
    };
  } catch (error: any) {
    console.error('finalizeFairlaunch error:', error);
    return {
      success: false,
      error: error.message || 'Failed to finalize fairlaunch',
    };
  }
}
