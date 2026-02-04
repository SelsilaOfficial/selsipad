import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/feed/trending
 * Get trending hashtags from posts in the last 24 hours
 */
export async function GET() {
  try {
    const supabase = createClient();

    // Get all posts from last 24 hours with hashtags
    const { data: posts, error } = await supabase
      .from('posts')
      .select('hashtags, created_at, project_id')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .not('hashtags', 'is', null);

    if (error) {
      console.error('[Trending API] Error fetching posts:', error);
      return NextResponse.json({ trending: [] });
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ trending: [] });
    }

    // Count hashtag occurrences
    const hashtagCounts: Record<string, { count: number; projectIds: Set<string> }> = {};

    posts.forEach((post) => {
      if (post.hashtags) {
        post.hashtags.forEach((tag: string) => {
          if (!hashtagCounts[tag]) {
            hashtagCounts[tag] = { count: 0, projectIds: new Set() };
          }
          hashtagCounts[tag].count++;
          if (post.project_id) {
            hashtagCounts[tag].projectIds.add(post.project_id);
          }
        });
      }
    });

    // Convert to array and sort by count
    // Filter: Only show hashtags with >= 20 mentions (these become trending tokens)
    const trending = Object.entries(hashtagCounts)
      .map(([hashtag, data]) => ({
        hashtag,
        count: data.count,
        project_count: data.projectIds.size,
        score: data.count + data.projectIds.size * 2, // Weight projects higher
      }))
      .filter((item) => item.count >= 20) // TRENDING TOKEN THRESHOLD: 20+ posts
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Top 10 trending tokens
      .map((item, index) => ({
        rank: index + 1,
        hashtag: item.hashtag,
        post_count_24h: item.count,
        project_count: item.project_count,
        score: item.score,
      }));

    return NextResponse.json({ trending });
  } catch (error: any) {
    console.error('[Trending API] Error:', error);
    return NextResponse.json({ trending: [], error: error.message }, { status: 500 });
  }
}
