'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Check } from 'lucide-react';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { getExplorerUrl } from '@/lib/contracts/addresses';

interface CreateTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tokenInfo: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  }) => void;
  selectedChain: 'bnb' | 'ethereum' | 'base';
  defaultName?: string;
  defaultSymbol?: string;
}

// Token Factory ABI (minimal for createToken)
const tokenFactoryAbi = [
  {
    type: 'function',
    name: 'createToken',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'decimals', type: 'uint8' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'antiBotConfig', type: 'uint256[3]' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'event',
    name: 'TokenCreated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
    ],
  },
] as const;

// Fee per chain (in native token)
const CREATION_FEES: Record<string, string> = {
  bnb: '0.5', // 0.5 BNB
  ethereum: '0.1', // 0.1 ETH
  base: '0.1', // 0.1 ETH
};

const CHAIN_IDS: Record<string, number> = {
  bnb: 97, // BSC Testnet
  ethereum: 11155111, // Sepolia
  base: 84532, // Base Sepolia
};

const TOKEN_FACTORY_ADDRESSES: Record<string, `0x${string}`> = {
  bnb: '0xB05fd8F59f723ab590aB4eCb47d16701568B4e12',
  ethereum: '0x3e00abF9F9F8F50724EAd093185eEA250601c050',
  base: '0x3e00abF9F9F8F50724EAd093185eEA250601c050',
};

