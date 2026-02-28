import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createClient } from '@/lib/supabase/server';
import { getDeployerPrivateKey } from '@/lib/web3/deployer-wallet';

const FairlaunchABI = {
  abi: [
    'function setLPLocker(address _lpLocker) external',
    'function lpLockerAddress() view returns (address)',
    'function hasRole(bytes32 role, address account) view returns (bool)',
  ],
};

const FactoryABI = ['function adminExecutor() view returns (address)'];

const FACTORY_ADDRESSES: Record<string, string> = {
  '97':
    process.env.NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_TESTNET ||
    '0xa6dE6Ebd3E0ED5AcbE9c07B59C738C610821e175',
  '56': process.env.NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_MAINNET || '',
  '11155111':
    process.env.NEXT_PUBLIC_FAIRLAUNCH_FACTORY_SEPOLIA ||
    '0xdc13D871057838C1e9b0226C3bC2cd2d9636b272',
  '84532':
    process.env.NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BASE_SEPOLIA ||
    '0xce329E6d7415999160bB6f47133b552a91C915a0',
};

/** LP Locker addresses per chain */
const LP_LOCKER_ADDRESSES: Record<string, string> = {
  '97': '0xc1B619737d5F11490868D9A96025f864d7441532', // BSC Testnet — real LPLocker deployed 2026-02-15
  '56': '', // BSC Mainnet — TBD
  '11155111': '0x151f010682D2991183E6235CA396c1c99cEF5A30', // Sepolia
  '84532': '0xaAbC564820edFc8A3Ce4Dd0547e6f4455731DB7a', // Base Sepolia
};

/** RPC URLs per chain */
function getRpcUrl(chain: string): string {
  const rpcs: Record<string, string | undefined> = {
    '97': process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    '56': process.env.BSC_MAINNET_RPC_URL,
    '11155111': process.env.ETH_SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    '84532': process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  };
  return rpcs[chain] || rpcs['97']!;
}

const ADMIN_ROLE = ethers.id('ADMIN_ROLE');

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    console.log('[Setup LP Locker] Starting LP Locker configuration...');

    const { roundId, contractAddress } = await req.json();

    if (!roundId || !contractAddress) {
      return NextResponse.json({ error: 'Missing roundId or contractAddress' }, { status: 400 });
    }

    console.log('[Setup LP Locker] Round ID:', roundId);
    console.log('[Setup LP Locker] Contract:', contractAddress);

    // Get chain for this round (needed for factory address and RPC)
    const supabase = await createClient();
    const { data: round } = await supabase
      .from('launch_rounds')
      .select('chain')
      .eq('id', roundId)
      .single();
    const rawChain = (round?.chain ?? '97').toString();
    const chain =
      rawChain === 'bsc-testnet'
        ? '97'
        : rawChain === 'bsc' || rawChain === 'bnb'
          ? '56'
          : rawChain;

    // Get LP Locker address for this chain
    const lpLockerAddress = LP_LOCKER_ADDRESSES[chain];
    console.log('[Setup LP Locker] LP Locker address:', lpLockerAddress, 'for chain:', chain);

    if (!lpLockerAddress || lpLockerAddress === ethers.ZeroAddress) {
      return NextResponse.json(
        { error: `LP Locker not deployed for chain ${chain}` },
        { status: 500 }
      );
    }

    const rpcUrl = getRpcUrl(chain);
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // CRITICAL: Per-network deployer key must be the factory's adminExecutor
    const chainId = parseInt(chain) || 97;
    const adminPrivateKey = getDeployerPrivateKey(chainId);

    const signer = new ethers.Wallet(adminPrivateKey, provider);
    console.log('[Setup LP Locker] Admin wallet:', signer.address);

    // Connect to contract
    const fairlaunchContract = new ethers.Contract(contractAddress, FairlaunchABI.abi, signer);

    // Check if admin has ADMIN_ROLE
    const hasAdminRole = await fairlaunchContract.hasRole!(ADMIN_ROLE, signer.address);
    console.log('[Setup LP Locker] Has ADMIN_ROLE:', hasAdminRole);

    if (!hasAdminRole) {
      // Help user: Fairlaunch gets ADMIN_ROLE only for the factory's adminExecutor at creation time
      let hint = 'Admin wallet does not have ADMIN_ROLE on this contract.';
      try {
        const factoryAddress = FACTORY_ADDRESSES[chain];
        if (factoryAddress) {
          const factory = new ethers.Contract(factoryAddress, FactoryABI, provider);
          const adminExecutor = await factory.adminExecutor?.();
          const expected =
            typeof adminExecutor === 'string'
              ? adminExecutor
              : (adminExecutor?.toString?.() ?? null);
          if (expected) {
            hint = `Your wallet (${signer.address}) is not the factory's adminExecutor. Only the wallet that was set as admin when the factory was deployed can call setLPLocker. Factory adminExecutor: ${expected}. Set DEPLOYER_PRIVATE_KEY in .env to that wallet's private key and try again.`;
            console.log('[Setup LP Locker] Factory adminExecutor:', expected);
          }
        }
      } catch (e) {
        console.warn('[Setup LP Locker] Could not read factory adminExecutor:', e);
      }
      return NextResponse.json({ error: hint }, { status: 403 });
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

    // Update database (supabase already created above for round fetch)
    const { error: dbError } = await supabase
      .from('launch_rounds')
      .update({
        deployment_status: 'READY',
        updated_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    if (dbError) {
      console.error('[Setup LP Locker] Database update failed:', dbError);
    } else {
      console.log('[Setup LP Locker] ✅ Database updated to READY');
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
