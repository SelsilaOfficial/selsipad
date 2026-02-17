/**
 * Admin API: Restore Blue Check
 *
 * Allows admins to restore previously revoked Blue Check
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
    const { target_user_id } = await request.json();

    if (!target_user_id) {
      return NextResponse.json(
        { error: 'Missing required field: target_user_id' },
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

    if (targetProfile.bluecheck_status !== 'REVOKED') {
      return NextResponse.json(
        { error: 'User Blue Check is not in REVOKED state' },
        { status: 400 }
      );
    }

    // Restore Blue Check
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        bluecheck_status: 'ACTIVE',
      })
      .eq('user_id', target_user_id);

    if (updateError) {
      console.error('Error restoring Blue Check:', updateError);
      return NextResponse.json({ error: 'Failed to restore Blue Check' }, { status: 500 });
    }

    // Create audit log entry
    await supabase.from('bluecheck_audit_log').insert({
      action_type: 'RESTORE',
      target_user_id: target_user_id,
      admin_user_id: user.id,
      metadata: {
        username: targetProfile.username,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Blue Check restored for ${targetProfile.username}`,
      target_user_id,
    });
  } catch (error) {
    console.error('Error in restore Blue Check endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
