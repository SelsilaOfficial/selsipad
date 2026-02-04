'use client';

import { AlertCircle, CheckCircle2, XCircle, Loader2, Shield } from 'lucide-react';
import { SecurityScanResult } from '@/lib/security/goplus';

interface SecurityScanPanelProps {
  scanResult: SecurityScanResult | null;
  isScanning: boolean;
  onRetry?: () => void;
}

export function SecurityScanPanel({ scanResult, isScanning, onRetry }: SecurityScanPanelProps) {
  if (isScanning) {
    return (
      <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <div>
            <p className="text-blue-200 font-medium">Scanning Token Security...</p>
            <p className="text-blue-300/80 text-sm mt-1">
              Checking for mint functions, honeypots, high taxes, and pause mechanisms
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!scanResult) {
    return null;
  }

  const getCheckIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle2 className="w-5 h-5 text-green-400" />
    ) : (
      <XCircle className="w-5 h-5 text-red-400" />
    );
  };

  const getCheckColor = (passed: boolean) => {
    return passed ? 'text-green-300' : 'text-red-300';
  };

  return (
    <div
      className={`border rounded-lg p-6 ${
        scanResult.allPassed
          ? 'bg-green-950/30 border-green-800/40'
          : 'bg-red-950/30 border-red-800/40'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Shield
            className={`w-6 h-6 ${
              scanResult.allPassed ? 'text-green-400' : 'text-red-400'
            }`}
          />
          <div>
            <h3
              className={`font-semibold ${
                scanResult.allPassed ? 'text-green-200' : 'text-red-200'
              }`}
            >
              {scanResult.allPassed
                ? '✓ Security Scan Passed'
                : '✗ Security Scan Failed'}
            </h3>
            <p className="text-sm text-gray-400">
              Scanned at {new Date(scanResult.scannedAt).toLocaleString()}
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm text-gray-400 hover:text-gray-300 transition"
          >
            Retry Scan
          </button>
        )}
      </div>

      {/* Security Checks */}
      <div className="space-y-3">
        {/* Anti-Mint Check */}
        <div className="flex items-start gap-3">
          {getCheckIcon(scanResult.checks.antiMint.pass)}
          <div className="flex-1">
            <p className={`font-medium ${getCheckColor(scanResult.checks.antiMint.pass)}`}>
              Anti-Mint: {scanResult.checks.antiMint.message}
            </p>
            {scanResult.checks.antiMint.details && (
              <p className="text-sm text-gray-400 mt-1">
                {scanResult.checks.antiMint.details}
              </p>
            )}
          </div>
        </div>

        {/* Honeypot Check */}
        <div className="flex items-start gap-3">
          {getCheckIcon(scanResult.checks.honeypot.pass)}
          <div className="flex-1">
            <p className={`font-medium ${getCheckColor(scanResult.checks.honeypot.pass)}`}>
              Honeypot: {scanResult.checks.honeypot.message}
            </p>
            {scanResult.checks.honeypot.details && (
              <p className="text-sm text-gray-400 mt-1">
                {scanResult.checks.honeypot.details}
              </p>
            )}
          </div>
        </div>

        {/* Tax Check */}
        <div className="flex items-start gap-3">
          {getCheckIcon(scanResult.checks.tax.pass)}
          <div className="flex-1">
            <p className={`font-medium ${getCheckColor(scanResult.checks.tax.pass)}`}>
              Tax/Fee: {scanResult.checks.tax.message}
            </p>
            {scanResult.checks.tax.buyTax !== undefined && (
              <p className="text-sm text-gray-400 mt-1">
                Buy Tax: {scanResult.checks.tax.buyTax.toFixed(1)}% | Sell Tax:{' '}
                {scanResult.checks.tax.sellTax?.toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        {/* Pause Check */}
        <div className="flex items-start gap-3">
          {getCheckIcon(scanResult.checks.pause.pass)}
          <div className="flex-1">
            <p className={`font-medium ${getCheckColor(scanResult.checks.pause.pass)}`}>
              No Pause: {scanResult.checks.pause.message}
            </p>
            {scanResult.checks.pause.details && (
              <p className="text-sm text-gray-400 mt-1">
                {scanResult.checks.pause.details}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Result Footer */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        {scanResult.allPassed ? (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-green-900/40 border border-green-700/40 rounded-full">
              <span className="text-green-300 text-sm font-medium">✓ SC Pass Badge Earned</span>
            </div>
            <p className="text-sm text-gray-400">
              This token has passed all security checks and is safe to use.
            </p>
          </div>
        ) : (
          <div className="bg-red-900/40 border border-red-700/40 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-200 font-medium">Cannot proceed with this token</p>
                <p className="text-red-300/80 text-sm mt-1">
                  This token has security issues that make it unsafe for fairlaunch. Please use a
                  different token or create a safe token via our factory.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
