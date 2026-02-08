/**
 * POST /api/fairlaunch/deploy
 *
 * Deploy a new Fairlaunch contract directly (bypassing Factory)
 * This enables automatic contract verification on BSCScan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FairlaunchDeployerService } from '@/lib/fairlaunch/deployer.service';
import { verificationQueue } from '@/lib/fairlaunch/verification-queue.service';
import {
  validateDeploymentParams,
  formatValidationErrors,
} from '@/lib/fairlaunch/deployment-validation';
import { TokenApprovalChecker } from '@/lib/fairlaunch/token-approval-checker';
import { deploymentLogger } from '@/lib/fairlaunch/deployment-logger';
import type { FairlaunchDeployParams } from '@/lib/fairlaunch/params-builder';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;
  let walletAddress: string | undefined;

  try {
    // 1. Authenticate user - Use server session (simplest approach)
    const { getServerSession } = await import('@/lib/auth/session');
    const session = await getServerSession();

    if (session) {
      // ✅ Got session from cookie!
      userId = session.userId;
      walletAddress = session.address;
      console.log('[Deploy API] Authenticated via session cookie:', { userId, walletAddress });
    } else {
      // Fallback: Check headers
      const walletHeader = request.headers.get('x-wallet-address');
      if (walletHeader) {
        walletAddress = walletHeader;
        console.log('[Deploy API] Using wallet-only auth:', walletAddress);
      } else {
        return NextResponse.json(
          { error: 'Unauthorized: No session or wallet found' },
          { status: 401 }
        );
      }
    }

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // 2. Parse and validate request body
    const body = await request.json();

    const validation = validateDeploymentParams(body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error?.issues || []);
      deploymentLogger.logValidationFailure(userId || walletAddress || 'unknown', errors);

      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errors,
        },
        { status: 400 }
      );
    }

    const validatedParams = validation.data!;
    // Use validated params
    const deployParams: FairlaunchDeployParams = {
      projectToken: validatedParams.projectToken,
      softcap: validatedParams.softcap,
      tokensForSale: validatedParams.tokensForSale,
      tokenDecimals: validatedParams.tokenDecimals,
      minContribution: validatedParams.minContribution,
      maxContribution: validatedParams.maxContribution,
      startTime: validatedParams.startTime,
      endTime: validatedParams.endTime,
      liquidityPercent: validatedParams.liquidityPercent,
      lpLockMonths: validatedParams.lpLockMonths,
      dexPlatform: validatedParams.dexPlatform,
      listingPremiumBps: validatedParams.listingPremiumBps,
      teamVestingAddress: validatedParams.teamVestingAddress,
      creatorWallet: validatedParams.creatorWallet,
      chainId: validatedParams.chainId,
    };

    // 3. Validate creator wallet (Pattern 68: Wallet-Only Auth)
    // When using wallet-only auth, walletAddress from header is already validated
    console.log('[Deploy API] Creator wallet:', deployParams.creatorWallet);
    console.log('[Deploy API] Authenticated wallet:', walletAddress);

    // 4. Check token approval (balance check)
    deploymentLogger.info('Checking token approval', {
      userId,
      tokenAddress: deployParams.projectToken,
      tokensForSale: deployParams.tokensForSale,
    });

    const tokenChecker = new TokenApprovalChecker(deployParams.chainId);
    const approvalCheck = await tokenChecker.validateFairlaunchFunding(
      deployParams.projectToken,
      deployParams.creatorWallet,
      deployParams.tokensForSale,
      deployParams.tokenDecimals
    );

    if (!approvalCheck.isValid) {
      deploymentLogger.logTokenCheckResult(
        userId || walletAddress || 'unknown',
        deployParams.projectToken,
        false,
        approvalCheck.errors
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Token validation failed',
          details: approvalCheck.errors,
          tokenInfo: {
            symbol: approvalCheck.symbol,
            name: approvalCheck.name,
            balance: approvalCheck.balance.toString(),
            required: approvalCheck.requiredAmount.toString(),
          },
        },
        { status: 400 }
      );
    }

    deploymentLogger.logTokenCheckResult(
      userId || walletAddress || 'unknown',
      deployParams.projectToken,
      true
    );

    // 5. Deploy contract
    deploymentLogger.logDeploymentStart(
      userId || walletAddress || 'unknown',
      deployParams.chainId,
      deployParams.projectToken
    );

    const deployer = new FairlaunchDeployerService(deployParams.chainId);
    const result = await deployer.deploy(deployParams);

    if (!result.success) {
      deploymentLogger.logDeploymentFailure(
        userId || walletAddress || 'unknown',
        deployParams.chainId,
        new Error(result.error || 'Unknown deployment error')
      );

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Deployment failed',
        },
        { status: 500 }
      );
    }

    deploymentLogger.logDeploymentTransaction(
      userId || walletAddress || 'unknown',
      deployParams.chainId,
      result.txHash!,
      result.contractAddress!
    );

    // Helper: Convert BigInt to string for JSON serialization
    const serializeBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return obj.toString();
      if (Array.isArray(obj)) return obj.map(serializeBigInt);
      if (typeof obj === 'object') {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serializeBigInt(v)]));
      }
      return obj;
    };

    // 5. Save to database (Pattern: Project → Launch Round)
    const serializedBody = serializeBigInt(body);

    // 5a. Get user_id (UUID) - required for owner_user_id
    // userId from auth is already a UUID from profiles.user_id
    if (!userId) {
      return NextResponse.json({ error: 'User ID required for project creation' }, { status: 400 });
    }

    // 5b. Create project record first
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        owner_user_id: userId, // ✅ Must be UUID from profiles.user_id
        creator_id: userId, // ✅ Same as owner
        creator_wallet: walletAddress,
        name: serializedBody.projectName || `Fairlaunch ${serializedBody.tokenSymbol || 'Token'}`,
        symbol: serializedBody.tokenSymbol || null,
        description: serializedBody.description || null,
        logo_url: serializedBody.logoUrl || null,
        website: serializedBody.website || null,
        twitter: serializedBody.twitter || null,
        telegram: serializedBody.telegram || null,
        discord: serializedBody.discord || null,
        status: 'DEPLOYED', // Direct deployment via escrow
        submitted_at: new Date().toISOString(), // ✅ Auto-submitted
        approved_at: new Date().toISOString(), // ✅ Auto-approved (escrow model)
        contract_mode: 'LAUNCHPAD_TEMPLATE', // ✅ CHECK: LAUNCHPAD_TEMPLATE or EXTERNAL_CONTRACT
        contract_network: 'EVM', // ✅ CHECK: EVM or SOLANA
        chain_id: deployParams.chainId, // ✅ Numeric chain ID
        type: 'FAIRLAUNCH', // ✅ Project type
        token_address: deployParams.projectToken, // ✅ Token contract
        contract_address: result.contractAddress, // ✅ Fairlaunch contract
        deployment_tx_hash: result.txHash, // ✅ Deployment transaction
        chains_supported: [deployParams.chainId.toString()],
        kyc_status: 'NONE',
        sc_scan_status: 'PENDING', // Will be updated after GoPlus scan
      })
      .select()
      .single();

    if (projectError || !project) {
      deploymentLogger.logDatabaseOperation(
        'insert_project',
        false,
        undefined,
        new Error(projectError?.message || 'Project insert failed')
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create project record',
          details: projectError?.message || 'Unknown error',
        },
        { status: 500 }
      );
    }

    console.log('[Deploy API] Project created:', project.id);

    // 5c. Create launch_round with project_id
    const { data: launchRound, error: launchRoundError } = await supabase
      .from('launch_rounds')
      .insert({
        project_id: project.id, // ✅ Link to project
        type: 'FAIRLAUNCH',
        chain: deployParams.chainId.toString(),
        chain_id: deployParams.chainId, // ✅ Numeric chain ID
        token_address: deployParams.projectToken,
        raise_asset: 'NATIVE',
        status: 'DEPLOYED', // ✅ Contract deployed
        deployment_status: 'PENDING_FUNDING', // Track specific deployment state
        contract_address: result.contractAddress,
        round_address: result.contractAddress, // ✅ Same as contract_address
        created_by: userId,
        // ✅ Auto-approved for escrow deployments
        approved_by: userId,
        approved_at: new Date().toISOString(),
        // ✅ Deployment metadata (top-level columns)
        deployed_at: result.deployedAt.toISOString(),
        deployer_address: deployer.getDeployerAddress(),
        deployment_tx_hash: result.txHash,
        deployment_block_number: result.blockNumber,
        // ✅ Token & security metadata
        token_source: serializedBody.tokenSource || 'existing', // ✅ CHECK: factory or existing (lowercase)
        security_badges: serializedBody.securityBadges || [],
        fee_splitter_address: serializedBody.feeSplitterAddress || null,
        sale_type: 'fairlaunch',
        params: {
          // Original parameters (BigInt converted to strings)
          ...serializedBody,
          funding_state: 'PENDING_FUNDING', // Internal state for UI flow
          // Deployment metadata
          deployment_tx: result.txHash,
          deployment_block: result.blockNumber,
          deployed_at: result.deployedAt.toISOString(),
          deployer_address: deployer.getDeployerAddress(),
          gas_used: result.gasUsed?.toString(),
          verified: false, // Will be updated by verification worker
          creator_wallet: walletAddress,
          // Constructor args for verification
          constructor_args: serializeBigInt(result.constructorArgs),
        },
        start_at: deployParams.startTime.toISOString(),
        end_at: deployParams.endTime.toISOString(),
      })
      .select()
      .single();

    if (launchRoundError || !launchRound) {
      deploymentLogger.logDatabaseOperation(
        'insert_launch_round',
        false,
        undefined,
        new Error(launchRoundError?.message || 'Launch round insert failed')
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save deployment to database',
          details: launchRoundError?.message || 'Unknown error',
        },
        { status: 500 }
      );
    }

    deploymentLogger.logDatabaseOperation('insert', true, launchRound.id);

    // 6. Queue verification job
    const jobId = await verificationQueue.addJob(
      result.contractAddress,
      launchRound.id,
      deployParams.chainId,
      result.constructorArgs
    );

    deploymentLogger.logVerificationQueued(launchRound.id, result.contractAddress, jobId);

    // 7. Return success response
    const duration = Date.now() - startTime;
    deploymentLogger.logApiResponse(userId || walletAddress || 'unknown', 201, true, duration);

    return NextResponse.json(
      {
        success: true,
        launchRoundId: launchRound.id,
        contractAddress: result.contractAddress,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        deployerAddress: deployer.getDeployerAddress(),
        tokenInfo: {
          symbol: approvalCheck.symbol,
          balance: approvalCheck.balance.toString(),
          required: approvalCheck.requiredAmount.toString(),
        },
        nextStep: 'FUND_CONTRACT',
        message: 'Contract deployed successfully. Next: Send tokens to contract.',
      },
      { status: 201 }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;

    if (userId) {
      deploymentLogger.error('Unexpected error in deployment API', { userId }, error);
      deploymentLogger.logApiResponse(userId || walletAddress || 'unknown', 500, false, duration);
    } else {
      console.error('[DeploymentAPI] Unexpected error:', error);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fairlaunch/deploy?txHash=0x...
 *
 * Check deployment status by transaction hash
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txHash = searchParams.get('txHash');
    const chainId = parseInt(searchParams.get('chainId') || '97');

    if (!txHash) {
      return NextResponse.json({ error: 'txHash is required' }, { status: 400 });
    }

    const deployer = new FairlaunchDeployerService(chainId);
    const status = await deployer.getDeploymentStatus(txHash);

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Error checking deployment status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check deployment status',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
