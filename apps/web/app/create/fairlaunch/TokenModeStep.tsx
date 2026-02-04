'use client';

import { useState } from 'react';
import { isTokenFactoryAvailable } from '@/lib/web3/token-factory';
import { CreateTokenDialog } from '@/components/fairlaunch/CreateTokenDialog';

type TokenModeStepProps = {
  network: string;
  tokenMode: 'create' | 'existing';
  setTokenMode: (mode: 'create' | 'existing') => void;
  tokenAddress: string;
  onTokenAddressChange: (address: string) => void;
  onTokenCreated: (address: string) => void;
  error?: string;
};

export function TokenModeStep({
  network,
  tokenMode,
  setTokenMode,
  tokenAddress,
  onTokenAddressChange,
  onTokenCreated,
  error,
}: TokenModeStepProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const factoryAvailable = isTokenFactoryAvailable(network);

  const handleTokenCreated = (data: { address: string; name: string; symbol: string; decimals: number; totalSupply: string }) => {
    onTokenCreated(data.address);
    onTokenAddressChange(data.address);
    setShowCreateDialog(false);
  };

  return (
    <div>
      {/* Token Address Input */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Token Address
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={tokenAddress}
            onChange={(e) => onTokenAddressChange(e.target.value)}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm placeholder-gray-500"
            placeholder="Masukkan alamat token atau buat token baru"
          />
          
          {factoryAvailable && (
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all shadow-lg whitespace-nowrap"
            >
              Create Token
            </button>
          )}
        </div>
        
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

        {/* Info Box */}
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-blue-300 text-xs">
            ℹ️ <strong>Create Token:</strong> Token yang dibuat melalui platform otomatis mendapat Gold SAFU Shield (aman).
            <br />
            💡 <strong>Existing Token:</strong> Memerlukan SC Scan untuk verifikasi keamanan.
          </p>
        </div>
      </div>

      {/* Create Token Dialog */}
      <CreateTokenDialog
        network={network}
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onTokenCreated={handleTokenCreated}
      />
    </div>
  );
}
