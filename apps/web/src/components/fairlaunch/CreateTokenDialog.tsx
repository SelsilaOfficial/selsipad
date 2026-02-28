'use client';

import { useState, useEffect } from 'react';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { X } from 'lucide-react';
import {
  getTokenCreationFee,
  TOKEN_FACTORY_ADDRESSES,
  SimpleTokenFactoryABI,
} from '@/lib/web3/token-factory';
import type { Address } from 'viem';
import { decodeEventLog, encodeFunctionData } from 'viem';

// Chain ID mapping
const CHAIN_IDS: Record<string, number> = {
  bsc_testnet: 97,
  bnb: 56,
  sepolia: 11155111,
  ethereum: 1,
  base_sepolia: 84532,
  base: 8453,
};

type CreateTokenDialogProps = {
  network: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokenCreated: (data: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  }) => void;
};

export function CreateTokenDialog({
  network,
  open,
  onOpenChange,
  onTokenCreated,
}: CreateTokenDialogProps) {
  const [formData, setFormData] = useState({
    type: 'standard',
    name: '',
    symbol: '',
    totalSupply: '',
    decimals: 18,
  });

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Use sendTransaction instead of writeContract to BYPASS wagmi's simulation
  // which sends simulation to the wrong chain for Base Sepolia
  const { sendTransaction, data: hash, isPending, error: txError, reset } = useSendTransaction();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  // Extract token address when transaction succeeds
  useEffect(() => {
    if (isSuccess && receipt && receipt.logs) {
      try {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: SimpleTokenFactoryABI,
              data: log.data,
              topics: log.topics,
            });

            if (decoded.eventName === 'TokenCreated') {
              const tokenAddress = (decoded.args as any).token as string;
              const creatorAddress = (decoded.args as any).creator as string;
              console.log('Token created:', tokenAddress);

              // Auto-verify token on BSCScan
              const verifyChainId = network.includes('bsc_testnet')
                ? 97
                : network.includes('bnb')
                  ? 56
                  : undefined;
              if (verifyChainId) {
                const totalSupplyWei = (
                  BigInt(formData.totalSupply) *
                  10n ** BigInt(formData.decimals)
                ).toString();

                fetch('/api/internal/verify-factory-token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    tokenAddress,
                    name: formData.name,
                    symbol: formData.symbol,
                    totalSupply: totalSupplyWei,
                    decimals: formData.decimals,
                    ownerAddress: creatorAddress,
                    chainId: verifyChainId,
                  }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.success) {
                      console.log('✅ Token verification submitted:', data.guid);
                    } else {
                      console.error('❌ Verification failed:', data.error);
                    }
                  })
                  .catch((err) => console.error('❌ Verification request failed:', err));
              }

              onTokenCreated({
                address: tokenAddress,
                name: formData.name,
                symbol: formData.symbol,
                decimals: formData.decimals,
                totalSupply: formData.totalSupply,
              });

              setTimeout(() => {
                reset();
                setFormData({
                  type: 'standard',
                  name: '',
                  symbol: '',
                  totalSupply: '',
                  decimals: 18,
                });
                onOpenChange(false);
              }, 2000);
              break;
            }
          } catch (e) {
            continue;
          }
        }
      } catch (error) {
        console.error('Error extracting token address:', error);
      }
    }
  }, [isSuccess, receipt, onTokenCreated, onOpenChange, reset]);

  const handleCreate = async () => {
    if (!formData.name || !formData.symbol || !formData.totalSupply) {
      alert('Semua field harus diisi!');
      return;
    }

    if (!isConnected || !address) {
      alert('Please connect your wallet');
      return;
    }

    const requiredChainId = CHAIN_IDS[network];
    if (!requiredChainId) {
      alert('Invalid chain selected');
      return;
    }

    console.log(`[CreateToken] Current chainId: ${chainId}, Required: ${requiredChainId}`);

    if (chainId !== requiredChainId) {
      try {
        console.log(`[CreateToken] Switching chain to ${requiredChainId}...`);
        await switchChain?.({ chainId: requiredChainId });
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err: any) {
        console.error('[CreateToken] Chain switch failed:', err);
        alert('Please switch to the correct network in your wallet');
        return;
      }
    }

    const factoryAddress = TOKEN_FACTORY_ADDRESSES[network] as Address;
    if (!factoryAddress || factoryAddress === '0x0000000000000000000000000000000000000000') {
      alert('Token factory not available for this chain');
      return;
    }

    const creationFee = getTokenCreationFee(network);
    const totalSupply = BigInt(formData.totalSupply) * 10n ** BigInt(formData.decimals);

    console.log(`[CreateToken] Factory: ${factoryAddress}`);
    console.log(`[CreateToken] Fee: ${creationFee}`);
    console.log(`[CreateToken] Args: ${formData.name}, ${formData.symbol}, ${totalSupply}, ${formData.decimals}`);

    // Encode the function call data manually
    // This bypasses wagmi's writeContract simulation which sends it to wrong chain
    const callData = encodeFunctionData({
      abi: SimpleTokenFactoryABI,
      functionName: 'createToken',
      args: [formData.name, formData.symbol, totalSupply, formData.decimals],
    });

    console.log(`[CreateToken] Encoded calldata: ${callData.slice(0, 20)}...`);
    console.log(`[CreateToken] Sending raw transaction (no simulation)...`);

    try {
      // sendTransaction sends directly to MetaMask WITHOUT simulation
      // MetaMask handles the chain routing correctly since it's already on Base Sepolia
      sendTransaction({
        to: factoryAddress,
        data: callData,
        value: creationFee,
        chainId: requiredChainId,
      });
    } catch (err) {
      console.error('[CreateToken] Token creation failed:', err);
    }
  };

  if (!open) return null;

  const fee = getTokenCreationFee(network);
  const feeDisplay = `${(Number(fee) / 1e18).toFixed(2)} ${network.includes('bsc') ? 'BNB' : 'ETH'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Create Token</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tokenType"
                  value="standard"
                  checked={formData.type === 'standard'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-4 h-4 text-blue-500"
                />
                <span className="text-sm text-white">
                  Standard Token
                  <span className="ml-2 text-xs text-blue-400">(Recommended)</span>
                </span>
              </label>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
              placeholder="Ethereum"
            />
          </div>

          {/* Symbol */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Symbol</label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
              placeholder="ETH"
              maxLength={10}
            />
          </div>

          {/* Decimals */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Decimals</label>
            <input
              type="number"
              value={formData.decimals}
              onChange={(e) =>
                setFormData({ ...formData, decimals: parseInt(e.target.value) || 18 })
              }
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              placeholder="18"
              min="1"
              max="18"
            />
          </div>

          {/* Total Supply */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Total supply</label>
            <input
              type="number"
              value={formData.totalSupply}
              onChange={(e) => setFormData({ ...formData, totalSupply: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              placeholder="1000000"
            />
            <p className="text-xs text-gray-500 mt-1">
              Before decimals (e.g., 1000000 = 1M tokens)
            </p>
          </div>

          {/* Anti-Bot (disabled) */}
          <div className="flex items-center gap-2 opacity-50">
            <input type="checkbox" disabled className="w-4 h-4" />
            <label className="text-sm text-gray-500">Implement Selsila Anti-Bot System</label>
          </div>

          {/* Error Display */}
          {txError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="text-red-400 text-sm">❌ {(txError as any).shortMessage || txError.message}</div>
            </div>
          )}

          {/* Creation Fee */}
          <div className="pt-4 border-t border-gray-700">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-400">Creation Fee:</span>
              <span className="text-green-400 font-semibold">{feeDisplay}</span>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={
                isPending ||
                isConfirming ||
                !formData.name ||
                !formData.symbol ||
                !formData.totalSupply
              }
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg"
            >
              {isPending || isConfirming ? 'Creating Token...' : 'Create Token'}
            </button>

            {isSuccess && (
              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="text-green-400 text-sm">✅ Token berhasil dibuat!</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
