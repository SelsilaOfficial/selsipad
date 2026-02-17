/**
 * Admin API: Revoke Blue Check
 *
 * Allows admins/moderators to revoke Blue Check from users
 * Status changes to 'REVOKED' (can be restored later)
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

    // Check if user is admin or moderator
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin, is_moderator')
      .eq('user_id', user.id)
      .single();

    if (!adminProfile?.is_admin && !adminProfile?.is_moderator) {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Moderator access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const { target_user_id, reason } = await request.json();

    if (!target_user_id || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: target_user_id, reason' },
        { status: 400 }
      );
    }

    // Get target user info
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('user_id, bluecheck_status, username')
      .eq('user_id', target_user_id)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetProfile.bluecheck_status !== 'ACTIVE') {
      return NextResponse.json({ error: 'User does not have active Blue Check' }, { status: 400 });
    }

    // Revoke Blue Check
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        bluecheck_status: 'REVOKED',
      })
      .eq('user_id', target_user_id);

    if (updateError) {
      console.error('Error revoking Blue Check:', updateError);
      return NextResponse.json({ error: 'Failed to revoke Blue Check' }, { status: 500 });
    }

    // Create audit log entry
    await supabase.from('bluecheck_audit_log').insert({
      action_type: 'REVOKE',
      target_user_id: target_user_id,
      admin_user_id: user.id,
      reason: reason,
      metadata: {
        username: targetProfile.username,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Blue Check revoked from ${targetProfile.username}`,
      target_user_id,
    });
  } catch (error) {
    console.error('Error in revoke Blue Check endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
