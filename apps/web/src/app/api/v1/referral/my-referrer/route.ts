import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUserId } from '@/lib/auth/require-admin';

/**
 * GET /api/v1/referral/my-referrer
 *
 * Returns the authenticated user's permanent referrer wallet address.
 * Used by ParticipationForm to ensure referral is preserved across projects,
 * even when user navigates directly without a ?ref= URL parameter.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json({ referrer: null });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find existing referral relationship where this user is the referee
    const { data: relationship } = await supabase
      .from('referral_relationships')
      .select('referrer_id, code')
      .eq('referee_id', userId)
      .limit(1)
      .single();

    if (!relationship) {
      return NextResponse.json({ referrer: null });
    }

    // Get the referrer's wallet address
    const { data: wallet } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', relationship.referrer_id)
      .limit(1)
      .single();

    if (!wallet?.address) {
      return NextResponse.json({ referrer: null });
    }

    return NextResponse.json({
      referrer: wallet.address,
      code: relationship.code,
    });
  } catch {
    return NextResponse.json({ referrer: null });
  }
}
