'use client';

import { Edit2, CheckCircle } from 'lucide-react';
import { NetworkBadge } from '../NetworkBadge';
import type { FullPresaleConfig } from '@/../../packages/shared/src/validators/presale-wizard';

interface Step8ReviewProps {
  data: Partial<FullPresaleConfig>;
  onEdit: (step: number) => void;
  termsAccepted: boolean;
  onTermsChange: (accepted: boolean) => void;
}

export function Step8Review({ data, onEdit, termsAccepted, onTermsChange }: Step8ReviewProps) {
  const formatDate = (date?: string) => {
    if (!date) return 'Not set';
    // datetime-local values don't have timezone info, so display as-is with WIB label
    // This matches the input label on Step 2 which says "(UTC+7 / WIB)"
    const d = new Date(date);
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Review Your Presale</h2>
        <p className="text-gray-400">
          Please review all details carefully before proceeding. You can edit any section by
          clicking the edit button.
        </p>
      </div>

      {/* Basic Info */}
      <ReviewSection title="Basic Information" onEdit={() => onEdit(1)}>
        <ReviewItem label="Project Name" value={data.basics?.name} />
        <ReviewItem label="Description" value={data.basics?.description?.slice(0, 100) + '...'} />
        <ReviewItem
          label="Network"
          value={data.basics?.network && <NetworkBadge network={data.basics.network} />}
        />
        {data.basics?.logo_url && (
          <ReviewItem
            label="Logo"
            value={<img src={data.basics.logo_url} alt="Logo" className="w-12 h-12 rounded" />}
          />
        )}
      </ReviewSection>

      {/* Sale Parameters */}
      <ReviewSection title="Sale Parameters" onEdit={() => onEdit(2)}>
        <ReviewItem label="Token Address" value={data.sale_params?.token_address} mono />
        <ReviewItem label="Total Tokens" value={data.sale_params?.total_tokens} />
        <ReviewItem label="Price" value={data.sale_params?.price} />
        <ReviewItem
          label="Softcap / Hardcap"
          value={`${data.sale_params?.softcap} / ${data.sale_params?.hardcap}`}
        />
        <ReviewItem
          label="Min / Max Contribution"
          value={`${data.sale_params?.min_contribution} / ${data.sale_params?.max_contribution}`}
        />
        <ReviewItem label="Payment Token" value={data.sale_params?.payment_token} />
        <ReviewItem label="Start" value={formatDate(data.sale_params?.start_at)} />
        <ReviewItem label="End" value={formatDate(data.sale_params?.end_at)} />
      </ReviewSection>

      {/* Vesting */}
      <ReviewSection title="Vesting Schedules" onEdit={() => onEdit(4)}>
        <ReviewItem
          label="Investor Vesting"
          value={
            data.investor_vesting?.schedule?.length
              ? `${data.investor_vesting.schedule.length} unlock events`
              : 'Not configured'
          }
        />
        <ReviewItem
          label="Team Vesting"
          value={
            data.team_vesting?.schedule?.length
              ? `${data.team_vesting.schedule.length} unlock events`
              : 'Not configured'
          }
        />
      </ReviewSection>

      {/* LP Lock */}
      <ReviewSection title="LP Lock" onEdit={() => onEdit(6)}>
        <ReviewItem label="Duration" value={`${data.lp_lock?.duration_months} months`} />
        <ReviewItem label="Percentage" value={`${data.lp_lock?.percentage}%`} />
      </ReviewSection>

      {/* Terms Acceptance */}
      <div className="p-6 bg-gray-800/30 border border-gray-700 rounded-lg">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => onTermsChange(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900"
          />
          <div className="text-sm text-gray-300">
            I have reviewed all information and accept the{' '}
            <a href="/terms" target="_blank" className="text-purple-400 hover:text-purple-300">
              Terms & Conditions
            </a>{' '}
            and{' '}
            <a
              href="/presale-policy"
              target="_blank"
              className="text-purple-400 hover:text-purple-300"
            >
              Presale Policy
            </a>
            . I understand that incorrect information may result in presale rejection.
          </div>
        </label>
      </div>

      {termsAccepted && (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Ready to proceed to compliance check!</span>
        </div>
      )}
    </div>
  );
}

function ReviewSection({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          Edit
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ReviewItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-4 text-sm">
      <span className="text-gray-400">{label}:</span>
      <span className={`text-white text-right ${mono ? 'font-mono text-xs' : ''}`}>
        {value || 'Not set'}
      </span>
    </div>
  );
}
