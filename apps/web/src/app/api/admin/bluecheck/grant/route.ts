/**
 * Admin API: Grant Blue Check Manually
 *
 * Allows admins to grant Blue Check to users without payment
 * Use cases: partnerships, community managers, bug bounties, VIPs
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Parse request body
    const { target_user_id, reason } = await request.json();

    if (!target_user_id || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: target_user_id, reason' },
        { status: 400 }
      );
    }

    // Check if target user exists
    const { data: targetProfile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, bluecheck_status, username')
      .eq('user_id', target_user_id)
      .single();

    if (profileError || !targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user already has Blue Check
    if (targetProfile.bluecheck_status === 'ACTIVE') {
      return NextResponse.json({ error: 'User already has Blue Check' }, { status: 400 });
    }

    // Grant Blue Check
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        bluecheck_status: 'ACTIVE',
        bluecheck_purchased_at: new Date().toISOString(),
        bluecheck_grant_type: 'MANUAL_GRANT',
      })
      .eq('user_id', target_user_id);

    if (updateError) {
      console.error('Error granting Blue Check:', updateError);
      return NextResponse.json({ error: 'Failed to grant Blue Check' }, { status: 500 });
    }

    // Create audit log entry
    const { error: auditError } = await supabase.from('bluecheck_audit_log').insert({
      action_type: 'MANUAL_GRANT',
      target_user_id: target_user_id,
      admin_user_id: user.id,
      reason: reason,
      metadata: {
        username: targetProfile.username,
      },
    });

    if (auditError) {
      console.error('Error creating audit log:', auditError);
      // Don't fail the request if audit log fails, but log it
    }

    return NextResponse.json({
      success: true,
      message: `Blue Check granted to ${targetProfile.username}`,
      target_user_id,
    });
  } catch (error) {
    console.error('Error in grant Blue Check endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
