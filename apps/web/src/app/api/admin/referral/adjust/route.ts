/**
 * POST /api/admin/referral/adjust
 * Manual referral reward adjustment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { referrer_id, amount, asset, chain, reason } = body;

    if (!referrer_id || !amount || !asset || !chain || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // TODO: Check admin role
    // TODO: Require Two-Man Rule approval (FASE 2)

    // Create manual adjustment ledger entry
    const { error: insertError } = await supabase.from('referral_ledger').insert({
      referrer_id,
      source_type: 'MANUAL_ADJUSTMENT',
      source_id: user.id, // Admin user ID as source
      amount,
      asset,
      chain,
      status: 'CLAIMABLE',
    });

    if (insertError) {
      console.error('Error creating adjustment:', insertError);
      return NextResponse.json({ error: 'Failed to create adjustment' }, { status: 500 });
    }

    // TODO: Audit log with reason
    console.log(
      `[Admin] Manual adjustment: ${amount} ${asset} on ${chain} for user ${referrer_id} by ${user.id}. Reason: ${reason}`
    );

    return NextResponse.json({ success: true, message: 'Manual adjustment applied' });
  } catch (error) {
    console.error('Error in POST /api/admin/referral/adjust:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
