'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePublicClient, useWalletClient } from 'wagmi';
import { decodeEventLog, parseEther, parseUnits, type Address } from 'viem';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { NetworkTokenStep } from './steps/NetworkTokenStep';
import { ProjectInfoStep } from './steps/ProjectInfoStep';
import { SaleParamsStep } from './steps/SaleParamsStep';
import { LiquidityPlanStep } from './steps/LiquidityPlanStep';
import { TeamVestingStep } from './steps/TeamVestingStep';
import { ReviewStep } from './steps/ReviewStep';
import { DeployStep } from './steps/DeployStep';
import { VestingScheduleUI } from '@/lib/fairlaunch/helpers';
import { prepareFairlaunchDeployment, saveFairlaunch } from '@/actions/fairlaunch';
import { 
  FAIRLAUNCH_FACTORY_ABI, 
  FAIRLAUNCH_FACTORY_ADDRESS,
  FEE_SPLITTER_ADDRESS,
  DEPLOYMENT_FEE 
} from '@/contracts/FairlaunchFactory';

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
  { id: 7, title: 'Deploy', description: 'Deploy fairlaunch' },
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

  // Wagmi hooks for blockchain interaction
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

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

  // Deploy handler
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
    
    console.log('🚀 Starting deployment...');

    try {
      
      // Step 1: Prepare deployment params via server action
      const prepareResult = await prepareFairlaunchDeployment(wizardData);

      if (!prepareResult.success || !prepareResult.params) {
        throw new Error(prepareResult.error || 'Failed to prepare deployment');
      }

      console.log('✅ Deployment params prepared:', prepareResult.params);
      console.log('Factory:', prepareResult.factoryAddress);
      console.log('Chain ID:', prepareResult.chainId);

      // Step 2: Verify wallet client is available
      if (!walletClient) {
        throw new Error('Wallet not connected. Please connect your wallet to deploy.');
      }

      if (!publicClient) {
        throw new Error('Public client not available');
      }

      const chainId = prepareResult.chainId || 97;
      const factoryAddress = FAIRLAUNCH_FACTORY_ADDRESS[chainId];
      const deploymentFee = DEPLOYMENT_FEE[chainId];

      if (!factoryAddress) {
        throw new Error(`FairlaunchFactory not deployed on chain ${chainId}`);
      }

      if (!deploymentFee) {
        throw new Error(`Deployment fee not configured for chain ${chainId}`);
      }

      // Step 3: Get token decimals FIRST (needed for contract args)
      const tokenDecimals = prepareResult.params.tokenDecimals || 18;
      const tokensForSaleWithDecimals = parseUnits(prepareResult.params.tokensForSale, tokenDecimals);
      
      // Step 3.5: Prepare contract arguments
      // Convert decimal values (like "0.1") to wei using parseEther
      const createFairlaunchParams = {
        projectToken: prepareResult.params.tokenAddress as Address,
        paymentToken: '0x0000000000000000000000000000000000000000' as Address, // Native BNB
        softcap: parseEther(prepareResult.params.softcap),
        tokensForSale: tokensForSaleWithDecimals, // ✅ Now uses proper decimals!
        minContribution: parseEther(prepareResult.params.minContribution),
        maxContribution: parseEther(prepareResult.params.maxContribution),
        startTime: BigInt(prepareResult.params.startTime),
        endTime: BigInt(prepareResult.params.endTime),
        projectOwner: walletAddress as Address,
        listingPremiumBps: prepareResult.params.listingPremiumBps,
      };

      const vestingParams = {
        beneficiary: (prepareResult.params.vestingParams.beneficiary || walletAddress) as Address,
        startTime: BigInt(prepareResult.params.vestingParams.startTime || prepareResult.params.endTime),
        durations: prepareResult.params.vestingParams.durations?.map((d: any) => BigInt(d)) || [],
        amounts: prepareResult.params.vestingParams.amounts?.map((a: any) => BigInt(a)) || [],
      };

      const lpPlan = {
        lockMonths: BigInt(prepareResult.params.lpLockMonths),
        liquidityPercent: BigInt(prepareResult.params.liquidityPercent),
        dexId: prepareResult.params.dexId as `0x${string}`,
      };

      console.log('📝 Contract args prepared');
      console.log('Deployment fee:', deploymentFee.toString(), 'wei');
      console.log('Token decimals:', tokenDecimals);
      console.log('Tokens for sale (human):', prepareResult.params.tokensForSale);
      console.log('Tokens for sale (base units):', tokensForSaleWithDecimals.toString());

      // Step 3.6: Calculate total tokens needed and approve Factory
      console.log('💰 Calculating token requirements...');
      
      // Calculate liquidity tokens (same formula as contract)
      const liquidityPercent = BigInt(prepareResult.params.liquidityPercent);
      const liquidityTokens = (tokensForSaleWithDecimals * liquidityPercent) / 10000n;
      const totalFairlaunchTokens = tokensForSaleWithDecimals + liquidityTokens;
      
      // Calculate vesting tokens (also need to convert)
      const vestingAmounts = vestingParams.amounts;
      const totalVestingTokens = vestingAmounts.reduce((sum: bigint, amount: bigint) => sum + amount, 0n);
      
      // Total tokens to approve
      const totalTokensNeeded = totalFairlaunchTokens + totalVestingTokens;
      
      console.log('💰 Token calculation:');
      console.log('  - For sale:', tokensForSaleWithDecimals.toString());
      console.log('  - For liquidity:', liquidityTokens.toString());
      console.log('  - For vesting:', totalVestingTokens.toString());
      console.log('  - TOTAL:', totalTokensNeeded.toString());
      
      // Approve Factory to spend tokens
      console.log('🔐 Requesting token approval... (confirm in wallet)');
      
      const ERC20_ABI = [
        {
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          name: 'approve',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ] as const;
      
      const approveTxHash = await walletClient.writeContract({
        address: prepareResult.params.tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [factoryAddress, totalTokensNeeded],
      });
      
      console.log('📤 Approval transaction sent:', approveTxHash);
      console.log('⏳ Waiting for approval confirmation...');
      
      await publicClient.waitForTransactionReceipt({
        hash: approveTxHash,
        confirmations: 2,
      });
      
      console.log('✅ Token approval confirmed!');
      console.log(`Factory ${factoryAddress} can now spend ${totalTokensNeeded.toString()} tokens`);
      
      console.log('📋 LP Plan parameters:');
      console.log('  - Liquidity Percent (BPS):', lpPlan.liquidityPercent);
      console.log('  - LP Lock Months:', lpPlan.lockMonths);
      console.log('  - DEX ID:', lpPlan.dexId);
      
      console.log('🚀 Deploying Fairlaunch... (confirm in wallet)');

      // Step 4: Deploy via wagmi writeContract
      const txHash = await walletClient.writeContract({
        address: factoryAddress as Address,
        abi: FAIRLAUNCH_FACTORY_ABI,
        functionName: 'createFairlaunch',
        args: [createFairlaunchParams, vestingParams, lpPlan],
        value: deploymentFee,
      });

      console.log('📤 Transaction sent:', txHash);

      // Step 5: Wait for transaction confirmation
      const txReceipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 2, // Wait for 2 confirmations for security
      });

      console.log('✅ Transaction confirmed:', txReceipt.transactionHash);

      // Step 6: Parse event logs to get deployed addresses
      let fairlaunchAddress: string | undefined;
      let vestingAddress: string | undefined;

      console.log('📋 Parsing transaction logs...');
      console.log('Total logs:', txReceipt.logs.length);

      for (const log of txReceipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: FAIRLAUNCH_FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          });

          console.log('Decoded event:', decoded.eventName);

          if (decoded.eventName === 'FairlaunchCreated') {
            const args = decoded.args as {
              fairlaunchId: bigint;
              fairlaunch: Address;
              vesting: Address;
              projectToken: Address; // ✅ Added missing parameter
            };
            
            fairlaunchAddress = args.fairlaunch;
            vestingAddress = args.vesting;
            
            console.log('🎉 Fairlaunch deployed!');
            console.log('Fairlaunch address:', fairlaunchAddress);
            console.log('Vesting address:', vestingAddress);
            break;
          }
        } catch (e: any) {
          // Skip logs that don't match our ABI
          console.log('Skipping log (not from our contract):', e.message);
          continue;
        }
      }

      if (!fairlaunchAddress) {
        console.error('❌ Failed to find FairlaunchCreated event in logs');
        console.error('Transaction receipt:', txReceipt);
        throw new Error('Failed to parse FairlaunchCreated event from transaction logs. The deployment may have succeeded - check BSCScan: ' + txReceipt.transactionHash);
      }

      // Step 7: Save to database with REAL addresses
      const saveResult = await saveFairlaunch({
        network: wizardData.network,
        tokenAddress: wizardData.tokenAddress,
        tokenSource: wizardData.tokenMode as 'factory' | 'existing',
        securityBadges: wizardData.securityBadges,
        
        // Token metadata
        tokenName: wizardData.tokenName,
        tokenSymbol: wizardData.tokenSymbol,
        tokenDecimals: wizardData.tokenDecimals,
        tokenTotalSupply: wizardData.tokenTotalSupply,
        
        projectName: wizardData.projectName,
        description: wizardData.description,
        logoUrl: wizardData.logoUrl,
        socialLinks: wizardData.socialLinks,
        tokensForSale: wizardData.tokensForSale,
        softcap: wizardData.softcap,
        startTime: wizardData.startTime,
        endTime: wizardData.endTime,
        minContribution: wizardData.minContribution,
        maxContribution: wizardData.maxContribution,
        dexPlatform: wizardData.dexPlatform,
        listingPremiumBps: wizardData.listingPremiumBps,
        liquidityPercent: wizardData.liquidityPercent,
        lpLockMonths: wizardData.lpLockMonths,
        teamAllocation: wizardData.teamAllocation,
        vestingBeneficiary: wizardData.vestingBeneficiary,
        vestingSchedule: wizardData.vestingSchedule,
        
        // REAL deployed addresses from blockchain
        fairlaunchAddress,
        vestingAddress,
        feeSplitterAddress: FEE_SPLITTER_ADDRESS[chainId],
        transactionHash: txReceipt.transactionHash,
      });

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save fairlaunch to database');
      }

      // Clear draft after successful deployment
      localStorage.removeItem(STORAGE_KEY);
      
      // ✅ Mark as successfully deployed (ONLY on success!)
      setHasDeployedSuccessfully(true);

      return {
        success: true,
        fairlaunchAddress,
        vestingAddress,
        transactionHash: txReceipt.transactionHash,
        fairlaunchId: saveResult.fairlaunchId,
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
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Create Fairlaunch 🚀</h1>
          <p className="text-gray-400">
            Launch your token in 7 steps. No KYC, no admin review - instant deployment with auto
            security checks.
          </p>
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
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 mb-6 min-h-[600px]">
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
            <DeployStep
              wizardData={wizardData}
              onDeploy={handleDeploy}
              explorerUrl={getExplorerUrl(wizardData.network)}
            />
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
