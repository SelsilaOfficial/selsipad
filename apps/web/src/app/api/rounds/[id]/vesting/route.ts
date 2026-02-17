import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds/[id]/vesting
 * Get vesting schedule details (public)
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get vesting schedule
    const { data: schedule, error } = await supabase
      .from('vesting_schedules')
      .select('*')
      .eq('round_id', params.id)
      .single();

    if (error || !schedule) {
      return NextResponse.json({ error: 'Vesting schedule not found' }, { status: 404 });
    }

    // Get round for context
    const { data: round } = await supabase
      .from('launch_rounds')
      .select('status, result, finalized_at')
      .eq('id', params.id)
      .single();

    return NextResponse.json({
      schedule,
      round: round || null,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
