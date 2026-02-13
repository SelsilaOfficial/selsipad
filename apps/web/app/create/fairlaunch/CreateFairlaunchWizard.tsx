'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { NetworkTokenStep } from './steps/NetworkTokenStep';
import { ProjectInfoStep } from './steps/ProjectInfoStep';
import { SaleParamsStep } from './steps/SaleParamsStep';
import { LiquidityPlanStep } from './steps/LiquidityPlanStep';
import { TeamVestingStep } from './steps/TeamVestingStep';
import { ReviewStep } from './steps/ReviewStep';
import { SubmitStep } from './steps/SubmitStep';
import { VestingScheduleUI } from '@/lib/fairlaunch/helpers';
import { saveFairlaunch } from '@/actions/fairlaunch';
import { createClient } from '@/lib/supabase/client';

interface CreateFairlaunchWizardProps {
  walletAddress: string;
}

// Wizard data interface
interface WizardData {
  // Step 1: Network & Token
  network: string;
  tokenMode: 'existing' | 'factory' | null;
  tokenAddress: string;
  tokenSource: string;
  securityScanStatus: 'PASS' | 'FAIL' | null;
  securityBadges: string[];

  // Token metadata (from scan or factory creation)
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  tokenTotalSupply?: string;

  // Step 2: Project Info
  projectName: string;
  description: string;
  logoUrl?: string;
  socialLinks: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };

  // Step 3: Sale Parameters
  tokensForSale: string;
  softcap: string;
  startTime: string;
  endTime: string;
  minContribution: string;
  maxContribution: string;
  dexPlatform: string;
  listingPremiumBps: number;

  // Step 4: Liquidity Plan
  liquidityPercent: number;
  lpLockMonths: number;

  // Step 5: Team Vesting
  teamAllocation: string;
  vestingBeneficiary: string;
  vestingSchedule: VestingScheduleUI[];
}

const STORAGE_KEY = 'wizard:fairlaunch:v2';

const FAIRLAUNCH_STEPS = [
  { id: 1, title: 'Network & Token', description: 'Choose network and token' },
  { id: 2, title: 'Project Info', description: 'Project details & social' },
  { id: 3, title: 'Sale Parameters', description: 'Tokens, softcap & timing' },
  { id: 4, title: 'Liquidity Plan', description: 'LP allocation & lock' },
  { id: 5, title: 'Team Vesting', description: 'Team tokens & schedule' },
  { id: 6, title: 'Review & Apply', description: 'Final review' },
  { id: 7, title: 'Submit', description: 'Submit to admin' },
];

