'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseAbi, parseEther } from 'viem';
import {
  usePresaleStatus,
  usePresaleConfig,
  usePresaleTotalRaised,
  useFinalizeSuccessEscrow,
} from '@/lib/web3/presale-hooks';
import { PresaleStatusLabel, PresaleStatusColor } from '@/lib/web3/presale-contracts';

interface FinalizationPreview {
  merkleRoot: string;
  totalAllocation: string;
  unsoldToBurn: string;
  tokensForLP: string;
  tokenMinLP: string;
  bnbMinLP: string;
  contributorCount: number;
  snapshotHash: string;
  allocations: Array<{
    wallet: string;
    contribution: string;
    allocation: string;
  }>;
  calldata: {
    target: string;
    data: string;
  };
  // Also accept top-level target from prepare-finalize route
  target?: string;
}

export default function AdminFinalizePage() {
  const params = useParams();
  const { address: adminAddress } = useAccount();

  const [preview, setPreview] = useState<FinalizationPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsoldToBurn, setUnsoldToBurn] = useState('0');
  const [tokensForLP, setTokensForLP] = useState('0');
  const [tokenMinLP, setTokenMinLP] = useState('0');
  const [bnbMinLP, setBnbMinLP] = useState('0');

  // Read contract data
  const { data: status } = usePresaleStatus(
    (preview?.calldata.target || undefined) as `0x${string}` | undefined
  );
  const config = usePresaleConfig(
    (preview?.calldata.target || undefined) as `0x${string}` | undefined
  );
  const { data: totalRaised } = usePresaleTotalRaised(
    (preview?.calldata.target || undefined) as `0x${string}` | undefined
  );

  // Write hook for direct execution (testnet only) — escrow flow
  const {
    finalize: executeFinalize,
    isPending: isExecuting,
    hash: txHash,
  } = useFinalizeSuccessEscrow();

  const enableDirectFinalize = process.env.NEXT_PUBLIC_ENABLE_DIRECT_FINALIZE === 'true';

  // Fetch finalization preview
  const loadPreview = async () => {
    setIsLoadingPreview(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/presale/${params.id}/prepare-finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to prepare finalization');
      }

      const data = await response.json();
      setPreview(data);

      // Autofill LP params from prepare-finalize response
      setUnsoldToBurn(data.unsoldToBurn || '0');
      setTokensForLP(data.tokensForLP || '0');
      setTokenMinLP(data.tokenMinLP || '0');
      setBnbMinLP(data.bnbMinLP || '0');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Direct execution (testnet only) — escrow-based finalization
  const handleDirectExecute = async () => {
    if (!preview) return;

    const roundAddr = (preview.target || preview.calldata?.target) as `0x${string}`;
    try {
      await executeFinalize({
        roundAddress: roundAddr,
        merkleRoot: preview.merkleRoot as `0x${string}`,
        totalAllocation: BigInt(preview.totalAllocation),
        unsoldToBurn: BigInt(unsoldToBurn || '0'),
        tokensForLP: BigInt(tokensForLP || '0'),
        tokenMinLP: BigInt(tokenMinLP || '0'),
        bnbMinLP: BigInt(bnbMinLP || '0'),
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Copy calldata for timelock/multisig
  const copyCalldata = () => {
    if (!preview) return;

    const payload = JSON.stringify(
      {
        target: preview.calldata.target,
        data: preview.calldata.data,
        description: `Finalize Presale #${params.id}`,
      },
      null,
      2
    );

    navigator.clipboard.writeText(payload);
    alert('Calldata copied to clipboard!');
  };

  if (!adminAddress) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">Please connect your admin wallet to continue.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Finalize Presale #{params.id}</h1>
          <p className="text-gray-600">
            Generate Merkle tree, persist proofs, and execute finalization
          </p>
        </div>

        {/* Status Overview */}
        {preview && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Contract Status</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Current Status</span>
                <div className="mt-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${PresaleStatusColor[status || 0]}`}
                  >
                    {PresaleStatusLabel[status || 0]}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-500">Total Raised</span>
                <p className="mt-1 text-lg font-semibold">
                  {totalRaised ? (Number(totalRaised) / 1e18).toFixed(4) : '0'} BNB
                </p>
              </div>

              <div>
                <span className="text-sm text-gray-500">Softcap</span>
                <p className="mt-1 text-lg">
                  {config?.softCap ? (Number(config.softCap) / 1e18).toFixed(2) : '0'} BNB
                </p>
              </div>

              <div>
                <span className="text-sm text-gray-500">Hardcap</span>
                <p className="mt-1 text-lg">
                  {config?.hardCap ? (Number(config.hardCap) / 1e18).toFixed(2) : '0'} BNB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Load Preview Button */}
        {!preview && (
          <div className="bg-white rounded-lg shadow p-6">
            <button
              onClick={loadPreview}
              disabled={isLoadingPreview}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              {isLoadingPreview ? 'Generating Merkle Tree...' : 'Prepare Finalization'}
            </button>

            <p className="text-sm text-gray-500 mt-2 text-center">
              This will generate the Merkle tree and persist proofs to the database
            </p>
          </div>
        )}

        {/* Finalization Preview */}
        {preview && (
          <>
            {/* Merkle Root & Allocations */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Finalization Preview</h2>

              <div className="space-y-4">
                <div>
                  <span className="text-sm text-gray-500">Merkle Root</span>
                  <p className="mt-1 font-mono text-sm bg-gray-100 p-2 rounded break-all">
                    {preview.merkleRoot}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Total Allocation</span>
                    <p className="mt-1 font-semibold">
                      {(Number(preview.totalAllocation) / 1e18).toLocaleString()} Tokens
                    </p>
                  </div>

                  <div>
                    <span className="text-sm text-gray-500">Contributors</span>
                    <p className="mt-1 font-semibold">{preview.contributorCount}</p>
                  </div>

                  <div>
                    <span className="text-sm text-gray-500">Snapshot Hash</span>
                    <p className="mt-1 font-mono text-xs">{preview.snapshotHash.slice(0, 10)}...</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Allocations Table */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Token Allocations</h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                        Wallet
                      </th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">
                        Contribution (BNB)
                      </th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">
                        Allocation (Tokens)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {preview.allocations.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-mono text-sm">
                          {item.wallet.slice(0, 6)}...{item.wallet.slice(-4)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {(Number(item.contribution) / 1e18).toFixed(4)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {(Number(item.allocation) / 1e18).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h2 className="text-lg font-semibold">Execute Finalization</h2>

              {/* Proposal Mode (Production) */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium mb-2">1. Proposal Mode (Recommended)</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Copy calldata for timelock/multisig execution (Production)
                </p>

                <button
                  onClick={copyCalldata}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  📋 Copy Calldata for Timelock
                </button>
              </div>

              {/* Direct Execute (Testnet Only) */}
              {enableDirectFinalize && (
                <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
                  <h3 className="font-medium mb-2">2. Direct Execute (Testnet Only)</h3>
                  <p className="text-sm text-yellow-700 mb-3">
                    ⚠️ Execute finalizeSuccessEscrow directly. Only enabled in testnet.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-sm font-medium text-yellow-800 block mb-1">
                        Unsold to Burn (wei)
                      </label>
                      <input
                        type="text"
                        value={unsoldToBurn}
                        onChange={(e) => setUnsoldToBurn(e.target.value)}
                        placeholder="0"
                        className="w-full border border-yellow-300 rounded px-3 py-1.5 text-sm font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-yellow-800 block mb-1">
                        Tokens for LP (wei)
                      </label>
                      <input
                        type="text"
                        value={tokensForLP}
                        onChange={(e) => setTokensForLP(e.target.value)}
                        placeholder="0"
                        className="w-full border border-yellow-300 rounded px-3 py-1.5 text-sm font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-yellow-800 block mb-1">
                        Token Min LP (wei)
                      </label>
                      <input
                        type="text"
                        value={tokenMinLP}
                        onChange={(e) => setTokenMinLP(e.target.value)}
                        placeholder="0"
                        className="w-full border border-yellow-300 rounded px-3 py-1.5 text-sm font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-yellow-800 block mb-1">
                        BNB Min LP (wei)
                      </label>
                      <input
                        type="text"
                        value={bnbMinLP}
                        onChange={(e) => setBnbMinLP(e.target.value)}
                        placeholder="0"
                        className="w-full border border-yellow-300 rounded px-3 py-1.5 text-sm font-mono bg-white"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-yellow-600 mb-3">
                    Auto-filled from prepare-finalize. Override only if needed.
                  </p>

                  <button
                    onClick={handleDirectExecute}
                    disabled={isExecuting || !!txHash}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
                  >
                    {isExecuting
                      ? 'Executing finalizeSuccessEscrow...'
                      : txHash
                        ? '✅ Executed'
                        : '⚡ Execute Escrow Finalization'}
                  </button>

                  {txHash && (
                    <p className="mt-2 text-sm">
                      TX:{' '}
                      <a
                        href={`https://testnet.bscscan.com/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {txHash.slice(0, 10)}...{txHash.slice(-8)}
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
