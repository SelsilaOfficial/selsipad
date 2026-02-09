'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';
import { ethers } from 'ethers';
import { revalidatePath } from 'next/cache';

// PresaleFactory ABI — only createPresale function
const FACTORY_ABI = [
  {
    name: 'createPresale',
    type: 'function',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'projectToken', type: 'address' },
          { name: 'paymentToken', type: 'address' },
          { name: 'softCap', type: 'uint256' },
          { name: 'hardCap', type: 'uint256' },
          { name: 'minContribution', type: 'uint256' },
          { name: 'maxContribution', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'projectOwner', type: 'address' },
        ],
      },
      {
        name: 'vestingParams',
        type: 'tuple',
        components: [
          { name: 'tgeUnlockBps', type: 'uint256' },
          { name: 'cliffDuration', type: 'uint256' },
          { name: 'vestingDuration', type: 'uint256' },
        ],
      },
      {
        name: 'lpPlan',
        type: 'tuple',
        components: [
          { name: 'lockMonths', type: 'uint256' },
          { name: 'dexId', type: 'bytes32' },
          { name: 'liquidityPercent', type: 'uint256' },
        ],
      },
      { name: 'complianceHash', type: 'bytes32' },
    ],
    outputs: [
      { name: 'round', type: 'address' },
      { name: 'vesting', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
] as const;

// Factory addresses per chain
const FACTORY_ADDRESSES: Record<string, string> = {
  '97': '0xf3935d541A4F8fBED26c39f7E43625CE7b4d11E6', // BSC Testnet (v2.2 auto-burn)
};

const RPC_URLS: Record<string, string> = {
  '97': process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com',
  '56': process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
};

/**
 * Admin action to deploy a presale on-chain via PresaleFactory.
 * Status flow: APPROVED → DEPLOYED
 *
 * The factory deploys both the PresaleRound and MerkleVesting contracts
 * in a single transaction, then grants all necessary roles.
 */
export async function deployPresale(roundId: string) {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createServiceRoleClient();

    // Get round details
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select(
        'id, status, type, chain, token_address, start_at, end_at, params, created_by, project_id'
      )
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return { success: false, error: 'Round not found' };
    }

    if (round.type !== 'PRESALE') {
      return { success: false, error: 'Not a presale round' };
    }

    if (round.status !== 'APPROVED') {
      return { success: false, error: `Cannot deploy: current status is ${round.status}` };
    }

    // Get admin private key
    const adminPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!adminPrivateKey) {
      return { success: false, error: 'DEPLOYER_PRIVATE_KEY not configured' };
    }

    const chain = round.chain;
    const rpcUrl = RPC_URLS[chain];
    const factoryAddress = FACTORY_ADDRESSES[chain];

    if (!rpcUrl || !factoryAddress) {
      return { success: false, error: `Unsupported chain: ${chain}` };
    }

    // Get project owner wallet address
    // profiles table has no wallet_address — look up from wallets table or projects.creator_wallet
    let ownerWallet: string | null = null;

    // Primary: query wallets table for the EVM wallet
    const { data: walletRow } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', round.created_by)
      .eq('chain', 'evm')
      .single();

    if (walletRow?.address) {
      ownerWallet = walletRow.address;
    }

    // Fallback: projects.creator_wallet (stored during wizard submission)
    if (!ownerWallet && round.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('creator_wallet')
        .eq('id', round.project_id)
        .single();
      if (project?.creator_wallet) {
        ownerWallet = project.creator_wallet;
      }
    }

    if (!ownerWallet) {
      return { success: false, error: 'Project owner wallet not found' };
    }

    const params = round.params as any;

    // Prepare contract parameters
    const presaleParams = {
      projectToken: round.token_address,
      paymentToken: ethers.ZeroAddress, // NATIVE (BNB/ETH)
      softCap: ethers.parseEther(String(params.softcap)),
      hardCap: ethers.parseEther(String(params.hardcap)),
      minContribution: ethers.parseEther(String(params.min_contribution)),
      maxContribution: ethers.parseEther(String(params.max_contribution)),
      startTime: BigInt(Math.floor(new Date(round.start_at).getTime() / 1000)),
      endTime: BigInt(Math.floor(new Date(round.end_at).getTime() / 1000)),
      projectOwner: ownerWallet,
    };

    // Investor vesting params
    const investorVesting = params.investor_vesting || {};
    const tgeUnlockBps = BigInt(Math.floor((investorVesting.tge_percentage || 10) * 100)); // Convert percent to BPS
    const cliffDuration = BigInt((investorVesting.cliff_months || 0) * 30 * 24 * 3600); // months→seconds
    // Calculate vesting duration from the last month in the schedule
    const scheduleMonths = (investorVesting.schedule || []).map((s: any) => s.month || 0);
    const lastMonth = scheduleMonths.length > 0 ? Math.max(...scheduleMonths) : 6;
    const vestingDuration = BigInt(lastMonth * 30 * 24 * 3600); // months→seconds

    const vestingParams = {
      tgeUnlockBps,
      cliffDuration,
      vestingDuration,
    };

    // LP lock plan
    const lpLock = params.lp_lock || {};
    const lpPlan = {
      lockMonths: BigInt(lpLock.duration_months || 12),
      dexId: ethers.id(lpLock.dex || 'pancakeswap'), // keccak256("pancakeswap")
      liquidityPercent: BigInt((lpLock.percentage || 70) * 100), // percent→BPS
    };

    // Compliance hash (hash of the submission data)
    const complianceHash = ethers.id(
      JSON.stringify({
        roundId: round.id,
        submittedBy: round.created_by,
        timestamp: new Date().toISOString(),
      })
    );

    // Update status to deploying
    await supabase
      .from('launch_rounds')
      .update({
        status: 'DEPLOYING',
        deployment_status: 'IN_PROGRESS',
        admin_deployer_id: session.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    // Deploy via factory
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, adminWallet);

    console.log('[deployPresale] Deploying presale...', {
      chain,
      factoryAddress,
      tokenAddress: round.token_address,
      softCap: params.softcap,
      hardCap: params.hardcap,
    });

    const tx = await (factory as any).createPresale(
      presaleParams,
      vestingParams,
      lpPlan,
      complianceHash,
      { gasLimit: 5000000 }
    );

    console.log('[deployPresale] Tx sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('[deployPresale] Tx confirmed, block:', receipt.blockNumber);

    // Parse PresaleCreated event to get deployed addresses
    const iface = new ethers.Interface([
      'event PresaleCreated(uint256 indexed presaleId, address indexed round, address indexed vesting, bytes32 scheduleSalt, bytes32 complianceHash)',
    ]);

    let roundAddress = '';
    let vestingAddress = '';
    let scheduleSalt = '';

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed && parsed.name === 'PresaleCreated') {
          roundAddress = parsed.args[1]; // round address (indexed)
          vestingAddress = parsed.args[2]; // vesting address (indexed)
          scheduleSalt = parsed.args[3]; // scheduleSalt
          break;
        }
      } catch {
        continue;
      }
    }

    if (!roundAddress) {
      // Fallback: try to decode from non-indexed event args
      console.error('[deployPresale] Could not parse PresaleCreated event from logs');
      return {
        success: false,
        error: 'Contract deployed but could not parse event. Tx: ' + tx.hash,
      };
    }

    // Update DB with deployed contract details
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'DEPLOYED',
        deployment_status: 'DEPLOYED',
        contract_address: roundAddress,
        round_address: roundAddress,
        vesting_vault_address: vestingAddress,
        schedule_salt: scheduleSalt,
        deployment_tx_hash: tx.hash,
        deployment_block_number: receipt.blockNumber,
        deployer_address: adminWallet.address,
        deployed_at: new Date().toISOString(),
        chain_id: parseInt(chain),
        updated_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    if (updateError) {
      console.error('[deployPresale] DB update failed:', updateError);
      return {
        success: false,
        error: `Contract deployed but DB update failed. Round: ${roundAddress}, Vesting: ${vestingAddress}`,
      };
    }

    // Update project status
    if (round.project_id) {
      await supabase
        .from('projects')
        .update({ status: 'DEPLOYED', updated_at: new Date().toISOString() })
        .eq('id', round.project_id);
    }

    revalidatePath('/admin');

    return {
      success: true,
      roundAddress,
      vestingAddress,
      scheduleSalt,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error: any) {
    console.error('[deployPresale] Error:', error);

    // Revert deploying status on failure
    try {
      const supabase = createServiceRoleClient();
      await supabase
        .from('launch_rounds')
        .update({
          status: 'APPROVED',
          deployment_status: 'FAILED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', roundId);
    } catch {
      // swallow revert error
    }

    return { success: false, error: error.message || 'Failed to deploy presale' };
  }
}