export function CreateFairlaunchWizard({ walletAddress }: CreateFairlaunchWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [hasDeployedSuccessfully, setHasDeployedSuccessfully] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 🔒 CRITICAL: useRef for SYNCHRONOUS blocking (state updates are async!)
  const deploymentLock = useRef(false);

  // Initialize wizard data with defaults
  const [wizardData, setWizardData] = useState<WizardData>({
    network: '',
    tokenMode: null,
    tokenAddress: '',
    tokenSource: '',
    securityScanStatus: null,
    securityBadges: [],
    projectName: '',
    description: '',
    logoUrl: '',
    socialLinks: {},
    tokensForSale: '',
    softcap: '',
    startTime: '',
    endTime: '',
    minContribution: '',
    maxContribution: '',
    dexPlatform: '',
    listingPremiumBps: 0,
    liquidityPercent: 80,
    lpLockMonths: 12,
    teamAllocation: '0',
    vestingBeneficiary: walletAddress,
    vestingSchedule: [{ month: 0, percentage: 100 }],
  });

  // Load draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setWizardData({ ...wizardData, ...parsed });
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    if (wizardData.projectName) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wizardData));
    }
  }, [wizardData]);

  // Update wizard data helper
  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
    setErrors({}); // Clear errors when data changes
  };

  // Validation for each step
  const validateStep = (step: number): boolean => {
    setErrors({});
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!wizardData.network) newErrors.network = 'Network is required';
        if (!wizardData.tokenAddress) newErrors.tokenAddress = 'Token address is required';
        if (wizardData.securityScanStatus !== 'PASS') {
          newErrors.security = 'Token must pass security scan';
        }
        break;

      case 2:
        if (!wizardData.projectName || wizardData.projectName.length < 3) {
          newErrors.projectName = 'Project name must be at least 3 characters';
        }
        if (!wizardData.description || wizardData.description.length < 10) {
          newErrors.description = 'Description must be at least 10 characters';
        }
        // Validate social links if provided
        Object.entries(wizardData.socialLinks).forEach(([platform, url]) => {
          if (url && !url.startsWith('http')) {
            newErrors[`social_${platform}`] = 'Must be a valid URL';
          }
        });
        break;

      case 3:
        if (!wizardData.tokensForSale || parseFloat(wizardData.tokensForSale) <= 0) {
          newErrors.tokensForSale = 'Tokens for sale must be greater than 0';
        }
        if (!wizardData.softcap || parseFloat(wizardData.softcap) <= 0) {
          newErrors.softcap = 'Softcap must be greater than 0';
        }
        if (!wizardData.startTime) newErrors.startTime = 'Start time is required';
        if (!wizardData.endTime) newErrors.endTime = 'End time is required';
        if (new Date(wizardData.startTime) >= new Date(wizardData.endTime)) {
          newErrors.endTime = 'End time must be after start time';
        }
        if (!wizardData.dexPlatform) newErrors.dexPlatform = 'DEX platform is required';
        break;

      case 4:
        if (wizardData.liquidityPercent < 70 || wizardData.liquidityPercent > 100) {
          newErrors.liquidityPercent = 'Liquidity must be 70-100%';
        }
        if (wizardData.lpLockMonths < 12) {
          newErrors.lpLockMonths = 'LP lock must be at least 12 months';
        }
        break;

      case 5:
        const teamAlloc = parseFloat(wizardData.teamAllocation);
        if (isNaN(teamAlloc) || teamAlloc < 0) {
          newErrors.teamAllocation = 'Invalid team allocation';
        }
        if (teamAlloc > 0) {
          if (!wizardData.vestingBeneficiary || wizardData.vestingBeneficiary.length < 40) {
            newErrors.vestingBeneficiary = 'Valid beneficiary address required';
          }
          const totalPercent = wizardData.vestingSchedule.reduce(
            (sum, period) => sum + period.percentage,
            0
          );
          if (Math.abs(totalPercent - 100) > 0.01) {
            newErrors.vestingSchedule = 'Vesting schedule must total 100%';
          }
        }
        break;

      case 6:
        if (!termsAccepted) {
          newErrors.terms = 'You must accept terms & conditions';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation handlers
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

  const handleSaveDraft = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wizardData));
    alert('Draft saved successfully!');
  };

  // Deploy handler - NEW: Uses backend API instead of Factory
  const handleDeploy = async () => {
    // 🔒 SYNCHRONOUS CHECK: Use ref, not state! (state updates are async)
    if (deploymentLock.current) {
      console.warn('🛑 DEPLOYMENT LOCKED! Another call already in progress or completed.');
      return {
        success: false,
        error: 'Deployment already in progress or completed',
      };
    }

    // 🔒 IMMEDIATELY lock (synchronous, blocks concurrent calls!)
    deploymentLock.current = true;
    console.log('🔐 Deployment lock acquired!');

    // Set state for UI feedback
    setIsDeploying(true);

    console.log('🚀 Starting deployment via backend API...');
    console.log('[Wizard] Using wallet address for auth:', walletAddress);

    try {
      // Get chain ID from network
      const chainIdMap: Record<string, number> = {
        bsc_testnet: 97,
        bnb: 56,
        sepolia: 11155111,
        ethereum: 1,
        base_sepolia: 84532,
        base: 8453,
      };

      const chainId = chainIdMap[wizardData.network] || 97;

      // Prepare deployment payload
      const deployPayload = {
        // Token configuration
        projectToken: wizardData.tokenAddress,
        tokenDecimals: wizardData.tokenDecimals || 18,

        // Sale parameters
        softcap: wizardData.softcap,
        tokensForSale: wizardData.tokensForSale,
        minContribution: wizardData.minContribution,
        maxContribution: wizardData.maxContribution,

        // Timing
        startTime: new Date(wizardData.startTime).toISOString(),
        endTime: new Date(wizardData.endTime).toISOString(),

        // Liquidity settings
        liquidityPercent: wizardData.liquidityPercent || 70,
        lpLockMonths: wizardData.lpLockMonths || 24,
        listingPremiumBps: wizardData.listingPremiumBps || 0,
        dexPlatform: wizardData.dexPlatform || 'PancakeSwap',

        // Team vesting (optional)
        teamVestingAddress:
          parseFloat(wizardData.teamAllocation) > 0 ? wizardData.vestingBeneficiary : null,

        // Creator and network
        creatorWallet: walletAddress,
        chainId: chainId,
      };

      console.log('[Wizard] Deploying via API:', deployPayload);

      // Get session token from cookie (custom session management)
      const getSessionToken = (): string | null => {
        if (typeof document === 'undefined') return null;
        const cookies = document.cookie.split(';');
        const sessionCookie = cookies.find((c) => c.trim().startsWith('session_token='));
        if (!sessionCookie) return null;
        const token = sessionCookie.split('=')[1];
        return token || null; // Ensure we return null, not undefined
      };

      const sessionToken = getSessionToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Wallet-Address': walletAddress, // Fallback for wallet-only auth
      };

      // Add session token if available (preferred)
      if (sessionToken) {
        headers['X-Session-Token'] = sessionToken; // Send as custom header
        console.log('[Wizard] Using session token auth');
      } else {
        console.warn('[Wizard] No session token, using wallet-only auth');
      }

      // Call backend deployment API
      const response = await fetch('/api/fairlaunch/deploy', {
        method: 'POST',
        headers,
        body: JSON.stringify(deployPayload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details?.join(', ') || 'Deployment failed');
      }

      console.log('[Wizard] Deployment successful:', data);

      // 5. Success!
      // ✅ Mark as successfully deployed for UI state
      setHasDeployedSuccessfully(true);

      return {
        success: true,
        fairlaunchAddress: data.contractAddress,
        transactionHash: data.txHash,
        launchRoundId: data.launchRoundId, // UUID from backend
        tokenInfo: data.tokenInfo,
        nextStep: data.nextStep,
      };
    } catch (error: any) {
      console.error('Deployment error:', error);

      // 🔓 UNLOCK on error to allow retry!
      deploymentLock.current = false;
      console.log('🔓 Lock released due to error');

      return {
        success: false,
        error: error.message || 'Deployment failed',
      };
    } finally {
      setIsDeploying(false);
    }
  };

  // Get network symbol
  const getNetworkSymbol = (network: string) => {
    if (network.includes('bsc') || network === 'bnb') return 'BNB';
    if (network === 'solana') return 'SOL';
    return 'ETH';
  };

  const paymentSymbol = getNetworkSymbol(wizardData.network);

  // Get explorer URL
  const getExplorerUrl = (network: string) => {
    const explorers: Record<string, string> = {
      ethereum: 'https://etherscan.io',
      sepolia: 'https://sepolia.etherscan.io',
      bnb: 'https://bscscan.com',
      bsc_testnet: 'https://testnet.bscscan.com',
      base: 'https://basescan.org',
      base_sepolia: 'https://sepolia.basescan.org',
    };
    return explorers[network] || 'https://etherscan.io';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/10 to-gray-900 py-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => router.push('/create')}
            className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-purple-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent font-sans">
              Create Fairlaunch 🚀
            </h1>
            <p className="text-gray-400">
              Launch your token in 7 steps. No KYC, no admin review - instant deployment with auto
              security checks.
            </p>
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="mb-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between">
            {FAIRLAUNCH_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => {
                    // Allow navigation to completed steps or current step
                    if (completedSteps.includes(step.id) || step.id <= currentStep) {
                      setCurrentStep(step.id);
                    }
                  }}
                  disabled={step.id > currentStep && !completedSteps.includes(step.id)}
                  className={`flex flex-col items-center transition ${
                    step.id === currentStep
                      ? 'opacity-100 scale-110'
                      : completedSteps.includes(step.id)
                        ? 'opacity-100'
                        : 'opacity-40'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition ${
                      currentStep === step.id
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50'
                        : completedSteps.includes(step.id)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {completedSteps.includes(step.id) ? '✓' : step.id}
                  </div>
                  <span className="text-xs text-gray-300 mt-2 hidden md:block text-center max-w-[100px]">
                    {step.title}
                  </span>
                </button>
                {index < FAIRLAUNCH_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded transition ${
                      completedSteps.includes(step.id) ? 'bg-green-500' : 'bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Card */}
        <div
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 mb-6 min-h-[600px]"
          style={{
            fontFamily:
              'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          {/* Step Title */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-1">
              {FAIRLAUNCH_STEPS[currentStep - 1]?.title || 'Step'}
            </h2>
            <p className="text-gray-400 text-sm">
              {FAIRLAUNCH_STEPS[currentStep - 1]?.description || ''}
            </p>
          </div>

          {/* Step Content */}
          {currentStep === 1 && (
            <NetworkTokenStep
              data={{
                network: wizardData.network,
                tokenMode: wizardData.tokenMode,
                tokenAddress: wizardData.tokenAddress,
                tokenSource: wizardData.tokenSource,
                securityScanStatus: wizardData.securityScanStatus,
                securityBadges: wizardData.securityBadges,
              }}
              onChange={updateWizardData}
              errors={errors}
            />
          )}

          {currentStep === 2 && (
            <ProjectInfoStep
              data={{
                projectName: wizardData.projectName,
                description: wizardData.description,
                logoUrl: wizardData.logoUrl,
                socialLinks: wizardData.socialLinks,
              }}
              onChange={updateWizardData}
              errors={errors}
            />
          )}

          {currentStep === 3 && (
            <SaleParamsStep
              data={{
                tokensForSale: wizardData.tokensForSale,
                softcap: wizardData.softcap,
                startTime: wizardData.startTime,
                endTime: wizardData.endTime,
                minContribution: wizardData.minContribution,
                maxContribution: wizardData.maxContribution,
                dexPlatform: wizardData.dexPlatform,
                listingPremiumBps: wizardData.listingPremiumBps,
              }}
              network={wizardData.network}
              paymentSymbol={paymentSymbol}
              onChange={updateWizardData}
              errors={errors}
            />
          )}

          {currentStep === 4 && (
            <LiquidityPlanStep
              data={{
                liquidityPercent: wizardData.liquidityPercent,
                lpLockMonths: wizardData.lpLockMonths,
              }}
              saleData={{
                tokensForSale: wizardData.tokensForSale,
                softcap: wizardData.softcap,
                endTime: wizardData.endTime,
              }}
              paymentSymbol={paymentSymbol}
              onChange={updateWizardData}
              errors={errors}
            />
          )}

          {currentStep === 5 && (
            <TeamVestingStep
              data={{
                teamAllocation: wizardData.teamAllocation,
                vestingBeneficiary: wizardData.vestingBeneficiary,
                vestingSchedule: wizardData.vestingSchedule,
              }}
              walletAddress={walletAddress}
              onChange={updateWizardData}
              errors={errors}
            />
          )}

          {currentStep === 6 && (
            <ReviewStep
              wizardData={wizardData}
              termsAccepted={termsAccepted}
              onTermsChange={setTermsAccepted}
              onSaveDraft={handleSaveDraft}
            />
          )}

          {currentStep === 7 && (
            <SubmitStep formData={wizardData} onBack={() => setCurrentStep(6)} />
          )}
        </div>

        {/* Navigation Buttons */}
        {currentStep < 7 && (
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={isDeploying}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition flex items-center gap-2 shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentStep === 6 ? (
                isDeploying ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    Deploy Now
                  </>
                )
              ) : (
                <>
                  Next
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Validation Errors (global) */}
        {Object.keys(errors).length > 0 && currentStep < 7 && (
          <div className="mt-4 bg-red-950/30 border border-red-800/40 rounded-lg p-4">
            <p className="text-red-300 font-medium text-sm mb-2">
              ⚠️ Please fix the following errors:
            </p>
            <ul className="text-red-300/80 text-sm space-y-1">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}>• {message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
