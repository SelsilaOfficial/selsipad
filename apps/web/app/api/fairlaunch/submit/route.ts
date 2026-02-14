/**
 * POST /api/fairlaunch/submit
 *
 * Submit a new Fairlaunch project with escrowed tokens
 * This replaces the old /deploy endpoint in the Hybrid Admin architecture
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  validateDeploymentParams,
  formatValidationErrors,
} from '@/lib/fairlaunch/deployment-validation';
import { ethers } from 'ethers';
import type { FairlaunchDeployParams } from '@/lib/fairlaunch/params-builder';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// EscrowVault contract address (from Phase 1 deployment)
const ESCROW_VAULT_ADDRESS = '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;
  let walletAddress: string | undefined;

  try {
    // 1. Authenticate user
    const { getServerSession } = await import('@/lib/auth/session');
    const session = await getServerSession();

    if (session) {
      userId = session.userId;
      walletAddress = session.address;
      console.log('[Submit API] Authenticated via session:', { userId, walletAddress });
    } else {
      const walletHeader = request.headers.get('x-wallet-address');
      if (walletHeader) {
        walletAddress = walletHeader;
        console.log('[Submit API] Using wallet-only auth:', walletAddress);
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const { escrowTxHash, creationFeeTxHash, ...deployParams } = body;

    if (!escrowTxHash || !creationFeeTxHash) {
      return NextResponse.json(
        { error: 'Missing escrow or creation fee transaction hash' },
        { status: 400 }
      );
    }

    const validation = validateDeploymentParams(deployParams);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error?.issues || []);
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const validatedParams = validation.data!;

    // 3. Verify escrow transaction on-chain
    console.log('[Submit API] Verifying escrow TX:', escrowTxHash);
    const provider = new ethers.JsonRpcProvider(
      validatedParams.chainId === 97
        ? process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545'
        : process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed1.binance.org'
    );

    const escrowTx = await provider.getTransaction(escrowTxHash);
    if (!escrowTx) {
      return NextResponse.json({ error: 'Escrow transaction not found' }, { status: 400 });
    }

    // Verify transaction is to EscrowVault
    if (escrowTx.to?.toLowerCase() !== ESCROW_VAULT_ADDRESS.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invalid escrow transaction: wrong recipient' },
        { status: 400 }
      );
    }

    // Get transaction receipt to ensure it was successful
    const escrowReceipt = await provider.getTransactionReceipt(escrowTxHash);
    if (!escrowReceipt || escrowReceipt.status !== 1) {
      return NextResponse.json({ error: 'Escrow transaction failed or pending' }, { status: 400 });
    }

    // 4. Verify creation fee payment
    console.log('[Submit API] Verifying creation fee TX:', creationFeeTxHash);
    const feeTx = await provider.getTransaction(creationFeeTxHash);
    if (!feeTx) {
      return NextResponse.json({ error: 'Creation fee transaction not found' }, { status: 400 });
    }

    const feeReceipt = await provider.getTransactionReceipt(creationFeeTxHash);
    if (!feeReceipt || feeReceipt.status !== 1) {
      return NextResponse.json(
        { error: 'Creation fee payment failed or pending' },
        { status: 400 }
      );
    }

    // Validate fee recipient and amount
    const TREASURY_ADDRESS =
      process.env.TREASURY_WALLET_ADDRESS || process.env.NEXT_PUBLIC_TREASURY_WALLET;
    if (!TREASURY_ADDRESS) {
      return NextResponse.json({ error: 'Treasury address not configured' }, { status: 500 });
    }

    if (feeTx.to?.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid fee payment: wrong recipient' }, { status: 400 });
    }

    // Validate fee amount (allow some tolerance for gas price fluctuation)
    const EXPECTED_FEE = ethers.parseEther('0.2'); // BSC Testnet fairlaunch fee
    if (feeTx.value < EXPECTED_FEE) {
      return NextResponse.json(
        { error: `Insufficient creation fee: expected ${ethers.formatEther(EXPECTED_FEE)} BNB` },
        { status: 400 }
      );
    }

    // 5. Create project in database with PENDING_DEPLOY status
    const projectId = crypto.randomUUID();
    const launchRoundId = crypto.randomUUID();

    // Insert project
    const { error: projectError } = await supabase.from('projects').insert({
      id: projectId,
      owner_user_id: userId,
      name: validatedParams.metadata?.name || 'Unnamed Fairlaunch',
      symbol: validatedParams.metadata?.symbol,
      description: validatedParams.metadata?.description,
      logo_url: validatedParams.metadata?.logoUrl,
      banner_url: validatedParams.metadata?.bannerUrl,
      website: validatedParams.metadata?.projectWebsite,
      telegram: validatedParams.metadata?.telegram,
      twitter: validatedParams.metadata?.twitter,
      discord: validatedParams.metadata?.discord, // ✅ Column added to DB
      type: 'FAIRLAUNCH',
      chain_id: validatedParams.chainId,
      token_address: validatedParams.projectToken,
      creator_wallet: validatedParams.creatorWallet,
      status: 'SUBMITTED',
      sc_scan_status: 'IDLE',
      kyc_status: 'NONE',
    });

    if (projectError) {
      console.error('[Submit API] Project creation error:', projectError);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    // Calculate token economics for database storage
    const tokensForSale = parseFloat(validatedParams.tokensForSale);
    const softcap = parseFloat(validatedParams.softcap);
    const liquidityPercent = validatedParams.liquidityPercent;
    const premiumBps = validatedParams.listingPremiumBps || 0;
    const teamVestingTokens = parseFloat(validatedParams.teamVestingTokens || '0');

    // CRITICAL: Factory contract calculates liquidity tokens as percentage of tokensForSale
    // NOT from raised funds! This matches the factory contract's createFairlaunch logic.
    const liquidityTokens = Math.ceil(tokensForSale * (liquidityPercent / 100));
    const totalEscrow = tokensForSale + liquidityTokens + teamVestingTokens;

    console.log('[Submit API] Token economics:', {
      tokensForSale,
      liquidityTokens,
      teamVestingTokens,
      totalEscrow,
    });

    // Insert launch round
    const { error: roundError } = await supabase.from('launch_rounds').insert({
      id: launchRoundId,
      project_id: projectId,
      type: 'FAIRLAUNCH',
      sale_type: 'fairlaunch', // Required for admin dashboard stats
      chain: validatedParams.chainId.toString(), // Must be numeric string or "SOLANA"
      chain_id: validatedParams.chainId,
      token_address: validatedParams.projectToken,
      raise_asset: 'NATIVE', // BNB for BSC
      start_at: new Date(validatedParams.startTime).toISOString(),
      end_at: new Date(validatedParams.endTime).toISOString(),
      status: 'SUBMITTED', // ← Set to SUBMITTED so admin can see it
      created_by: userId,
      params: {
        softcap: validatedParams.softcap,
        hardcap: null,
        min_contribution: validatedParams.minContribution,
        max_contribution: validatedParams.maxContribution,
        tokens_for_sale: validatedParams.tokensForSale,
        liquidity_tokens: liquidityTokens.toString(),
        team_vesting_tokens: teamVestingTokens.toString(),
        vesting_address: validatedParams.teamVestingAddress || null,
        vesting_schedule: validatedParams.vestingSchedule || null,
        liquidity_percent: validatedParams.liquidityPercent,
        lp_lock_months: validatedParams.lpLockMonths,
        listing_price_premium_bps: validatedParams.listingPremiumBps,
        dex_platform: validatedParams.dexPlatform,
        // Project display metadata
        project_name: validatedParams.metadata?.name,
        token_symbol: validatedParams.metadata?.symbol,
        project_description: validatedParams.metadata?.description,
        logo_url: validatedParams.metadata?.logoUrl,
        banner_url: validatedParams.metadata?.bannerUrl,
      },
      // Escrow tracking fields
      escrow_tx_hash: escrowTxHash,
      escrow_amount: totalEscrow.toString(),
      creation_fee_tx_hash: creationFeeTxHash,
      creation_fee_paid: feeTx.value.toString(),
    });

    if (roundError) {
      console.error('[Submit API] Launch round creation error:', roundError);
      // Rollback project
      await supabase.from('projects').delete().eq('id', projectId);
      return NextResponse.json({ error: 'Failed to create launch round' }, { status: 500 });
    }

    console.log('[Submit API] ✅ Project submitted successfully:', {
      projectId,
      launchRoundId,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      projectId,
      launchRoundId,
      status: 'PENDING_DEPLOY',
      message: 'Project submitted successfully. Awaiting admin deployment.',
    });
  } catch (error: any) {
    console.error('[Submit API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
