/**
 * POST /api/internal/verify-factory-token
 * 
 * Auto-verify factory-created SimpleToken contracts using Hardhat verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface VerifyRequest {
  tokenAddress: string;
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  ownerAddress: string;
  chainId: number;
}

// Map chainId to Hardhat network name
const NETWORK_NAMES: Record<number, string> = {
  97: 'bscTestnet',
  56: 'bsc',
};

export async function POST(request: NextRequest) {
  try {
    const {
      tokenAddress,
      name,
      symbol,
      totalSupply,
      decimals,
      ownerAddress,
      chainId,
    }: VerifyRequest = await request.json();

    console.log('[Factory Token Verification] Starting Hardhat verification:', {
      tokenAddress,
      name,
      symbol,
      chainId,
    });

    const network = NETWORK_NAMES[chainId];
    if (!network) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    // Build Hardhat verify command
    // Constructor args: name, symbol, totalSupply, decimals, owner
    const cmd = `cd packages/contracts && npx hardhat verify --network ${network} ${tokenAddress} "${name}" "${symbol}" "${totalSupply}" ${decimals} ${ownerAddress}`;

    console.log('[Factory Token Verification] Running Hardhat verify...');

    // Execute Hardhat verify (with timeout)
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 60000, // 60 second timeout
    });

    console.log('[Factory Token Verification] Hardhat output:', stdout);

    if (stderr && !stderr.includes('warning')) {
      console.error('[Factory Token Verification] ❌ Stderr:', stderr);
    }

    // Check if verification successful
    if (stdout.includes('Successfully verified') || stdout.includes('Already Verified')) {
      console.log('[Factory Token Verification] ✅ Success!');
      return NextResponse.json({
        success: true,
        message: 'Token verified successfully on BSCScan',
        output: stdout,
      });
    } else {
      console.error('[Factory Token Verification] ❌ Failed');
      return NextResponse.json(
        {
          success: false,
          error: 'Verification failed',
          output: stdout,
          stderr,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Factory Token Verification] ❌ Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
