/**
 * POST /api/admin/fairlaunch/deploy
 *
 * Admin-controlled deployment via FairlaunchFactory (v12.5)
 * v11 Hybrid Admin-Controlled Deployment Model
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import FairlaunchFactoryABI from '@/../../packages/contracts/artifacts/contracts/fairlaunch/FairlaunchFactory.sol/FairlaunchFactory.json';
import EscrowVaultABI from '@/../../packages/contracts/artifacts/contracts/escrow/EscrowVault.sol/EscrowVault.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FACTORY_ADDRESSES = {
  bsc_testnet:
    process.env.NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_TESTNET ||
    '0x9c01770816C81D4c356DBD6335839Ba65e33d7e8',
  bnb: process.env.NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_MAINNET,
};

const ESCROW_VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_TOKEN_ESCROW_BSC_TESTNET || '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F'; // Must match submit API!

export async function POST(request: NextRequest) {
  try {
    // 1. Check admin authentication
    const { getServerSession } = await import('@/lib/auth/session');
    const session = await getServerSession();

    console.log('[Admin Deploy] Session check:', {
      hasSession: !!session,
      userId: session?.userId,
      address: session?.address,
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.userId)
      .single();

    console.log('[Admin Deploy] Profile check:', {
      userId: session.userId,
      found: !!profile,
      isAdmin: profile?.is_admin,
      error: profileError,
    });

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    console.log('[Admin Deploy] ✅ Admin authenticated:', session.userId);

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

    // 5. Validate status (should be APPROVED_TO_DEPLOY after admin approval)
    if (!['APPROVED', 'SUBMITTED', 'APPROVED_TO_DEPLOY'].includes(launchRound.status)) {
      return NextResponse.json(
        {
          error: `Invalid status: ${launchRound.status}. Must be APPROVED, SUBMITTED, or APPROVED_TO_DEPLOY.`,
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
    const deployerKey = process.env.ADMIN_DEPLOYER_PRIVATE_KEY;

    if (!deployerKey) {
      throw new Error('ADMIN_DEPLOYER_PRIVATE_KEY not configured');
    }

    const signer = new ethers.Wallet(deployerKey, provider);
    console.log('[Admin Deploy] Deployer wallet:', signer.address);

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

    const factoryAddress = (
      chainId === 97 ? FACTORY_ADDRESSES.bsc_testnet : FACTORY_ADDRESSES.bnb
    ) as string;

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
    const createParams = {
      projectToken: project.token_address,
      paymentToken: ethers.ZeroAddress, // Native BNB
      softcap: ethers.parseEther(params.softcap.toString()),
      tokensForSale: ethers.parseUnits(params.tokens_for_sale.toString(), 18),
      minContribution: ethers.parseEther((params.min_contribution || '0.1').toString()),
      maxContribution: ethers.parseEther((params.max_contribution || '10').toString()),
      startTime: BigInt(Math.floor(new Date(launchRound.start_at).getTime() / 1000)),
      endTime: BigInt(Math.floor(new Date(launchRound.end_at).getTime() / 1000)),
      projectOwner: project.creator_wallet,
      listingPremiumBps: BigInt(params.listing_premium_bps || 0), // 0 = fair launch price
    };

    // Tuple 2: TeamVestingParams
    const vestingParams = {
      beneficiary: params.vesting_address || project.creator_wallet,
      startTime: BigInt(Math.floor(new Date(launchRound.end_at).getTime() / 1000)), // After fairlaunch ends
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

    // 9. Deploy via factory (with 3 separate tuples + deployment fee)
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

    // 12. Update projects table
    const { error: updateProjectError } = await supabase
      .from('projects')
      .update({
        status: 'DEPLOYED',
        contract_address: contractAddress,
        deployment_tx_hash: receipt.hash,
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
