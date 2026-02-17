import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { isAdmin: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Step 1: Get user_id from wallets table
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('user_id')
      .eq('address', walletAddress)
      .single();

    if (walletError || !wallet) {
      console.log('[Admin Check] Wallet not found:', walletAddress);
      return NextResponse.json({ isAdmin: false });
    }

    // Step 2: Check is_admin from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', wallet.user_id)
      .single();

    if (profileError || !profile) {
      console.log('[Admin Check] Profile not found for user_id:', wallet.user_id);
      return NextResponse.json({ isAdmin: false });
    }

    const isAdmin = profile.is_admin === true;

    console.log('[Admin Check] Result:', {
      wallet: walletAddress,
      user_id: wallet.user_id,
      isAdmin,
    });

    return NextResponse.json({ isAdmin });
  } catch (error) {
    console.error('[Admin Check] Error:', error);
    return NextResponse.json({ isAdmin: false, error: 'Internal server error' }, { status: 500 });
  }
}
