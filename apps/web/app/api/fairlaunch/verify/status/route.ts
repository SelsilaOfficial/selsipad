/**
 * GET /api/fairlaunch/verify/status?contractAddress=0x...&chainId=97
 * 
 * Check verification status of a contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { BSCScanVerifierService } from '@/lib/fairlaunch/bscscan-verifier.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get('contractAddress');
    const chainId = parseInt(searchParams.get('chainId') || '97');

    if (!contractAddress) {
      return NextResponse.json({ error: 'contractAddress is required' }, { status: 400 });
    }

    const verifier = new BSCScanVerifierService(chainId);
    const isVerified = await verifier.isVerified(contractAddress);

    return NextResponse.json({
      contractAddress,
      chainId,
      verified: isVerified,
      explorerUrl: getExplorerUrl(chainId, contractAddress),
    });
  } catch (error: any) {
    console.error('Error checking verification status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check verification status',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

function getExplorerUrl(chainId: number, address: string): string {
  const urls: Record<number, string> = {
    97: `https://testnet.bscscan.com/address/${address}#code`,
    56: `https://bscscan.com/address/${address}#code`,
    11155111: `https://sepolia.etherscan.io/address/${address}#code`,
    1: `https://etherscan.io/address/${address}#code`,
    84532: `https://sepolia.basescan.org/address/${address}#code`,
    8453: `https://basescan.org/address/${address}#code`,
  };

  return urls[chainId] || '';
}
