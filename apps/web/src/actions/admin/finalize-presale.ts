'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ethers } from 'ethers';
import { revalidatePath } from 'next/cache';
import { getDeployerPrivateKey } from '@/lib/web3/deployer-wallet';
import { recordLPLock } from './record-lp-lock';
import { getAdminSession } from '@/lib/auth/admin-session';

const RPC_URLS: Record<string, string> = {
  '97': process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com',
  '56': process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
};

// Escrow Vault ABI
const ESCROW_VAULT_ABI = [
  'function release(bytes32 projectId, address toContract) external',
  'function isPending(bytes32 projectId) view returns (bool)',
  'function getBalance(bytes32 projectId) view returns (uint256)',
  'event Deposited(bytes32 indexed projectId, address indexed tokenAddress, uint256 amount, address indexed depositor)',
];

// MerkleVesting ABI
const MERKLE_VESTING_ABI = [
  'function setMerkleRoot(bytes32 _merkleRoot, uint256 _totalAllocated) external',
  'function merkleRoot() view returns (bytes32)',
  'function token() view returns (address)',
];

// PresaleRound ABI — V2.4: updated for 6-param finalizeSuccessEscrow
const PRESALE_ROUND_ABI = [
  'function finalizeFailed(string reason) external',
  'function status() view returns (uint8)',
  'function totalRaised() view returns (uint256)',
  'function softCap() view returns (uint256)',
  'function hardCap() view returns (uint256)',
  'function feeConfig() view returns (uint256 totalBps, uint256 treasuryBps, uint256 referralPoolBps, uint256 sbtStakingBps)',
  'function snap() view returns (bool taken)',
  'function feePaid() view returns (bool)',
  'function lpCreated() view returns (bool)',
  'function ownerPaid() view returns (bool)',
  'function vestingFunded() view returns (bool)',
  'function finalizeSuccessEscrow(bytes32 _merkleRoot, uint256 totalVestingAllocation, uint256 unsoldToBurn, uint256 tokensForLP, uint256 tokenMinLP, uint256 bnbMinLP) external',
  'event Contributed(address indexed contributor, uint256 amount, address indexed referrer)',
];

// Known escrow vault addresses per chain
const ESCROW_VAULTS: Record<string, string> = {
  '97': '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F',
};

/**
 * Admin action to finalize a presale.
 *
 * For SUCCESS: Manual flow (escrow release → vesting vault → set merkle root)
 *   - Bypasses the contract's finalizeSuccess which has a projectOwner token transfer issue
 *   - Releases tokens from escrow directly to the vesting vault
 *   - Sets the merkle root on the vesting vault for claim distribution
 *
 * For FAILURE: Calls finalizeFailed on the presale contract
 */
