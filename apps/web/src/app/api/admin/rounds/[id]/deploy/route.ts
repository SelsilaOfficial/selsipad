import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/require-admin';
import { CONTRACTS } from '@/lib/web3/presale-contracts';
import { ethers } from 'ethers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRESALE_FACTORY_ABI = [
  'function createPresale((address projectToken, address paymentToken, uint256 softCap, uint256 hardCap, uint256 minContribution, uint256 maxContribution, uint256 startTime, uint256 endTime, address projectOwner) params, (uint256 tgeUnlockBps, uint256 cliffDuration, uint256 vestingDuration) vestingParams, (uint256 lockMonths, bytes32 dexId, uint256 liquidityPercent) lpPlan, bytes32 complianceHash) returns (address round, address vesting)',
  'event PresaleCreated(uint256 indexed presaleId, address indexed round, address indexed vesting, bytes32 scheduleSalt, bytes32 complianceHash)',
];

/**
 * POST /api/admin/rounds/[id]/deploy
 * Deploy presale on-chain via PresaleFactory (BSC Testnet) and persist round/vesting addresses.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    const roundId = params.id;

    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (fetchError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    if (round.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Round must be in APPROVED status' }, { status: 400 });
    }

    if (round.type !== 'PRESALE') {
      return NextResponse.json(
        { error: 'Only PRESALE rounds can be deployed via this endpoint' },
        { status: 400 }
      );
    }

    const chain = String(round.chain || '97');
    if (chain !== '97') {
      return NextResponse.json(
        { error: 'Only BSC Testnet (chain 97) is supported for presale deploy' },
        { status: 400 }
      );
    }

    const p = round.params as Record<string, any>;
    const tokenAddress = (round.token_address || p?.token_address) as string;
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return NextResponse.json({ error: 'Invalid or missing token_address' }, { status: 400 });
    }

    const projectOwnerUserId = round.created_by;
    const { data: walletRow } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', projectOwnerUserId)
      .eq('chain', '97')
      .limit(1)
      .maybeSingle();

    const projectOwnerAddress = walletRow?.address;
    if (!projectOwnerAddress || !ethers.isAddress(projectOwnerAddress)) {
      return NextResponse.json(
        {
          error:
            'No BSC Testnet wallet found for round owner. Owner must link a wallet for chain 97.',
        },
        { status: 400 }
      );
    }

    const softCap = ethers.parseEther(String(p?.softcap ?? 0));
    const hardCap = ethers.parseEther(String(p?.hardcap ?? 0));
    const minContribution = ethers.parseEther(String(p?.min_contribution ?? 0));
    const maxContribution = ethers.parseEther(String(p?.max_contribution ?? 0));
    const startAt = round.start_at
      ? Math.floor(new Date(round.start_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    const endAt = round.end_at
      ? Math.floor(new Date(round.end_at).getTime() / 1000)
      : startAt + 7 * 24 * 3600;

    const paymentToken =
      round.raise_asset === 'NATIVE' || !round.raise_asset
        ? ethers.ZeroAddress
        : (round.raise_asset as string);
    if (paymentToken !== ethers.ZeroAddress && !ethers.isAddress(paymentToken)) {
      return NextResponse.json(
        { error: 'Invalid raise_asset (payment token) address' },
        { status: 400 }
      );
    }

    const investorVesting = p?.investor_vesting || {};
    const tgeBps = Math.min(10000, Math.round((investorVesting.tge_percentage ?? 0) * 100));
    const cliffMonths = investorVesting.cliff_months ?? 0;
    const cliffDuration = cliffMonths * 30 * 24 * 60 * 60;
    const vestingMonths = investorVesting.schedule?.length
      ? Math.max(...investorVesting.schedule.map((s: any) => s.months || 0))
      : 12;
    const vestingDuration = vestingMonths * 30 * 24 * 60 * 60;

    const lpLock = p?.lp_lock_plan || p?.lp_lock || {};
    const lockMonths = Math.max(12, lpLock.duration_months ?? lpLock.lockMonths ?? 12);
    const dexId = lpLock.dexId
      ? ethers.keccak256(ethers.toUtf8Bytes(lpLock.dexId))
      : ethers.id('PANCAKESWAP');
    const liquidityPercent = Math.min(10000, lpLock.liquidityPercent ?? lpLock.percentage ?? 7000);

    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!deployerPrivateKey) {
      return NextResponse.json({ error: 'DEPLOYER_PRIVATE_KEY not configured' }, { status: 500 });
    }

    const rpcUrl =
      process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(deployerPrivateKey, provider);

    const config = CONTRACTS.bsc_testnet;
    const factory = new ethers.Contract(config.factory, PRESALE_FACTORY_ABI, signer);

    const createParams = {
      projectToken: tokenAddress,
      paymentToken: paymentToken as `0x${string}`,
      softCap,
      hardCap,
      minContribution,
      maxContribution,
      startTime: BigInt(startAt),
      endTime: BigInt(endAt),
      projectOwner: projectOwnerAddress as `0x${string}`,
    };

    const vestingParams = {
      tgeUnlockBps: BigInt(tgeBps),
      cliffDuration: BigInt(cliffDuration),
      vestingDuration: BigInt(vestingDuration),
    };

    const lpPlan = {
      lockMonths: BigInt(lockMonths),
      dexId,
      liquidityPercent: BigInt(liquidityPercent),
    };

    const complianceHash = ethers.keccak256(ethers.toUtf8Bytes(roundId));

    if (typeof factory.createPresale !== 'function') {
      return NextResponse.json(
        { error: 'Factory contract missing createPresale function' },
        { status: 500 }
      );
    }
    const tx = await factory.createPresale(createParams, vestingParams, lpPlan, complianceHash);
    const receipt = await tx.wait();

    const iface = new ethers.Interface(PRESALE_FACTORY_ABI);
    const log = receipt?.logs?.find((l: { topics: string[] }) => {
      try {
        const parsed = iface.parseLog({ topics: l.topics as string[], data: (l as any).data });
        return parsed?.name === 'PresaleCreated';
      } catch {
        return false;
      }
    });

    if (!log) {
      return NextResponse.json(
        { error: 'PresaleCreated event not found in receipt' },
        { status: 500 }
      );
    }

    const parsed = iface.parseLog({ topics: log.topics as string[], data: (log as any).data });
    const roundAddress = parsed?.args?.round as string;
    const vestingAddress = parsed?.args?.vesting as string;
    const scheduleSaltBytes32 = parsed?.args?.scheduleSalt as string;
    const scheduleSalt = scheduleSaltBytes32; // keep 0x hex string for DB

    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        round_address: roundAddress,
        vesting_vault_address: vestingAddress,
        schedule_salt: scheduleSalt,
        contract_address: roundAddress,
        status: 'DEPLOYED',
        deployment_tx_hash: receipt?.hash ?? null,
        deployment_block_number: receipt?.blockNumber ?? null,
        deployer_address: signer.address,
        deployed_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    if (updateError) {
      console.error('Failed to update round after deploy:', updateError);
      return NextResponse.json(
        { error: 'Deployment succeeded but DB update failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      round_address: roundAddress,
      vesting_vault_address: vestingAddress,
      schedule_salt: scheduleSalt,
      tx_hash: receipt?.hash,
      status: 'DEPLOYED',
    });
  } catch (err: any) {
    console.error('Presale deploy error:', err);
    const message = err?.reason || err?.message || 'Deployment failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
