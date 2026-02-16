'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Save, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { createBondingCurveDraft, submitBondingCurve } from './actions';

// ===== BONDING CURVE-SPECIFIC SCHEMAS (NOT PRESALE) =====
const bondingCurveBasicsSchema = z.object({
  name: z.string().min(3, 'Min 3 characters'),
  symbol: z.string().min(2, 'Min 2 characters').max(10, 'Max 10 characters'),
  description: z.string().min(10, 'Min 10 characters'),
  logo_url: z.string().url('Must be valid URL').optional().or(z.literal('')),
});

const bondingCurveParamsSchema = z.object({
  initial_virtual_sol_reserves: z.string().min(1, 'Required'),
  initial_virtual_token_reserves: z.string().min(1, 'Required'),
  graduation_threshold_sol: z.string().min(1, 'Required'),
});

const teamVestingSchema = z.object({
  team_allocation: z.string().min(1, 'Required'),
  schedule: z
    .array(
      z.object({
        month: z.number(),
        percentage: z.number(),
      })
    )
    .min(1, 'At least one vesting period required'),
});

interface CreateBondingCurveWizardProps {
  walletAddress: string;
}

//  Unique storage key for bonding curve
const STORAGE_KEY = 'wizard:bondingcurve:v1';

const BONDING_CURVE_STEPS = [
  { id: 1, name: 'Basic Info', description: 'Token details' },
  { id: 2, name: 'Curve Params', description: 'Virtual reserves' },
  { id: 3, name: 'Fees', description: 'Cost disclosure' },
  { id: 4, name: 'Team Vesting', description: 'Mandatory' },
  { id: 5, name: 'Review', description: 'Summary' },
  { id: 6, name: 'Deploy', description: 'Create pool' },
];

