'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Save, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

// Ensure this matches your deployment
const FACTORY_ADDRESS = '0x9cE2f9284EF7C711ec541f1bC07c844097722618';
const CREATE_FEE = '0.05'; // 0.05 BNB

const FACTORY_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "string", "name": "_symbol", "type": "string" },
      { "internalType": "address", "name": "_referrer", "type": "address" }
    ],
    "name": "launchToken",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

// ===== BONDING CURVE SCHEMA (EVM ONLY) =====
const bondingCurveBasicsSchema = z.object({
  name: z.string().min(3, 'Min 3 characters'),
  symbol: z.string().min(2, 'Min 2 characters').max(10, 'Max 10 characters'),
  description: z.string().min(10, 'Min 10 characters'),
  logo_url: z.string().url('Must be valid URL').optional().or(z.literal('')),
});

interface CreateBondingCurveWizardProps {
  walletAddress: string;
}

const STORAGE_KEY = 'wizard:bondingcurve:v2:evm';

const BONDING_CURVE_STEPS = [
  { id: 1, name: 'Basic Info', description: 'Token details' },
  { id: 2, name: 'Fees & Rules', description: 'Cost disclosure' },
  { id: 3, name: 'Review', description: 'Summary' },
  { id: 4, name: 'Deploy', description: 'Create pool' },
];

