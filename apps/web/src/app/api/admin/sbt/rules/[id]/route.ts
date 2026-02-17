/**
 * PUT/DELETE /api/admin/sbt/rules/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Enforce Two-Man Rule: Create Action Request instead of direct update
    const { data: action, error: actionError } = await supabase
      .from('admin_actions')
      .insert({
        type: 'sbt_rule_update',
        payload: { rule_id: id, changes: body },
        requested_by: user.id,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
      })
      .select('id')
      .single();

    if (actionError) {
      console.error('Two-man rule error:', actionError);
      return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Update request submitted for approval',
        action_id: action.id,
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const supabase = createClient();

    const { error } = await supabase
      .from('sbt_rules')
      .delete() // Check constraints (if stakes exist, maybe soft delete/deactivate?)
      .eq('id', id);

    if (error) throw error; // Foreign key constraint might fail if stakes exist

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed (Rule might be in use)' }, { status: 500 });
  }
}
