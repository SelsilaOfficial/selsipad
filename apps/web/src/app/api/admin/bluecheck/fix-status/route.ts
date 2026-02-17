/**
 * Manual fix for Blue Check status
 * Run this from the admin panel or via API
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createServiceRoleClient();

    const { wallet_address } = await request.json();

    if (!wallet_address) {
      return NextResponse.json({ error: 'wallet_address required' }, { status: 400 });
    }

    console.log('🔍 Checking wallet:', wallet_address);

    // Get wallet - use user_id column (not profile_id)
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('user_id, address, chain')
      .ilike('address', wallet_address)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: 'Wallet not found', details: walletError },
        { status: 404 }
      );
    }

    console.log('✅ Wallet found:', wallet);

    // Get current profile status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, username, bluecheck_status')
      .eq('user_id', wallet.user_id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Profile not found', details: profileError },
        { status: 404 }
      );
    }

    console.log('📋 Current status:', profile);

    if (profile.bluecheck_status === 'ACTIVE') {
      return NextResponse.json({
        success: true,
        message: 'Blue Check already ACTIVE',
        profile,
      });
    }

    // Update to ACTIVE
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        bluecheck_status: 'ACTIVE',
      })
      .eq('user_id', wallet.user_id)
      .select('user_id, username, bluecheck_status');

    if (updateError) {
      return NextResponse.json({ error: 'Update failed', details: updateError }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Blue Check activated!',
      before: profile,
      after: updated,
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