export function CreateBondingCurveWizard({ walletAddress }: CreateBondingCurveWizardProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<any>({});
  
  const [wizardData, setWizardData] = useState({
    basics: { 
      name: '', 
      symbol: '', 
      description: '', 
      logo_url: '' 
    },
    // The referral address if the user arrived via a tracking link (defaulting to zero address if none)
    referrer: '0x0000000000000000000000000000000000000000',
  });

  // Wagmi hooks for smart contract interaction
  const { writeContract, data: txHash, isPending: isTxPending, error: txError } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Load active referrer from URL or query params (mocked implementation for now)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
      setWizardData(prev => ({ ...prev, referrer: ref }));
    }
  }, []);

  // Load draft
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          // Merge with current referring address if applicable
          const parsed = JSON.parse(saved);
          setWizardData(prev => ({ 
            ...parsed, 
            referrer: prev.referrer !== '0x0000000000000000000000000000000000000000' 
                        ? prev.referrer 
                        : parsed.referrer 
          }));
        } catch (e) {
          console.error('Failed to load bonding curve draft:', e);
        }
      }
    }
  }, []);

  // Save draft
  useEffect(() => {
    if (wizardData.basics?.name) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wizardData));
    }
  }, [wizardData]);

  // Navigate on exact confirmed
  useEffect(() => {
    if (isTxSuccess) {
      localStorage.removeItem(STORAGE_KEY);
      router.push(`/bonding-curve?created=true&tx=${txHash}`);
    }
  }, [isTxSuccess, router, txHash]);

  const validateStep = (step: number): boolean => {
    setErrors({});
    try {
      switch (step) {
        case 1:
          bondingCurveBasicsSchema.parse(wizardData.basics);
          break;
        case 3:
          if (!termsAccepted) {
            setErrors({ terms: 'You must accept the terms' });
            return false;
          }
          break;
      }
      return true;
    } catch (error: any) {
      if (error.errors) {
        const fieldErrors: any = {};
        error.errors.forEach((err: any) => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps([...completedSteps, currentStep]);
      }
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDeploy = () => {
    if (!isConnected) {
      alert("Please connect your wallet first.");
      return;
    }

    try {
      writeContract({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'launchToken',
        args: [
          wizardData.basics.name, 
          wizardData.basics.symbol,
          wizardData.referrer as `0x${string}`
        ],
        value: parseEther(CREATE_FEE)
      });
    } catch (err: any) {
      console.error(err);
      alert('Transaction failed to initiate: ' + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Create EVM Bonding Curve</h1>
        </div>
        <p className="text-gray-400">Launch a permissionless token on BSC Testnet instantly.</p>

        <div className="mt-4 bg-cyan-950/30 border border-cyan-800/40 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-cyan-300 font-medium mb-1">EVM Bonding Curve Features:</p>
              <ul className="text-cyan-200/80 space-y-1 text-xs">
                <li>• <strong>No Seed Liquidity Required</strong> - Fair Launch mechanism</li>
                <li>• <strong>Constant-product (AMM)</strong> pricing model</li>
                <li>• <strong>Auto-migration</strong> to DEX when threshold reached</li>
                <li>• <strong>Create Fee:</strong> 0.05 BNB | <strong>Swap Fee:</strong> 1.5%</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {BONDING_CURVE_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() =>
                  currentStep > step.id || completedSteps.includes(step.id)
                    ? setCurrentStep(step.id)
                    : null
                }
                className={`flex flex-col items-center ${currentStep >= step.id ? 'opacity-100' : 'opacity-50'}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    currentStep === step.id
                      ? 'bg-cyan-600 text-white'
                      : completedSteps.includes(step.id)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {completedSteps.includes(step.id) ? '✓' : step.id}
                </div>
                <span className="text-xs text-gray-400 mt-1 hidden md:block">{step.name}</span>
              </button>
              {index < BONDING_CURVE_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${currentStep > step.id ? 'bg-cyan-600' : 'bg-gray-700'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-6">
        
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Token Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Token Name</label>
                <input
                  type="text"
                  value={wizardData.basics?.name || ''}
                  onChange={(e) =>
                    setWizardData({
                      ...wizardData,
                      basics: { ...wizardData.basics, name: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="e.g., Selsipad Test Token"
                />
                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Symbol</label>
                <input
                  type="text"
                  value={wizardData.basics?.symbol || ''}
                  onChange={(e) =>
                    setWizardData({
                      ...wizardData,
                      basics: { ...wizardData.basics, symbol: e.target.value.toUpperCase() },
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="STT"
                />
                {errors.symbol && <p className="text-red-400 text-sm mt-1">{errors.symbol}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={wizardData.basics?.description || ''}
                  onChange={(e) =>
                    setWizardData({
                      ...wizardData,
                      basics: { ...wizardData.basics, description: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  rows={4}
                  placeholder="Describe your token's vision and utility..."
                />
                {errors.description && (
                  <p className="text-red-400 text-sm mt-1">{errors.description}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Fees Disclosure */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Fee Structure & Rules</h2>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="space-y-3">
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Creation Fee</span>
                  <span className="text-white font-medium">0.05 BNB</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Total Swap Fee (per trade)</span>
                  <span className="text-white font-medium">1.5%</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Referral Reward Rate</span>
                  <span className="text-green-400 font-medium">0.75% of Trade Volume</span>
                </div>
                <div className="flex justify-between pb-2">
                  <span className="text-gray-400">Virtual ETH Reserves</span>
                  <span className="text-white font-medium">0.015 ETH</span>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-purple-950/30 border border-purple-800/40 rounded-lg p-3">
              <p className="text-purple-200 text-sm">
                <strong>Migration Rule:</strong> When the total BNB collected reaches the migration threshold (1 BNB for testnet), all curve tokens and BNB will automatically be sent to PancakeSwap as a locked Liquidity Pool.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Review & Confirmation</h2>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-white mb-3">Launch Overview</h3>
              <div className="space-y-3 text-sm">
                <p className="flex justify-between">
                  <span className="text-gray-400">Token Name:</span>{' '}
                  <span className="text-white font-medium">{wizardData.basics?.name || 'N/A'}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-400">Token Symbol:</span>{' '}
                  <span className="text-white font-medium">{wizardData.basics?.symbol || 'N/A'}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-400">Network:</span>{' '}
                  <span className="text-cyan-400">BSC Testnet / Sepolia</span>
                </p>
                <p className="flex justify-between pt-2 border-t border-gray-700">
                  <span className="text-gray-400">Total Upfront Cost:</span>{' '}
                  <span className="text-xl font-bold text-yellow-400">0.05 BNB</span>
                </p>
              </div>
            </div>

            {errors.terms && <p className="text-red-400 text-sm mb-2">{errors.terms}</p>}
            <label className="flex items-start gap-3 cursor-pointer bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 flex-shrink-0"
              />
              <span className="text-sm text-gray-300">
                I understand I am interacting with a decentralized smart contract on the EVM. I acknowledge the creation fee of 0.05 BNB and agree to the platform's terms of service and migration mechanics.
              </span>
            </label>
          </div>
        )}

        {/* Step 4: Deploy */}
        {currentStep === 4 && (
          <div className="text-center py-8">
            <Zap className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Ready to Deploy!</h2>
            <p className="text-gray-400 mb-6">Your EVM bonding curve pool will be launched immutably on-chain.</p>

            <div className="space-y-3 mb-8 text-left max-w-sm mx-auto">
              <div className="flex items-center gap-3 text-green-400 bg-gray-800/40 p-3 rounded border border-gray-700">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Contract metadata validated</span>
              </div>
              <div className="flex items-center gap-3 text-green-400 bg-gray-800/40 p-3 rounded border border-gray-700">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Creation fee fixed at 0.05 BNB</span>
              </div>
              {wizardData.referrer !== '0x0000000000000000000000000000000000000000' && (
                <div className="flex items-center gap-3 text-blue-400 bg-blue-900/20 p-3 rounded border border-blue-800/40">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm break-all">Active Referrer applied</span>
                </div>
              )}
            </div>

            {txError && (
              <div className="mb-4 text-red-400 bg-red-900/20 p-4 rounded border border-red-800/50 text-sm max-w-lg mx-auto text-left break-words">
                <strong>Transaction Error:</strong><br/>
                {txError.message}
              </div>
            )}

            <button
              onClick={handleDeploy}
              disabled={isTxPending || isTxConfirming || !isConnected}
              className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/20 transition-all w-full md:w-auto min-w-[280px]"
            >
              {!isConnected 
                ? 'Please Connect Wallet' 
                : isTxPending 
                  ? 'Confirm in Wallet...' 
                  : isTxConfirming 
                    ? 'Processing on-chain...' 
                    : 'Deploy Token Now'}
            </button>
            {(isTxPending || isTxConfirming) && (
              <p className="mt-4 text-cyan-400 text-sm animate-pulse">
                Please do not close this window while transaction is pending...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between border-t border-gray-800 pt-6">
        <button
          onClick={handleBack}
          disabled={currentStep === 1 || isTxPending || isTxConfirming}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
            currentStep === 1 || isTxPending || isTxConfirming
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex gap-3">
           {/* Auto-save on next implicitly done by useEffect */}
          {currentStep < 4 && (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
