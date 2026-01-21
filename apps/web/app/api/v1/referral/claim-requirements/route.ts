import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * GET /api/v1/referral/claim-requirements
 *
 * Check if user meets referral claim requirements:
 * - Blue Check ACTIVE status
 * - At least 1 active referral
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();

    // Get user profile with requirements
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('bluecheck_status, active_referral_count')
      .eq('user_id', session.userId)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check requirements
    const blueCheckMet = profile.bluecheck_status === 'ACTIVE';
    const referralsMet = (profile.active_referral_count || 0) >= 1;
    const canClaim = blueCheckMet && referralsMet;

    // Determine blocked reason
    let blockedReason = null;
    if (!canClaim) {
      if (!blueCheckMet && !referralsMet) {
        blockedReason = 'Blue Check and 1 active referral required';
      } else if (!blueCheckMet) {
        blockedReason = 'Blue Check required';
      } else {
        blockedReason = 'At least 1 active referral required';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        canClaim,
        blockedReason,
        requirements: {
          blueCheck: {
            met: blueCheckMet,
            status: profile.bluecheck_status || 'NONE',
          },
          activeReferrals: {
            met: referralsMet,
            count: profile.active_referral_count || 0,
            required: 1,
          },
        },
      },
    });
  } catch (error: any) {
    console.error('Error checking claim requirements:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
