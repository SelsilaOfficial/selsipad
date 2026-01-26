import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/feed/follow/[userId]
 * Follow a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: targetUserId } = params;

    // Can't follow yourself
    if (session.userId === targetUserId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    const supabase = createClient();

    // Check if already following
    const { data: existing } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', session.userId)
      .eq('following_id', targetUserId)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Already following this user' }, { status: 400 });
    }

    // Create follow relationship
    const { error } = await supabase.from('user_follows').insert({
      follower_id: session.userId,
      following_id: targetUserId,
    });

    if (error) {
      console.error('[Follow API] Error creating follow:', error);
      return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 });
    }

    return NextResponse.json({ success: true, following: true });
  } catch (error: any) {
    console.error('[Follow API] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/feed/follow/[userId]
 * Unfollow a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: targetUserId } = params;
    const supabase = createClient();

    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', session.userId)
      .eq('following_id', targetUserId);

    if (error) {
      console.error('[Follow API] Error deleting follow:', error);
      return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 });
    }

    return NextResponse.json({ success: true, following: false });
  } catch (error: any) {
    console.error('[Follow API] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/feed/follow/[userId]
 * Check if current user is following target user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ following: false });
    }

    const { userId: targetUserId } = params;
    const supabase = createClient();

    const { data } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', session.userId)
      .eq('following_id', targetUserId)
      .single();

    return NextResponse.json({ following: !!data });
  } catch (error: any) {
    console.error('[Follow API] GET error:', error);
    return NextResponse.json({ following: false });
  }
}
