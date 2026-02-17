/**
 * POST /api/admin/moderation/users/[id]/unban
 * Unban user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TODO: Check admin role

    await supabase.from('profiles').update({ status: 'ACTIVE' }).eq('user_id', params.id);

    // TODO: Audit log
    console.log(`[Admin] User ${params.id} unbanned by ${user.id}`);

    return NextResponse.json({ success: true, message: 'User unbanned' });
  } catch (error) {
    console.error('Error in POST /api/admin/moderation/users/[id]/unban:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
