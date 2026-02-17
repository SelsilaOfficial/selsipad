import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/webhooks/sc-scan
 * Webhook receiver for smart contract scan results
 * Called by external scan providers (CertiK, Hacken, etc.)
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // TODO: Validate webhook signature based on provider
    // For now, accept all requests (development only)

    const body = await request.json();
    const { scan_id, status, score, report_url, findings_summary } = body;

    if (!scan_id) {
      return NextResponse.json({ error: 'scan_id is required' }, { status: 400 });
    }

    // Update scan result
    const { error: updateError } = await supabase
      .from('sc_scan_results')
      .update({
        status,
        score,
        report_url,
        findings_summary,
        scan_completed_at: new Date().toISOString(),
      })
      .eq('id', scan_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating scan result:', updateError);
      return NextResponse.json({ error: 'Failed to update scan result' }, { status: 500 });
    }

    // Trigger function will auto-award badge if status is PASSED

    return NextResponse.json({
      success: true,
      message: 'Scan results received and processed',
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
