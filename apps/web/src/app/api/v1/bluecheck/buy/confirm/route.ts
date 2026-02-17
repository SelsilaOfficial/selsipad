/**
 * POST /api/v1/bluecheck/buy/confirm
 * Submit tx_hash to confirm Blue Check purchase
 * Worker will verify and activate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateBlueCheckBuyConfirm, calculateFeeSplit } from '@selsipad/shared';
import type { BlueCheckBuyConfirmRequest } from '@selsipad/shared';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = (await request.json()) as BlueCheckBuyConfirmRequest;

    // Validate request
    const validation = validateBlueCheckBuyConfirm(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Get purchase intent
    const { data: purchase, error: fetchError } = await supabase
      .from('bluecheck_purchases')
      .select('*')
      .eq('id', body.purchase_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !purchase) {
      return NextResponse.json({ error: 'Purchase intent not found' }, { status: 404 });
    }

    // Check status
    if (purchase.status !== 'INTENT') {
      return NextResponse.json(
        { error: 'Invalid status', message: `Purchase is already ${purchase.status}` },
        { status: 400 }
      );
    }

    // Check expiry
    const expiresAt = new Date(purchase.intent_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        {
          error: 'Intent expired',
          message: 'Purchase intent has expired. Please create a new intent',
        },
        { status: 410 }
      );
    }

    // Update purchase with tx_hash and status=PENDING
    const { error: updateError } = await supabase
      .from('bluecheck_purchases')
      .update({
        payment_tx_hash: body.tx_hash,
        status: 'PENDING',
      })
      .eq('id', body.purchase_id);

    if (updateError) {
      console.error('Error updating purchase:', updateError);
      return NextResponse.json(
        { error: 'Failed to update purchase', details: updateError.message },
        { status: 500 }
      );
    }

    // Create fee_split record (will be processed by worker after confirmation)
    // Calculate 70/30 split
    const totalAmount = BigInt(purchase.payment_amount);
    const { treasury_amount, referral_pool_amount } = calculateFeeSplit(totalAmount);

    const { error: feeSplitError } = await supabase.from('fee_splits').insert({
      source_type: 'BLUECHECK',
      source_id: purchase.id,
      total_amount: totalAmount.toString(),
      treasury_amount: treasury_amount.toString(),
      referral_pool_amount: referral_pool_amount.toString(),
      asset: purchase.payment_token,
      chain: purchase.payment_chain,
      processed: false,
    });

    if (feeSplitError) {
      console.error('Error creating fee split:', feeSplitError);
      // Non-fatal, continue
    }

    return NextResponse.json({
      success: true,
      purchase_id: body.purchase_id,
      status: 'PENDING',
      message:
        'Payment submitted. Your Blue Check will be activated once the transaction is confirmed.',
    });
  } catch (error) {
    console.error('Error in POST /api/v1/bluecheck/buy/confirm:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
