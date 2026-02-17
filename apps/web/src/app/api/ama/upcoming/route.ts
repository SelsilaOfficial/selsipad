import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch upcoming/pinned/live AMAs, sorted by scheduled_at
    const { data: sessions, error } = await supabase
      .from('ama_requests')
      .select('id, project_name, description, scheduled_at, status, is_pinned')
      .in('status', ['PINNED', 'LIVE', 'PENDING'])
      .order('scheduled_at', { ascending: true })
      .limit(5);

    if (error) {
      console.error('Error fetching upcoming AMAs:', error);
      return NextResponse.json({ sessions: [] });
    }

    return NextResponse.json({ sessions: sessions || [] });
  } catch (error) {
    console.error('Error in /api/ama/upcoming:', error);
    return NextResponse.json({ sessions: [] });
  }
}
