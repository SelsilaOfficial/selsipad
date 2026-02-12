import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateContributionConfirm, PoolValidationError } from '@selsipad/shared';
import { getAuthUserId } from '@/lib/auth/require-admin';
import { ethers } from 'ethers';
import { recordContribution } from '@/actions/referral/record-contribution';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RPC_BY_CHAIN: Record<string, string> = {
  '97': process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
  '56': process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
};

/**
 * Verify tx receipt on chain: status 1, to === roundAddress, value/calldata consistent with contribute.
 * Returns { ok: true } or { ok: false, error: string }.
 */
async function verifyContributeReceipt(
  chain: string,
  txHash: string,
  roundAddress: string,
  expectedAmountWei: bigint,
  expectedReferral: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rpcUrl = RPC_BY_CHAIN[chain];
  if (!rpcUrl) {
    return { ok: false, error: `Unsupported chain for receipt verification: ${chain}` };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    return { ok: false, error: 'Transaction not found or not yet mined' };
  }

  if (receipt.status !== 1) {
    return { ok: false, error: 'Transaction reverted or failed' };
  }

  const roundAddrLower = roundAddress.toLowerCase();
  if (receipt.to?.toLowerCase() !== roundAddrLower) {
    return {
      ok: false,
      error: `Transaction target is not the round contract (expected ${roundAddress})`,
    };
  }

  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    return { ok: false, error: 'Transaction details not found' };
  }

  if (tx.to?.toLowerCase() !== roundAddrLower) {
    return { ok: false, error: 'Transaction was not sent to the round contract' };
  }

  const valueWei = tx.value ?? 0n;
  if (valueWei < expectedAmountWei) {
    return {
      ok: false,
      error: `Transaction value ${valueWei.toString()} is less than expected ${expectedAmountWei.toString()}`,
    };
  }

  return { ok: true };
}

/**
 * POST /api/rounds/[id]/contribute/confirm
 * Confirm contribution with transaction hash (step 2 of 2-step flow).
 * Verifies on-chain receipt before marking CONFIRMED.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    let userId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (!error && user) userId = user.id;
    }
    if (!userId) userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    let validatedData;
    try {
      validatedData = validateContributionConfirm(body);
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
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

    const roundAddress = round.round_address || round.contract_address;
    const chain = String(round.chain || '97');

    if (roundAddress && chain) {
      const amountWei = ethers.parseEther(String(validatedData.amount));
      const referral = (body.referral_address as string) || ethers.ZeroAddress;
      const verification = await verifyContributeReceipt(
        chain,
        validatedData.tx_hash,
        roundAddress,
        amountWei,
        referral
      );
      if (!verification.ok) {
        return NextResponse.json({ error: verification.error }, { status: 400 });
      }
    }

    const { data: existingTx } = await supabase
      .from('contributions')
      .select('id')
      .eq('chain', round.chain)
      .eq('tx_hash', validatedData.tx_hash)
      .maybeSingle();

    if (existingTx) {
      return NextResponse.json({ error: 'Transaction hash already recorded' }, { status: 409 });
    }

    const { data: pendingContribution } = await supabase
      .from('contributions')
      .select('*')
      .eq('round_id', roundId)
      .eq('user_id', userId)
      .eq('wallet_address', validatedData.wallet_address)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingContribution) {
      const { data: updated, error: updateError } = await supabase
        .from('contributions')
        .update({
          tx_hash: validatedData.tx_hash,
          status: 'CONFIRMED',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', pendingContribution.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating contribution:', updateError);
        return NextResponse.json({ error: 'Failed to confirm contribution' }, { status: 500 });
      }

      // ✅ Record for referral tracking on update path too
      if (userId) {
        try {
          await recordContribution({
            userId,
            sourceType: 'PRESALE',
            sourceId: roundId,
            amount: ethers.parseEther(String(validatedData.amount)).toString(),
            asset: round.raise_asset || 'NATIVE',
            chain,
            txHash: validatedData.tx_hash,
          });
        } catch (refErr) {
          console.error('[contribute/confirm] Referral tracking error (non-fatal):', refErr);
        }
      }

      return NextResponse.json({ contribution: updated });
    }

    const { data: newContribution, error: createError } = await supabase
      .from('contributions')
      .insert({
        round_id: roundId,
        user_id: userId,
        wallet_address: validatedData.wallet_address,
        amount: validatedData.amount,
        chain: round.chain,
        tx_hash: validatedData.tx_hash,
        status: 'CONFIRMED',
        confirmed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating contribution:', createError);
      return NextResponse.json({ error: 'Failed to record contribution' }, { status: 500 });
    }

    // ✅ Record for referral tracking (activate relationship + create fee splits)
    if (userId && newContribution) {
      try {
        await recordContribution({
          userId,
          sourceType: 'PRESALE',
          sourceId: roundId,
          amount: ethers.parseEther(String(validatedData.amount)).toString(),
          asset: round.raise_asset || 'NATIVE',
          chain,
          txHash: validatedData.tx_hash,
        });
      } catch (refErr) {
        console.error('[contribute/confirm] Referral tracking error (non-fatal):', refErr);
      }
    }

    return NextResponse.json({ contribution: newContribution });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
