/**
 * AMA Session Detail, Update, Delete, Pay, Join Token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: session } = await supabase
      .from('ama_sessions')
      .select(
        `*, project:projects(id, name, logo_url), host:profiles!ama_sessions_host_id_fkey(user_id, username, avatar_url)`
      )
      .eq('id', params.id)
      .single();

    if (!session) return NextResponse.json({ error: 'AMA not found' }, { status: 404 });
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { data: session } = await supabase
      .from('ama_sessions')
      .select('*')
      .eq('id', params.id)
      .single();
    if (!session) return NextResponse.json({ error: 'AMA not found' }, { status: 404 });
    if (session.host_id !== user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (session.status === 'LIVE')
      return NextResponse.json({ error: 'Cannot update live AMA' }, { status: 400 });

    const { error: updateError } = await supabase
      .from('ama_sessions')
      .update(body)
      .eq('id', params.id);

    if (updateError) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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
    if (session.host_id !== user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await supabase.from('ama_sessions').update({ status: 'CANCELLED' }).eq('id', params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
