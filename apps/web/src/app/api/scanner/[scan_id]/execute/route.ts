import { NextRequest, NextResponse } from 'next/server';
import { processScanById } from '@/lib/contract-scanner/scanner-executor';

/**
 * Execute specific scan by ID
 * POST /api/scanner/[scan_id]/execute
 *
 * Triggers immediate execution of a specific scan
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { scan_id: string } }) {
  try {
    const scanId = params.scan_id;

    if (!scanId) {
      return NextResponse.json({ success: false, error: 'Scan ID required' }, { status: 400 });
    }

    // Execute specific scan
    await processScanById(scanId);

    return NextResponse.json({
      success: true,
      scan_id: scanId,
      message: 'Scan executed successfully',
    });
  } catch (error: any) {
    console.error('Scan execution error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
