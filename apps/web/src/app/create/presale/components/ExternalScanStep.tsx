import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { scanContractAddress, getScanStatus } from '../actions/scan-contract';

export interface ExternalScanStepProps {
  projectId: string; // Can be 'temp' for new projects
  network: string;
  contractAddress: string;
  onContractAddressChange: (address: string) => void;
  onScanComplete: (status: 'PASS' | 'FAIL' | 'NEEDS_REVIEW') => void;
  onTokenInfoRead?: (info: {
    totalSupply: string;
    name: string;
    symbol: string;
    decimals: number;
  }) => void;
}

export function ExternalScanStep({
  projectId,
  network,
  contractAddress,
  onContractAddressChange,
  onScanComplete,
  onTokenInfoRead,
}: ExternalScanStepProps) {
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');

  // Poll scan status by scan_id (not projectId)
  useEffect(() => {
    if (scanId && (scanStatus === 'RUNNING' || scanStatus === 'PENDING')) {
      const interval = setInterval(async () => {
        const result = await getScanStatus(scanId);

        if (result.success && result.data) {
          setScanStatus(result.data.status);
          setScanResult(result.data);

          if (['PASS', 'FAIL', 'NEEDS_REVIEW'].includes(result.data.status)) {
            clearInterval(interval);
            onScanComplete(result.data.status as any);
            // Read token info from scan result if available
            if (
              result.data.status === 'PASS' &&
              (result.data as any).token_info &&
              onTokenInfoRead
            ) {
              const tokenInfo = (result.data as any).token_info;
              onTokenInfoRead({
                totalSupply: tokenInfo.total_supply || '0',
                name: tokenInfo.name || '',
                symbol: tokenInfo.symbol || '',
                decimals: tokenInfo.decimals || 18,
              });
            }
          }
        }
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [scanId, scanStatus, onScanComplete]);

  const handleStartScan = async () => {
    setError('');

    if (!contractAddress || contractAddress.length < 10) {
      setError('Please enter a valid contract address');
      return;
    }

    setIsScanning(true);
    setScanStatus('PENDING');

    const result = await scanContractAddress(contractAddress, network);

    if (result.success && result.data) {
      setScanId(result.data.scan_id);
      setScanStatus(result.data.status);

      // If the scan already completed (reused result or fast execution),
      // fire onScanComplete immediately since the polling useEffect
      // only handles PENDING/RUNNING -> terminal transitions
      if (['PASS', 'FAIL', 'NEEDS_REVIEW'].includes(result.data.status)) {
        // Fetch full scan data for display
        const fullResult = await getScanStatus(result.data.scan_id);
        if (fullResult.success && fullResult.data) {
          setScanResult(fullResult.data);
        }
        onScanComplete(result.data.status as 'PASS' | 'FAIL' | 'NEEDS_REVIEW');
      }
    } else {
      setError(result.error || 'Failed to start scan');
      setScanStatus(null);
      setIsScanning(false);
    }
  };

  const renderScanStatus = () => {
    if (!scanStatus) return null;

    switch (scanStatus) {
      case 'PENDING':
      case 'RUNNING':
        return (
          <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <div>
                <h4 className="text-lg font-semibold text-blue-300">Scanning Contract...</h4>
                <p className="text-blue-200/80 text-sm mt-1">
                  Analyzing security patterns and risk factors
                </p>
              </div>
            </div>
          </div>
        );

      case 'PASS':
        return (
          <div className="bg-green-950/30 border border-green-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-green-300 mb-2">
                  ✅ Security Scan Passed
                </h4>
                <p className="text-green-200/80 text-sm mb-3">
                  {scanResult?.summary || 'Contract passed all security checks'}
                </p>
                {scanResult?.risk_score !== undefined && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-green-400">Risk Score:</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden max-w-xs">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${scanResult.risk_score}%` }}
                      />
                    </div>
                    <span className="text-sm text-green-400 font-medium">
                      {scanResult.risk_score}/100
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'FAIL':
        return (
          <div className="bg-red-950/30 border border-red-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-red-300 mb-2">❌ Security Scan Failed</h4>
                <p className="text-red-200/80 text-sm mb-3">
                  {scanResult?.summary || 'Contract failed security checks'}
                </p>
                {scanResult?.risk_flags && scanResult.risk_flags.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-red-400 font-medium">Issues detected:</p>
                    <div className="flex flex-wrap gap-2">
                      {scanResult.risk_flags.map((flag: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-red-600/20 text-red-400 text-xs rounded font-mono"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={handleStartScan}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Scan
                </button>
              </div>
            </div>
          </div>
        );

      case 'NEEDS_REVIEW':
        return (
          <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <Shield className="w-8 h-8 text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-yellow-300 mb-2">
                  ⏳ Admin Review Required
                </h4>
                <p className="text-yellow-200/80 text-sm mb-3">
                  Your contract scan detected patterns that require manual review. An admin will
                  review your contract shortly.
                </p>
                <p className="text-yellow-200/80 text-sm">
                  You'll be notified when the review is complete. You can proceed once approved.
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Contract Security Scan</h2>
        <p className="text-gray-400">Enter your contract address to run security analysis</p>
      </div>

      {/* Contract Address Input */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Contract Address <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={contractAddress}
          onChange={(e) => onContractAddressChange(e.target.value)}
          placeholder="0x..."
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono"
          disabled={isScanning}
        />
        <p className="text-gray-500 text-sm mt-1">
          The contract must already be deployed on {network}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-950/30 border border-red-800 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Scan Button */}
      {!scanStatus && (
        <button
          onClick={handleStartScan}
          disabled={!contractAddress || isScanning}
          className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {isScanning ? 'Starting Scan...' : 'Run Security Scan'}
        </button>
      )}

      {/* Scan Status Display */}
      {renderScanStatus()}

      {/* Info Banner */}
      <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-4">
        <h4 className="text-blue-300 font-medium mb-2">What we check:</h4>
        <ul className="text-blue-200/80 text-sm space-y-1">
          <li>• Contract code exists and is valid</li>
          <li>• Proxy pattern detection</li>
          <li>• Ownership and admin privileges</li>
          <li>• Dangerous opcodes (selfdestruct, delegatecall)</li>
        </ul>
      </div>
    </div>
  );
}
