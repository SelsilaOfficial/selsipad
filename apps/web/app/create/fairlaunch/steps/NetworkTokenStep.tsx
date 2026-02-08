'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Shield, Coins } from 'lucide-react';
import { SecurityScanPanel } from '@/components/fairlaunch/SecurityScanPanel';
import { CreateTokenDialog } from '@/components/fairlaunch/CreateTokenDialog';
import { FeeBreakdown } from '@/components/fairlaunch/FeeBreakdown';
import { scanToken } from '@/actions/fairlaunch';
import { SecurityScanResult } from '@/lib/security/goplus';

interface NetworkTokenStepProps {
  data: {
    network: string;
    tokenMode: 'existing' | 'factory' | null;
    tokenAddress: string;
    tokenSource: string;
    securityScanStatus: 'PASS' | 'FAIL' | null;
    securityBadges: string[];
  };
  onChange: (data: Partial<NetworkTokenStepProps['data']>) => void;
  errors?: Record<string, string>;
}

const NETWORKS = {
  testnet: [
    { id: 'bsc_testnet', name: 'BSC Testnet', symbol: 'tBNB', icon: '/assets/chains/bnb.png' },
    { id: 'sepolia', name: 'ETH Sepolia', symbol: 'SepoliaETH', icon: '/assets/chains/eth.png' },
    { id: 'base_sepolia', name: 'Base Sepolia', symbol: 'ETH', icon: '/assets/chains/base.png' },
  ],
  mainnet: [
    { id: 'bnb', name: 'BNB Chain', symbol: 'BNB', icon: '/assets/chains/bnb.png' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', icon: '/assets/chains/eth.png' },
    { id: 'base', name: 'Base', symbol: 'ETH', icon: '/assets/chains/base.png' },
  ],
};

export function NetworkTokenStep({ data, onChange, errors }: NetworkTokenStepProps) {
  const [networkTab, setNetworkTab] = useState<'testnet' | 'mainnet'>(
    ['bnb', 'ethereum', 'base'].includes(data.network) ? 'mainnet' : 'testnet'
  );
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<SecurityScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Auto-scan when address is entered for existing token
  useEffect(() => {
    if (data.tokenMode === 'existing' && data.tokenAddress && data.tokenAddress.length === 42) {
      handleScan();
    }
  }, [data.tokenAddress, data.tokenMode]);

  const handleScan = async () => {
    if (!data.tokenAddress || !data.network) return;

    setIsScanning(true);
    setScanError(null);

    try {
      // Call server action instead of direct GoPlus API
      const result = await scanToken(data.network, data.tokenAddress);

      if (!result.success) {
        setScanError(result.error || 'Scan failed');
        onChange({
          securityScanStatus: 'FAIL',
          securityBadges: [],
        });
        return;
      }

      // Convert server action result to SecurityScanResult format for UI
      // The result already has the proper structure from goplus.ts
      const uiResult: SecurityScanResult = {
        token_address: data.tokenAddress,
        status: result.status || 'FAIL',
        checks: result.checks || {
          antiMint: { pass: false, message: 'No data' },
          honeypot: { pass: false, message: 'No data' },
          tax: { pass: false, message: 'No data' },
          pause: { pass: false, message: 'No data' },
        },
        allPassed: result.status === 'PASS',
        scannedAt: new Date().toISOString(),
      };

      setScanResult(uiResult);

      // Update wizard data with scan results
      onChange({
        securityScanStatus: result.status || 'FAIL',
        securityBadges: result.badges || [],
      });
    } catch (error: any) {
      setScanError(error.message || 'Failed to scan token');
      onChange({
        securityScanStatus: 'FAIL',
        securityBadges: [],
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleTokenCreated = (tokenData: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  }) => {
    onChange({
      tokenAddress: tokenData.address,
      tokenMode: 'factory',
      tokenSource: 'factory',
      securityScanStatus: 'PASS',
      securityBadges: ['SAFU', 'SC_PASS'],
      // Save token metadata
      tokenName: tokenData.name,
      tokenSymbol: tokenData.symbol,
      tokenDecimals: tokenData.decimals,
      tokenTotalSupply: tokenData.totalSupply,
    } as any);
    setShowCreateDialog(false);
  };

  const canProceed = data.network && data.tokenAddress && data.securityScanStatus === 'PASS';

  return (
    <div className="space-y-6">
      {/* Network Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Select Network <span className="text-red-400">*</span>
        </label>
        <div className="flex bg-gray-800 rounded-lg p-1 mb-4">
          <button
            type="button"
            onClick={() => setNetworkTab('testnet')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              networkTab === 'testnet'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🧪 Testnet
          </button>
          <button
            type="button"
            onClick={() => setNetworkTab('mainnet')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              networkTab === 'mainnet'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🌐 Mainnet
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {NETWORKS[networkTab].map((network) => (
            <button
              key={network.id}
              type="button"
              onClick={() => onChange({ network: network.id })}
              className={`relative p-4 rounded-xl border-2 transition text-center ${
                data.network === network.id
                  ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'
              }`}
            >
              <img
                src={network.icon}
                alt={network.name}
                className="w-7 h-7 rounded-full mx-auto mb-2"
              />
              <div className="text-sm font-medium text-white">{network.name}</div>
              <div className="text-xs text-gray-400 mt-1">{network.symbol}</div>
            </button>
          ))}
        </div>
        {errors?.network && <p className="text-red-400 text-sm mt-2">{errors.network}</p>}
      </div>

      {/* Token Mode Selection */}
      {data.network && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Token Source <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Use Existing Token */}
            <button
              type="button"
              onClick={() =>
                onChange({ tokenMode: 'existing', tokenAddress: '', securityBadges: [] })
              }
              className={`p-6 rounded-lg border-2 transition text-left ${
                data.tokenMode === 'existing'
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <Coins className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-white mb-1">Use Existing Token</div>
                  <div className="text-sm text-gray-400">
                    Import your existing ERC20 token. Will be scanned for security issues.
                  </div>
                  <div className="mt-3 flex gap-2">
                    <div className="px-2 py-1 bg-blue-900/40 border border-blue-700/40 rounded text-xs text-blue-300">
                      ✓ SC Pass
                    </div>
                  </div>
                </div>
              </div>
            </button>

            {/* Create New Token */}
            <button
              type="button"
              onClick={() => {
                onChange({ tokenMode: 'factory' });
                setShowCreateDialog(true);
              }}
              className={`p-6 rounded-lg border-2 transition text-left ${
                data.tokenMode === 'factory'
                  ? 'border-green-500 bg-green-900/30'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-white mb-1">Create Safe Token via Factory</div>
                  <div className="text-sm text-gray-400">
                    Deploy a secure ERC20 token using our factory. Automatically verified.
                  </div>
                  <div className="mt-3 flex gap-2">
                    <div className="px-2 py-1 bg-green-900/40 border border-green-700/40 rounded text-xs text-green-300">
                      🛡️ SAFU
                    </div>
                    <div className="px-2 py-1 bg-green-900/40 border border-green-700/40 rounded text-xs text-green-300">
                      ✓ SC Pass
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Existing Token - Address Input */}
      {data.tokenMode === 'existing' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Token Contract Address <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={data.tokenAddress}
            onChange={(e) => onChange({ tokenAddress: e.target.value })}
            placeholder="0x..."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
          {errors?.tokenAddress && (
            <p className="text-red-400 text-sm mt-2">{errors.tokenAddress}</p>
          )}
        </div>
      )}

      {/* Security Scan Results */}
      {data.tokenMode === 'existing' && (isScanning || scanResult || scanError) && (
        <div>
          {scanError && (
            <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-200 font-medium">Scan Error</p>
                  <p className="text-red-300/80 text-sm mt-1">{scanError}</p>
                  <button
                    onClick={handleScan}
                    className="mt-3 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg text-sm transition"
                  >
                    Retry Scan
                  </button>
                </div>
              </div>
            </div>
          )}

          <SecurityScanPanel scanResult={scanResult} isScanning={isScanning} onRetry={handleScan} />

          {/* Block if scan failed */}
          {scanResult && !scanResult.allPassed && (
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-200 mb-2">
                    Cannot Proceed with This Token
                  </h4>
                  <p className="text-amber-300/90 text-sm mb-4">
                    This token has security issues that make it unsafe for fairlaunch. We recommend
                    creating a safe token via our factory instead.
                  </p>
                  <button
                    onClick={() => {
                      onChange({ tokenMode: 'factory' });
                      setShowCreateDialog(true);
                    }}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                  >
                    🛡️ Create Safe Token Instead
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Factory Token - Display Created Address */}
      {data.tokenMode === 'factory' && data.tokenAddress && (
        <div className="bg-green-950/30 border border-green-800/40 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-200 mb-2">✅ Safe Token Created</h4>
              <p className="text-green-300/90 text-sm mb-3">
                Your token has been deployed and automatically assigned security badges.
              </p>
              <div className="bg-green-900/40 border border-green-800/30 rounded-lg p-3">
                <p className="text-xs text-green-300 mb-1">Token Address:</p>
                <p className="text-sm text-green-200 font-mono break-all">{data.tokenAddress}</p>
              </div>
              <div className="flex gap-2 mt-3">
                <div className="px-3 py-1 bg-green-900/40 border border-green-700/40 rounded-full text-sm text-green-300">
                  🛡️ SAFU
                </div>
                <div className="px-3 py-1 bg-green-900/40 border border-green-700/40 rounded-full text-sm text-green-300">
                  ✓ SC Pass
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fee Display */}
      {data.network && (
        <FeeBreakdown
          network={data.network}
          tokenSource={data.tokenMode || 'existing'}
          showExample={false}
        />
      )}

      {/* Proceed Indicator */}
      {!canProceed && data.tokenMode && (
        <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            {!data.securityScanStatus
              ? '⏳ Waiting for security scan...'
              : data.securityScanStatus === 'FAIL'
                ? '❌ Security scan must pass to continue'
                : '✓ Ready to proceed!'}
          </p>
        </div>
      )}

      {/* Create Token Dialog */}
      {showCreateDialog && (
        <CreateTokenDialog
          network={data.network!}
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onTokenCreated={handleTokenCreated}
        />
      )}
    </div>
  );
}
