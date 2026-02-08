import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { type PresaleParams, type FairlaunchParams } from '@selsipad/shared';
import { requireAdmin } from '@/lib/auth/require-admin';
import { generateMerkleTree } from '@/lib/server/merkle/generate-tree';
import { ethers } from 'ethers';
import { PRESALE_ROUND_ABI } from '@/lib/web3/presale-contracts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RPC_BY_CHAIN: Record<string, string> = {
  '97': process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
  '56': process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
};

/**
 * POST /api/admin/rounds/[id]/finalize
 * Finalize an ended round. For PRESALE with on-chain deployment: generates merkle tree,
 * writes presale_merkle_proofs, calls PresaleRound.finalizeSuccess or finalizeFailed.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;
    const { userId } = adminResult;

    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key header required' }, { status: 400 });
    }

    const roundId = params.id;

    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (fetchError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    const allowedStatuses = ['ENDED', 'DEPLOYED'];
    if (!allowedStatuses.includes(round.status)) {
      return NextResponse.json(
        {
          error: `Can only finalize rounds with status ENDED or DEPLOYED (current: ${round.status})`,
        },
        { status: 400 }
      );
    }

    if (round.result !== 'NONE' && round.result !== null) {
      return NextResponse.json({ error: 'Round already finalized' }, { status: 400 });
    }

    const softcap =
      round.type === 'PRESALE'
        ? (round.params as PresaleParams).softcap
        : (round.params as FairlaunchParams).softcap;
    const totalRaised = Number(round.total_raised ?? 0);
    const result = totalRaised >= softcap ? 'SUCCESS' : 'FAILED';

    const roundAddress = round.round_address || round.contract_address;
    const vestingVaultAddress = round.vesting_vault_address;
    const scheduleSalt =
      round.schedule_salt || '0x0000000000000000000000000000000000000000000000000000000000000000';
    const chain = String(round.chain || '97');
    const chainId = parseInt(chain, 10) || 97;

    if (round.type === 'PRESALE' && roundAddress && vestingVaultAddress) {
      const adminPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
      if (!adminPrivateKey) {
        return NextResponse.json({ error: 'DEPLOYER_PRIVATE_KEY not configured' }, { status: 500 });
      }

      const rpcUrl = RPC_BY_CHAIN[chain];
      if (!rpcUrl) {
        return NextResponse.json(
          { error: `Unsupported chain for finalize: ${chain}` },
          { status: 400 }
        );
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const signer = new ethers.Wallet(adminPrivateKey, provider);
      const roundContract = new ethers.Contract(roundAddress, PRESALE_ROUND_ABI as any, signer);

      if (result === 'SUCCESS') {
        const { data: contributions } = await supabase
          .from('contributions')
          .select('user_id, wallet_address, amount')
          .eq('round_id', roundId)
          .eq('status', 'CONFIRMED');

        if (!contributions?.length) {
          return NextResponse.json(
            { error: 'No confirmed contributions for success finalization' },
            { status: 400 }
          );
        }

        const price = Number((round.params as PresaleParams).price) || 1;
        const decimals = 18;
        const allocations = contributions.map((c) => {
          const amountNum = Number(c.amount);
          const tokens = amountNum / price;
          const allocationWei = BigInt(Math.floor(tokens * 10 ** decimals));
          return {
            address: (c.wallet_address as string).toLowerCase(),
            allocation: allocationWei,
          };
        });

        const merkleData = generateMerkleTree(
          allocations,
          vestingVaultAddress,
          chainId,
          scheduleSalt
        );

        for (const alloc of allocations) {
          const proof = merkleData.proofsByWallet[alloc.address];
          await supabase.from('presale_merkle_proofs').upsert(
            {
              round_id: roundId,
              wallet_address: alloc.address,
              allocation: alloc.allocation.toString(),
              proof: proof || [],
            },
            { onConflict: 'round_id,wallet_address' }
          );
        }

        const tx = await (roundContract as any).finalizeSuccess(
          merkleData.root,
          merkleData.totalAllocation
        );
        const receipt = await tx.wait();

        const block = await provider.getBlock(receipt.blockNumber);
        const tgeTimestamp = block?.timestamp ?? Math.floor(Date.now() / 1000);

        await supabase
          .from('launch_rounds')
          .update({
            merkle_root: merkleData.root,
            tge_timestamp: tgeTimestamp,
            result: 'SUCCESS',
            status: 'SUCCESS',
            vesting_status: 'CONFIRMED',
            finalized_by: userId,
            finalized_at: new Date().toISOString(),
          })
          .eq('id', roundId);

        const roundAllocations = contributions.map((c) => {
          const amountNum = Number(c.amount);
          const tokens = amountNum / price;
          return {
            round_id: roundId,
            user_id: c.user_id,
            contributed_amount: amountNum,
            allocation_tokens: tokens,
            claimable_tokens: 0,
            refund_amount: 0,
            claim_status: 'PENDING',
            refund_status: 'NONE',
          };
        });
        await supabase
          .from('round_allocations')
          .upsert(roundAllocations, { onConflict: 'round_id,user_id' });

        return NextResponse.json({
          round_id: roundId,
          result: 'SUCCESS',
          tx_hash: receipt?.hash,
          merkle_root: merkleData.root,
          allocations_created: true,
        });
      }

      const reason = 'Soft cap not met';
      const tx = await (roundContract as any).finalizeFailed(reason);
      const failReceipt = await tx.wait();

      await supabase
        .from('launch_rounds')
        .update({
          result: 'FAILED',
          status: 'FAILED',
          finalized_by: userId,
          finalized_at: new Date().toISOString(),
        })
        .eq('id', roundId);

      const { data: failedContributions } = await supabase
        .from('contributions')
        .select('user_id, amount')
        .eq('round_id', roundId)
        .eq('status', 'CONFIRMED');

      if (failedContributions?.length) {
        const refunds = failedContributions.map((c) => ({
          round_id: roundId,
          user_id: c.user_id,
          amount: c.amount,
          status: 'PENDING',
          chain: round.chain,
        }));
        await supabase.from('refunds').insert(refunds);
      }

      return NextResponse.json({
        round_id: roundId,
        result: 'FAILED',
        tx_hash: failReceipt?.hash,
        refunds_created: true,
      });
    }

    const updates: Record<string, unknown> = {
      status: 'FINALIZED',
      result,
      finalized_by: userId,
      finalized_at: new Date().toISOString(),
    };

    let finalPrice: number | undefined;
    if (round.type === 'FAIRLAUNCH' && result === 'SUCCESS') {
      // DB may have either 'token_for_sale' or 'tokens_for_sale'
      const params = round.params as any;
      const tokensForSale = params.tokens_for_sale || params.token_for_sale || 0;
      finalPrice = tokensForSale > 0 ? totalRaised / tokensForSale : 0;
      updates.params = { ...round.params, final_price: finalPrice };
    }

    const { data: finalizedRound, error: updateError } = await supabase
      .from('launch_rounds')
      .update(updates)
      .eq('id', roundId)
      .select()
      .single();

    if (updateError) {
      console.error('Error finalizing round:', updateError);
      return NextResponse.json({ error: 'Failed to finalize round' }, { status: 500 });
    }

    if (result === 'SUCCESS') {
      const { data: contributions } = await supabase
        .from('contributions')
        .select('user_id, amount')
        .eq('round_id', roundId)
        .eq('status', 'CONFIRMED');

      if (contributions?.length) {
        const presaleParams = round.params as PresaleParams;
        const fairParams = round.params as FairlaunchParams;
        const allocations = contributions.map((c) => {
          const amountNum = Number(c.amount);
          let tokens = 0;
          if (round.type === 'PRESALE') {
            tokens = amountNum / presaleParams.price;
          } else {
            tokens = (amountNum / totalRaised) * fairParams.token_for_sale;
          }
          return {
            round_id: roundId,
            user_id: c.user_id,
            contributed_amount: amountNum,
            allocation_tokens: tokens,
            claimable_tokens: 0,
            refund_amount: 0,
            claim_status: 'PENDING',
            refund_status: 'NONE',
          };
        });
        await supabase.from('round_allocations').upsert(allocations);
      }
    }

    if (result === 'FAILED') {
      const { data: contributions } = await supabase
        .from('contributions')
        .select('user_id, amount')
        .eq('round_id', roundId)
        .eq('status', 'CONFIRMED');

      if (contributions?.length) {
        const refunds = contributions.map((c) => ({
          round_id: roundId,
          user_id: c.user_id,
          amount: c.amount,
          status: 'PENDING',
          chain: round.chain,
        }));
        await supabase.from('refunds').insert(refunds);
      }
    }

    return NextResponse.json({
      round: finalizedRound,
      result,
      allocations_created: result === 'SUCCESS',
      refunds_created: result === 'FAILED',
    });
  } catch (err: any) {
    console.error('Finalize error:', err);
    const message = err?.reason || err?.message || 'Finalization failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
