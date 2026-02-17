/**
 * Admin Moderation: Delete posts, ban users, revoke Blue Check
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TODO: Check if user is admin (FASE 2 integration)

    const { data: post } = await supabase.from('posts').select('*').eq('id', params.id).single();
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
      .eq('id', params.id);

    // TODO: Audit log
    return NextResponse.json({ success: true, message: 'Post deleted by admin' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
