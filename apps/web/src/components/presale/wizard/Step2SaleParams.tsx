'use client';

import { useEffect } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { useReadContract } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import type { PresaleSaleParams } from '@/../../packages/shared/src/validators/presale-wizard';

// Minimal ERC20 ABI for totalSupply + decimals + symbol
const ERC20_ABI = [
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface Step2SaleParamsProps {
  data: Partial<PresaleSaleParams>;
  onChange: (data: Partial<PresaleSaleParams>) => void;
  errors?: Partial<Record<keyof PresaleSaleParams, string>>;
  network?: string;
  totalSupply?: string;
  tokenAddress?: string;
  /** Callback: pushes on-chain totalSupply to parent wizard state */
  onTotalSupplyRead?: (supply: string) => void;
  /** Callback: pushes on-chain symbol to parent wizard state */
  onTokenSymbolRead?: (symbol: string) => void;
  /** Callback: pushes on-chain decimals to parent wizard state */
  onTokenDecimalsRead?: (decimals: number) => void;
}

const PAYMENT_TOKENS = [
  { value: 'NATIVE', label: 'Native Token (ETH/BNB/SOL)', desc: 'Chain native token' },
  { value: 'USDC', label: 'USDC', desc: 'USD Coin stablecoin' },
  { value: 'USDT', label: 'USDT', desc: 'Tether stablecoin' },
];

export function Step2SaleParams({
  data,
  onChange,
  errors,
  network,
  totalSupply,
  tokenAddress,
  onTotalSupplyRead,
  onTokenSymbolRead,
  onTokenDecimalsRead,
}: Step2SaleParamsProps) {
  // Resolve token address: prop > data.token_address
  const resolvedAddress = tokenAddress || data.token_address || '';
  const isValidAddress = resolvedAddress.length === 42 && isAddress(resolvedAddress);

  // On-chain: read totalSupply
  const { data: onChainTotalSupply, isLoading: loadingSupply } = useReadContract({
    address: isValidAddress ? (resolvedAddress as `0x${string}`) : undefined,
    abi: ERC20_ABI,
    functionName: 'totalSupply',
    query: { enabled: isValidAddress },
  });

  // On-chain: read decimals
  const { data: onChainDecimals } = useReadContract({
    address: isValidAddress ? (resolvedAddress as `0x${string}`) : undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: isValidAddress },
  });

  // On-chain: read symbol
  const { data: onChainSymbol } = useReadContract({
    address: isValidAddress ? (resolvedAddress as `0x${string}`) : undefined,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: { enabled: isValidAddress },
  });

  // Compute display value: prefer on-chain, fallback to prop
  const decimals = onChainDecimals ?? 18;
  const displaySupply = onChainTotalSupply
    ? formatUnits(onChainTotalSupply, decimals)
    : totalSupply || '';

  // Push on-chain totalSupply back to parent wizard state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (onChainTotalSupply && onTotalSupplyRead) {
      const formatted = formatUnits(onChainTotalSupply, decimals);
      onTotalSupplyRead(formatted);
    }
  }, [onChainTotalSupply, decimals]);

  // Push on-chain symbol back to parent wizard state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (onChainSymbol && onTokenSymbolRead) {
      onTokenSymbolRead(onChainSymbol as string);
    }
  }, [onChainSymbol]);

  // Push on-chain decimals back to parent wizard state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (onChainDecimals !== undefined && onTokenDecimalsRead) {
      onTokenDecimalsRead(Number(onChainDecimals));
    }
  }, [onChainDecimals]);

  const handleChange = (field: keyof PresaleSaleParams, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const getMinStartDate = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    // Return raw datetime-local format (same as Fairlaunch)
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Sale Parameters</h2>
        <p className="text-gray-400">
          Configure the pricing, amounts, and timeline for your presale.
        </p>
      </div>

      {/* Total Supply Info Banner — On-chain read */}
      {isValidAddress && (
        <div className="p-4 bg-purple-900/20 border border-purple-700/40 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">Total Token Supply</span>
            </div>
            {loadingSupply ? (
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            ) : displaySupply && Number(displaySupply) > 0 ? (
              <span className="text-white font-bold text-lg">
                {Number(displaySupply).toLocaleString()}
              </span>
            ) : (
              <span className="text-gray-500 text-sm">Unable to read</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Auto-detected from your token contract on-chain. Tokens for sale must be less than total
            supply.
          </p>
        </div>
      )}

      {/* Token Address */}
      <div>
        <label htmlFor="token_address" className="block text-sm font-medium text-white mb-2">
          Token Contract Address <span className="text-red-400">*</span>
        </label>
        <input
          id="token_address"
          type="text"
          value={data.token_address || ''}
          onChange={(e) => handleChange('token_address', e.target.value)}
          placeholder={network === 'solana' ? 'Solana token mint address' : '0x...'}
          className={`w-full px-4 py-3 bg-gray-900 border ${
            errors?.token_address ? 'border-red-500' : 'border-gray-700'
          } rounded-lg text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors`}
        />
        {errors?.token_address && (
          <p className="mt-2 text-sm text-red-400">{errors.token_address}</p>
        )}
      </div>

      {/* Grid: Total Tokens & Price */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="total_tokens" className="block text-sm font-medium text-white mb-2">
            Total Tokens for Sale <span className="text-red-400">*</span>
          </label>
          <input
            id="total_tokens"
            type="text"
            value={data.total_tokens || ''}
            onChange={(e) => handleChange('total_tokens', e.target.value)}
            placeholder="1000000"
            className={`w-full px-4 py-3 bg-gray-900 border ${
              errors?.total_tokens ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500`}
          />
          {errors?.total_tokens && (
            <p className="mt-2 text-sm text-red-400">{errors.total_tokens}</p>
          )}
        </div>

        <div>
          <label htmlFor="price" className="block text-sm font-medium text-white mb-2">
            Price per Token <span className="text-red-400">*</span>
          </label>
          <input
            id="price"
            type="text"
            value={data.price || ''}
            onChange={(e) => handleChange('price', e.target.value)}
            placeholder="0.01"
            className={`w-full px-4 py-3 bg-gray-900 border ${
              errors?.price ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500`}
          />
          {errors?.price && <p className="mt-2 text-sm text-red-400">{errors.price}</p>}
        </div>
      </div>

      {/* Grid: Softcap & Hardcap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="softcap" className="block text-sm font-medium text-white mb-2">
            Softcap <span className="text-red-400">*</span>
          </label>
          <input
            id="softcap"
            type="text"
            value={data.softcap || ''}
            onChange={(e) => handleChange('softcap', e.target.value)}
            placeholder="50000"
            className={`w-full px-4 py-3 bg-gray-900 border ${
              errors?.softcap ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500`}
          />
          {errors?.softcap && <p className="mt-2 text-sm text-red-400">{errors.softcap}</p>}
          <p className="mt-1 text-xs text-gray-500">Minimum goal for success</p>
        </div>

        <div>
          <label htmlFor="hardcap" className="block text-sm font-medium text-white mb-2">
            Hardcap <span className="text-red-400">*</span>
          </label>
          <input
            id="hardcap"
            type="text"
            value={data.hardcap || ''}
            onChange={(e) => handleChange('hardcap', e.target.value)}
            placeholder="100000"
            className={`w-full px-4 py-3 bg-gray-900 border ${
              errors?.hardcap ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500`}
          />
          {errors?.hardcap && <p className="mt-2 text-sm text-red-400">{errors.hardcap}</p>}
          <p className="mt-1 text-xs text-gray-500">Maximum amount to raise</p>
        </div>
      </div>

      {/* Grid: Min & Max Contribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="min_contribution" className="block text-sm font-medium text-white mb-2">
            Min Contribution <span className="text-red-400">*</span>
          </label>
          <input
            id="min_contribution"
            type="text"
            value={data.min_contribution || ''}
            onChange={(e) => handleChange('min_contribution', e.target.value)}
            placeholder="0.1"
            className={`w-full px-4 py-3 bg-gray-900 border ${
              errors?.min_contribution ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500`}
          />
          {errors?.min_contribution && (
            <p className="mt-2 text-sm text-red-400">{errors.min_contribution}</p>
          )}
        </div>

        <div>
          <label htmlFor="max_contribution" className="block text-sm font-medium text-white mb-2">
            Max Contribution <span className="text-red-400">*</span>
          </label>
          <input
            id="max_contribution"
            type="text"
            value={data.max_contribution || ''}
            onChange={(e) => handleChange('max_contribution', e.target.value)}
            placeholder="10"
            className={`w-full px-4 py-3 bg-gray-900 border ${
              errors?.max_contribution ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500`}
          />
          {errors?.max_contribution && (
            <p className="mt-2 text-sm text-red-400">{errors.max_contribution}</p>
          )}
        </div>
      </div>

      {/* Payment Token */}
      <div>
        <label className="block text-sm font-medium text-white mb-3">
          Payment Token <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PAYMENT_TOKENS.map((token) => (
            <button
              key={token.value}
              type="button"
              onClick={() => handleChange('payment_token', token.value as any)}
              className={`p-4 rounded-lg border-2 transition-all ${
                data.payment_token === token.value
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
              }`}
            >
              <div className="text-left">
                <div
                  className={`font-semibold ${
                    data.payment_token === token.value ? 'text-white' : 'text-gray-300'
                  }`}
                >
                  {token.label}
                </div>
                <div className="text-xs text-gray-500 mt-1">{token.desc}</div>
              </div>
            </button>
          ))}
        </div>
        {errors?.payment_token && (
          <p className="mt-2 text-sm text-red-400">{errors.payment_token}</p>
        )}
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="start_at" className="block text-sm font-medium text-white mb-2">
            Start Time (UTC+7 / WIB) <span className="text-red-400">*</span>
          </label>
          <input
            id="start_at"
            type="datetime-local"
            value={data.start_at || ''}
            onChange={(e) => handleChange('start_at', e.target.value)}
            min={getMinStartDate()}
            className={`w-full px-4 py-3 bg-gray-900 border ${
              errors?.start_at ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white focus:outline-none focus:border-purple-500`}
          />
          <p className="text-xs text-gray-500 mt-1">Indonesia Western Time (WIB)</p>
          {errors?.start_at && <p className="mt-2 text-sm text-red-400">{errors.start_at}</p>}
        </div>

        <div>
          <label htmlFor="end_at" className="block text-sm font-medium text-white mb-2">
            End Time (UTC+7 / WIB) <span className="text-red-400">*</span>
          </label>
          <input
            id="end_at"
            type="datetime-local"
            value={data.end_at || ''}
            onChange={(e) => handleChange('end_at', e.target.value)}
            min={data.start_at || ''}
            className={`w-full px-4 py-3 bg-gray-900 border ${
              errors?.end_at ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white focus:outline-none focus:border-purple-500`}
          />
          <p className="text-xs text-gray-500 mt-1">Indonesia Western Time (WIB)</p>
          {errors?.end_at && <p className="mt-2 text-sm text-red-400">{errors.end_at}</p>}
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg flex gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-300">
          <strong className="text-white">Recommended Settings:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>Start time: At least 1 hour in the future</li>
            <li>Duration: 3-7 days for optimal participation</li>
            <li>Softcap: 50-70% of hardcap</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
