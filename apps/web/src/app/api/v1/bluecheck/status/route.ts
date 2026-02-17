/**
 * GET /api/v1/bluecheck/status
 * Check user's Blue Check status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile Blue Check status
    const { data: profile } = await supabase
      .from('profiles')
      .select('bluecheck_status')
      .eq('user_id', user.id)
      .single();

    // Get purchase history
    const { data: purchases } = await supabase
      .from('bluecheck_purchases')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      has_bluecheck: profile?.bluecheck_status === 'ACTIVE',
      status: profile?.bluecheck_status || null,
      purchase_history: purchases || [],
    });
  } catch (error) {
    console.error('Error in GET /api/v1/bluecheck/status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
