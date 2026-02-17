/**
 * AMA Session CRUD: Create, List, Get, Update, Delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCreateAMA } from '@selsipad/shared';
import type { CreateAMARequest } from '@selsipad/shared';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as CreateAMARequest;
    const validation = validateCreateAMA(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Verify project exists and user is owner
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', body.project_id)
      .single();

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only project owner can create AMA' }, { status: 403 });
    }

    const { data: session, error: insertError } = await supabase
      .from('ama_sessions')
      .insert({
        project_id: body.project_id,
        host_id: user.id,
        title: body.title,
        description: body.description || null,
        type: body.type,
        scheduled_at: body.scheduled_at,
        status: 'SUBMITTED',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create AMA', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/v1/ama:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const projectId = searchParams.get('project_id');

    let query = supabase
      .from('ama_sessions')
      .select(
        `
        *,
        project:projects(id, name, logo_url),
        host:profiles!ama_sessions_host_id_fkey(user_id, username, avatar_url)
      `
      )
      .order('scheduled_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (projectId) query = query.eq('project_id', projectId);

    const { data: sessions } = await query;
    return NextResponse.json({ sessions: sessions || [] });
  } catch (error) {
    console.error('Error in GET /api/v1/ama:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
