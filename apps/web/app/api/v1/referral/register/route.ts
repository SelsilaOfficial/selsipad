/**
 * POST /api/v1/referral/register
 * Generate unique referral code for user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';

function generateReferralCode(userId: string): string {
  const userHash = userId.substring(0, 4).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${userHash}${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const userId = session.userId;

    // Check if user already has a referral code in profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('user_id', userId)
      .single();

    if (profile?.referral_code) {
      return NextResponse.json({
        code: profile.referral_code,
        referral_link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://selsipad.com'}?ref=${profile.referral_code}`,
      });
    }

    // Generate unique code
    let code = generateReferralCode(userId);
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('referral_code', code)
        .maybeSingle();

      if (!existing) break;

      code = generateReferralCode(userId);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
    }

    // Update profile with code
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ referral_code: code })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating profile with referral code:', updateError);
      return NextResponse.json({ error: 'Failed to save referral code' }, { status: 500 });
    }

    return NextResponse.json({
      code,
      referral_link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://selsipad.com'}?ref=${code}`,
    });
  } catch (error) {
    console.error('Error in POST /api/v1/referral/register:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
