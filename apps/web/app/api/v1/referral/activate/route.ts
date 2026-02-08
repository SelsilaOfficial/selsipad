/**
 * POST /api/v1/referral/activate
 * Link referee to referrer via code
 * Activation happens later when referee makes first qualifying event (worker)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';
import { validateReferralActivate } from '@selsipad/shared';
import type { ReferralActivateRequest } from '@selsipad/shared';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const userId = session.userId;

    const body = (await request.json()) as ReferralActivateRequest;

    const validation = validateReferralActivate(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Find referrer by code
    const { data: referrer } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('referral_code', body.code)
      .single();

    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    // Cannot refer yourself
    if (referrer.user_id === userId) {
      return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 });
    }

    // Check if relationship already exists
    const { data: existing } = await supabase
      .from('referral_relationships')
      .select('id')
      .eq('referee_id', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'You have already used a referral code' }, { status: 400 });
    }

    // Create relationship (activated_at will be set by worker)
    const { error: insertError } = await supabase.from('referral_relationships').insert({
      referrer_id: referrer.user_id,
      referee_id: userId,
      code: body.code,
      activated_at: null, // Will be set by worker on first qualifying event
    });

    if (insertError) {
      console.error('Error creating referral relationship:', insertError);
      return NextResponse.json({ error: 'Failed to activate referral' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Referral code applied successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/v1/referral/activate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
