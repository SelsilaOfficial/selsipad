import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/v1/referral/resolve?code=XXXXXXXX
 *
 * Resolves a referral code to the referrer's wallet address for on-chain usage.
 * Returns the wallet address so the contribute() call can pass it to the contract.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find the profile that owns this referral code, then get their wallet address
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_id, referral_code')
    .eq('referral_code', code.toUpperCase())
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Referral code not found' }, { status: 404 });
  }

  // Get the wallet address from the wallets table
  const { data: wallet } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', profile.user_id)
    .limit(1)
    .single();

  if (!wallet?.address) {
    return NextResponse.json({ error: 'Referrer wallet not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    wallet_address: wallet.address,
  });
}
