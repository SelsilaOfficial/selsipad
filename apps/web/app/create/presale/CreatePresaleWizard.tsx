'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { PresaleWizardStepper } from '@/components/presale/PresaleWizardStepper';
import { Step0ContractMode } from '@/components/presale/wizard/Step0ContractMode';
import { Step1BasicInfo } from '@/components/presale/wizard/Step1BasicInfo';
import { Step2SaleParams } from '@/components/presale/wizard/Step2SaleParams';
import { Step3AntiBot } from '@/components/presale/wizard/Step3AntiBot';
import { Step4InvestorVesting } from '@/components/presale/wizard/Step4InvestorVesting';
import { Step5TeamVesting } from '@/components/presale/wizard/Step5TeamVesting';
import { Step6LpLock } from '@/components/presale/wizard/Step6LpLock';
import { Step7Fees } from '@/components/presale/wizard/Step7Fees';
import { Step8Review } from '@/components/presale/wizard/Step8Review';
import { Step9Submit } from '@/components/presale/wizard/Step9Submit';
import {
  fullPresaleConfigSchema,
  presaleBasicsSchema,
  presaleSaleParamsSchema,
  presaleAntiBotSchema,
  investorVestingSchema,
  teamVestingSchema,
  lpLockSchema,
  feesReferralSchema,
  type FullPresaleConfig,
  type ComplianceStatus,
} from '@/../../packages/shared/src/validators/presale-wizard';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';

interface CreatePresaleWizardProps {
  walletAddress: string;
  initialKycStatus: ComplianceStatus['kyc_status'];
  initialScScanStatus: ComplianceStatus['sc_scan_status'];
}

const STORAGE_KEY = 'selsipad_presale_draft';

