import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { verifyDevAccess } from '@/lib/auth/devAccess';

/**
 * Example protected developer API endpoint
 * Only accessible by users with DEV_KYC_VERIFIED badge
 */

/**
 * GET /api/developer/analytics
 * Get platform analytics (developer only)
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify developer access
    try {
      await verifyDevAccess(session.userId);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    // Developer has access - return analytics data
    const analytics = {
      totalUsers: 1250,
      totalPosts: 5430,
      totalProjects: 89,
      activeUsers24h: 234,
      apiCalls24h: 12340,
      trending: {
        topHashtags: ['#presale', '#fairlaunch', '#meme'],
        topProjects: ['Project A', 'Project B'],
      },
      performance: {
        avgResponseTime: '145ms',
        uptime: '99.9%',
        errorRate: '0.1%',
      },
    };

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error('[Developer Analytics] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
