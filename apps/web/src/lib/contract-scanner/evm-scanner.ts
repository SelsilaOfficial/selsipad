/**
 * EVM Contract Scanner - MVP Implementation
 *
 * Performs basic security checks on EVM contracts:
 * - Code existence
 * - Proxy pattern detection
 * - Ownable/AccessControl detection
 * - Dangerous opcode heuristics
 * - Interface compatibility (basic)
 */

export interface ScanResult {
  risk_score: number;
  risk_flags: string[];
  summary: string;
  raw_findings: Record<string, any>;
  status: 'PASS' | 'FAIL' | 'NEEDS_REVIEW';
}

interface CheckResult {
  name: string;
  passed: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: any;
}

export class EVMScanner {
  private readonly RPC_URLS: Record<string, string> = {
    EVM_56: process.env.NEXT_PUBLIC_BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    EVM_97: 'https://bsc-testnet-rpc.publicnode.com',
    EVM_1: process.env.NEXT_PUBLIC_ETH_RPC_URL || 'https://eth.llamarpc.com',
    EVM_137: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com',
  };

  // Map common chain identifiers to RPC_URLS keys
  private readonly CHAIN_MAP: Record<string, string> = {
    bsc_testnet: 'EVM_97',
    bsc_mainnet: 'EVM_56',
    bsc: 'EVM_56',
    ethereum: 'EVM_1',
    polygon: 'EVM_137',
    '97': 'EVM_97',
    '56': 'EVM_56',
    '1': 'EVM_1',
    '137': 'EVM_137',
  };

  /**
   * Resolve RPC URL from network string (accepts EVM_97, bsc_testnet, 97, etc.)
   */
  private resolveRpcUrl(network: string): string {
    // Direct match first
    if (this.RPC_URLS[network]) return this.RPC_URLS[network];
    // Try chain map
    const mapped = this.CHAIN_MAP[network.toLowerCase()];
    if (mapped && this.RPC_URLS[mapped]) return this.RPC_URLS[mapped];
    throw new Error(`Unsupported network: ${network}`);
  }

  /**
   * Scan contract address on specified network
   */
  async scan(address: string, network: string): Promise<ScanResult> {
    try {
      const checks: CheckResult[] = await Promise.all([
        this.checkCodeExists(address, network),
        this.checkProxyPattern(address, network),
        this.checkOwnablePattern(address, network),
        this.checkDangerousOpcodes(address, network),
      ]);

      const riskScore = this.calculateRiskScore(checks);
      const riskFlags = this.extractFlags(checks);
      const summary = this.generateSummary(checks, riskScore);
      const status = this.determineStatus(riskScore, riskFlags);

      return {
        risk_score: riskScore,
        risk_flags: riskFlags,
        summary,
        raw_findings: { checks },
        status,
      };
    } catch (error: any) {
      console.error('Scan error:', error);
      return {
        risk_score: 100,
        risk_flags: ['SCAN_ERROR'],
        summary: `Scan failed: ${error.message}`,
        raw_findings: { error: error.message },
        status: 'FAIL',
      };
    }
  }