export function CreateBondingCurveWizard({ walletAddress }: CreateBondingCurveWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const [wizardData, setWizardData] = useState({
    basics: {} as { name?: string; symbol?: string; description?: string; logo_url?: string },
    curve_params: {
      initial_virtual_sol_reserves: '30',
      initial_virtual_token_reserves: '1073000000',
      graduation_threshold_sol: '85',
    },
    team_vesting: { team_allocation: '0', schedule: [] as { month: number; percentage: number }[] },
    fees: {
      deploy_fee_sol: '0.5',
      swap_fee_bps: 150,
      migration_fee_sol: '2.5',
    },
  });

  // Load draft
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setWizardData(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load bonding curve draft:', e);
      }
    }
  }, []);

  // Save draft
  useEffect(() => {
    if (wizardData.basics?.name) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wizardData));
    }
  }, [wizardData]);

  const validateStep = (step: number): boolean => {
    setErrors({});
    try {
      switch (step) {
        case 1:
          bondingCurveBasicsSchema.parse(wizardData.basics);
          break;
        case 2:
          bondingCurveParamsSchema.parse(wizardData.curve_params);
          break;
        case 4:
          teamVestingSchema.parse(wizardData.team_vesting);
          if (wizardData.team_vesting.schedule.reduce((s, v) => s + v.percentage, 0) !== 100) {
            setErrors({ schedule: 'Vesting must total 100%' });
            return false;
          }
          break;
        case 5:
          return termsAccepted;
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

  const handleSaveDraft = async () => {
    try {
      const result = await createBondingCurveDraft(wizardData, walletAddress);
      if (result.success) {
        alert('Draft saved!');
      } else {
        alert('Save failed: ' + result.error);
      }
    } catch (error) {
      alert('Failed to save draft');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await submitBondingCurve(wizardData, walletAddress);
      if (result.success) {
        localStorage.removeItem(STORAGE_KEY);
        router.push('/bonding-curve?created=true');
      } else {
        alert('Submission failed: ' + result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const teamVestingValid =
    wizardData.team_vesting.schedule.reduce((sum, v) => sum + v.percentage, 0) === 100;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Create Bonding Curve</h1>
        </div>
        <p className="text-gray-400">Launch permissionless bonding curve on Solana in 6 steps.</p>

        <div className="mt-4 bg-cyan-950/30 border border-cyan-800/40 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-cyan-300 font-medium mb-1">Bonding Curve Features:</p>
              <ul className="text-cyan-200/80 space-y-1 text-xs">
                <li>
                  • <strong>Permissionless</strong> - No KYC required
                </li>
                <li>
                  • <strong>Constant-product</strong> pricing with virtual reserves
                </li>
                <li>
                  • <strong>Auto-graduation</strong> to Raydium/Orca
                </li>
                <li>
                  • <strong>Fees:</strong> Deploy 0.5 SOL, Swap 1.5%, Migration 2.5 SOL
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper - 6 STEPS */}
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
            <div className="mb-4 bg-yellow-950/30 border border-yellow-800/40 rounded-lg p-3">
              <p className="text-yellow-200 text-sm">
                <strong>Solana Only:</strong> Bonding curves are exclusively on Solana
              </p>
            </div>

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
                  placeholder="My Token"
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
                      basics: { ...wizardData.basics, symbol: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="MTK"
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
                  placeholder="Describe your token..."
                />
                {errors.description && (
                  <p className="text-red-400 text-sm mt-1">{errors.description}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Curve Parameters (NO PRESALE FIELDS!) */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Bonding Curve Parameters</h2>
            <p className="text-gray-400 text-sm mb-6">
              Configure constant-product curve with virtual reserves
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Initial Virtual SOL Reserves
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={wizardData.curve_params?.initial_virtual_sol_reserves || '30'}
                  onChange={(e) =>
                    setWizardData({
                      ...wizardData,
                      curve_params: {
                        ...wizardData.curve_params,
                        initial_virtual_sol_reserves: e.target.value,
                      },
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
                <p className="text-gray-500 text-xs mt-1">Recommended: 30 SOL</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Initial Virtual Token Reserves
                </label>
                <input
                  type="number"
                  value={wizardData.curve_params?.initial_virtual_token_reserves || '1073000000'}
                  onChange={(e) =>
                    setWizardData({
                      ...wizardData,
                      curve_params: {
                        ...wizardData.curve_params,
                        initial_virtual_token_reserves: e.target.value,
                      },
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
                <p className="text-gray-500 text-xs mt-1">Recommended: 1.073B tokens</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Graduation Threshold (SOL)
                </label>
                <input
                  type="number"
                  value={wizardData.curve_params?.graduation_threshold_sol || '85'}
                  onChange={(e) =>
                    setWizardData({
                      ...wizardData,
                      curve_params: {
                        ...wizardData.curve_params,
                        graduation_threshold_sol: e.target.value,
                      },
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
                <p className="text-gray-500 text-xs mt-1">
                  When raised SOL hits this, pool migrates to DEX
                </p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-2">Formula</h4>
                <p className="text-xs text-gray-400">k = (vSOL + rSOL) × (vTOK + rTOK)</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Fees Disclosure */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Fee Structure</h2>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Deploy Fee</span>
                  <span className="text-white font-medium">0.5 SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Swap Fee (per trade)</span>
                  <span className="text-white font-medium">1.5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Migration Fee (upon graduation)</span>
                  <span className="text-white font-medium">2.5 SOL</span>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-purple-950/30 border border-purple-800/40 rounded-lg p-3">
              <p className="text-purple-200 text-sm">
                <strong>Post-Migration:</strong> LP will be locked for minimum 12 months after DEX
                migration
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Team Vesting (MANDATORY) */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Team Vesting (Mandatory)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Team Allocation
                </label>
                <input
                  type="number"
                  value={wizardData.team_vesting?.team_allocation || ''}
                  onChange={(e) =>
                    setWizardData({
                      ...wizardData,
                      team_vesting: { ...wizardData.team_vesting, team_allocation: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="100000"
                />
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Vesting Schedule (must total 100%)</p>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <p className="text-xs text-gray-500">
                    Add vesting periods. Example: Month 0 = 20%, Month 6 = 40%, Month 12 = 40%
                  </p>
                </div>
                {errors.schedule && <p className="text-red-400 text-sm mt-1">{errors.schedule}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Review & Terms</h2>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-4">
              <h3 className="font-semibold text-white mb-2">Summary</h3>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-400">Token:</span>{' '}
                  <span className="text-white">
                    {wizardData.basics?.name || 'N/A'} ({wizardData.basics?.symbol || 'N/A'})
                  </span>
                </p>
                <p>
                  <span className="text-gray-400">Network:</span>{' '}
                  <span className="text-cyan-400">Solana</span>
                </p>
                <p>
                  <span className="text-gray-400">Virtual SOL:</span>{' '}
                  <span className="text-white">
                    {wizardData.curve_params?.initial_virtual_sol_reserves} SOL
                  </span>
                </p>
                <p>
                  <span className="text-gray-400">Virtual Tokens:</span>{' '}
                  <span className="text-white">
                    {wizardData.curve_params?.initial_virtual_token_reserves}
                  </span>
                </p>
                <p>
                  <span className="text-gray-400">Graduation:</span>{' '}
                  <span className="text-white">
                    {wizardData.curve_params?.graduation_threshold_sol} SOL
                  </span>
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-300">
                I understand the fee structure and that LP lock (12+ months) applies after DEX
                migration
              </span>
            </label>
          </div>
        )}

        {/* Step 6: Deploy */}
        {currentStep === 6 && (
          <div className="text-center py-8">
            <Zap className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Ready to Deploy!</h2>
            <p className="text-gray-400 mb-6">Your bonding curve pool is ready to launch.</p>

            <div className="space-y-3 mb-6 text-left max-w-md mx-auto">
              <div className="flex items-center gap-3 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span>Token information configured</span>
              </div>
              <div className="flex items-center gap-3 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span>Curve parameters set</span>
              </div>
              <div
                className={`flex items-center gap-3 ${teamVestingValid ? 'text-green-400' : 'text-red-400'}`}
              >
                {teamVestingValid ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span>Team vesting {teamVestingValid ? 'configured' : 'required'}</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !teamVestingValid}
              className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Deploying...' : 'Deploy Bonding Curve Pool'}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
            currentStep === 1
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex gap-3">
          {currentStep < 6 && (
            <>
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-gray-800 text-gray-300 hover:bg-gray-700"
              >
                <Save className="w-5 h-5" />
                Save Draft
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
              >
                Next
                <ArrowRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
