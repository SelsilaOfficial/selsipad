'use server';

/**
 * Admin action to verify Fairlaunch ecosystem contracts on BSCScan
 *
 * Called after admin deployment to automatically verify:
 * - Fairlaunch contract
 * - Token contract (if created via platform)
 * - TeamVesting contract (if team allocation exists)
 */

import { createClient } from '@/lib/supabase/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

interface VerifyContractsResult {
  success: boolean;
  fairlaunch?: {
    verified: boolean;
    url?: string;
    error?: string;
  };
  token?: {
    verified: boolean;
    url?: string;
    error?: string;
  };
  vesting?: {
    verified: boolean;
    url?: string;
    error?: string;
  };
  error?: string;
}

/**
 * Verify all contracts for a Fairlaunch round
 */
export async function verifyFairlaunchContracts(roundId: string): Promise<VerifyContractsResult> {
  try {
    const supabase = await createClient();

    // 1. Get round data with contract addresses
    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (fetchError || !round) {
      return {
        success: false,
        error: 'Fairlaunch round not found',
      };
    }

    // 2. Validate contracts exist
    if (!round.pool_address) {
      return {
        success: false,
        error: 'Fairlaunch contract not deployed yet',
      };
    }

    // 3. Call verification script
    const contractsPath = path.join(process.cwd(), '../../packages/contracts');
    const scriptPath = path.join(contractsPath, 'scripts/verify-fairlaunch-ecosystem.js');

    // Build environment variables for script
    const env = {
      ...process.env,
      FAIRLAUNCH_ADDRESS: round.pool_address,
      TOKEN_ADDRESS: round.token_address || '',
      VESTING_ADDRESS: round.vesting_address || '',
      NETWORK: round.network === 'bsc_testnet' ? 'bscTestnet' : round.network,
    };

    console.log('Starting contract verification...');
    console.log('Fairlaunch:', round.pool_address);
    console.log('Token:', round.token_address);
    console.log('Vesting:', round.vesting_address);

    // Execute verification script
    const { stdout, stderr } = await execAsync(
      `cd ${contractsPath} && npx hardhat run ${scriptPath} --network ${env.NETWORK}`,
      {
        env,
        timeout: 180000, // 3 minutes timeout
      }
    );

    console.log('Verification output:', stdout);
    if (stderr) {
      console.error('Verification stderr:', stderr);
    }

    // 4. Parse results from stdout
    // Script outputs "✅ Fairlaunch verified!", "✅ Token verified!", etc.
    const fairlaunchVerified =
      stdout.includes('✅ Fairlaunch verified') || stdout.includes('Fairlaunch already verified');
    const tokenVerified =
      stdout.includes('✅ Token verified') || stdout.includes('Token already verified');
    const vestingVerified =
      stdout.includes('✅ Vesting verified') || stdout.includes('Vesting already verified');

    // 5. Update database
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        fairlaunch_contract_verified: fairlaunchVerified,
        token_contract_verified: round.token_address ? tokenVerified : null,
        vesting_contract_verified: round.vesting_address ? vestingVerified : null,
        verified_at: fairlaunchVerified ? new Date().toISOString() : null,
      })
      .eq('id', roundId);

    if (updateError) {
      console.error('Failed to update verification status:', updateError);
    }

    // 6. Build result
    const baseUrl =
      round.network === 'bsc_testnet' ? 'https://testnet.bscscan.com' : 'https://bscscan.com';

    return {
      success: true,
      fairlaunch: {
        verified: fairlaunchVerified,
        url: `${baseUrl}/address/${round.pool_address}#code`,
      },
      token: round.token_address
        ? {
            verified: tokenVerified,
            url: `${baseUrl}/address/${round.token_address}#code`,
          }
        : undefined,
      vesting: round.vesting_address
        ? {
            verified: vestingVerified,
            url: `${baseUrl}/address/${round.vesting_address}#code`,
          }
        : undefined,
    };
  } catch (error: any) {
    console.error('verifyFairlaunchContracts error:', error);
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
}

/**
 * Check verification status for a round
 */
export async function getVerificationStatus(roundId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('launch_rounds')
      .select(
        'fairlaunch_contract_verified, token_contract_verified, vesting_contract_verified, verified_at, pool_address, token_address, vesting_address, network'
      )
      .eq('id', roundId)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: 'Round not found',
      };
    }

    const baseUrl =
      data.network === 'bsc_testnet' ? 'https://testnet.bscscan.com' : 'https://bscscan.com';

    return {
      success: true,
      fairlaunch: {
        verified: data.fairlaunch_contract_verified || false,
        url: data.pool_address ? `${baseUrl}/address/${data.pool_address}#code` : undefined,
      },
      token: data.token_address
        ? {
            verified: data.token_contract_verified || false,
            url: `${baseUrl}/address/${data.token_address}#code`,
          }
        : undefined,
      vesting: data.vesting_address
        ? {
            verified: data.vesting_contract_verified || false,
            url: `${baseUrl}/address/${data.vesting_address}#code`,
          }
        : undefined,
      verifiedAt: data.verified_at,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
