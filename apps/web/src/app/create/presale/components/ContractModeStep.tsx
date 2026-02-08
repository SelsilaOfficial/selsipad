'use client';

import { useState } from 'react';
import { Shield, FileCode, Zap, Check, Globe, CheckCircle } from 'lucide-react';

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

export interface ContractModeStepProps {
  selectedMode: 'EXTERNAL_CONTRACT' | 'LAUNCHPAD_TEMPLATE' | null;
  onSelectMode: (mode: 'EXTERNAL_CONTRACT' | 'LAUNCHPAD_TEMPLATE') => void;
  network: string;
  onNetworkChange?: (network: string) => void;
}

export function ContractModeStep({
  selectedMode,
  onSelectMode,
  network,
  onNetworkChange,
}: ContractModeStepProps) {
  const [networkTab, setNetworkTab] = useState<'testnet' | 'mainnet'>(
    ['bnb', 'ethereum', 'base'].includes(network) ? 'mainnet' : 'testnet'
  );

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-2">Choose Contract Source</h2>
        <p className="text-gray-400">Select how you want to deploy your presale contract</p>
      </div>

      {/* Network Selection */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-purple-400" />
          <h3 className="text-base font-semibold text-white">Select Network</h3>
        </div>

        {/* Testnet / Mainnet Tabs */}
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

        {/* Network Buttons */}
        <div className="grid grid-cols-3 gap-3">
          {NETWORKS[networkTab].map((net) => (
            <button
              key={net.id}
              type="button"
              onClick={() => onNetworkChange?.(net.id)}
              className={`relative p-3 rounded-xl border-2 transition-all text-center ${
                network === net.id
                  ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                  : 'border-gray-700 bg-gray-800/60 hover:border-gray-500 hover:bg-gray-800'
              }`}
            >
              <img src={net.icon} alt={net.name} className="w-7 h-7 rounded-full mx-auto mb-1" />
              <div className="text-sm font-medium text-white">{net.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{net.symbol}</div>
              {network === net.id && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* External Contract Option */}
        <button
          type="button"
          onClick={() => onSelectMode('EXTERNAL_CONTRACT')}
          className={`p-6 rounded-xl border-2 transition-all text-left ${
            selectedMode === 'EXTERNAL_CONTRACT'
              ? 'border-purple-600 bg-purple-600/10'
              : 'border-gray-700 hover:border-gray-600 bg-gray-800'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-lg ${
                selectedMode === 'EXTERNAL_CONTRACT' ? 'bg-purple-600/20' : 'bg-gray-700'
              }`}
            >
              <FileCode
                className={`w-8 h-8 ${
                  selectedMode === 'EXTERNAL_CONTRACT' ? 'text-purple-400' : 'text-gray-500'
                }`}
              />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Use My Contract</h3>
              <p className="text-sm text-gray-400 mb-4">
                Bring your own smart contract that you've already deployed
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  {selectedMode === 'EXTERNAL_CONTRACT' ? (
                    <Check className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Shield className="w-4 h-4 text-gray-500" />
                  )}
                  Security scan required
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  {selectedMode === 'EXTERNAL_CONTRACT' ? (
                    <Check className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Check className="w-4 h-4 text-gray-500" />
                  )}
                  Full control over contract
                </div>
              </div>
            </div>
          </div>
        </button>

        {/* Launchpad Template Option */}
        <button
          type="button"
          onClick={() => onSelectMode('LAUNCHPAD_TEMPLATE')}
          className={`p-6 rounded-xl border-2 transition-all text-left ${
            selectedMode === 'LAUNCHPAD_TEMPLATE'
              ? 'border-green-600 bg-green-600/10'
              : 'border-gray-700 hover:border-gray-600 bg-gray-800'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-lg ${
                selectedMode === 'LAUNCHPAD_TEMPLATE' ? 'bg-green-600/20' : 'bg-gray-700'
              }`}
            >
              <Zap
                className={`w-8 h-8 ${
                  selectedMode === 'LAUNCHPAD_TEMPLATE' ? 'text-green-400' : 'text-gray-500'
                }`}
              />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Use Launchpad Template</h3>
              <p className="text-sm text-gray-400 mb-4">
                Deploy from our audited, battle-tested template
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  {selectedMode === 'LAUNCHPAD_TEMPLATE' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Check className="w-4 h-4 text-gray-500" />
                  )}
                  No scan required
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  {selectedMode === 'LAUNCHPAD_TEMPLATE' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Check className="w-4 h-4 text-gray-500" />
                  )}
                  Fast deployment
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  {selectedMode === 'LAUNCHPAD_TEMPLATE' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Shield className="w-4 h-4 text-gray-500" />
                  )}
                  May be audited (based on version)
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Selection Indicator */}
      {selectedMode && (
        <div className="text-center">
          <p className="text-sm text-gray-400">
            Selected:{' '}
            <span className="text-white font-medium">
              {selectedMode === 'EXTERNAL_CONTRACT' ? 'My Contract' : 'Launchpad Template'}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
