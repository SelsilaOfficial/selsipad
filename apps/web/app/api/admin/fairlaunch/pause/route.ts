/**
 * POST /api/admin/fairlaunch/pause
 * 
 * Admin-only endpoint to pause a live fairlaunch project
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_WALLETS = (process.env.ADMIN_WALLET_ADDRESSES || '').split(',').map(a => a.toLowerCase());

export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin authentication
    const { getServerSession } = await import('@/lib/auth/session');
    const session = await getServerSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminWallet = session.address.toLowerCase();
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.userId)
      .single();

    if (!profile?.is_admin && !ADMIN_WALLETS.includes(adminWallet)) {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // 2. Get request params
    const { projectId, reason } = await request.json();

    if (!projectId || !reason) {
      return NextResponse.json(
        { error: 'Project ID and reason required' },
        { status: 400 }
      );
    }

    // 3. Verify project is LIVE
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, status, name')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status !== 'LIVE') {
      return NextResponse.json(
        { error: `Cannot pause project with status: ${project.status}` },
        { status: 400 }
      );
    }

    // 4. Update status to PAUSED
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'PAUSED',
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('[Admin Pause] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to pause project' }, { status: 500 });
    }

    // 5. Update launch round with pause info
    await supabase
      .from('launch_rounds')
      .update({
        paused_at: new Date().toISOString(),
        pause_reason: reason,
      })
      .eq('project_id', projectId);

    console.log('[Admin Pause] ✅ Project paused:', {
      projectId,
      projectName: project.name,
      reason,
      admin: session.userId,
    });

    return NextResponse.json({
      success: true,
      projectId,
      status: 'PAUSED',
      message: 'Project paused successfully',
    });

  } catch (error: any) {
    console.error('[Admin Pause] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