  /**
   * Check 1: Contract code exists
   */
  private async checkCodeExists(address: string, network: string): Promise<CheckResult> {
    try {
      const rpcUrl = this.resolveRpcUrl(network);

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getCode',
          params: [address, 'latest'],
          id: 1,
        }),
      });

      const data = await response.json();
      const code = data.result;

      const passed = code && code !== '0x' && code.length > 2;

      return {
        name: 'CODE_EXISTS',
        passed,
        severity: passed ? 'LOW' : 'CRITICAL',
        message: passed
          ? 'Contract bytecode found'
          : 'No contract code at address - not a deployed contract',
        details: { codeSize: code?.length || 0 },
      };
    } catch (error: any) {
      return {
        name: 'CODE_EXISTS',
        passed: false,
        severity: 'CRITICAL',
        message: `Failed to check code: ${error.message}`,
      };
    }
  }

  /**
   * Check 2: Proxy pattern detection
   */
  private async checkProxyPattern(address: string, network: string): Promise<CheckResult> {
    try {
      const rpcUrl = this.resolveRpcUrl(network);
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getCode',
          params: [address, 'latest'],
          id: 1,
        }),
      });

      const data = await response.json();
      const code = data.result?.toLowerCase() || '';

      // More specific proxy patterns (longer sequences reduce false positives)
      const proxyIndicators = [
        '363d3d373d3d3d363d73', // EIP-1167 minimal proxy
        '5860208158601c335a63', // UUPS proxy pattern
        '360894a13ba1a3210667', // EIP-1967 implementation slot prefix
      ];

      const isProxy = proxyIndicators.some((indicator) => code.includes(indicator));

      if (isProxy) {
        return {
          name: 'PROXY_PATTERN',
          passed: false,
          severity: 'MEDIUM',
          message: 'Proxy contract detected - requires additional review',
          details: { isMinimalProxy: code.includes('363d3d373d3d3d363d73') },
        };
      }

      return {
        name: 'PROXY_PATTERN',
        passed: true,
        severity: 'LOW',
        message: 'No proxy pattern detected',
      };
    } catch (error: any) {
      return {
        name: 'PROXY_PATTERN',
        passed: true,
        severity: 'LOW',
        message: 'Unable to check proxy pattern',
      };
    }
  }

  /**
   * Check 3: Ownable/AccessControl pattern detection
   */
  private async checkOwnablePattern(address: string, network: string): Promise<CheckResult> {
    try {
      const rpcUrl = this.resolveRpcUrl(network);

      // Check for owner() function (Ownable pattern)
      const ownerSelector = '0x8da5cb5b'; // keccak256("owner()").slice(0, 10)

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: address,
              data: ownerSelector,
            },
            'latest',
          ],
          id: 1,
        }),
      });

      const data = await response.json();
      const hasOwner = data.result && data.result !== '0x';

      if (hasOwner) {
        return {
          name: 'OWNABLE_PATTERN',
          passed: true,
          severity: 'MEDIUM',
          message: 'Contract has ownership structure - admin privileges detected',
          details: { hasOwner: true },
        };
      }

      return {
        name: 'OWNABLE_PATTERN',
        passed: true,
        severity: 'LOW',
        message: 'No obvious ownership pattern detected',
        details: { hasOwner: false },
      };
    } catch (error: any) {
      return {
        name: 'OWNABLE_PATTERN',
        passed: true,
        severity: 'LOW',
        message: 'Unable to check ownership pattern',
      };
    }
  }

  /**
   * Check 4: Dangerous opcode heuristics
   */
  private async checkDangerousOpcodes(address: string, network: string): Promise<CheckResult> {
    try {
      const rpcUrl = this.resolveRpcUrl(network);
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getCode',
          params: [address, 'latest'],
          id: 1,
        }),
      });

      const data = await response.json();
      const code = data.result?.toLowerCase() || '';

      // Use longer sequences to avoid false positives from addresses/constants
      // Single bytes like 'ff' match too many legitimate bytecodes
      const dangerousPatterns = [
        { opcode: '6080ff', name: 'SELFDESTRUCT_PATTERN', severity: 'HIGH' as const },
        { opcode: 'ff00', name: 'SELFDESTRUCT', severity: 'HIGH' as const },
      ];

      const foundPatterns = dangerousPatterns.filter((pattern) => code.includes(pattern.opcode));

      if (foundPatterns.length > 0) {
        const highestSeverity = foundPatterns.some((p) => p.severity === 'HIGH')
          ? 'HIGH'
          : 'MEDIUM';

        return {
          name: 'DANGEROUS_OPCODES',
          passed: false,
          severity: highestSeverity,
          message: `Dangerous opcodes detected: ${foundPatterns.map((p) => p.name).join(', ')}`,
          details: { patterns: foundPatterns },
        };
      }

      return {
        name: 'DANGEROUS_OPCODES',
        passed: true,
        severity: 'LOW',
        message: 'No obvious dangerous opcodes detected',
      };
    } catch (error: any) {
      return {
        name: 'DANGEROUS_OPCODES',
        passed: true,
        severity: 'LOW',
        message: 'Unable to check opcodes',
      };
    }
  }

  /**
   * Calculate risk score from check results (0-100, higher = more risky)
   */
  private calculateRiskScore(checks: CheckResult[]): number {
    const severityWeights = {
      CRITICAL: 100,
      HIGH: 70,
      MEDIUM: 40,
      LOW: 10,
    };

    let totalRisk = 0;
    let maxPossibleRisk = 0;

    for (const check of checks) {
      const weight = severityWeights[check.severity];
      maxPossibleRisk += weight;

      if (!check.passed) {
        totalRisk += weight;
      }
    }

    return maxPossibleRisk > 0 ? Math.round((totalRisk / maxPossibleRisk) * 100) : 0;
  }

  /**
   * Extract risk flags from failed checks
   */
  private extractFlags(checks: CheckResult[]): string[] {
    return checks.filter((c) => !c.passed).map((c) => c.name);
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(checks: CheckResult[], riskScore: number): string {
    const failedChecks = checks.filter((c) => !c.passed);

    if (riskScore === 0) {
      return 'Contract passed all basic security checks. No obvious risks detected.';
    }

    if (riskScore >= 70) {
      return `HIGH RISK: ${failedChecks.length} critical issues found. ${failedChecks.map((c) => c.message).join('; ')}`;
    }

    if (riskScore >= 40) {
      return `MEDIUM RISK: ${failedChecks.length} issues require review. ${failedChecks.map((c) => c.message).join('; ')}`;
    }

    return `LOW RISK: ${failedChecks.length} minor issues detected. ${failedChecks.map((c) => c.message).join('; ')}`;
  }

  /**
   * Determine final status based on risk score and flags
   */
  private determineStatus(
    riskScore: number,
    riskFlags: string[]
  ): 'PASS' | 'FAIL' | 'NEEDS_REVIEW' {
    // FAIL if critical issues
    if (riskFlags.includes('CODE_EXISTS') || riskFlags.includes('SCAN_ERROR')) {
      return 'FAIL';
    }

    // FAIL if risk score too high
    if (riskScore >= 70) {
      return 'FAIL';
    }

    // NEEDS_REVIEW if proxy or dangerous opcodes
    if (
      riskFlags.includes('PROXY_PATTERN') ||
      riskFlags.includes('DANGEROUS_OPCODES') ||
      riskScore >= 40
    ) {
      return 'NEEDS_REVIEW';
    }

    // PASS otherwise
    return 'PASS';
  }
}

// Export singleton instance
export const evmScanner = new EVMScanner();
