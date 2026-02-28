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
import { getAuthUserId } from '@/lib/auth/require-admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// EscrowVault contract addresses per chain
const ESCROW_VAULT_ADDRESSES: Record<number, string> = {
  97: '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F', // BSC Testnet
  56: '0x0000000000000000000000000000000000000000', // BSC Mainnet (TBD)
  11155111: process.env.NEXT_PUBLIC_ESCROW_VAULT_SEPOLIA || '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F',
  84532: process.env.NEXT_PUBLIC_ESCROW_VAULT_BASE_SEPOLIA || '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F',
  1: '0x0000000000000000000000000000000000000000', // Ethereum Mainnet (TBD)
  8453: '0x0000000000000000000000000000000000000000', // Base Mainnet (TBD)
};

// RPC URLs per chain
const RPC_URLS: Record<number, string> = {
  97: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
  56: process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed1.binance.org',
  11155111: process.env.ETH_SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
  84532: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  1: process.env.ETH_MAINNET_RPC_URL || 'https://eth.llamarpc.com',
  8453: process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
};

// Creation fees per chain (in native token)
const CREATION_FEES: Record<number, string> = {
  97: '0.2',      // 0.2 BNB
  56: '0.2',      // 0.2 BNB
  11155111: '0.1', // 0.1 ETH
  84532: '0.1',    // 0.1 ETH
  1: '0.1',        // 0.1 ETH
  8453: '0.1',     // 0.1 ETH
};

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate user (REQUIRED - matches presale pattern)
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to submit your project' },
        { status: 401 }
      );
    }

    // Get wallet address from session
    const { getServerSession } = await import('@/lib/auth/session');
    const session = await getServerSession();
    const walletAddress = session?.address;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required - Please connect your wallet' },
        { status: 400 }
      );
    }

    console.log('[Submit API] Authenticated submission:', { userId, walletAddress });

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
    const rpcUrl = RPC_URLS[validatedParams.chainId];
    if (!rpcUrl) {
      return NextResponse.json(
        { error: `Unsupported chain ID: ${validatedParams.chainId}` },
        { status: 400 }
      );
    }
    console.log(`[Submit API] Verifying escrow TX on chain ${validatedParams.chainId}:`, escrowTxHash);
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const escrowTx = await provider.getTransaction(escrowTxHash);
    if (!escrowTx) {
      return NextResponse.json({ error: `Escrow transaction not found on chain ${validatedParams.chainId}` }, { status: 400 });
    }

    // Verify transaction is to EscrowVault (per-chain)
    const escrowVaultAddress = ESCROW_VAULT_ADDRESSES[validatedParams.chainId];
    if (!escrowVaultAddress || escrowVaultAddress === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json(
        { error: `Escrow vault not configured for chain ${validatedParams.chainId}` },
        { status: 400 }
      );
    }
    if (escrowTx.to?.toLowerCase() !== escrowVaultAddress.toLowerCase()) {
      return NextResponse.json(
        { error: `Invalid escrow transaction: wrong recipient. Expected ${escrowVaultAddress}, got ${escrowTx.to}` },
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

    // Validate fee recipient — accept ANY known platform treasury address
    // (handles cases where fee was paid during earlier attempt with different chain config)
    const ALL_TREASURY_ADDRESSES = new Set(
      [
        process.env.BSC_TESTNET_TREASURY_WALLET,
        process.env.BSC_TREASURY_WALLET,
        process.env.ETH_SEPOLIA_TREASURY_WALLET,
        process.env.BASE_SEPOLIA_TREASURY_WALLET,
        process.env.ETH_TREASURY_WALLET,
        process.env.BASE_TREASURY_WALLET,
        process.env.TREASURY_WALLET_ADDRESS,
        process.env.PLATFORM_WALLET_ADDRESS,
      ]
        .filter(Boolean)
        .map((a) => a!.toLowerCase())
    );

    if (!ALL_TREASURY_ADDRESSES.has(feeTx.to?.toLowerCase() || '')) {
      console.log('[Submit API] Fee TX recipient:', feeTx.to);
      console.log('[Submit API] Known treasuries:', [...ALL_TREASURY_ADDRESSES]);
      return NextResponse.json({ error: 'Invalid fee payment: wrong recipient' }, { status: 400 });
    }

    // Validate fee amount (per-chain)
    const expectedFeeStr = CREATION_FEES[validatedParams.chainId] || '0.1';
    const nativeSymbol = [97, 56].includes(validatedParams.chainId) ? 'BNB' : 'ETH';
    const EXPECTED_FEE = ethers.parseEther(expectedFeeStr);
    if (feeTx.value < EXPECTED_FEE) {
      return NextResponse.json(
        { error: `Insufficient creation fee: expected ${ethers.formatEther(EXPECTED_FEE)} ${nativeSymbol}` },
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