export function CreatePresaleWizard({
  walletAddress,
  initialKycStatus,
  initialScScanStatus,
}: CreatePresaleWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0); // Start at Step 0: Contract Mode
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [projectId, setProjectId] = useState<string | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);

  // wizard data state  - Extended with contract security fields
  // Using loose typing because data is filled incrementally across steps.
  // Each step validates its own section via zod schemas at transition time.
  const [wizardData, setWizardData] = useState<Record<string, any>>({
    network: '',
    basics: {},
    sale_params: {} as any,
    anti_bot: { whitelist_enabled: false },
    investor_vesting: { tge_percentage: 0, cliff_months: 0, schedule: [] },
    team_vesting: { team_allocation: '0', schedule: [] },
    lp_lock: { duration_months: 12, percentage: 100 },
    fees_referral: { platform_fee_bps: 500 },
    // Contract security defaults
    contract_mode: null,
    contract_address: '',
    scan_status: null,
    template_audit_status: null,
  });

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setWizardData(parsed);
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, []);

  // Save draft to localStorage on data change
  useEffect(() => {
    if (Object.keys(wizardData.basics || {}).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wizardData));
    }
  }, [wizardData]);

  // Auto-create presale draft (project + round) when user enters basic info
  useEffect(() => {
    const createDraft = async () => {
      const name = wizardData.basics?.name;
      const network = wizardData.basics?.network;

      if (name && name.length >= 3 && network && !roundId) {
        try {
          const res = await fetch('/api/presale/draft', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(wizardData),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.round?.id) setRoundId(data.round.id);
            if (data.project_id) setProjectId(data.project_id);
          }
        } catch (error) {
          console.error('Failed to create presale draft:', error);
        }
      }
    };

    createDraft();
  }, [wizardData.basics?.name, wizardData.basics?.network, roundId]);

  // Validation per step
  const validateStep = (step: number): boolean => {
    setErrors({});
    try {
      switch (step) {
        case 0:
          // Validate network selected
          if (!wizardData.network) {
            setErrors({ network: 'Please select a network' });
            return false;
          }
          // Validate contract mode selected
          if (!wizardData.contract_mode) {
            setErrors({ contract_mode: 'Please select a contract mode' });
            return false;
          }
          // For external contract, require scan PASS
          if (wizardData.contract_mode === 'EXTERNAL_CONTRACT') {
            if (!wizardData.contract_address) {
              setErrors({ contract_address: 'Contract address required' });
              return false;
            }
            if (wizardData.scan_status !== 'PASS') {
              setErrors({ scan: 'Security scan must pass before proceeding' });
              return false;
            }
          }
          // For template, require token already created
          if (wizardData.contract_mode === 'LAUNCHPAD_TEMPLATE') {
            if (!wizardData.contract_address) {
              setErrors({ template: 'Please create your token first before proceeding' });
              return false;
            }
          }
          return true;
        case 1:
          presaleBasicsSchema.parse({
            ...wizardData.basics,
            network: wizardData.network || wizardData.basics?.network,
          });
          break;
        case 2:
          presaleSaleParamsSchema.parse(wizardData.sale_params);
          break;
        case 3:
          presaleAntiBotSchema.parse(wizardData.anti_bot);
          break;
        case 4:
          investorVestingSchema.parse(wizardData.investor_vesting);
          break;
        case 5:
          lpLockSchema.parse(wizardData.lp_lock);
          break;
        case 6:
          teamVestingSchema.parse(wizardData.team_vesting);
          break;
        case 7:
          feesReferralSchema.parse(wizardData.fees_referral);
          break;
        case 8:
          return termsAccepted;
        case 9:
          // Final submission step always valid (handled by submit button)
          return true;
        default:
          return true;
      }
      return true;
    } catch (error: any) {
      if (error.errors) {
        const fieldErrors: any = {};
        error.errors.forEach((err: any) => {
          const field = err.path[0];
          fieldErrors[field] = err.message;
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
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveDraft = async () => {
    try {
      if (!roundId) {
        // Convert datetime-local values to UTC before sending to server
        const draftPayload = {
          ...wizardData,
          sale_params: {
            ...wizardData.sale_params,
            start_at: wizardData.sale_params?.start_at
              ? new Date(wizardData.sale_params.start_at).toISOString()
              : undefined,
            end_at: wizardData.sale_params?.end_at
              ? new Date(wizardData.sale_params.end_at).toISOString()
              : undefined,
          },
        };
        const res = await fetch('/api/presale/draft', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftPayload),
        });
        if (!res.ok) {
          const err = await res.json();
          alert('Failed to save draft: ' + (err.error || res.statusText));
          return;
        }
        const data = await res.json();
        if (data.round?.id) setRoundId(data.round.id);
        if (data.project_id) setProjectId(data.project_id);
        alert('Draft saved successfully!');
        return;
      }
      const params = {
        price: parseFloat(wizardData.sale_params?.price || '0'),
        softcap: parseFloat(wizardData.sale_params?.softcap || '0'),
        hardcap: parseFloat(wizardData.sale_params?.hardcap || '0'),
        token_for_sale: parseFloat(wizardData.sale_params?.total_tokens || '0'),
        min_contribution: parseFloat(wizardData.sale_params?.min_contribution || '0'),
        max_contribution: parseFloat(wizardData.sale_params?.max_contribution || '0'),
        investor_vesting: wizardData.investor_vesting,
        team_vesting: wizardData.team_vesting,
        lp_lock: wizardData.lp_lock,
        project_name: wizardData.basics?.name,
        project_description: wizardData.basics?.description,
        logo_url: wizardData.basics?.logo_url,
        banner_url: wizardData.basics?.banner_url,
        anti_bot: wizardData.anti_bot,
        fees_referral: wizardData.fees_referral,
      };
      const patchRes = await fetch(`/api/rounds/${roundId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_at: wizardData.sale_params?.start_at
            ? new Date(wizardData.sale_params.start_at).toISOString()
            : undefined,
          end_at: wizardData.sale_params?.end_at
            ? new Date(wizardData.sale_params.end_at).toISOString()
            : undefined,
          params,
        }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json();
        alert('Failed to update draft: ' + (err.error || patchRes.statusText));
        return;
      }
      alert('Draft saved successfully!');
    } catch (error) {
      alert('Failed to save draft');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const validated = fullPresaleConfigSchema.parse({
        ...wizardData,
        basics: { ...wizardData.basics, network: wizardData.network || wizardData.basics?.network },
        terms_accepted: termsAccepted,
      });

      let currentRoundId = roundId;
      if (!currentRoundId) {
        // Convert datetime-local values to proper UTC ISO strings BEFORE
        // sending to the draft API.  The browser knows the user's real
        // timezone (e.g. WIB / UTC+7) — the server does NOT.
        const draftPayload = {
          ...validated,
          sale_params: {
            ...validated.sale_params,
            start_at: validated.sale_params?.start_at
              ? new Date(validated.sale_params.start_at).toISOString()
              : undefined,
            end_at: validated.sale_params?.end_at
              ? new Date(validated.sale_params.end_at).toISOString()
              : undefined,
          },
        };
        const createRes = await fetch('/api/presale/draft', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftPayload),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          alert('Failed to create draft: ' + (err.error || createRes.statusText));
          return;
        }
        const createData = await createRes.json();
        currentRoundId = createData.round?.id;
        if (createData.project_id) setProjectId(createData.project_id);
        if (currentRoundId) setRoundId(currentRoundId);
      }

      if (!currentRoundId) {
        alert('Could not create or find draft round.');
        return;
      }

      const params = {
        price: parseFloat(validated.sale_params?.price || '0'),
        softcap: parseFloat(validated.sale_params?.softcap || '0'),
        hardcap: parseFloat(validated.sale_params?.hardcap || '0'),
        token_for_sale: parseFloat(validated.sale_params?.total_tokens || '0'),
        min_contribution: parseFloat(validated.sale_params?.min_contribution || '0'),
        max_contribution: parseFloat(validated.sale_params?.max_contribution || '0'),
        investor_vesting: validated.investor_vesting,
        team_vesting: validated.team_vesting,
        lp_lock: validated.lp_lock,
        project_name: validated.basics?.name,
        project_description: validated.basics?.description,
        logo_url: validated.basics?.logo_url,
        banner_url: validated.basics?.banner_url,
        anti_bot: validated.anti_bot,
        fees_referral: validated.fees_referral,
      };
      await fetch(`/api/rounds/${currentRoundId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_at: validated.sale_params?.start_at
            ? new Date(validated.sale_params.start_at).toISOString()
            : undefined,
          end_at: validated.sale_params?.end_at
            ? new Date(validated.sale_params.end_at).toISOString()
            : undefined,
          params,
        }),
      });

      const submitRes = await fetch(`/api/rounds/${currentRoundId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!submitRes.ok) {
        const err = await submitRes.json();
        alert('Submission failed: ' + (err.error || submitRes.statusText));
        return;
      }

      localStorage.removeItem(STORAGE_KEY);
      router.push('/dashboard/owner/presales?created=true');
    } catch (error: any) {
      console.error('Submit error:', error);
      alert('Validation failed. Please check all fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compliance status
  // KYC: always CONFIRMED — only KYC-verified developers can access this page
  // SC Scan: derived from Step 0 wizard data:
  //   - Factory template → template_audit_status = 'PASS' (default contract)
  //   - External contract → scan_status from ExternalScanStep
  const resolvedScStatus = (() => {
    // Factory template → always PASS (pre-audited default contract)
    if (wizardData.contract_mode === 'LAUNCHPAD_TEMPLATE') return 'PASS' as const;
    if (wizardData.template_audit_status === 'VALID') return 'PASS' as const;
    // External contract → use scan result from Step 0
    if (wizardData.scan_status === 'PASS' || wizardData.scan_status === 'OVERRIDE_PASS')
      return wizardData.scan_status;
    return initialScScanStatus;
  })();

  const complianceStatus: ComplianceStatus = {
    kyc_status: 'CONFIRMED',
    sc_scan_status: resolvedScStatus,
    investor_vesting_valid:
      (wizardData.investor_vesting?.schedule?.length || 0) > 0 &&
      Math.abs(
        (wizardData.investor_vesting?.tge_percentage || 0) +
          (wizardData.investor_vesting?.schedule?.reduce(
            (sum: number, s: { percentage: number }) => sum + s.percentage,
            0
          ) || 0) -
          100
      ) < 0.01,
    team_vesting_valid:
      (wizardData.team_vesting?.schedule?.length || 0) > 0 &&
      wizardData.team_vesting?.schedule?.reduce(
        (sum: number, s: { percentage: number }) => sum + s.percentage,
        0
      ) === 100,
    lp_lock_valid: (wizardData.lp_lock?.duration_months || 0) >= 12,
  };

  const progressPercentage = Math.round(((currentStep + 1) / 10) * 100);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans selection:bg-cyan-500/30 -mx-4 sm:-mx-6 -my-8 px-4 sm:px-6 py-8">
      {/* Animated Background Layer */}
      <AnimatedBackground />

      {/* Subtle Dark Overlay for Readability */}
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content Layer */}
      <div className="relative z-10 max-w-[1000px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/create')}
              className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
            </button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#39AEC4] to-[#756BBA] bg-clip-text text-transparent font-sans">
                Create Presale
              </h1>
              <p className="text-sm text-gray-400">Launch your IDO on SELSIPAD</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <div className="w-2 h-2 rounded-full bg-[#39AEC4] animate-pulse" />
            <span className="text-sm font-medium text-gray-300">Step {currentStep + 1} of 10</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#39AEC4]">Progress</span>
            <span className="text-sm text-gray-400">{progressPercentage}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] transition-all duration-500 ease-out relative"
              style={{ width: `${progressPercentage}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div
          className="rounded-[24px] bg-gradient-to-br from-[#1A1A20] to-[#0A0A0C] border border-[#39AEC4]/20 p-6 sm:p-8 shadow-2xl shadow-black/50 relative overflow-hidden group"
          style={{
            fontFamily:
              'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          {/* Glossy overlay effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

          {/* Step Content Wrapper */}
          <div className="relative z-10">
            {/* Stepper Display (Simplified for new UI) */}
            <div className="mb-8 overflow-x-auto pb-2 -mx-2 px-2">
              <PresaleWizardStepper
                currentStep={currentStep}
                totalSteps={10}
                completedSteps={completedSteps}
                onStepClick={handleStepClick}
                className="min-w-[600px]"
              />
            </div>

            {currentStep === 0 && (
              <Step0ContractMode
                data={{
                  contract_mode: wizardData.contract_mode,
                  contract_address: wizardData.contract_address,
                  scan_status: wizardData.scan_status,
                  template_audit_status: wizardData.template_audit_status,
                }}
                onChange={(data) => {
                  setWizardData({
                    ...wizardData,
                    network: data.network || wizardData.network,
                    contract_mode: data.contract_mode,
                    contract_address: data.contract_address,
                    scan_status: data.scan_status,
                    template_audit_status: data.template_audit_status,
                    total_supply: data.total_supply || wizardData.total_supply,
                    token_name: data.token_name || wizardData.token_name,
                    token_symbol: data.token_symbol || wizardData.token_symbol,
                    token_decimals: data.token_decimals || wizardData.token_decimals,
                  });
                }}
                projectId={projectId}
                network={wizardData.network || ''}
                errors={errors}
              />
            )}

            {currentStep === 1 && (
              <Step1BasicInfo
                data={wizardData.basics || {}}
                onChange={(data) => setWizardData({ ...wizardData, basics: data })}
                errors={errors}
                selectedNetwork={wizardData.network}
              />
            )}

            {currentStep === 2 && (
              <Step2SaleParams
                data={(wizardData.sale_params || {}) as any}
                onChange={(data) => setWizardData({ ...wizardData, sale_params: data })}
                errors={errors}
                network={wizardData.network || wizardData.basics?.network}
                totalSupply={wizardData.total_supply}
                tokenAddress={wizardData.contract_address}
                onTotalSupplyRead={(supply) => {
                  if (supply && supply !== wizardData.total_supply) {
                    setWizardData((prev: any) => ({ ...prev, total_supply: supply }));
                  }
                }}
                onTokenSymbolRead={(symbol) => {
                  if (symbol && symbol !== wizardData.token_symbol) {
                    setWizardData((prev: any) => ({ ...prev, token_symbol: symbol }));
                  }
                }}
                onTokenDecimalsRead={(decimals) => {
                  if (decimals !== undefined && decimals !== wizardData.token_decimals) {
                    setWizardData((prev: any) => ({ ...prev, token_decimals: decimals }));
                  }
                }}
              />
            )}

            {currentStep === 3 && (
              <Step3AntiBot
                data={(wizardData.anti_bot || {}) as any}
                onChange={(data) => setWizardData({ ...wizardData, anti_bot: data })}
                errors={errors}
              />
            )}

            {currentStep === 4 && (
              <Step4InvestorVesting
                data={(wizardData.investor_vesting || {}) as any}
                onChange={(data) => setWizardData({ ...wizardData, investor_vesting: data })}
                errors={errors}
              />
            )}

            {currentStep === 5 && (
              <Step6LpLock
                data={(wizardData.lp_lock || {}) as any}
                onChange={(data) => setWizardData({ ...wizardData, lp_lock: data })}
                errors={errors}
              />
            )}

            {currentStep === 6 && (
              <Step5TeamVesting
                data={(wizardData.team_vesting || {}) as any}
                onChange={(data) => setWizardData({ ...wizardData, team_vesting: data })}
                errors={errors}
                totalTokenSupply={wizardData.total_supply || '0'}
                tokensForSale={wizardData.sale_params?.total_tokens || '0'}
                lpLockPercentage={wizardData.lp_lock?.percentage || 0}
              />
            )}

            {currentStep === 7 && (
              <Step7Fees
                data={(wizardData.fees_referral || {}) as any}
                onChange={(data) => setWizardData({ ...wizardData, fees_referral: data })}
              />
            )}

            {currentStep === 8 && (
              <Step8Review
                data={wizardData}
                onEdit={handleStepClick}
                termsAccepted={termsAccepted}
                onTermsChange={setTermsAccepted}
              />
            )}

            {currentStep === 9 && (
              <Step9Submit
                complianceStatus={complianceStatus}
                wizardData={wizardData}
                isSubmitting={isSubmitting}
                tokenAddress={
                  wizardData.contract_address || wizardData.sale_params?.token_address || ''
                }
                tokenDecimals={wizardData.token_decimals || 18}
                tokensForSale={wizardData.sale_params?.total_tokens || '0'}
                teamAllocation={wizardData.team_vesting?.team_allocation || '0'}
                lpLockPercentage={wizardData.lp_lock?.percentage || 0}
                network={wizardData.network || wizardData.basics?.network || ''}
              />
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/5">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-[14px] font-semibold transition-all border ${
                  currentStep === 0
                    ? 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              {/* Save Draft Button - Only show if not submitting */}
              {currentStep < 9 && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="hidden sm:flex items-center gap-2 px-6 py-3 rounded-[14px] font-semibold bg-white/5 border border-white/10 text-[#39AEC4] hover:bg-[#39AEC4]/10 hover:border-[#39AEC4]/30 transition-all"
                >
                  <Save className="w-4 h-4" />
                  Save Draft
                </button>
              )}
            </div>

            {currentStep < 10 && (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 rounded-[14px] font-bold bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/20 transform hover:-translate-y-0.5"
              >
                {currentStep === 9 ? 'Review Compliance' : 'Next Step'}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => {
              if (confirm('Are you sure you want to cancel? Your draft will be saved.')) {
                router.push('/presales');
              }
            }}
            className="text-sm font-medium text-gray-500 hover:text-[#39AEC4] transition-colors"
          >
            Cancel and return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
