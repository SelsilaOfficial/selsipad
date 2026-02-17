import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, secret } = await request.json();

    // Simple protection - you can change this secret
    if (secret !== process.env.ADMIN_SETUP_SECRET) {
      return NextResponse.json(
        { error: 'Invalid secret. Set ADMIN_SETUP_SECRET in .env.local' },
        { status: 403 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Find or create user_id from wallets table
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('user_id')
      .eq('address', walletAddress)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        {
          error: 'Wallet not found in database',
          instruction: 'Please connect your wallet to the app first, then try again',
          walletAddress,
        },
        { status: 404 }
      );
    }

    // Step 2: Update is_admin flag in profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('user_id', wallet.user_id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to set admin flag', details: updateError },
        { status: 500 }
      );
    }

    // Step 3: Verify
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, user_id')
      .eq('user_id', wallet.user_id)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Admin access granted successfully',
      walletAddress,
      user_id: wallet.user_id,
      is_admin: profile?.is_admin,
    });
  } catch (error) {
    console.error('[Set Admin] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
