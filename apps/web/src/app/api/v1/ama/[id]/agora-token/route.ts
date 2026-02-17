import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { createClient } from '@supabase/supabase-js';

/**
 * Generate Agora RTC Token for Voice/Video AMA
 * POST /api/v1/ama/[id]/agora-token
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const amaId = params.id;

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE!;

    if (!appId || !appCertificate) {
      return NextResponse.json({ error: 'Agora credentials not configured' }, { status: 500 });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify AMA exists and is LIVE
    const { data: ama, error: amaError } = await supabase
      .from('ama_requests')
      .select('id, status, type, developer_id')
      .eq('id', amaId)
      .single();

    if (amaError || !ama) {
      return NextResponse.json({ error: 'AMA not found' }, { status: 404 });
    }

    if (ama.status !== 'LIVE') {
      return NextResponse.json({ error: 'AMA is not live' }, { status: 400 });
    }

    if (ama.type === 'TEXT') {
      return NextResponse.json({ error: 'This AMA does not support voice/video' }, { status: 400 });
    }

    // Generate token
    const channelName = `ama-${amaId}`;
    const uid = Math.floor(Math.random() * 100000);
    const role = RtcRole.PUBLISHER; // All users get publisher so they can unmute if needed
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    console.log('[Agora Token] Generated for AMA:', amaId, 'Channel:', channelName, 'UID:', uid);

    return NextResponse.json({
      token,
      channelName,
      uid,
      appId,
      expiresAt: privilegeExpiredTs,
      role: 'publisher',
    });
  } catch (error) {
    console.error('[Agora Token API] Error:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
