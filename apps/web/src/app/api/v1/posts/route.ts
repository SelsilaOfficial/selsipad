/**
 * POST /api/v1/posts
 * Create post with Blue Check gating (POST/REPLY/QUOTE/REPOST)
 *
 * CRITICAL: Only Blue Check ACTIVE users can create posts (RLS enforced)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCreatePost } from '@selsipad/shared';
import type { CreatePostRequest, PostWithAuthor } from '@selsipad/shared';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = (await request.json()) as CreatePostRequest;

    // Validate request
    const validation = validateCreatePost(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Get idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');

    // Check for existing post with same idempotency key (last 5 minutes)
    if (idempotencyKey) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data: existing } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', user.id)
        .eq('content', body.content)
        .gte('created_at', fiveMinutesAgo)
        .maybeSingle();

      if (existing) {
        // Return existing post
        return NextResponse.json({ post: existing }, { status: 200 });
      }
    }

    // CRITICAL: Blue Check gating check (server-side validation)
    // RLS will also enforce this at database level
    const { data: profile } = await supabase
      .from('profiles')
      .select('bluecheck_status')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.bluecheck_status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: 'Blue Check required',
          message: 'You must have an active Blue Check to create posts',
        },
        { status: 403 }
      );
    }

    // Validate project exists if project_id provided
    if (body.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('id', body.project_id)
        .single();

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    // Validate parent/quoted/reposted post exists
    if (body.parent_post_id) {
      const { data: parent } = await supabase
        .from('posts')
        .select('id')
        .eq('id', body.parent_post_id)
        .is('deleted_at', null)
        .single();

      if (!parent) {
        return NextResponse.json({ error: 'Parent post not found' }, { status: 404 });
      }
    }

    if (body.quoted_post_id) {
      const { data: quoted } = await supabase
        .from('posts')
        .select('id')
        .eq('id', body.quoted_post_id)
        .is('deleted_at', null)
        .single();

      if (!quoted) {
        return NextResponse.json({ error: 'Quoted post not found' }, { status: 404 });
      }
    }

    if (body.reposted_post_id) {
      const { data: reposted } = await supabase
        .from('posts')
        .select('id')
        .eq('id', body.reposted_post_id)
        .is('deleted_at', null)
        .single();

      if (!reposted) {
        return NextResponse.json({ error: 'Reposted post not found' }, { status: 404 });
      }
    }

    // Create post
    const { data: post, error: insertError } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        content: body.content,
        type: body.type,
        project_id: body.project_id || null,
        parent_post_id: body.parent_post_id || null,
        quoted_post_id: body.quoted_post_id || null,
        reposted_post_id: body.reposted_post_id || null,
      })
      .select(
        `
        *,
        author:profiles!posts_author_id_fkey(user_id, username, avatar_url, bluecheck_status),
        project:projects(id, name, logo_url)
      `
      )
      .single();

    if (insertError) {
      console.error('Error creating post:', insertError);

      // Check if it's RLS policy failure (Blue Check gating)
      if (insertError.code === '42501' || insertError.message.includes('policy')) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Blue Check required to create posts',
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create post', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/v1/posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
