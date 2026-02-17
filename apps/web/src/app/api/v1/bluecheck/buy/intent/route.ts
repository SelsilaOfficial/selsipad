/**
 * POST /api/v1/bluecheck/buy/intent
 * Generate Blue Check purchase intent ($10 fixed price)
 * 10-minute expiry
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateBlueCheckBuyIntent } from '@selsipad/shared';
import type { BlueCheckBuyIntentRequest } from '@selsipad/shared';

const BLUECHECK_PRICE_USD = 10.0;
const INTENT_EXPIRY_MINUTES = 10;

// TODO: Get from price oracle or config
const MOCK_PRICES: Record<string, Record<string, { price: string; decimals: number }>> = {
  ethereum: {
    USDT: { price: '10000000', decimals: 6 }, // $10 in USDT (6 decimals)
    USDC: { price: '10000000', decimals: 6 },
  },
  bsc: {
    USDT: { price: '10000000000000000000', decimals: 18 }, // $10 in USDT (18 decimals)
    USDC: { price: '10000000000000000000', decimals: 18 },
  },
};

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
    const body = (await request.json()) as BlueCheckBuyIntentRequest;

    // Validate request
    const validation = validateBlueCheckBuyIntent(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Check if user already has Blue Check
    const { data: profile } = await supabase
      .from('profiles')
      .select('bluecheck_status')
      .eq('user_id', user.id)
      .single();

    if (profile?.bluecheck_status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Already have Blue Check', message: 'You already have an active Blue Check' },
        { status: 400 }
      );
    }

    // Check for existing pending purchase
    const { data: existingPurchase } = await supabase
      .from('bluecheck_purchases')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['INTENT', 'PENDING'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPurchase) {
      // Check if intent not expired
      const expiresAt = new Date(existingPurchase.intent_expires_at);
      if (expiresAt > new Date()) {
        // Return existing intent
        return NextResponse.json({
          purchase_id: existingPurchase.id,
          price_usd: existingPurchase.price_usd,
          payment_amount: existingPurchase.payment_amount,
          payment_chain: existingPurchase.payment_chain,
          payment_token: existingPurchase.payment_token,
          intent_expires_at: existingPurchase.intent_expires_at,
          payment_address: process.env.TREASURY_ADDRESS || '0x...', // TODO: Get from config
        });
      }
    }

    // Get payment amount in selected token
    const paymentData = MOCK_PRICES[body.payment_chain]?.[body.payment_token];
    if (!paymentData) {
      return NextResponse.json(
        {
          error: 'Unsupported payment method',
          message: `${body.payment_token} on ${body.payment_chain} is not supported`,
        },
        { status: 400 }
      );
    }

    // Calculate intent expiry
    const intentExpiresAt = new Date(Date.now() + INTENT_EXPIRY_MINUTES * 60 * 1000);

    // Create purchase intent
    const { data: purchase, error: insertError } = await supabase
      .from('bluecheck_purchases')
      .insert({
        user_id: user.id,
        price_usd: BLUECHECK_PRICE_USD,
        payment_chain: body.payment_chain,
        payment_token: body.payment_token,
        payment_amount: paymentData.price,
        status: 'INTENT',
        intent_expires_at: intentExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating purchase intent:', insertError);
      return NextResponse.json(
        { error: 'Failed to create purchase intent', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      purchase_id: purchase.id,
      price_usd: purchase.price_usd,
      payment_amount: purchase.payment_amount,
      payment_chain: purchase.payment_chain,
      payment_token: purchase.payment_token,
      intent_expires_at: purchase.intent_expires_at,
      payment_address: process.env.TREASURY_ADDRESS || '0x...', // TODO: Get from config
    });
  } catch (error) {
    console.error('Error in POST /api/v1/bluecheck/buy/intent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
