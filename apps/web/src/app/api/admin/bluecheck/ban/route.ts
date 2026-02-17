/**
 * Admin API: Ban User (Remove Blue Check + Prevent Posting)
 *
 * Allows admins/moderators to ban users completely
 * Removes Blue Check and marks user as banned
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createClient();

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
    const { target_user_id, reason, duration } = await request.json();

    if (!target_user_id || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: target_user_id, reason' },
        { status: 400 }
      );
    }

    // Get target user info
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('user_id, bluecheck_status, username, is_banned')
      .eq('user_id', target_user_id)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetProfile.is_banned) {
      return NextResponse.json({ error: 'User is already banned' }, { status: 400 });
    }

    // Calculate ban expiry if duration provided
    let bannedUntil = null;
    if (duration && duration > 0) {
      bannedUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(); // duration in days
    }

    // Ban user (remove Blue Check and set banned flag)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        bluecheck_status: 'BANNED',
        is_banned: true,
        banned_until: bannedUntil,
        ban_reason: reason,
      })
      .eq('user_id', target_user_id);

    if (updateError) {
      console.error('Error banning user:', updateError);
      return NextResponse.json({ error: 'Failed to ban user' }, { status: 500 });
    }

    // Create audit log entry
    await supabase.from('bluecheck_audit_log').insert({
      action_type: 'BAN',
      target_user_id: target_user_id,
      admin_user_id: user.id,
      reason: reason,
      metadata: {
        username: targetProfile.username,
        duration_days: duration,
        permanent: !duration,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${targetProfile.username} has been banned`,
      target_user_id,
      banned_until: bannedUntil,
    });
  } catch (error) {
    console.error('Error in ban user endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
