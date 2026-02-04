import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyContractWithRetry, getNetworkFromChainId } from '@/lib/verification/contract-verifier';
import { buildFairlaunchArgsFromDB, buildVestingArgsFromDB } from '@/lib/verification/args-builders';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes for verification

/**
 * Internal API route for contract verification
 * This route is called after contract deployment to trigger auto-verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractAddress, contractType, launchRoundId, projectId, constructorArgs, chainId } = body;

    console.log('[Verify API] Request:', { contractAddress, contractType, launchRoundId, projectId, chainId });

    // Validate required fields
    if (!contractAddress || !contractType) {
      return NextResponse.json(
        { error: 'Missing required fields: contractAddress, contractType' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Determine network
    const network = chainId ? getNetworkFromChainId(chainId) : 'bscTestnet';

    // Handle different contract types
    if (contractType === 'fairlaunch') {
      return await verifyFairlaunchContract(
        supabase,
        contractAddress,
        launchRoundId,
        constructorArgs,
        network
      );
    } else if (contractType === 'vesting') {
      return await verifyVestingContract(
        supabase,
        contractAddress,
        launchRoundId,
        constructorArgs,
        network
      );
    } else if (contractType === 'token') {
      return await verifyTokenContract(
        supabase,
        contractAddress,
        projectId,
        constructorArgs,
        network
      );
    } else {
      return NextResponse.json(
        { error: `Unsupported contract type: ${contractType}` },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[Verify API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

async function verifyFairlaunchContract(
  supabase: any,
  contractAddress: string,
  launchRoundId: string,
  constructorArgs: any[],
  network: string
) {
  console.log('[Verify API] Verifying Fairlaunch:', contractAddress);

  // Update status to VERIFICATION_QUEUED
  await supabase
    .from('launch_rounds')
    .update({ verification_status: 'VERIFICATION_QUEUED' })
    .eq('id', launchRoundId);

  // Execute verification
  const result = await verifyContractWithRetry({
    contractAddress,
    constructorArgs,
    network: network as any,
    contractPath: 'contracts/fairlaunch/Fairlaunch.sol:Fairlaunch',
  });

  // Update database with result
  const updates: any = {
    verification_status: result.status,
    verification_attempts: supabase.raw('verification_attempts + 1'),
  };

  if (result.success) {
    updates.verified_at = new Date().toISOString();
    updates.last_verification_error = null;
  } else {
    updates.last_verification_error = result.error || 'Verification failed';
  }

  await supabase
    .from('launch_rounds')
    .update(updates)
    .eq('id', launchRoundId);

  console.log('[Verify API] Fairlaunch verification result:', result.status);

  return NextResponse.json({
    success: result.success,
    status: result.status,
    contractAddress,
    message: result.success ? 'Contract verified successfully' : 'Verification failed',
    error: result.error,
  });
}

async function verifyVestingContract(
  supabase: any,
  contractAddress: string,
  launchRoundId: string,
  constructorArgs: any[],
  network: string
) {
  console.log('[Verify API] Verifying Vesting:', contractAddress);

  // Update status to VERIFICATION_QUEUED
  await supabase
    .from('launch_rounds')
    .update({ vesting_verification_status: 'VERIFICATION_QUEUED' })
    .eq('id', launchRoundId);

  // Execute verification
  const result = await verifyContractWithRetry({
    contractAddress,
    constructorArgs,
    network: network as any,
    contractPath: 'contracts/vesting/TeamVesting.sol:TeamVesting',
  });

  // Update database with result
  const updates: any = {
    vesting_verification_status: result.status,
  };

  if (result.success) {
    updates.vesting_verified_at = new Date().toISOString();
  }

  await supabase
    .from('launch_rounds')
    .update(updates)
    .eq('id', launchRoundId);

  console.log('[Verify API] Vesting verification result:', result.status);

  return NextResponse.json({
    success: result.success,
    status: result.status,
    contractAddress,
    message: result.success ? 'Vesting contract verified successfully' : 'Verification failed',
    error: result.error,
  });
}

async function verifyTokenContract(
  supabase: any,
  contractAddress: string,
  projectId: string,
  constructorArgs: any[],
  network: string
) {
  console.log('[Verify API] Verifying Token:', contractAddress);

  // Update status to VERIFYING
  await supabase
    .from('projects')
    .update({ token_verification_status: 'VERIFYING' })
    .eq('id', projectId);

  // Execute verification
  const result = await verifyContractWithRetry({
    contractAddress,
    constructorArgs,
    network: network as any,
    contractPath: 'contracts/token/StandardToken.sol:StandardToken',
  });

  // Update database with result
  const updates: any = {
    token_verification_status: result.status,
    token_verification_attempts: supabase.raw('token_verification_attempts + 1'),
  };

  if (result.success) {
    updates.token_verified_at = new Date().toISOString();
    updates.last_token_verification_error = null;
  } else {
    updates.last_token_verification_error = result.error || 'Verification failed';
  }

  await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId);

  console.log('[Verify API] Token verification result:', result.status);

  return NextResponse.json({
    success: result.success,
    status: result.status,
    contractAddress,
    message: result.success ? 'Token verified successfully' : 'Verification failed',
    error: result.error,
  });
}
