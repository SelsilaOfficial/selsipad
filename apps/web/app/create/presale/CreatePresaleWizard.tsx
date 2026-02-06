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
  const [wizardData, setWizardData] = useState<
    Partial<FullPresaleConfig> & {
      contract_mode?: 'EXTERNAL_CONTRACT' | 'LAUNCHPAD_TEMPLATE' | null;
      contract_address?: string;
      scan_status?: string | null;
      template_audit_status?: 'VALID' | 'NOT_AUDITED' | null;
    }
  >({
    basics: {},
    sale_params: {},
    anti_bot: { whitelist_enabled: false },
    investor_vesting: { tge_percentage: 0, cliff_months: 0, schedule: [] },
    team_vesting: { team_allocation: '0', schedule: [] },
    lp_lock: { duration_months: 12, percentage: 100, platform: 'UNICRYPT' },
    fees_referral: { platform_fee_bps: 500, referral_enabled: true, referral_reward_bps: 100 },
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
          // For template, require VALID audit status
          if (wizardData.contract_mode === 'LAUNCHPAD_TEMPLATE') {
            if (wizardData.template_audit_status !== 'VALID') {
              setErrors({ template: 'Selected template is not audited' });
              return false;
            }
          }
          return true;
        case 1:
          presaleBasicsSchema.parse(wizardData.basics);
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
          teamVestingSchema.parse(wizardData.team_vesting);
          break;
        case 6:
          lpLockSchema.parse(wizardData.lp_lock);
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
    if (currentStep > 1) {
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
        const res = await fetch('/api/presale/draft', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wizardData),
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
          start_at: wizardData.sale_params?.start_at,
          end_at: wizardData.sale_params?.end_at,
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
        terms_accepted: termsAccepted,
      });

      let currentRoundId = roundId;
      if (!currentRoundId) {
        const createRes = await fetch('/api/presale/draft', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validated),
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
          start_at: validated.sale_params?.start_at,
          end_at: validated.sale_params?.end_at,
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
  const complianceStatus: ComplianceStatus = {
    kyc_status: initialKycStatus,
    sc_scan_status: initialScScanStatus,
    investor_vesting_valid:
      (wizardData.investor_vesting?.schedule?.length || 0) > 0 &&
      wizardData.investor_vesting?.schedule?.reduce((sum, s) => sum + s.percentage, 0) === 100,
    team_vesting_valid:
      (wizardData.team_vesting?.schedule?.length || 0) > 0 &&
      wizardData.team_vesting?.schedule?.reduce((sum, s) => sum + s.percentage, 0) === 100,
    lp_lock_valid: (wizardData.lp_lock?.duration_months || 0) >= 12,
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Create Presale</h1>
        <p className="text-gray-400">
          Launch your token presale in 9 simple steps. Your progress is automatically saved.
        </p>
      </div>

      {/* Stepper */}
      <PresaleWizardStepper
        currentStep={currentStep}
        totalSteps={10}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
        className="mb-8"
      />

      {/* Main Content Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-6">
        {/* Step Content */}
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
                contract_mode: data.contract_mode,
                contract_address: data.contract_address,
                scan_status: data.scan_status,
                template_audit_status: data.template_audit_status,
              });
            }}
            projectId={projectId}
            network={wizardData.basics?.network || 'ethereum'}
            errors={errors}
          />
        )}

        {currentStep === 1 && (
          <Step1BasicInfo
            data={wizardData.basics || {}}
            onChange={(data) => setWizardData({ ...wizardData, basics: data })}
            errors={errors}
          />
        )}

        {currentStep === 2 && (
          <Step2SaleParams
            data={wizardData.sale_params || {}}
            onChange={(data) => setWizardData({ ...wizardData, sale_params: data })}
            errors={errors}
            network={wizardData.basics?.network}
          />
        )}

        {currentStep === 3 && (
          <Step3AntiBot
            data={wizardData.anti_bot || {}}
            onChange={(data) => setWizardData({ ...wizardData, anti_bot: data })}
            errors={errors}
          />
        )}

        {currentStep === 4 && (
          <Step4InvestorVesting
            data={wizardData.investor_vesting || {}}
            onChange={(data) => setWizardData({ ...wizardData, investor_vesting: data })}
            errors={errors}
          />
        )}

        {currentStep === 5 && (
          <Step5TeamVesting
            data={wizardData.team_vesting || {}}
            onChange={(data) => setWizardData({ ...wizardData, team_vesting: data })}
            errors={errors}
          />
        )}

        {currentStep === 6 && (
          <Step6LpLock
            data={wizardData.lp_lock || {}}
            onChange={(data) => setWizardData({ ...wizardData, lp_lock: data })}
            errors={errors}
          />
        )}

        {currentStep === 7 && (
          <Step7Fees
            data={wizardData.fees_referral || {}}
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
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
            currentStep === 0
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex items-center gap-3">
          {/* Save Draft Button */}
          {currentStep < 9 && (
            <button
              type="button"
              onClick={handleSaveDraft}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <Save className="w-5 h-5" />
              Save Draft
            </button>
          )}

          {/* Next Button */}
          {currentStep < 10 && (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white transition-colors"
            >
              {currentStep === 9 ? 'Review Compliance' : 'Next'}
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Cancel Link */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            if (confirm('Are you sure you want to cancel? Your draft will be saved.')) {
              router.push('/presales');
            }
          }}
          className="text-gray-500 hover:text-gray-400 text-sm"
        >
          Cancel and return to presales
        </button>
      </div>
    </div>
  );
}
