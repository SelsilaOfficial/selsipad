'use server';

import { getServerSession } from '@/lib/auth/session';
import { createClient } from '@supabase/supabase-js';
import { processScanById } from '@/lib/contract-scanner/scanner-executor';

interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Standalone contract scan - NO project required
 * Scans contract code directly for security issues:
 * - Mint function (can create tokens?)
 * - Pause function (can freeze trading?)
 * - Honeypot detection
 * - Tax detection
 */
export async function scanContractAddress(
  contractAddress: string,
  network: string
): Promise<
  ActionResult<{
    scan_id: string;
    status: string;
  }>
> {
  try {
    // Auth is optional — scanning is a public contract check

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check for recent scan of same address (prevent spam, allow reuse)
    const { data: existingScan } = await supabase
      .from('sc_scan_results')
      .select('id, status, score, risk_flags, summary')
      .eq('contract_address', contractAddress.toLowerCase())
      .in('status', ['PASS', 'FAIL', 'NEEDS_REVIEW'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // If recent scan exists and is complete, return it
    if (existingScan) {
      console.log('[Scan] Reusing existing scan result:', existingScan.id);
      return {
        success: true,
        data: {
          scan_id: existingScan.id,
          status: existingScan.status,
        },
      };
    }

    // Create new scan run (without project_id)
    const { data: scanRun, error: scanError } = await supabase
      .from('sc_scan_results')
      .insert({
        project_id: null, // No project required!
        network: network.includes('bsc') ? 'EVM' : 'EVM',
        target_address: contractAddress.toLowerCase(),
        contract_address: contractAddress.toLowerCase(),
        status: 'PENDING',
        chain: network,
        scan_provider: 'INTERNAL',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scanError) {
      console.error('[Scan] Failed to create scan run:', scanError);
      return { success: false, error: 'Failed to start scan' };
    }

    console.log('[Scan] Created scan run:', scanRun.id);

    // Trigger scan execution directly (don't use HTTP fetch — it silently fails)
    try {
      await processScanById(scanRun.id);
      console.log('[Scan] Scan completed for:', scanRun.id);
    } catch (executeError) {
      console.error('[Scan] Execution error:', executeError);
      // Non-blocking - the status will be updated in DB regardless (FAIL on error)
    }

    // Re-fetch the updated status after execution
    const { data: updatedScan } = await supabase
      .from('sc_scan_results')
      .select('status')
      .eq('id', scanRun.id)
      .single();

    return {
      success: true,
      data: {
        scan_id: scanRun.id,
        status: updatedScan?.status || 'RUNNING',
      },
    };
  } catch (error: any) {
    console.error('[Scan] Error:', error);
    return { success: false, error: error.message || 'Failed to start scan' };
  }
}

/**
 * Get scan status by scan_id (not project_id)
 */
export async function getScanStatus(scanId: string): Promise<
  ActionResult<{
    status: string;
    risk_score: number | null;
    risk_flags: string[];
    summary: string | null;
  }>
> {
  try {
    // Auth is optional — checking scan status is public

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: scanRun, error } = await supabase
      .from('sc_scan_results')
      .select('id, status, score, risk_flags, summary')
      .eq('id', scanId)
      .single();

    if (error || !scanRun) {
      return { success: false, error: 'Scan not found' };
    }

    return {
      success: true,
      data: {
        status: scanRun.status,
        risk_score: scanRun.score,
        risk_flags: scanRun.risk_flags || [],
        summary: scanRun.summary,
      },
    };
  } catch (error: any) {
    console.error('[Scan] Get status error:', error);
    return { success: false, error: error.message || 'Failed to get scan status' };
  }
}
