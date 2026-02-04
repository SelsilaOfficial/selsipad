'use server';

import { scanTokenSecurity } from '@/lib/security/goplus';

interface ScanTokenResult {
  success: boolean;
  status?: 'PASS' | 'FAIL';
  badges?: string[];
  checks?: any;
  error?: string;
}

/**
 * Scan a token contract for security vulnerabilities using GoPlus Security API
 * 
 * @param network - Network identifier (ethereum, bnb, base, etc.)
 * @param tokenAddress - Token contract address to scan
 * @returns Security scan result with status and badges
 */
export async function scanToken(
  network: string,
  tokenAddress: string
): Promise<ScanTokenResult> {
  try {
    // Validate inputs
    if (!network || !tokenAddress) {
      return {
        success: false,
        error: 'Network and token address are required',
      };
    }

    // Call GoPlus Security API (note: params order is tokenAddress, network)
    const result = await scanTokenSecurity(tokenAddress, network);

    if (!result) {
      return {
        success: false,
        error: 'No scan result returned from GoPlus API',
      };
    }

    // Generate security badges based on scan results
    const badges: string[] = [];

    if (result.allPassed) {
      badges.push('SC_PASS'); // Overall scan passed
    }

    // Individual check badges based on the checks object
    if (result.checks.antiMint.pass) {
      badges.push('NO_MINT');
    }

    if (result.checks.honeypot.pass) {
      badges.push('NO_HONEYPOT');
    }

    if (result.checks.pause.pass) {
      badges.push('NO_PAUSE');
    }

    if (result.checks.tax.pass) {
      badges.push('TAX_LOCKED');
    }

    return {
      success: true,
      status: result.status,
      badges,
      checks: result.checks,
    };
  } catch (error: any) {
    console.error('Token scan error:', error);
    return {
      success: false,
      error: error.message || 'Failed to scan token',
    };
  }
}
