import { NextRequest, NextResponse } from 'next/server';
import { processPendingScans } from '@/lib/contract-scanner/scanner-executor';

/**
 * Scanner Execution Endpoint
 * POST /api/scanner/execute
 *
 * Triggers execution of all pending scans
 * Can be called from:
 * - Cron job (every 30s)
 * - After scan creation (webhook)
 * - Manual admin trigger
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.SCANNER_API_KEY;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Process pending scans
    const result = await processPendingScans();

    return NextResponse.json({
      success: true,
      processed: result.processed || 0,
      message: `Processed ${result.processed || 0} scans`,
    });
  } catch (error: any) {
    console.error('Scanner execution error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Get scanner status
 * GET /api/scanner/execute
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Scanner executor is running',
    endpoint: '/api/scanner/execute',
    methods: ['POST'],
  });
}
