'use client';

import { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { decodeEventLog } from 'viem';
import {
  getTokenCreationFee,
  getTokenFactoryAddress,
  SimpleTokenFactoryABI,
} from '@/lib/web3/token-factory';

export interface TemplateModeStepProps {
  templateVersion: string;
  network: string;
  templateAuditStatus: 'VALID' | 'NOT_AUDITED' | null;
  onTokenCreated?: (data: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  }) => void;
}

export function TemplateModeStep({
  templateVersion,
  network,
  templateAuditStatus,
  onTokenCreated,
}: TemplateModeStepProps) {
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    totalSupply: '',
    decimals: 18,
  });

  const [createdToken, setCreatedToken] = useState<{
    address: string;
    name: string;
    symbol: string;
  } | null>(null);

  const { writeContract, data: hash, isPending, reset, error: writeError } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  const creationFee = getTokenCreationFee(network);
  const nativeCurrency = network.includes('bsc') || network === 'bnb' ? 'BNB' : 'ETH';
  const feeDisplay = `${(Number(creationFee) / 1e18).toFixed(2)} ${nativeCurrency}`;
  const explorerBase =
    network === 'bsc_testnet'
      ? 'https://testnet.bscscan.com'
      : network === 'bnb'
        ? 'https://bscscan.com'
        : network === 'sepolia'
          ? 'https://sepolia.etherscan.io'
          : network === 'base_sepolia'
            ? 'https://sepolia.basescan.org'
            : network === 'base'
              ? 'https://basescan.org'
              : 'https://etherscan.io';

  // Extract token address on success
  useEffect(() => {
    if (!isSuccess || !receipt?.logs) return;

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

          // Auto-verify on BSCScan
          const chainId = network === 'bsc_testnet' ? 97 : network === 'bnb' ? 56 : undefined;
          if (chainId) {
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
                chainId,
              }),
            }).catch((err) => console.error('Verification failed:', err));
          }

          setCreatedToken({
            address: tokenAddress,
            name: formData.name,
            symbol: formData.symbol,
          });

          onTokenCreated?.({
            address: tokenAddress,
            name: formData.name,
            symbol: formData.symbol,
            decimals: formData.decimals,
            totalSupply: formData.totalSupply,
          });
          break;
        }
      } catch {
        continue;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, receipt]);

  const handleCreate = () => {
    if (!formData.name || !formData.symbol || !formData.totalSupply) return;

    const factoryAddress = getTokenFactoryAddress(network);
    const totalSupply = BigInt(formData.totalSupply) * 10n ** BigInt(formData.decimals);

    writeContract({
      address: factoryAddress,
      abi: SimpleTokenFactoryABI,
      functionName: 'createToken',
      args: [formData.name, formData.symbol, totalSupply, formData.decimals],
      value: creationFee,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-2">Launchpad Template</h2>
        <p className="text-gray-400">Your presale will be deployed using our audited template</p>
      </div>

      {/* Template Info Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Template Information</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Version</p>
            <code className="text-white font-mono text-sm">{templateVersion}</code>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Network</p>
            <p className="text-white text-sm font-medium">{network}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Method</p>
            <p className="text-white text-sm">Factory Deploy</p>
          </div>
        </div>
      </div>

      {/* Audit Status Banner */}
      {templateAuditStatus === 'VALID' ? (
        <div className="bg-green-950/30 border border-green-800 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <Shield className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-green-300 mb-2">✅ Audited Template</h4>
              <p className="text-green-200/80 text-sm mb-3">
                This template version has been professionally audited and verified. Your project
                will automatically receive the <strong>PROJECT_AUDITED</strong> badge upon
                deployment.
              </p>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400 font-medium">
                  Eligible for PROJECT_AUDITED badge
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-8 h-8 text-gray-500 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-300 mb-2">🏭 Factory Verified</h4>
              <p className="text-gray-400 text-sm mb-3">
                This template version has not yet been audited. Your contract will be deployed from
                our verified factory, but will not receive the PROJECT_AUDITED badge.
              </p>
              <p className="text-gray-500 text-sm">
                The contract is still safe to use and follows our standard template pattern.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Inline Token Creation Form — shown BEFORE token is created */}
      {!createdToken && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Create Token</h3>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
              placeholder="Ethereum"
              disabled={isPending || isConfirming}
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
              disabled={isPending || isConfirming}
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
              disabled={isPending || isConfirming}
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
              disabled={isPending || isConfirming}
            />
            <p className="text-xs text-gray-500 mt-1">
              Before decimals (e.g., 1000000 = 1M tokens)
            </p>
          </div>

          {/* Creation Fee + Create Button */}
          <div className="pt-4 border-t border-gray-700">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-400">Creation Fee:</span>
              <span className="text-green-400 font-semibold">{feeDisplay}</span>
            </div>

            {/* Error */}
            {writeError && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{writeError.message?.slice(0, 200)}</p>
              </div>
            )}

            {/* TX Status */}
            {hash && (
              <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-300">
                    {isConfirming ? 'Confirming...' : 'Transaction sent'}
                  </span>
                  <a
                    href={`${explorerBase}/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}

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
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {isPending ? 'Confirm in Wallet...' : 'Creating Token...'}
                </>
              ) : (
                'Create Token'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Token Created Success — shown AFTER token is created */}
      {createdToken && (
        <div className="bg-green-950/30 border border-green-800/40 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-200 mb-2">✅ Token Created Successfully</h4>
              <p className="text-green-300/90 text-sm mb-3">
                Your token has been deployed and automatically assigned security badges.
              </p>
              <div className="bg-green-900/40 border border-green-800/30 rounded-lg p-3 mb-3">
                <p className="text-xs text-green-300 mb-1">Token Address:</p>
                <p className="text-sm text-green-200 font-mono break-all">{createdToken.address}</p>
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-1 bg-green-900/40 border border-green-700/40 rounded-full text-sm text-green-300">
                  🛡️ SAFU
                </div>
                <div className="px-3 py-1 bg-green-900/40 border border-green-700/40 rounded-full text-sm text-green-300">
                  ✓ SC Pass
                </div>
              </div>
              {hash && (
                <a
                  href={`${explorerBase}/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-green-400 text-sm hover:underline flex items-center gap-1"
                >
                  View transaction <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deploy Smart Contract Button — shown AFTER token is created */}
      {createdToken && (
        <div className="flex flex-col gap-4">
          <button
            disabled
            className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 opacity-70 cursor-not-allowed"
          >
            <CheckCircle className="w-5 h-5" />
            Token Deployed ✓ — Click Next to Continue
          </button>
        </div>
      )}

      {/* Benefits List */}
      <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-4">
        <h4 className="text-blue-300 font-medium mb-3">Template Benefits:</h4>
        <ul className="text-blue-200/80 text-sm space-y-2">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
            No security scan required
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
            Battle-tested code used by many projects
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
            Fast deployment via factory
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
            Community support and documentation
          </li>
        </ul>
      </div>
    </div>
  );
}
