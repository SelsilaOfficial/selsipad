/**
 * AMA Join Token Generation with TTL (5-15 min, one-time use, user-bound)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as crypto from 'crypto';

function generateJoinToken(amaId: string, userId: string, ttlMinutes: number = 10) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlMinutes * 60 * 1000);
  const payload = {
    ama_id: amaId,
    user_id: userId,
    expires_at: expiresAt.toISOString(),
    issued_at: issuedAt.toISOString(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.AMA_TOKEN_SECRET || 'change-me';
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return {
    token: `${payloadB64}.${signature}`,
    expires_at: expiresAt.toISOString(),
    expires_in_seconds: ttlMinutes * 60,
  };
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: session } = await supabase
      .from('ama_sessions')
      .select('*')
      .eq('id', params.id)
      .single();
    if (!session) return NextResponse.json({ error: 'AMA not found' }, { status: 404 });
    if (session.status !== 'LIVE')
      return NextResponse.json({ error: 'AMA is not live' }, { status: 400 });
    if (session.type === 'TEXT')
      return NextResponse.json({ error: 'Join token not needed for TEXT AMA' }, { status: 400 });

    const tokenData = generateJoinToken(params.id, user.id, 10);

    // Store token in database
    const { error: insertError } = await supabase.from('ama_join_tokens').insert({
      ama_id: params.id,
      user_id: user.id,
      token: tokenData.token,
      expires_at: tokenData.expires_at,
    });

    if (insertError) {
      console.error('Error storing join token:', insertError);
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
    }

    return NextResponse.json({
      token: tokenData.token,
      expires_at: tokenData.expires_at,
      expires_in_seconds: tokenData.expires_in_seconds,
      session: { id: session.id, title: session.title, type: session.type },
    });
  } catch (error) {
    console.error('Error in POST /api/v1/ama/[id]/join:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
