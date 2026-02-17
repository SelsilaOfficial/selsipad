import { NextResponse, type NextRequest } from 'next/server';
import { getSocialProfile, getUserPosts } from '@/lib/data/feedProfile';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const [profile, posts] = await Promise.all([
      getSocialProfile(userId),
      getUserPosts(userId, 30),
    ]);

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ profile, posts });
  } catch (error: any) {
    console.error('[Feed Profile API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