export function CreateTokenModal({
  isOpen,
  onClose,
  onSuccess,
  selectedChain,
  defaultName = '',
  defaultSymbol = '',
  mode = 'standard',
}: CreateTokenModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Form state
  const [name, setName] = useState(defaultName);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [decimals, setDecimals] = useState(18);
  const [totalSupply, setTotalSupply] = useState('1000000');

  // Anti-bot config
  const [enableAntiBot, setEnableAntiBot] = useState(false);
  const [maxTxPercent, setMaxTxPercent] = useState(5);
  const [maxWalletPercent, setMaxWalletPercent] = useState(2);
  const [cooldownSeconds, setCooldownSeconds] = useState(60);

  // Contract interaction
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  // Update defaults when props change
  useEffect(() => {
    setName(defaultName);
    setSymbol(defaultSymbol);
  }, [defaultName, defaultSymbol]);

  // Extract token address from receipt and pass full token info
  useEffect(() => {
    if (isSuccess && receipt) {
      console.log('🔍 ===== TOKEN CREATION SUCCESS =====');
      console.log('📦 Full Receipt:', receipt);
      console.log('📋 Total Logs:', receipt.logs.length);
      
      // Method 1: Try to get from contractCreated event or contractAddress
      if (receipt.contractAddress) {
        console.log('✅ Method 1: Found contractAddress in receipt:', receipt.contractAddress);
        onSuccess({
          address: receipt.contractAddress,
          name,
          symbol,
          decimals,
        });
        return;
      }

      // Method 2: Parse TokenCreated event
      if (receipt.logs && receipt.logs.length > 0) {
        console.log('🔎 Searching through logs...');
        
        // Find TokenCreated event (should have indexed token and owner)
        for (let i = 0; i < receipt.logs.length; i++) {
          const log = receipt.logs[i];
          console.log(`📝 Log ${i}:`, {
            address: log.address,
            topics: log.topics,
            topicsLength: log.topics?.length,
          });
          
          // TokenCreated has 3 topics: [eventHash, token, owner]
          if (log.topics && log.topics.length >= 2) {
            const topic1 = log.topics[1]; // token address
            console.log(`   Topic[1] (token):`, topic1);
            
            if (topic1) {
              // Remove 0x prefix if exists, take last 40 chars, add 0x back
              const cleanHex = topic1.startsWith('0x') ? topic1.slice(2) : topic1;
              const tokenAddress = ('0x' + cleanHex.slice(-40)) as `0x${string}`;
              
              console.log('✅ Extracted Token Address:', tokenAddress);
              
              // Validate it's not zero address
              if (tokenAddress !== '0x0000000000000000000000000000000000000000' && 
                  !tokenAddress.match(/^0x0+$/)) {
                console.log('✅ Valid non-zero address found!');
                onSuccess({
                  address: tokenAddress,
                  name,
                  symbol,
                  decimals,
                });
                return;
              } else {
                console.warn('⚠️ Extracted address is zero, trying next log...');
              }
            }
          }
        }
        
        // Method 3: Fallback to first log's address
        console.log('⚠️ Fallback: Using first log address');
        if (receipt.logs[0]?.address) {
          console.log('📍 First log address:', receipt.logs[0].address);
          onSuccess({
            address: receipt.logs[0].address,
            name,
            symbol,
            decimals,
          });
          return;
        }
      }
      
      console.error('❌ Failed to extract token address from receipt');
    }
  }, [isSuccess, receipt, onSuccess, name, symbol, decimals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !address) {
      alert('Please connect your wallet');
      return;
    }

    const requiredChainId = CHAIN_IDS[selectedChain];
    if (!requiredChainId) {
      alert('Invalid chain selected');
      return;
    }

    if (chainId !== requiredChainId) {
      try {
        await switchChain?.({ chainId: requiredChainId });
        await new Promise((r) => setTimeout(r, 1000));
      } catch {
        alert('Please switch to the correct network');
        return;
      }
    }

    const factoryAddress = TOKEN_FACTORY_ADDRESSES[selectedChain];
    if (!factoryAddress) {
      alert('Token factory not available for this chain');
      return;
    }

    const creationFee = CREATION_FEES[selectedChain]?.[mode] || '0';

    // Anti-bot config: [maxTxPercent * 100, maxWalletPercent * 100, cooldownSeconds]
    const antiBotConfig: readonly [bigint, bigint, bigint] = enableAntiBot
      ? [BigInt(maxTxPercent * 100), BigInt(maxWalletPercent * 100), BigInt(cooldownSeconds)]
      : [BigInt(0), BigInt(0), BigInt(0)];

    try {
      writeContract({
        address: factoryAddress,
        abi: tokenFactoryAbi,
        functionName: 'createToken',
        args: [name, symbol, decimals, parseUnits(totalSupply, decimals), antiBotConfig],
        value: parseEther(creationFee),
      });
    } catch (err) {
      console.error('Token creation failed:', err);
    }
  };

  if (!isOpen) return null;

  const fee = CREATION_FEES[selectedChain]?.[mode];
  const feeSymbol = selectedChain === 'bnb' ? 'BNB' : 'ETH';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-900">
          <h2 className="text-xl font-bold text-white">Create Token</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Token Type (fixed to Standard) */}
          <div className="p-3 bg-green-950/30 border border-green-800/40 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-green-300 font-medium">Standard Token</span>
            </div>
            <p className="text-xs text-green-200/70 mt-1">
              Creates a standard ERC20 token with optional anti-bot protection
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              placeholder="My Token"
              required
            />
          </div>

          {/* Symbol */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              placeholder="MTK"
              maxLength={10}
              required
            />
          </div>

          {/* Decimals */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Decimals</label>
            <input
              type="number"
              value={decimals}
              onChange={(e) => setDecimals(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              min={0}
              max={18}
              required
            />
          </div>

          {/* Total Supply */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Total Supply</label>
            <input
              type="number"
              value={totalSupply}
              onChange={(e) => setTotalSupply(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              placeholder="1000000"
              min={1}
              required
            />
          </div>

          {/* Anti-Bot Toggle */}
          <div className="p-3 bg-gray-800 border border-gray-700 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableAntiBot}
                onChange={(e) => setEnableAntiBot(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600"
              />
              <span className="text-sm text-white">Enable Anti-Bot Protection</span>
            </label>

            {enableAntiBot && (
              <div className="mt-3 space-y-3 pt-3 border-t border-gray-700">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Max TX %</label>
                    <input
                      type="number"
                      value={maxTxPercent}
                      onChange={(e) => setMaxTxPercent(Number(e.target.value))}
                      className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white"
                      min={1}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Max Wallet %</label>
                    <input
                      type="number"
                      value={maxWalletPercent}
                      onChange={(e) => setMaxWalletPercent(Number(e.target.value))}
                      className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white"
                      min={1}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cooldown (s)</label>
                    <input
                      type="number"
                      value={cooldownSeconds}
                      onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                      className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white"
                      min={0}
                      max={3600}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fee Info */}
          <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300">
                Creation Fee:{' '}
                <strong>
                  {fee} {feeSymbol}
                </strong>
              </span>
            </div>
            <p className="text-xs text-blue-200/70 mt-1">100% goes to Treasury</p>
          </div>

          {/* Error */}
          {writeError && (
            <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-lg">
              <p className="text-sm text-red-300">{writeError.message}</p>
            </div>
          )}

          {/* Success */}
          {isSuccess && (
            <div className="p-3 bg-green-950/30 border border-green-800/40 rounded-lg">
              <p className="text-sm text-green-300">✅ Token created successfully!</p>
              {hash && (
                <a
                  href={getExplorerUrl(chainId, hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-400 hover:underline"
                >
                  View transaction →
                </a>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending || isConfirming || !name || !symbol || !totalSupply}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isPending ? 'Confirm in wallet...' : 'Creating...'}
              </>
            ) : (
              'Create Token'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
