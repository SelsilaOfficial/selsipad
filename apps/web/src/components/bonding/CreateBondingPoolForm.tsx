'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEXSelect, FeeSplitDisplay } from './DEXSelector';
import type { CreateBondingPoolRequest, DEXType } from '@selsipad/shared';

interface CreateBondingPoolFormProps {
  projectId: string;
  onSuccess?: (poolId: string) => void;
}

export function CreateBondingPoolForm({ projectId, onSuccess }: CreateBondingPoolFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    token_name: '',
    token_symbol: '',
    token_decimals: 9,
    total_supply: '',
    virtual_sol_reserves: '',
    virtual_token_reserves: '',
    graduation_threshold_sol: '',
    target_dex: 'RAYDIUM' as DEXType,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'token_decimals' ? parseInt(value, 10) : value,
    }));
  };

  const handleDexChange = (dex: DEXType) => {
    setFormData((prev) => ({
      ...prev,
      target_dex: dex,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate form
      if (
        !formData.token_name ||
        !formData.token_symbol ||
        !formData.total_supply ||
        !formData.virtual_sol_reserves ||
        !formData.virtual_token_reserves ||
        !formData.graduation_threshold_sol
      ) {
        throw new Error('All fields are required');
      }

      // Validate numbers
      const totalSupply = BigInt(formData.total_supply);
      const virtualSol = BigInt(formData.virtual_sol_reserves);
      const virtualTokens = BigInt(formData.virtual_token_reserves);
      const threshold = BigInt(formData.graduation_threshold_sol);

      if (totalSupply <= 0n || virtualSol <= 0n || virtualTokens <= 0n || threshold <= 0n) {
        throw new Error('All amounts must be positive');
      }

      const request: CreateBondingPoolRequest = {
        project_id: projectId,
        token_name: formData.token_name,
        token_symbol: formData.token_symbol,
        token_decimals: formData.token_decimals,
        total_supply: formData.total_supply,
        virtual_sol_reserves: formData.virtual_sol_reserves,
        virtual_token_reserves: formData.virtual_token_reserves,
        graduation_threshold_sol: formData.graduation_threshold_sol,
        target_dex: formData.target_dex,
      };

      const response = await fetch('/api/v1/bonding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create pool');
      }

      const pool = await response.json();
      onSuccess?.(pool.id);
      router.push(`/bonding-curve/${pool.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Token Information Section */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
        <h3 className="font-bold text-lg">Token Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Token Name</label>
            <input
              type="text"
              name="token_name"
              value={formData.token_name}
              onChange={handleInputChange}
              placeholder="e.g., MyToken"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Token Symbol</label>
            <input
              type="text"
              name="token_symbol"
              value={formData.token_symbol}
              onChange={handleInputChange}
              placeholder="e.g., MYT"
              maxLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Decimals</label>
            <select
              name="token_decimals"
              value={formData.token_decimals}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {Array.from({ length: 19 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Total Supply (in base units)</label>
            <input
              type="text"
              name="total_supply"
              value={formData.total_supply}
              onChange={handleInputChange}
              placeholder="e.g., 1000000000000000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
              required
            />
          </div>
        </div>
      </div>

      {/* AMM Configuration Section */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
        <h3 className="font-bold text-lg">Bonding Curve Configuration</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Virtual SOL Reserves (lamports)
            </label>
            <input
              type="text"
              name="virtual_sol_reserves"
              value={formData.virtual_sol_reserves}
              onChange={handleInputChange}
              placeholder="e.g., 10000000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
              required
            />
            <p className="text-xs text-gray-500 mt-1">10 SOL = 10000000000 lamports</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Virtual Token Reserves (base units)
            </label>
            <input
              type="text"
              name="virtual_token_reserves"
              value={formData.virtual_token_reserves}
              onChange={handleInputChange}
              placeholder="e.g., 1000000000000000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Graduation Threshold (lamports)</label>
          <input
            type="text"
            name="graduation_threshold_sol"
            value={formData.graduation_threshold_sol}
            onChange={handleInputChange}
            placeholder="e.g., 50000000000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Pool will graduate to DEX once this SOL amount is collected
          </p>
        </div>
      </div>

      {/* Fee Configuration Info */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="font-bold text-lg mb-4">Fee Structure</h3>
        <FeeSplitDisplay swapFeeBps={150} />
        <p className="text-xs text-gray-600 mt-3">
          • Deploy Fee: 0.5 SOL (one-time) <br />• Migration Fee: 2.5 SOL (upon graduation)
        </p>
      </div>

      {/* DEX Selection */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
        <h3 className="font-bold text-lg">Select DEX for Graduation</h3>
        <p className="text-sm text-gray-600">
          When your bonding curve reaches the graduation threshold, liquidity will be migrated to
          the selected DEX.
        </p>
        <DEXSelect value={formData.target_dex} onChange={handleDexChange} />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors"
      >
        {loading ? 'Creating Pool...' : 'Create Bonding Curve Pool'}
      </button>
    </form>
  );
}
