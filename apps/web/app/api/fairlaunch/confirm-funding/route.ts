
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ethers } from 'ethers';

// Helper to get non-public RPC URL if available
const getRpcUrl = () => {
  return process.env.BSC_TESTNET_RPC_URL || 
         process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL || 
         'https://data-seed-prebsc-1-s1.binance.org:8545';
};

export async function POST(request: NextRequest) {
  try {
    const { contractAddress, tokenAddress, requiredAmount } = await request.json();

    if (!contractAddress || !tokenAddress) {
      return NextResponse.json(
        { error: 'Missing contractAddress or tokenAddress' }, 
        { status: 400 }
      );
    }

    // 1. Verify on-chain balance
    const provider = new ethers.JsonRpcProvider(getRpcUrl());
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );

    const balance = await (tokenContract as any).balanceOf(contractAddress);
    // If requiredAmount is provided, check against it, otherwise assume > 0 is good enough for now
    
    if (balance <= 0n) {
       return NextResponse.json(
        { error: 'Contract has no token balance' }, 
        { status: 400 }
      );
    }

    // 2. Update Database
    const supabase = createClient();
    
    // Find the launch round
    const { data: launchRound, error: findError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('contract_address', contractAddress)
      .single();

    if (findError || !launchRound) {
       return NextResponse.json({ error: 'Launch round not found' }, { status: 404 });
    }

    // Update status
    const newParams = {
        ...launchRound.params,
        funding_state: 'FUNDED',
        funded_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'LIVE',
        deployment_status: 'FUNDED', // ✅ Update deployment status
        params: newParams
      })
      .eq('id', launchRound.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ success: true, status: 'LIVE' });

  } catch (error: any) {
    console.error('[ConfirmFunding] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
