import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { verifyDevAccess } from '@/lib/auth/devAccess';

/**
 * GET /api/developer/status
 * Check if current user has developer access
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        { 
          hasDeveloperAccess: false,
          error: 'Authentication required' 
        },
        { status: 401 }
      );
    }

    // Check if user has developer badge
    try {
      await verifyDevAccess(session.userId);
      
      return NextResponse.json({
        hasDeveloperAccess: true,
        userId: session.userId,
      });
    } catch (error: any) {
      return NextResponse.json({
        hasDeveloperAccess: false,
        error: error.message,
      });
    }
  } catch (error: any) {
    console.error('[Developer Status] Error:', error);
    return NextResponse.json(
      { 
        hasDeveloperAccess: false,
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
