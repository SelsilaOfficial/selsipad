'use client';

import { useState } from 'react';
import { ContractModeStep } from '@/app/create/presale/components/ContractModeStep';
import { ExternalScanStep } from '@/app/create/presale/components/ExternalScanStep';
import { TemplateModeStep } from '@/app/create/presale/components/TemplateModeStep';

interface Step0ContractModeProps {
  data: {
    contract_mode?: 'EXTERNAL_CONTRACT' | 'LAUNCHPAD_TEMPLATE' | null;
    contract_address?: string;
    scan_status?: string | null;
    template_audit_status?: 'VALID' | 'NOT_AUDITED' | null;
  };
  onChange: (data: any) => void;
  projectId?: string | null;
  network: string;
  errors?: any;
}

export function Step0ContractMode({
  data,
  onChange,
  projectId,
  network,
  errors,
}: Step0ContractModeProps) {
  const [subStep, setSubStep] = useState<0 | 1>(data.contract_mode ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Contract Setup</h2>
        <p className="text-gray-400">Choose how you want to deploy your presale smart contract</p>
      </div>

      {/* Sub-step 0: Mode Selection */}
      {subStep === 0 && (
        <>
          <ContractModeStep
            selectedMode={data.contract_mode || null}
            onSelectMode={(mode) => {
              onChange({ ...data, contract_mode: mode });
              setSubStep(1);
            }}
            network={network}
            onNetworkChange={(net) => {
              onChange({ ...data, network: net });
            }}
          />
          {errors?.contract_mode && (
            <p className="mt-2 text-sm text-red-400">{errors.contract_mode}</p>
          )}
        </>
      )}

      {/* Sub-step 1: External Scan Flow */}
      {subStep === 1 && data.contract_mode === 'EXTERNAL_CONTRACT' && (
        <>
          <ExternalScanStep
            projectId={projectId || 'temp'} // Pass temp ID, will create project after scan
            network={network}
            contractAddress={data.contract_address || ''}
            onContractAddressChange={(address) => onChange({ ...data, contract_address: address })}
            onScanComplete={(status) => onChange({ ...data, scan_status: status })}
          />

          {errors?.contract_address && (
            <p className="mt-2 text-sm text-red-400">{errors.contract_address}</p>
          )}
          {errors?.scan && <p className="mt-2 text-sm text-red-400">{errors.scan}</p>}

          <button
            type="button"
            onClick={() => setSubStep(0)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Change Contract Mode
          </button>
        </>
      )}

      {/* Sub-step 1: Template Info + Token Creation */}
      {subStep === 1 && data.contract_mode === 'LAUNCHPAD_TEMPLATE' && (
        <>
          <TemplateModeStep
            templateVersion="1.0.0"
            network={network}
            templateAuditStatus={data.template_audit_status || null}
            onTokenCreated={(tokenData) => {
              onChange({
                ...data,
                contract_address: tokenData.address,
                template_audit_status: 'VALID',
              });
            }}
          />

          {errors?.template && <p className="mt-2 text-sm text-red-400">{errors.template}</p>}

          <button
            type="button"
            onClick={() => setSubStep(0)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Change Contract Mode
          </button>
        </>
      )}

      {/* Info Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
        <div className="flex gap-3">
          <div className="text-blue-400 text-xl flex-shrink-0">ℹ️</div>
          <div className="text-sm text-blue-300">
            <strong className="text-blue-200">Contract Security:</strong>{' '}
            {data.contract_mode === 'EXTERNAL_CONTRACT'
              ? 'Your custom contract will undergo automated security scanning before approval.'
              : data.contract_mode === 'LAUNCHPAD_TEMPLATE'
                ? 'Our pre-audited template requires no additional security scanning.'
                : 'Select a contract option to continue with presale creation.'}
          </div>
        </div>
      </div>
    </div>
  );
}
