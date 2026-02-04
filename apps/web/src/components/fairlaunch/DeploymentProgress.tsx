'use client';

import { CheckCircle2, Loader2, ExternalLink, Copy, CheckIcon } from 'lucide-react';
import { useState } from 'react';

interface DeploymentStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  message?: string;
}

interface DeploymentProgressProps {
  steps: DeploymentStep[];
  transactionHash?: string;
  fairlaunchAddress?: string;
  vestingAddress?: string;
  explorerUrl?: string;
}

export function DeploymentProgress({
  steps,
  transactionHash,
  fairlaunchAddress,
  vestingAddress,
  explorerUrl,
}: DeploymentProgressProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const getStepIcon = (status: DeploymentStep['status']) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'error':
        return <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">!</div>;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-600" />;
    }
  };

  const getStepColor = (status: DeploymentStep['status']) => {
    switch (status) {
      case 'loading':
        return 'text-blue-300';
      case 'success':
        return 'text-green-300';
      case 'error':
        return 'text-red-300';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Deployment Steps */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h3 className="font-semibold text-white mb-6">Deployment Progress</h3>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex gap-4">
              {/* Icon */}
              <div className="flex flex-col items-center">
                {getStepIcon(step.status)}
                {index < steps.length - 1 && (
                  <div className={`w-0.5 h-8 mt-2 ${
                    step.status === 'success' ? 'bg-green-500' : 'bg-gray-700'
                  }`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className={`font-medium ${getStepColor(step.status)}`}>
                  {step.label}
                </div>
                {step.message && (
                  <div className="text-sm text-gray-400 mt-1">{step.message}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction Hash */}
      {transactionHash && (
        <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-blue-300 mb-1">Transaction Hash</p>
              <p className="text-xs text-blue-200 font-mono truncate">
                {transactionHash}
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => copyToClipboard(transactionHash, 'tx')}
                className="p-2 hover:bg-blue-900/30 rounded transition"
                title="Copy"
              >
                {copiedItem === 'tx' ? (
                  <CheckIcon className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-blue-400" />
                )}
              </button>
              {explorerUrl && (
                <a
                  href={`${explorerUrl}/tx/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-blue-900/30 rounded transition"
                  title="View on Explorer"
                >
                  <ExternalLink className="w-4 h-4 text-blue-400" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contract Addresses */}
      {(fairlaunchAddress || vestingAddress) && (
        <div className="space-y-3">
          {fairlaunchAddress && (
            <div className="bg-green-950/30 border border-green-800/40 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-green-300 mb-1 font-medium">Fairlaunch Contract</p>
                  <p className="text-xs text-green-200 font-mono truncate">
                    {fairlaunchAddress}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => copyToClipboard(fairlaunchAddress, 'fairlaunch')}
                    className="p-2 hover:bg-green-900/30 rounded transition"
                    title="Copy"
                  >
                    {copiedItem === 'fairlaunch' ? (
                      <CheckIcon className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-green-400" />
                    )}
                  </button>
                  {explorerUrl && (
                    <a
                      href={`${explorerUrl}/address/${fairlaunchAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-green-900/30 rounded transition"
                      title="View on Explorer"
                    >
                      <ExternalLink className="w-4 h-4 text-green-400" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {vestingAddress && (
            <div className="bg-purple-950/30 border border-purple-800/40 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-purple-300 mb-1 font-medium">Vesting Contract</p>
                  <p className="text-xs text-purple-200 font-mono truncate">
                    {vestingAddress}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => copyToClipboard(vestingAddress, 'vesting')}
                    className="p-2 hover:bg-purple-900/30 rounded transition"
                    title="Copy"
                  >
                    {copiedItem === 'vesting' ? (
                      <CheckIcon className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-purple-400" />
                    )}
                  </button>
                  {explorerUrl && (
                    <a
                      href={`${explorerUrl}/address/${vestingAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-purple-900/30 rounded transition"
                      title="View on Explorer"
                    >
                      <ExternalLink className="w-4 h-4 text-purple-400" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
