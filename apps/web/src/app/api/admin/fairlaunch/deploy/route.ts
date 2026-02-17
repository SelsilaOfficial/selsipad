/**
 * POST /api/admin/fairlaunch/deploy
 *
 * Admin-controlled deployment via FairlaunchFactory (v12.5)
 * v11 Hybrid Admin-Controlled Deployment Model
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { getDeployerPrivateKey } from '@/lib/web3/deployer-wallet';
import FairlaunchFactoryABI from '@/../../packages/contracts/artifacts/contracts/fairlaunch/FairlaunchFactory.sol/FairlaunchFactory.json';
import FairlaunchABI from '@/../../packages/contracts/artifacts/contracts/fairlaunch/Fairlaunch.sol/Fairlaunch.json';
import EscrowVaultABI from '@/../../packages/contracts/artifacts/contracts/escrow/EscrowVault.sol/EscrowVault.json';
import lpLockerDeployment from '@/../../packages/contracts/deployments/lplocker.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FACTORY_ADDRESSES = {
  bsc_testnet:
    process.env.NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_TESTNET ||
    '0xa6dE6Ebd3E0ED5AcbE9c07B59C738C610821e175', // Pair Pre-Create Fix (Feb 12)
  bnb: process.env.NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_MAINNET,
  sepolia:
    process.env.NEXT_PUBLIC_FAIRLAUNCH_FACTORY_SEPOLIA ||
    '0x53850a56397379Da8572A6a47003bca88bB52A24', // V2 Router Fix (Feb 12)
  base_sepolia:
    process.env.NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BASE_SEPOLIA ||
    '0xeEf8C1da1b94111237c419AB7C6cC30761f31572', // Full Infra Deploy (Feb 12)
};

const ESCROW_VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_TOKEN_ESCROW_BSC_TESTNET || '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F'; // Must match submit API!

/** Parse ISO date to Unix seconds. If string has no timezone (no Z or ±HH:MM), treat as UTC so server TZ does not change chain endTime. */
function isoToUnixSeconds(iso: string | null | undefined): number {
  if (!iso) return Math.floor(Date.now() / 1000);
  const s = String(iso).trim();
  const hasTz = /Z|[+-]\d{2}:?\d{2}$/.test(s);
  return Math.floor(new Date(hasTz ? s : s + 'Z').getTime() / 1000);
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Check admin authentication via admin_session cookie
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const adminCookie = cookieStore.get('admin_session')?.value;

    let adminUserId: string | null = null;

    if (adminCookie) {
      try {
        const adminSession = JSON.parse(adminCookie);
        adminUserId = adminSession.userId;
        console.log('[Admin Deploy] Admin session found:', {
          userId: adminSession.userId,
          wallet: adminSession.wallet,
          roles: adminSession.roles,
        });
      } catch {
        console.log('[Admin Deploy] Failed to parse admin_session cookie');
      }
    }

    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized — no admin session' }, { status: 401 });
    }

    // 2. Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', adminUserId)
      .single();

    console.log('[Admin Deploy] Profile check:', {
      userId: adminUserId,
      found: !!profile,
      isAdmin: profile?.is_admin,
      error: profileError,
    });

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    console.log('[Admin Deploy] ✅ Admin authenticated:', adminUserId);

    // 3. Get launch round ID from request
    const body = await request.json();
    const { launchRoundId } = body;

    if (!launchRoundId) {
      return NextResponse.json({ error: 'Launch round ID required' }, { status: 400 });
    }

    // 4. Fetch launch round and project data (MANUAL JOIN)
    const { data: launchRound, error: roundError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', launchRoundId)
      .single();

    if (roundError || !launchRound) {
      console.error('[Admin Deploy] Round fetch error:', roundError);
      return NextResponse.json({ error: 'Launch round not found' }, { status: 404 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', launchRound.project_id)
      .single();

    if (projectError || !project) {
      console.error('[Admin Deploy] Project fetch error:', projectError);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log('[Admin Deploy] Deploying fairlaunch:', {
      launchRoundId,
      projectId: project.id,
    });

    // 5. Validate status — must be APPROVED before deployment
    if (launchRound.status !== 'APPROVED') {
      return NextResponse.json(
        {
          error: `Invalid status: ${launchRound.status}. Fairlaunch must be APPROVED before deployment.`,
        },
        { status: 400 }
      );
    }

    // 6. Setup ethers provider and signer
    const chainId = parseInt(launchRound.chain_id || launchRound.chain || '97');
    const rpcUrl =
      chainId === 97
        ? process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'
        : process.env.BSC_MAINNET_RPC_URL;

    if (!rpcUrl) {
      throw new Error('RPC URL not configured');
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    // CRITICAL: Use per-network deployer key which is factory's adminExecutor
    // Factory grants ADMIN_ROLE to adminExecutor, required for setLPLocker() and finalize()
    const deployerKey = getDeployerPrivateKey(chainId);

    const signer = new ethers.Wallet(deployerKey, provider);
    console.log('[Admin Deploy] Deployer wallet (adminExecutor):', signer.address);

    // 7a. FIRST: Get projectId from escrow transaction (decode from logs)
    // Wizard generates random UUID and hashes it, we need to extract that bytes32
    const escrowVault = new ethers.Contract(ESCROW_VAULT_ADDRESS, EscrowVaultABI.abi, signer);

    console.log('[Admin Deploy] Decoding projectId from escrow TX:', launchRound.escrow_tx_hash);

    const escrowReceipt = await provider.getTransactionReceipt(launchRound.escrow_tx_hash);
    if (!escrowReceipt) {
      return NextResponse.json({ error: 'Escrow transaction not found on-chain' }, { status: 400 });
    }

    // Find the Deposited event log
    const depositedEventTopic = ethers.id('Deposited(bytes32,address,uint256,address)');
    const depositLog = escrowReceipt.logs.find(
      (log) =>
        log.topics[0] === depositedEventTopic &&
        log.address.toLowerCase() === ESCROW_VAULT_ADDRESS.toLowerCase()
    );

    if (!depositLog) {
      return NextResponse.json(
        { error: 'Deposited event not found in escrow transaction' },
        { status: 400 }
      );
    }

    // Extract projectId from event topics (topic[1] is the indexed projectId)
    const projectIdBytes32 = depositLog.topics[1];

    console.log('[Admin Deploy] Extracted projectId from escrow:', projectIdBytes32);

    // Check escrow balance
    const escrowBalance = await (escrowVault as any).getBalance(projectIdBytes32);

    if (escrowBalance === 0n) {
      console.log('[Admin Deploy] ⚠️ No tokens in escrow - tokens may have been released already');
      console.log('[Admin Deploy] Proceeding to check admin wallet token balance...');

      // Verify admin wallet has tokens (from previous release)
      const tokenContract = new ethers.Contract(
        project.token_address,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );

      const adminBalance = await (tokenContract as any).balanceOf(signer.address);
      if (adminBalance === 0n) {
        return NextResponse.json(
          {
            error:
              'No tokens in escrow and admin wallet has no tokens. Cannot proceed with deployment.',
          },
          { status: 400 }
        );
      }

      console.log(
        '[Admin Deploy] ✅ Admin wallet has tokens:',
        ethers.formatUnits(adminBalance, 18)
      );
      console.log('[Admin Deploy] Skipping escrow release, proceeding to factory approval...');
    } else {
      console.log(
        '[Admin Deploy] Escrow balance:',
        ethers.formatUnits(escrowBalance, 18),
        'tokens'
      );

      // Release tokens from escrow to admin wallet (for factory to pull)
      console.log('[Admin Deploy] Releasing tokens from escrow to admin wallet...');
      const releaseTx = await (escrowVault as any).release(projectIdBytes32, signer.address);
      await releaseTx.wait();
      console.log('[Admin Deploy] ✅ Tokens released from escrow');
    }

    // 7b. Approve factory to spend tokens (always approve max to be safe)
    const tokenContract = new ethers.Contract(
      project.token_address,
      [
        'function balanceOf(address) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function transfer(address to, uint256 amount) returns (bool)',
      ],
      signer
    );

    const factoryAddressMap: Record<number, string | undefined> = {
      97: FACTORY_ADDRESSES.bsc_testnet,
      56: FACTORY_ADDRESSES.bnb,
      11155111: FACTORY_ADDRESSES.sepolia,
      84532: FACTORY_ADDRESSES.base_sepolia,
    };
    const factoryAddress = factoryAddressMap[chainId] as string;
    if (!factoryAddress) {
      throw new Error(`No factory address configured for chain ${chainId}`);
    }

    const adminBalance = await (tokenContract as any).balanceOf(signer.address);
    console.log('[Admin Deploy] Admin token balance:', ethers.formatUnits(adminBalance, 18));

    // Always approve max uint256 to ensure factory can pull all required tokens
    // (tokensForSale + liquidityTokens + teamVestingTokens)
    console.log('[Admin Deploy] Approving factory for max uint256...');
    const MAX_UINT256 = ethers.MaxUint256;
    const approveTx = await (tokenContract as any).approve(factoryAddress, MAX_UINT256);
    await approveTx.wait();
    console.log('[Admin Deploy] ✅ Factory approved for unlimited spend');

    // 7c. Get factory contract and deployment fee
    const factory = new ethers.Contract(factoryAddress, FairlaunchFactoryABI.abi, signer);

    // Fetch deployment fee from factory
    const deploymentFee = await (factory as any).DEPLOYMENT_FEE();
    console.log(
      '[Admin Deploy] Deployment fee required:',
      ethers.formatEther(deploymentFee),
      'BNB'
    );

    // 8. Build deployment parameters from JSONB params
    // Factory expects 3 tuples: CreateFairlaunchParams, TeamVestingParams, LPLockPlan
    const params = launchRound.params || {};

    // Tuple 1: CreateFairlaunchParams
    // CRITICAL: Auto-adjust startTime/endTime if they are in the past.
    // The factory validates startTime > block.timestamp (line 207 in FairlaunchFactory.sol).
    // Admin review delay often causes original times to expire.
    const nowUnix = Math.floor(Date.now() / 1000);
    const DEPLOY_BUFFER_SECONDS = 5 * 60; // 5 minutes buffer

    let startTimeUnix = isoToUnixSeconds(launchRound.start_at);
    let endTimeUnix = isoToUnixSeconds(launchRound.end_at);
    const originalDuration = endTimeUnix - startTimeUnix;

    if (startTimeUnix <= nowUnix) {
      const newStart = nowUnix + DEPLOY_BUFFER_SECONDS;
      const newEnd = newStart + Math.max(originalDuration, 3600); // Minimum 1 hour duration
      console.log('[Admin Deploy] ⚠️ startTime is in the past, auto-adjusting:');
      console.log(
        `  Original: start=${new Date(startTimeUnix * 1000).toISOString()}, end=${new Date(endTimeUnix * 1000).toISOString()}`
      );
      console.log(
        `  Adjusted: start=${new Date(newStart * 1000).toISOString()}, end=${new Date(newEnd * 1000).toISOString()}`
      );
      console.log(`  Duration preserved: ${originalDuration}s → ${newEnd - newStart}s`);
      startTimeUnix = newStart;
      endTimeUnix = newEnd;

      // Update database with adjusted times so UI shows correct countdown
      const { error: timeUpdateError } = await supabase
        .from('launch_rounds')
        .update({
          start_at: new Date(startTimeUnix * 1000).toISOString(),
          end_at: new Date(endTimeUnix * 1000).toISOString(),
        })
        .eq('id', launchRoundId);

      if (timeUpdateError) {
        console.error('[Admin Deploy] Failed to update adjusted times:', timeUpdateError);
      } else {
        console.log('[Admin Deploy] ✅ Database times updated');
      }
    }

    const createParams = {
      projectToken: project.token_address,
      paymentToken: ethers.ZeroAddress, // Native BNB
      softcap: ethers.parseEther(params.softcap.toString()),
      tokensForSale: ethers.parseUnits(params.tokens_for_sale.toString(), 18),
      minContribution: ethers.parseEther((params.min_contribution || '0.1').toString()),
      maxContribution: ethers.parseEther((params.max_contribution || '10').toString()),
      startTime: BigInt(startTimeUnix),
      endTime: BigInt(endTimeUnix),
      projectOwner: project.creator_wallet,
      listingPremiumBps: BigInt(params.listing_premium_bps || 0), // 0 = fair launch price
    };

    // Tuple 2: TeamVestingParams
    const vestingParams = {
      beneficiary: params.vesting_address || project.creator_wallet,
      startTime: BigInt(isoToUnixSeconds(launchRound.end_at)), // After fairlaunch ends
      durations: (params.vesting_schedule || []).map((s: any) =>
        BigInt(s.month * 30 * 24 * 60 * 60)
      ), // months to seconds
      amounts: (params.vesting_schedule || []).map((s: any) => {
        const teamTokens = ethers.parseUnits((params.team_vesting_tokens || '0').toString(), 18);
        return (teamTokens * BigInt(Math.floor(s.percentage * 100))) / BigInt(10000);
      }),
    };

    // Tuple 3: LPLockPlan
    const lpPlan = {
      lockMonths: BigInt(params.lp_lock_months || 12),
      liquidityPercent: BigInt((params.liquidity_percent || 70) * 100), // Convert % to basis points (70 → 7000)
      dexId: ethers.id(params.dex_platform || 'PancakeSwap'), // Convert to bytes32
    };

    console.log('[Admin Deploy] Deploy params:', {
      projectToken: createParams.projectToken,
      softcap: createParams.softcap.toString(),
      tokensForSale: createParams.tokensForSale.toString(),
      liquidityPercent: lpPlan.liquidityPercent.toString(),
    });

    // 9. Deploy via factory (sending deployment fee)
    console.log('[Admin Deploy] Calling factory.createFairlaunch()...');
    const tx = await (factory as any).createFairlaunch(createParams, vestingParams, lpPlan, {
      value: deploymentFee,
    });
    console.log('[Admin Deploy] TX sent:', tx.hash);

    // 10. Wait for confirmation
    console.log('[Admin Deploy] Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log('[Admin Deploy] Confirmed in block:', receipt.blockNumber);

    // 11. Extract contract address from FairlaunchCreated event
    const fairlaunchCreatedEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === 'FairlaunchCreated';
      } catch {
        return false;
      }
    });

    if (!fairlaunchCreatedEvent) {
      throw new Error('FairlaunchCreated event not found in receipt');
    }

    const parsedEvent = factory.interface.parseLog(fairlaunchCreatedEvent);
    const contractAddress = parsedEvent?.args?.fairlaunch; // Match contract event signature
    const vestingAddress = parsedEvent?.args?.vesting;

    if (!contractAddress) {
      throw new Error('Failed to extract contract address from event');
    }

    console.log('[Admin Deploy] ✅ Contract deployed:', contractAddress);
    console.log('[Admin Deploy] ✅ Vesting vault deployed:', vestingAddress);

    // 12. Factory handles token transfers automatically
    // The FairlaunchFactory contract uses safeTransferFrom to pull tokens from admin
    // and automatically transfers them to the deployed Fairlaunch and Vesting contracts.
    // No additional funding step needed - contracts are ready to use!
    console.log('[Admin Deploy] ✅ Contracts funded by factory during deployment');

    // 12.5. Auto-configure LP Locker (CRITICAL for finalization)
    console.log('[Admin Deploy] ⚙️ Starting LP Locker auto-configuration...');
    try {
      console.log('[Admin Deploy] Loading LP Locker deployment config...');
      const lpLockerAddress = lpLockerDeployment.lpLocker;
      console.log('[Admin Deploy] LP Locker address from config:', lpLockerAddress);

      if (lpLockerAddress && lpLockerAddress !== ethers.ZeroAddress) {
        console.log('[Admin Deploy] Setting LP Locker:', lpLockerAddress);

        const fairlaunchContract = new ethers.Contract(contractAddress, FairlaunchABI.abi, signer);

        const setLPLockerTx = await (fairlaunchContract as any).setLPLocker(lpLockerAddress);
        await setLPLockerTx.wait();

        console.log('[Admin Deploy] ✅ LP Locker configured:', setLPLockerTx.hash);
      } else {
        console.warn('[Admin Deploy] ⚠️ LP Locker not deployed yet - skipping configuration');
      }
    } catch (lpLockerError: any) {
      console.error('[Admin Deploy] ⚠️ Failed to set LP Locker:', lpLockerError.message);
      console.error('[Admin Deploy] Full error:', lpLockerError);
      console.error('[Admin Deploy] Deployment will continue, but finalization may fail!');
      // Don't throw - allow deployment to continue
    }

    // 12. Update projects table with factory metadata and SAFU badges
    const { error: updateProjectError } = await supabase
      .from('projects')
      .update({
        status: 'DEPLOYED',
        contract_address: contractAddress,
        deployment_tx_hash: receipt.hash,
        // ✅ Auto-grant SAFU badges for factory-deployed tokens
        factory_address: factoryAddress,
        template_version: 'v1.0',
        metadata: {
          ...(project.metadata || {}),
          security_badges: ['SAFU', 'SC_PASS'],
        },
        // verification_status removed - not in projects table
      })
      .eq('id', project.id);

    if (updateProjectError) {
      console.error('[Admin Deploy] Failed to update projects:', updateProjectError);
    }

    // 13. Update launch_rounds table
    const { error: updateRoundError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'DEPLOYED',
        contract_address: contractAddress,
        vesting_vault_address: vestingAddress, // Save vesting vault address
        deployed_at: new Date().toISOString(),
        deployment_tx_hash: receipt.hash,
        // admin_deployer_id removed - foreign key constraint issue
        verification_status: 'VERIFICATION_PENDING', // Will be updated by verification service
        vesting_verification_status: 'VERIFICATION_PENDING',
      })
      .eq('id', launchRoundId);

    if (updateRoundError) {
      console.error('[Admin Deploy] Failed to update launch_rounds:', updateRoundError);
    }

    console.log('[Admin Deploy] ✅ Database updated');

    // 14. Trigger auto-verification (non-blocking)
    console.log('[Admin Deploy] Triggering auto-verification...');

    // Build constructor args for Fairlaunch
    const fairlaunchArgs = [
      project.token_address, // projectToken
      '0x0000000000000000000000000000000000000000', // paymentToken (native)
      createParams.softcap.toString(), // softcap
      createParams.tokensForSale.toString(), // tokensForSale
      createParams.minContribution.toString(), // minContribution
      createParams.maxContribution.toString(), // maxContribution
      Number(createParams.startTime), // startTime
      Number(createParams.endTime), // endTime
      Number(createParams.listingPremiumBps), // listingPremiumBps
      params.creator_wallet, // feeSplitter (temp: using creator wallet)
      vestingAddress, // teamVesting
      params.creator_wallet, // projectOwner
      factoryAddress, // adminExecutor
      Number(lpPlan.liquidityPercent), // liquidityPercent
      Number(lpPlan.lockMonths), // lpLockMonths
      lpPlan.dexId, // dexId
    ];

    // Trigger Fairlaunch verification
    fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/internal/verify-contract`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress,
          contractType: 'fairlaunch',
          launchRoundId,
          constructorArgs: fairlaunchArgs,
          chainId: 97, // BSC Testnet
        }),
      }
    ).catch((err) => {
      console.error('[Admin Deploy] Failed to trigger Fairlaunch verification:', err);
    });

    // Build constructor args for Vesting
    const vestingArgs = [
      vestingParams.beneficiary, // beneficiary
      vestingParams.startTime.toString(), // startTime - convert to string
      vestingParams.durations.map((d: any) => d.toString()), // durations array - convert all to string
      vestingParams.amounts.map((a: any) => a.toString()), // amounts array - convert all to string
    ];

    // Trigger Vesting verification
    fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/internal/verify-contract`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress: vestingAddress,
          contractType: 'vesting',
          launchRoundId,
          constructorArgs: vestingArgs,
          chainId: 97,
        }),
      }
    ).catch((err) => {
      console.error('[Admin Deploy] Failed to trigger Vesting verification:', err);
    });

    console.log('[Admin Deploy] ✅ Verification requests sent');

    // 15. Return success
    return NextResponse.json({
      success: true,
      projectId: project.id,
      launchRoundId,
      contractAddress,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber.toString(), // Convert BigInt to string
      status: 'DEPLOYED',
      verified: false, // Will be updated by verification process
    });
  } catch (error: any) {
    console.error('[Admin Deploy] Error:', error);
    return NextResponse.json(
      { error: 'Deployment failed', details: error.message },
      { status: 500 }
    );
  }
}
