'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { 
  getTokenCreationFee, 
  TOKEN_FACTORY_ADDRESSES,
  SimpleTokenFactoryABI 
} from '@/lib/web3/token-factory';
import type { Address } from 'viem';

type TokenCreationFormProps = {
  network: string;
  onTokenCreated: (address: string) => void;
};

export function TokenCreationForm({ network, onTokenCreated }: TokenCreationFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    totalSupply: '',
    decimals: 18,
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleCreate = async () => {
    if (!formData.name || !formData.symbol || !formData.totalSupply) {
      alert('All fields required');
      return;
    }

    try {
      const factoryAddress = TOKEN_FACTORY_ADDRESSES[network] as Address;
      const creationFee = getTokenCreationFee(network);
      const totalSupply = BigInt(formData.totalSupply) * (10n ** BigInt(formData.decimals));

      await writeContract({
        address: factoryAddress,
        abi: SimpleTokenFactoryABI,
        functionName: 'createToken',
        args: [formData.name, formData.symbol, totalSupply, formData.decimals],
        value: creationFee,
      });
    } catch (error: any) {
      alert('Token creation failed: ' + error.message);
    }
  };

  const fee = getTokenCreationFee(network);
  const feeDisplay = `${(Number(fee) / 1e18).toFixed(4)} ${network.includes('bsc') ? 'BNB' : 'ETH'}`;

  return (
    <div className="space-y-4 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
      <div className="text-sm text-blue-300 mb-3">
        ℹ️ Platform tokens are auto-approved with Gold SAFU Shield
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Token Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            placeholder="My Token"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Symbol</label>
          <input
            type="text"
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            placeholder="MTK"
            maxLength={10}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Total Supply</label>
        <input
          type="number"
          value={formData.totalSupply}
          onChange={(e) => setFormData({ ...formData, totalSupply: e.target.value })}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
          placeholder="1000000"
        />
        <p className="text-gray-500 text-xs mt-1">Before decimals. Example: 1000000 = 1M tokens</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Decimals</label>
        <select
          value={formData.decimals}
          onChange={(e) => setFormData({ ...formData, decimals: parseInt(e.target.value) })}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value={18}>18 (Standard)</option>
          <option value={9}>9 (Solana-style)</option>
          <option value={6}>6 (USDC-style)</option>
        </select>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <div className="flex justify-between text-sm mb-3">
          <span className="text-gray-400">Creation Fee:</span>
          <span className="text-white font-mono">{feeDisplay}</span>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending || isConfirming || !formData.name || !formData.symbol || !formData.totalSupply}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg"
        >
          {isPending || isConfirming ? 'Creating Token...' : 'Create Token'}
        </button>

        {isSuccess && (
          <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="text-green-400 text-sm">✅ Token created! Check transaction for address.</div>
          </div>
        )}
      </div>
    </div>
  );
}