export async function finalizePresale(
  roundId: string,
  outcome: 'SUCCESS' | 'FAILED',
  options?: {
    merkleRoot?: string;
    totalAllocation?: string;
    unsoldToBurn?: string;
    tokensForLP?: string;
    tokenMinLP?: string;
    bnbMinLP?: string;
    failureReason?: string;
  }
) {
  try {
    const adminSession = await getAdminSession();

    if (!adminSession) {
      return { success: false, error: 'Not authenticated — admin session required' };
    }

    const supabase = createServiceRoleClient();
    const session = { userId: adminSession.userId };

    // Get round details
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select(
        'id, status, type, chain, contract_address, round_address, vesting_vault_address, total_raised, params, project_id, escrow_tx_hash, escrow_amount, chain_id, deployment_block_number'
      )
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return { success: false, error: 'Round not found' };
    }

    if (round.type !== 'PRESALE') {
      return { success: false, error: 'Not a presale round' };
    }

    const contractAddress = round.round_address || round.contract_address;
    if (!contractAddress) {
      return { success: false, error: 'No contract address — deploy first' };
    }

    // Only allow finalize from DEPLOYED or ENDED status
    if (!['DEPLOYED', 'ENDED', 'LIVE'].includes(round.status)) {
      return { success: false, error: `Cannot finalize: current status is ${round.status}` };
    }

    const chainId = parseInt(round.chain) || 97;
    const adminPrivateKey = getDeployerPrivateKey(chainId);

    const rpcUrl = RPC_URLS[round.chain];
    if (!rpcUrl) {
      return { success: false, error: `Unsupported chain: ${round.chain}` };
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

    if (outcome === 'SUCCESS') {
      // ═══════════════════════════════════════════════════
      // ON-CHAIN FINALIZATION VIA finalizeSuccessEscrow()
      // ═══════════════════════════════════════════════════
      // Flow:
      //   1. Release escrow → PresaleRound contract
      //   2. Call round.finalizeSuccessEscrow(merkleRoot, totalAllocation, unsoldToBurn)
      //      → funds vesting, sets merkle root, distributes BNB, burns unsold
      //   3. Update DB to FINALIZED
      // ═══════════════════════════════════════════════════

      if (!options?.merkleRoot || !options?.totalAllocation) {
        return {
          success: false,
          error: 'merkleRoot and totalAllocation required for success finalization',
        };
      }

      if (!round.vesting_vault_address) {
        return { success: false, error: 'Vesting vault address not set in DB' };
      }

      // Check softcap was met
      const presaleContract = new ethers.Contract(contractAddress, PRESALE_ROUND_ABI, provider);
      const [totalRaised, softCap] = await Promise.all([
        (presaleContract as any).totalRaised(),
        (presaleContract as any).softCap(),
      ]);

      if (totalRaised < softCap) {
        return {
          success: false,
          error: `Softcap not met. Raised: ${ethers.formatEther(totalRaised)}, Required: ${ethers.formatEther(softCap)}`,
        };
      }

      const unsoldToBurn = options.unsoldToBurn || '0';

      console.log('[finalizePresale] On-chain escrow flow starting...');
      console.log('[finalizePresale] merkleRoot:', options.merkleRoot);
      console.log('[finalizePresale] totalAllocation:', options.totalAllocation);
      console.log('[finalizePresale] unsoldToBurn:', unsoldToBurn);
      console.log('[finalizePresale] roundAddress:', contractAddress);

      const txHashes: string[] = [];

      // ─── Step 1: Release escrow → round contract ───
      const escrowVaultAddr = ESCROW_VAULTS[round.chain];
      if (!escrowVaultAddr) {
        return { success: false, error: `No escrow vault configured for chain ${round.chain}` };
      }

      // Get escrow projectId from the deposit tx
      const escrowProjectId = await getEscrowProjectId(
        provider,
        round.escrow_tx_hash,
        escrowVaultAddr
      );
      if (!escrowProjectId) {
        return { success: false, error: 'Could not find escrow deposit projectId from tx' };
      }

      console.log('[finalizePresale] Escrow projectId:', escrowProjectId);

      const escrowContract = new ethers.Contract(escrowVaultAddr, ESCROW_VAULT_ABI, adminWallet);

      // Check if escrow is still pending
      const isPending = await (escrowContract as any).isPending(escrowProjectId);
      if (!isPending) {
        console.log('[finalizePresale] Escrow already released, skipping release step');
      } else {
        // Release to ROUND CONTRACT (not vesting vault!)
        console.log('[finalizePresale] Releasing escrow to round contract...');
        const releaseTx = await (escrowContract as any).release(
          escrowProjectId,
          contractAddress, // ← round contract, not vesting vault
          { gasLimit: 500000 }
        );
        console.log('[finalizePresale] Escrow release tx:', releaseTx.hash);
        const releaseReceipt = await releaseTx.wait();
        console.log('[finalizePresale] Escrow released, block:', releaseReceipt.blockNumber);
        txHashes.push(releaseTx.hash);
      }

      // ─── Step 2: Call finalizeSuccessEscrow on round contract ───
      const ROUND_FINALIZE_ABI = [
        'function finalizeSuccessEscrow(bytes32 _merkleRoot, uint256 _totalVestingAllocation, uint256 _unsoldToBurn, uint256 _tokensForLP, uint256 _tokenMinLP, uint256 _bnbMinLP) external',
        'function status() view returns (uint8)',
        'function feePaid() view returns (bool)',
        'function lpCreated() view returns (bool)',
        'function ownerPaid() view returns (bool)',
        'function vestingFunded() view returns (bool)',
      ];
      const roundContract = new ethers.Contract(contractAddress, ROUND_FINALIZE_ABI, adminWallet);

      // Check if already finalized — V2.4: status 3 = FINALIZING (resumable), 4 = FINALIZED_SUCCESS (done)
      const currentStatus = await (roundContract as any).status();
      let alreadyFinalized = false;
      if (currentStatus === 4n) {
        // Already fully finalized — still need to record LP lock if missed
        console.log('[finalizePresale] Already fully finalized on-chain');
        alreadyFinalized = true;
      } else if (currentStatus === 3n) {
        // FINALIZING — resume from where we left off
        console.log('[finalizePresale] Status is FINALIZING — resuming phases...');
        const finalizeTx = await (roundContract as any).finalizeSuccessEscrow(
          options.merkleRoot,
          BigInt(options.totalAllocation),
          BigInt(unsoldToBurn),
          BigInt(options.tokensForLP || '0'),
          BigInt(options.tokenMinLP || '0'),
          BigInt(options.bnbMinLP || '0'),
          { gasLimit: 5000000 }
        );
        console.log('[finalizePresale] Resume finalize tx:', finalizeTx.hash);
        await finalizeTx.wait();
        txHashes.push(finalizeTx.hash);
      } else {
        // ENDED or just synced — start finalization
        console.log('[finalizePresale] Calling finalizeSuccessEscrow (V2.4, 6 params)...');
        const finalizeTx = await (roundContract as any).finalizeSuccessEscrow(
          options.merkleRoot,
          BigInt(options.totalAllocation),
          BigInt(unsoldToBurn),
          BigInt(options.tokensForLP || '0'),
          BigInt(options.tokenMinLP || '0'),
          BigInt(options.bnbMinLP || '0'),
          { gasLimit: 5000000 }
        );
        console.log('[finalizePresale] Finalize tx:', finalizeTx.hash);
        const finalizeReceipt = await finalizeTx.wait();
        console.log('[finalizePresale] Finalized in block:', finalizeReceipt.blockNumber);
        txHashes.push(finalizeTx.hash);
      }

      // ─── Step 3: Update DB ───
      const { error: updateError } = await supabase
        .from('launch_rounds')
        .update({
          status: 'FINALIZED',
          result: 'SUCCESS',
          merkle_root: options.merkleRoot,
          tge_timestamp: Math.floor(Date.now() / 1000),
          finalized_by: session.userId,
          finalized_at: new Date().toISOString(),
          total_raised: parseFloat(ethers.formatEther(totalRaised)),
          vesting_status: 'CONFIRMED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', roundId);

      if (updateError) {
        return {
          success: false,
          error: `On-chain success but DB update failed: ${updateError.message}`,
        };
      }

      // Update project status
      if (round.project_id) {
        await supabase
          .from('projects')
          .update({ status: 'FINALIZED', updated_at: new Date().toISOString() })
          .eq('id', round.project_id);
      }

      // Process fee splits (V2.4: upsert + on-chain referral)
      await processPresaleFeeSplits(supabase, round, totalRaised, provider);

      // ─── Step 4: Record LP Lock to DB ───
      // Parse TokensLocked event from the finalize receipt
      if (txHashes.length > 0) {
        try {
          const lastTxHash = txHashes[txHashes.length - 1]!;
          const lockReceipt = await provider.getTransactionReceipt(lastTxHash);
          if (lockReceipt) {
            // Read actual LPLocker address from contract (factory-deployed, may differ from hardcoded)
            const onChainLocker = await provider
              .call({
                to: contractAddress,
                data: ethers.id('lpLocker()').slice(0, 10),
              })
              .then((r) => '0x' + r.slice(26))
              .catch(() => '');
            const lockResult = await recordLPLock(
              lockReceipt,
              roundId,
              round.chain || '',
              onChainLocker || undefined
            );
            if (lockResult.success) {
              console.log(`[finalizePresale] LP Lock recorded: lockId=${lockResult.lockId}`);
            } else {
              console.warn('[finalizePresale] LP Lock recording skipped:', lockResult.error);
            }
          }
        } catch (lockErr) {
          console.warn('[finalizePresale] LP Lock recording error (non-fatal):', lockErr);
        }
      } else if (alreadyFinalized) {
        // Contract was already finalized — read LP state directly from on-chain
        try {
          const ONCHAIN_LP_ABI = [
            'function lpCreated() view returns (bool)',
            'function lpLockId() view returns (uint256)',
            'function lpLocker() view returns (address)',
            'function lpUsedBnb() view returns (uint256)',
            'function liquidityBps() view returns (uint256)',
          ];
          const lpContract = new ethers.Contract(contractAddress, ONCHAIN_LP_ABI, provider);
          const [lpCreated, lpLockId, lpLockerAddr, lpUsedBnb] = await Promise.all([
            (lpContract as any).lpCreated().catch(() => false),
            (lpContract as any).lpLockId().catch(() => 0n),
            (lpContract as any).lpLocker().catch(() => ''),
            (lpContract as any).lpUsedBnb().catch(() => 0n),
          ]);

          if (lpCreated && lpLockerAddr) {
            console.log('[finalizePresale] Reading LP lock from on-chain state:', {
              lpLockId: Number(lpLockId),
              lpLocker: lpLockerAddr,
              lpUsedBnb: ethers.formatEther(lpUsedBnb),
            });

            // Read lock details from LPLocker contract
            const LP_LOCKER_ABI = [
              'function getLock(uint256 lockId) view returns (tuple(address lpToken, address owner, address beneficiary, uint256 amount, uint256 lockTime, uint256 unlockTime, bool withdrawn))',
            ];
            const lockerContract = new ethers.Contract(lpLockerAddr, LP_LOCKER_ABI, provider);
            const lock = await (lockerContract as any).getLock(lpLockId);

            if (lock && lock.lpToken && lock.lpToken !== ethers.ZeroAddress) {
              const unlockDate = new Date(Number(lock.unlockTime) * 1000);
              const lockedAtDate = new Date(Number(lock.lockTime) * 1000);

              const { createServiceRoleClient: createSR } =
                await import('@/lib/supabase/service-role');
              const supa = createSR();
              const { error: lpDbErr } = await supa.from('liquidity_locks').upsert(
                {
                  round_id: roundId,
                  lock_id: String(Number(lpLockId)),
                  lp_token_address: lock.lpToken,
                  locker_contract_address: lpLockerAddr,
                  lock_amount: ethers.formatEther(lock.amount),
                  locked_at: lockedAtDate.toISOString(),
                  locked_until: unlockDate.toISOString(),
                  lock_tx_hash: 'on-chain-recovery',
                  chain: round.chain || '97',
                  dex_type: 'PANCAKE',
                  lock_duration_months: 13,
                  status: 'LOCKED',
                },
                { onConflict: 'round_id' }
              );

              if (!lpDbErr) {
                await supa
                  .from('launch_rounds')
                  .update({
                    lock_status: 'LOCKED',
                    pool_address: lock.lpToken,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', roundId);
                console.log(
                  `[finalizePresale] ✅ LP Lock recovered from on-chain: lockId=${Number(lpLockId)}`
                );
              } else {
                console.warn('[finalizePresale] LP Lock DB save failed:', lpDbErr.message);
              }
            }
          } else {
            console.log('[finalizePresale] No LP created on-chain (lpCreated=false)');
          }
        } catch (onchainLpErr) {
          console.warn('[finalizePresale] On-chain LP recovery error (non-fatal):', onchainLpErr);
        }
      }

      // ─── Step 5: Write round_allocations ───
      // Calculate and persist token allocations for each contributor
      try {
        const roundParams = round.params as any;
        const pricePerToken = roundParams?.price ? parseFloat(String(roundParams.price)) : 0;
        const tokenDecimals = 18; // Standard ERC20

        if (pricePerToken > 0 && options.merkleRoot) {
          // Get contributors from presale_merkle_proofs (already written by prepare-finalize)
          const { data: proofs } = await supabase
            .from('presale_merkle_proofs')
            .select('wallet_address, allocation')
            .eq('round_id', roundId);

          if (proofs && proofs.length > 0) {
            // Look up user_ids from wallets
            const allocations = [];
            for (const proof of proofs) {
              const { data: walletRow } = await supabase
                .from('wallets')
                .select('user_id')
                .ilike('address', proof.wallet_address)
                .single();

              const tokenAmount = Number(BigInt(proof.allocation)) / 10 ** tokenDecimals;
              const contributedBnb = tokenAmount * pricePerToken;

              allocations.push({
                round_id: roundId,
                user_id: walletRow?.user_id || null,
                contributed_amount: contributedBnb,
                allocation_tokens: tokenAmount,
                claimable_tokens: 0,
                refund_amount: 0,
                claim_status: 'PENDING',
                refund_status: 'NONE',
              });
            }

            const { error: allocErr } = await supabase
              .from('round_allocations')
              .upsert(allocations, { onConflict: 'round_id,user_id' });

            if (allocErr) {
              console.warn('[finalizePresale] round_allocations upsert error:', allocErr.message);
            } else {
              console.log(`[finalizePresale] ✅ ${allocations.length} round_allocations written`);
            }

            // ─── Step 5.5: Create Vesting Schedule & Allocations ───
            // Create master vesting schedule and individual vesting allocations
            try {
              const roundParams = round.params as any;
              const totalTokens = allocations.reduce((sum, a) => sum + a.allocation_tokens, 0);
              const tgePercentage = roundParams?.investor_vesting?.tge_percentage || 0;
              const cliffMonths = roundParams?.investor_vesting?.cliff_months || 0;
              const vestingMonths = roundParams?.investor_vesting?.schedule?.length || 12;

              // Get token address from projects table
              let tokenAddress = roundParams?.token_address;
              if (!tokenAddress && round.project_id) {
                const { data: project } = await supabase
                  .from('projects')
                  .select('token_address')
                  .eq('id', round.project_id)
                  .single();
                tokenAddress = project?.token_address;
              }

              if (!tokenAddress) {
                console.warn('[finalizePresale] No token_address found, skipping vesting setup');
                throw new Error('token_address required for vesting');
              }

              // Create vesting schedule (master schedule for this round)
              const { data: schedule, error: scheduleErr } = await supabase
                .from('vesting_schedules')
                .upsert(
                  {
                    round_id: roundId,
                    token_address: tokenAddress,
                    chain: String(round.chain || '97'),
                    total_tokens: totalTokens,
                    tge_percentage: tgePercentage,
                    tge_at: new Date().toISOString(), // TGE starts at finalization
                    cliff_months: cliffMonths,
                    vesting_months: vestingMonths,
                    interval_type: 'MONTHLY',
                    status: 'CONFIRMED', // Valid: PENDING|CONFIRMED|FAILED|PAUSED
                    contract_address: contractAddress,
                  },
                  { onConflict: 'round_id' }
                )
                .select()
                .single();

              if (scheduleErr || !schedule) {
                console.warn('[finalizePresale] vesting_schedules error:', scheduleErr?.message);
              } else {
                console.log(`[finalizePresale] ✅ Vesting schedule created: ${schedule.id}`);

                // Create individual vesting allocations for each user
                const vestingAllocations = allocations.map((alloc) => ({
                  schedule_id: schedule.id,
                  round_id: roundId, // Required field in vesting_allocations
                  user_id: alloc.user_id,
                  allocation_tokens: alloc.allocation_tokens,
                  claimed_tokens: 0,
                  // No 'status' field in vesting_allocations schema
                }));

                const { error: vestingErr } = await supabase
                  .from('vesting_allocations')
                  .upsert(vestingAllocations, { onConflict: 'user_id,schedule_id' });

                if (vestingErr) {
                  console.warn('[finalizePresale] vesting_allocations error:', vestingErr.message);
                } else {
                  console.log(
                    `[finalizePresale] ✅ ${vestingAllocations.length} vesting_allocations created`
                  );
                }
              }
            } catch (vestingErr) {
              console.warn('[finalizePresale] vesting creation error (non-fatal):', vestingErr);
            }
          }
        }
      } catch (allocErr) {
        console.warn('[finalizePresale] round_allocations error (non-fatal):', allocErr);
      }

      revalidatePath('/admin');
      return {
        success: true,
        outcome: 'SUCCESS',
        txHash: txHashes.join(', '),
        details: {
          escrowReleased: !isPending ? 'already released' : 'released to round',
          finalizedOnChain: true,
          totalRaised: ethers.formatEther(totalRaised),
        },
      };
    } else {
      // FAILED finalization — call contract's finalizeFailed directly
      const contract = new ethers.Contract(contractAddress, PRESALE_ROUND_ABI, adminWallet);
      const reason = options?.failureReason || 'Softcap not met';

      const tx = await (contract as any).finalizeFailed(reason, { gasLimit: 500000 });
      console.log('[finalizePresale] Failed tx sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('[finalizePresale] Confirmed, block:', receipt.blockNumber);

      // Update DB
      const { error: updateError } = await supabase
        .from('launch_rounds')
        .update({
          status: 'FINALIZED',
          result: 'FAILED',
          finalized_by: session.userId,
          finalized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', roundId);

      if (updateError) {
        return {
          success: false,
          error: `On-chain failed but DB update failed: ${updateError.message}`,
        };
      }

      // Update project status
      if (round.project_id) {
        await supabase
          .from('projects')
          .update({ status: 'FAILED', updated_at: new Date().toISOString() })
          .eq('id', round.project_id);
      }

      revalidatePath('/admin');
      return { success: true, outcome: 'FAILED', txHash: tx.hash };
    }
  } catch (error: any) {
    console.error('[finalizePresale] Error:', error);
    return { success: false, error: error.message || 'Failed to finalize presale' };
  }
}

/**
 * Parse the Deposited event from the escrow tx to extract the projectId bytes32.
 * The projectId is the first indexed topic of the Deposited event.
 */
async function getEscrowProjectId(
  provider: ethers.JsonRpcProvider,
  escrowTxHash: string | null,
  escrowVaultAddr: string
): Promise<string | null> {
  if (!escrowTxHash) return null;

  try {
    const receipt = await provider.getTransactionReceipt(escrowTxHash);
    if (!receipt) return null;

    const iface = new ethers.Interface(ESCROW_VAULT_ABI);
    const depositedTopic = iface.getEvent('Deposited')!.topicHash;

    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() === escrowVaultAddr.toLowerCase() &&
        log.topics[0] === depositedTopic
      ) {
        // projectId is topics[1] (first indexed param)
        return log.topics[1] ?? null;
      }
    }

    return null;
  } catch (err) {
    console.error('[getEscrowProjectId] Error parsing tx:', err);
    return null;
  }
}

/**
 * Process fee splits after successful presale finalization.
 * Same pattern as fairlaunch: 70% owner, 30% platform (treasury/referral/staking).
 */
async function processPresaleFeeSplits(
  supabase: ReturnType<typeof createServiceRoleClient>,
  round: any,
  totalRaised: bigint,
  provider: ethers.JsonRpcProvider
) {
  try {
    // FIX 4: Read feeBps from on-chain contract, not DB params
    const presaleContract = new ethers.Contract(
      round.round_address || round.contract_address,
      PRESALE_ROUND_ABI,
      provider
    );
    const feeConfig = await (presaleContract as any).feeConfig();
    const feeBps = BigInt(feeConfig.totalBps);
    const feeAmount = (totalRaised * feeBps) / 10000n;

    // Columns are numeric(78,0) — store in wei
    const treasuryWei = (feeAmount * 50n) / 100n;
    const referralWei = (feeAmount * 40n) / 100n;
    const stakingWei = feeAmount - treasuryWei - referralWei;

    // Fee_splits: upsert (idempotent on retry)
    const { data: feeSplit, error: feeError } = await supabase
      .from('fee_splits')
      .upsert(
        {
          source_id: round.id,
          source_type: 'PRESALE',
          total_amount: feeAmount.toString(),
          treasury_amount: treasuryWei.toString(),
          referral_pool_amount: referralWei.toString(),
          staking_pool_amount: stakingWei.toString(),
          asset: 'BNB',
          chain: round.chain || '97',
          processed: true,
          processed_at: new Date().toISOString(),
        },
        { onConflict: 'source_type,source_id' }
      )
      .select()
      .single();

    if (feeError) {
      console.error('[processPresaleFeeSplits] Fee split error:', feeError);
      return;
    }

    console.log(
      '[processPresaleFeeSplits] Fee split upserted:',
      feeSplit?.id,
      'feeBps:',
      feeBps.toString(),
      'amount:',
      ethers.formatEther(feeAmount),
      'BNB'
    );

    // FIX 5+6: Referral from on-chain Contributed events with bounded block range and bigint math
    const roundAddress = round.round_address || round.contract_address;
    const deployBlock = round.deployment_block_number || 0;

    // BSC RPC limits eth_getLogs to 10,000 blocks. Use bounded range.
    let events: any[] = [];
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = deployBlock > 0 ? deployBlock : Math.max(0, currentBlock - 9999);
      const filter = (presaleContract as any).filters.Contributed();

      // If range exceeds 9999, paginate in chunks
      const MAX_RANGE = 9999;
      for (let start = fromBlock; start <= currentBlock; start += MAX_RANGE) {
        const end = Math.min(start + MAX_RANGE - 1, currentBlock);
        const chunk = await presaleContract.queryFilter(filter, start, end);
        events.push(...chunk);
      }
      console.log(
        '[processPresaleFeeSplits] Queried',
        events.length,
        'events from block',
        fromBlock,
        'to',
        currentBlock
      );
    } catch (logErr) {
      console.error('[processPresaleFeeSplits] eth_getLogs error:', (logErr as Error).message);
      // Non-fatal: fee split already saved, just skip referral distribution
      return;
    }

    const totalRaisedWei = totalRaised;
    let referralCount = 0;

    // Master referrer address — used as on-chain fallback for users without referral codes.
    // When detected, we resolve the REAL referrer from DB referral_relationships instead.
    const MASTER_REFERRER = (process.env.NEXT_PUBLIC_MASTER_REFERRER || '').toLowerCase();

    for (const event of events) {
      const parsedLog = event as ethers.EventLog;
      if (!parsedLog.args) continue;
      const [contributor, amount, referrer] = parsedLog.args;
      if (referrer === ethers.ZeroAddress) continue;

      // Look up contributor wallet → user_id
      const { data: contribWallet } = await supabase
        .from('wallets')
        .select('user_id')
        .ilike('address', contributor)
        .single();

      if (!contribWallet?.user_id) continue;

      // Resolve the REAL referrer:
      // If on-chain referrer is the master referrer OR not registered in wallets,
      // look up the actual referrer from DB referral_relationships.
      let realReferrerId: string | null = null;
      const isOnchainMasterReferrer =
        MASTER_REFERRER && String(referrer).toLowerCase() === MASTER_REFERRER;

      if (!isOnchainMasterReferrer) {
        // On-chain referrer is a specific wallet — try direct lookup
        const { data: referrerWallet } = await supabase
          .from('wallets')
          .select('user_id')
          .ilike('address', referrer)
          .single();

        if (referrerWallet?.user_id) {
          realReferrerId = referrerWallet.user_id;
          console.log(
            `[processPresaleFeeSplits] Direct referrer found: ${referrer} → ${realReferrerId}`
          );
        }
      }

      // Fallback to DB referral_relationships (handles master referrer + unregistered wallets)
      if (!realReferrerId) {
        const { data: relationship } = await supabase
          .from('referral_relationships')
          .select('referrer_id, activated_at')
          .eq('referee_id', contribWallet.user_id)
          .single();

        if (relationship?.referrer_id) {
          realReferrerId = relationship.referrer_id;
          console.log(
            `[processPresaleFeeSplits] DB referral_relationship found: contributor ${contribWallet.user_id} → referrer ${realReferrerId}`
          );

          // Activate the relationship if not yet activated
          if (!relationship.activated_at) {
            const { error: activateErr } = await supabase
              .from('referral_relationships')
              .update({ activated_at: new Date().toISOString() })
              .eq('referee_id', contribWallet.user_id)
              .eq('referrer_id', realReferrerId);

            if (!activateErr) {
              // Increment referrer's active_referral_count
              await supabase.rpc('increment_active_referral_count', {
                target_user_id: realReferrerId,
              });
              console.log(
                `[processPresaleFeeSplits] Activated referral: ${contribWallet.user_id} → ${realReferrerId}`
              );
            }
          }
        } else {
          console.log(
            `[processPresaleFeeSplits] No referral relationship for contributor ${contribWallet.user_id}, skipping`
          );
          continue;
        }
      }

      if (!realReferrerId) continue;

      // FIX 5: pure bigint — no Number() precision loss
      const proportionalAmount = (referralWei * BigInt(amount)) / totalRaisedWei;

      const { error: ledgerErr } = await supabase.from('referral_ledger').upsert(
        {
          referrer_id: realReferrerId,
          source_type: 'PRESALE',
          source_id: feeSplit.id,
          referee_id: contribWallet.user_id,
          amount: proportionalAmount.toString(),
          asset: 'BNB',
          chain: round.chain || '97',
          status: 'CLAIMABLE',
        },
        { onConflict: 'source_type,source_id,referee_id' }
      );

      if (!ledgerErr) {
        referralCount++;
        console.log(
          `[processPresaleFeeSplits] Referral reward ${proportionalAmount.toString()} → referrer ${realReferrerId}`
        );
      } else if (ledgerErr.code !== '23505') {
        console.error('[processPresaleFeeSplits] Ledger upsert error:', ledgerErr);
      }
    }

    console.log(
      '[processPresaleFeeSplits] Created',
      referralCount,
      'referral entries from',
      events.length,
      'on-chain events'
    );
  } catch (error) {
    console.error('[processPresaleFeeSplits] Error:', error);
  }
}

/**
 * Get on-chain presale state for admin dashboard.
 */
export async function getPresaleOnchainState(roundId: string) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) return { success: false, error: 'Not authenticated' };

    const supabase = createServiceRoleClient();
    const { data: round, error } = await supabase
      .from('launch_rounds')
      .select('chain, contract_address, round_address')
      .eq('id', roundId)
      .single();

    if (error || !round) return { success: false, error: 'Round not found' };

    const contractAddress = round.round_address || round.contract_address;
    if (!contractAddress) return { success: false, error: 'No contract address' };

    const rpcUrl = RPC_URLS[round.chain];
    if (!rpcUrl) return { success: false, error: 'Unsupported chain' };

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, PRESALE_ROUND_ABI, provider);

    const [status, totalRaised, softCap] = await Promise.all([
      (contract as any).status().catch(() => 0n),
      (contract as any).totalRaised().catch(() => 0n),
      (contract as any).softCap().catch(() => 0n),
    ]);

    return {
      success: true,
      state: {
        status: Number(status),
        totalRaised: ethers.formatEther(totalRaised),
        softCap: ethers.formatEther(softCap),
        softCapMet: totalRaised >= softCap,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
