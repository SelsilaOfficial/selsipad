import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createClient } from '@/lib/supabase/server';
import lpLockerDeployment from '@/../../packages/contracts/deployments/lplocker.json';

const FairlaunchABI = {
  abi: [
    'function setLPLocker(address _lpLocker) external',
    'function lpLockerAddress() view returns (address)',
    'function hasRole(bytes32 role, address account) view returns (bool)',
  ],
};

const ADMIN_ROLE = ethers.id('ADMIN_ROLE');

export async function POST(req: NextRequest) {
  try {
    console.log('[Setup LP Locker] Starting LP Locker configuration...');

    const { roundId, contractAddress } = await req.json();

    if (!roundId || !contractAddress) {
      return NextResponse.json({ error: 'Missing roundId or contractAddress' }, { status: 400 });
    }

    console.log('[Setup LP Locker] Round ID:', roundId);
    console.log('[Setup LP Locker] Contract:', contractAddress);

    // Get LP Locker address from deployment
    const lpLockerAddress = lpLockerDeployment.lpLocker;
    console.log('[Setup LP Locker] LP Locker address:', lpLockerAddress);

    if (!lpLockerAddress || lpLockerAddress === ethers.ZeroAddress) {
      return NextResponse.json({ error: 'LP Locker not deployed' }, { status: 500 });
    }

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL);
    // CRITICAL: Use DEPLOYER_PRIVATE_KEY (adminExecutor) which has ADMIN_ROLE from factory
    const adminPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

    if (!adminPrivateKey) {
      console.error('[Setup LP Locker] DEPLOYER_PRIVATE_KEY not configured');
      return NextResponse.json({ error: 'Admin wallet not configured' }, { status: 500 });
    }

    const signer = new ethers.Wallet(adminPrivateKey, provider);
    console.log('[Setup LP Locker] Admin wallet:', signer.address);

    // Connect to contract
    const fairlaunchContract = new ethers.Contract(contractAddress, FairlaunchABI.abi, signer);

    // Check if admin has ADMIN_ROLE
    const hasAdminRole = await fairlaunchContract.hasRole!(ADMIN_ROLE, signer.address);
    console.log('[Setup LP Locker] Has ADMIN_ROLE:', hasAdminRole);

    if (!hasAdminRole) {
      return NextResponse.json(
        { error: 'Admin wallet does not have ADMIN_ROLE on contract' },
        { status: 403 }
      );
    }

    // Check current LP Locker
    const currentLPLocker = await fairlaunchContract.lpLockerAddress!();
    console.log('[Setup LP Locker] Current LP Locker:', currentLPLocker);

    if (currentLPLocker !== ethers.ZeroAddress) {
      console.log('[Setup LP Locker] ✅ LP Locker already configured');
      return NextResponse.json({
        success: true,
        message: 'LP Locker already configured',
        lpLockerAddress: currentLPLocker,
      });
    }

    // Set LP Locker
    console.log('[Setup LP Locker] Setting LP Locker to:', lpLockerAddress);
    const setLPLockerTx = await fairlaunchContract.setLPLocker!(lpLockerAddress);
    console.log('[Setup LP Locker] Transaction sent:', setLPLockerTx.hash);

    const receipt = await setLPLockerTx.wait();
    console.log('[Setup LP Locker] ✅ Transaction confirmed in block:', receipt.blockNumber);

    // Update database
    const supabase = await createClient();
    const { error: dbError } = await supabase
      .from('launch_rounds')
      .update({
        deployment_status: 'READY_TO_FINALIZE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    if (dbError) {
      console.error('[Setup LP Locker] Database update failed:', dbError);
    } else {
      console.log('[Setup LP Locker] ✅ Database updated to READY_TO_FINALIZE');
    }

    return NextResponse.json({
      success: true,
      message: 'LP Locker configured successfully',
      lpLockerAddress,
      txHash: setLPLockerTx.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error: any) {
    console.error('[Setup LP Locker] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to setup LP Locker',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
