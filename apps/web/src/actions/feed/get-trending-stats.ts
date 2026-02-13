'use server';

import { createClient } from '@/lib/supabase/server';

interface TrendingStatsResult {
  chartData: { value: number; label: string }[];
  topProject: {
    name: string;
    symbol: string;
    score: number;
    postCount: number;
  } | null;
  totalPosts24h: number;
  totalPosts7d: number;
}

/**
 * Get trending feed statistics for the homepage card.
 * - Chart data: daily post counts over the last 7 days
 * - Top project: highest-scoring project from trending_projects
 * - Activity totals: 24h and 7d post counts
 */
export async function getTrendingStats(): Promise<TrendingStatsResult> {
  try {
    const supabase = createClient();
    const now = new Date();

    // 1. Build chart data: daily post counts for the last 7 days
    const chartData: { value: number; label: string }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      chartData.push({
        value: count || 0,
        label: dayNames[dayStart.getDay()],
      });
    }

    // 2. Get top trending project from latest snapshot
    let topProject: TrendingStatsResult['topProject'] = null;

    const { data: snapshot } = await supabase
      .from('trending_snapshots')
      .select('id')
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    if (snapshot) {
      const { data: topTrending } = await supabase
        .from('trending_projects')
        .select(
          `
          score,
          post_count_24h,
          project:projects ( name, symbol )
        `
        )
        .eq('snapshot_id', snapshot.id)
        .order('rank', { ascending: true })
        .limit(1)
        .single();

      if (topTrending?.project) {
        const proj = topTrending.project as any;
        topProject = {
          name: proj.name || 'Unknown',
          symbol: proj.symbol || '---',
          score: topTrending.score || 0,
          postCount: topTrending.post_count_24h || 0,
        };
      }
    }

    // 3. If no snapshot data, fall back to hashtag-based trending
    if (!topProject) {
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('hashtags, project_id')
        .gte('created_at', twentyFourHoursAgo)
        .not('project_id', 'is', null)
        .limit(500);

      if (recentPosts && recentPosts.length > 0) {
        // Count posts per project
        const projectCounts: Record<string, number> = {};
        recentPosts.forEach((p) => {
          if (p.project_id) {
            projectCounts[p.project_id] = (projectCounts[p.project_id] || 0) + 1;
          }
        });

        // Find top project
        const topId = Object.entries(projectCounts).sort((a, b) => b[1] - a[1])[0];
        if (topId) {
          const { data: proj } = await supabase
            .from('projects')
            .select('name, symbol')
            .eq('id', topId[0])
            .single();

          if (proj) {
            topProject = {
              name: proj.name || 'Unknown',
              symbol: proj.symbol || '---',
              score: topId[1],
              postCount: topId[1],
            };
          }
        }
      }
    }

    // 4. Calculate totals
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count: totalPosts24h } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    const { count: totalPosts7d } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);

    return {
      chartData,
      topProject,
      totalPosts24h: totalPosts24h || 0,
      totalPosts7d: totalPosts7d || 0,
    };
  } catch (error) {
    console.error('[getTrendingStats] Error:', error);
    return {
      chartData: [],
      topProject: null,
      totalPosts24h: 0,
      totalPosts7d: 0,
    };
  }
}
