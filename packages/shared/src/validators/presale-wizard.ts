/**
 * Presale Wizard Validators
 * Step-by-step validation schemas for the Create Presale Wizard
 */

import { z } from 'zod';

// ============================================
// Types & Schemas
// ============================================

/**
 * Step 1: Basic Information
 */
export const presaleBasicsSchema = z.object({
  name: z
    .string()
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name cannot exceed 100 characters'),
  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  logo_url: z.string().optional(),
  banner_url: z.string().optional(),
  network: z
    .enum(
      [
        'solana',
        'ethereum',
        'bsc',
        'polygon',
        'avalanche',
        'bsc_testnet',
        'sepolia',
        'base_sepolia',
        'base',
        'bnb',
        'localhost',
      ],
      {
        message: 'Please select a valid network',
      }
    )
    .optional(),
});

export type PresaleBasics = z.infer<typeof presaleBasicsSchema>;

/**
 * Step 2: Sale Parameters
 */
export const presaleSaleParamsSchema = z
  .object({
    token_address: z.string().min(1, 'Token address is required'),
    total_tokens: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Total tokens must be greater than 0',
    }),
    price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Price must be greater than 0',
    }),
    softcap: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Softcap must be greater than 0',
    }),
    hardcap: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Hardcap must be greater than 0',
    }),
    min_contribution: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Minimum contribution must be greater than 0',
    }),
    max_contribution: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Maximum contribution must be greater than 0',
    }),
    start_at: z.string().min(1, 'Start date is required'),
    end_at: z.string().min(1, 'End date is required'),
    payment_token: z.enum(['NATIVE', 'USDC', 'USDT'], {
      message: 'Please select a valid payment token',
    }),
  })
  .refine(
    (data) => {
      const softcap = Number(data.softcap);
      const hardcap = Number(data.hardcap);
      return softcap <= hardcap;
    },
    {
      message: 'Softcap cannot exceed hardcap',
      path: ['softcap'],
    }
  )
  .refine(
    (data) => {
      const min = Number(data.min_contribution);
      const max = Number(data.max_contribution);
      return min <= max;
    },
    {
      message: 'Minimum contribution cannot exceed maximum',
      path: ['min_contribution'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.start_at);
      const end = new Date(data.end_at);
      return start < end;
    },
    {
      message: 'End date must be after start date',
      path: ['end_at'],
    }
  )
  .refine(
    (data) => {
      // datetime-local values are in format 'YYYY-MM-DDTHH:MM'
      const start = new Date(data.start_at);
      return !isNaN(start.getTime());
    },
    {
      message: 'Invalid start date format',
      path: ['start_at'],
    }
  );

export type PresaleSaleParams = z.infer<typeof presaleSaleParamsSchema>;

/**
 * Step 3: Anti-Bot Configuration (Optional)
 */
export const presaleAntiBotSchema = z.object({
  whitelist_enabled: z.boolean().default(false),
  whitelist_addresses: z.array(z.string()).optional(),
  max_buy_per_wallet: z.string().optional(),
});

export type PresaleAntiBot = z.infer<typeof presaleAntiBotSchema>;

/**
 * Vesting Schedule Entry
 */
export const vestingEntrySchema = z.object({
  month: z.number().min(0, 'Month cannot be negative'),
  percentage: z
    .number()
    .min(0, 'Percentage cannot be negative')
    .max(100, 'Percentage cannot exceed 100'),
});

export type VestingEntry = z.infer<typeof vestingEntrySchema>;

/**
 * Step 4 & 5: Vesting Configuration
 */
export const vestingScheduleSchema = z
  .array(vestingEntrySchema)
  .min(1, 'At least one vesting entry is required')
  .refine(
    (schedule) => {
      const months = schedule.map((s) => s.month);
      const uniqueMonths = new Set(months);
      return months.length === uniqueMonths.size;
    },
    {
      message: 'Duplicate months are not allowed',
    }
  );

export const investorVestingSchema = z
  .object({
    tge_percentage: z
      .number()
      .min(0, 'TGE percentage cannot be negative')
      .max(100, 'TGE percentage cannot exceed 100'),
    cliff_months: z.number().min(0, 'Cliff duration cannot be negative'),
    schedule: vestingScheduleSchema,
  })
  .refine(
    (data) => {
      const scheduleTotal = data.schedule.reduce((sum, entry) => sum + entry.percentage, 0);
      const grandTotal = data.tge_percentage + scheduleTotal;
      return Math.abs(grandTotal - 100) < 0.01;
    },
    {
      message: 'TGE + vesting schedule must total 100%',
      path: ['schedule'],
    }
  );

export type InvestorVesting = z.infer<typeof investorVestingSchema>;

export const teamVestingSchema = z.object({
  team_allocation: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Team allocation must be a valid number',
  }),
  schedule: vestingScheduleSchema,
});

export type TeamVesting = z.infer<typeof teamVestingSchema>;

/**
 * Step 6: LP Lock Configuration
 */
export const lpLockSchema = z.object({
  duration_months: z.number().min(12, 'LP lock duration must be at least 12 months'),
  percentage: z
    .number()
    .min(51, 'LP lock percentage must be at least 51%')
    .max(100, 'LP lock percentage cannot exceed 100%'),
});

export type LpLock = z.infer<typeof lpLockSchema>;

/**
 * Step 7: Fees & Referral
 */
export const feesReferralSchema = z.object({
  platform_fee_bps: z.number().min(0).max(1000).default(500), // Fixed 5% on-chain
});

export type FeesReferral = z.infer<typeof feesReferralSchema>;

/**
 * Full Presale Configuration
 */
export const fullPresaleConfigSchema = z.object({
  basics: presaleBasicsSchema,
  sale_params: presaleSaleParamsSchema,
  anti_bot: presaleAntiBotSchema,
  investor_vesting: investorVestingSchema,
  team_vesting: teamVestingSchema,
  lp_lock: lpLockSchema,
  fees_referral: feesReferralSchema,
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
});

export type FullPresaleConfig = z.infer<typeof fullPresaleConfigSchema>;

// ============================================
// Helper Functions
// ============================================

/**
 * Validate EVM address format
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Solana address format
 */
export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Validate token address based on network
 */
export function validateTokenAddress(address: string, network: string): boolean {
  if (network === 'solana') {
    return isValidSolanaAddress(address);
  }
  return isValidEvmAddress(address);
}

/**
 * Create linear vesting schedule
 * @param totalMonths Total duration in months
 * @param tgePercentage Percentage unlocked at TGE (month 0)
 * @returns Vesting schedule array
 */
export function createLinearVesting(
  totalMonths: number,
  tgePercentage: number = 0
): VestingEntry[] {
  const schedule: VestingEntry[] = [];

  if (tgePercentage > 0) {
    schedule.push({ month: 0, percentage: tgePercentage });
  }

  const remainingPercentage = 100 - tgePercentage;
  const monthlyPercentage = remainingPercentage / totalMonths;

  for (let i = 1; i <= totalMonths; i++) {
    schedule.push({
      month: i,
      percentage: Number(monthlyPercentage.toFixed(2)),
    });
  }

  // Adjust last month to ensure total is exactly 100%
  const total = schedule.reduce((sum, s) => sum + s.percentage, 0);
  const lastEntry = schedule[schedule.length - 1];
  if (lastEntry && Math.abs(total - 100) > 0.01) {
    lastEntry.percentage += 100 - total;
    lastEntry.percentage = Number(lastEntry.percentage.toFixed(2));
  }

  return schedule;
}

/**
 * Validate compliance gates
 */
export interface ComplianceStatus {
  kyc_status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';
  sc_scan_status: 'NOT_REQUESTED' | 'PENDING' | 'PASS' | 'FAIL' | 'OVERRIDE_PASS';
  investor_vesting_valid: boolean;
  team_vesting_valid: boolean;
  lp_lock_valid: boolean;
}

export function validateComplianceGates(compliance: ComplianceStatus): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (compliance.kyc_status !== 'CONFIRMED') {
    violations.push('Developer KYC must be confirmed');
  }

  if (!['PASS', 'OVERRIDE_PASS'].includes(compliance.sc_scan_status)) {
    violations.push('Smart contract scan must pass');
  }

  if (!compliance.investor_vesting_valid) {
    violations.push('Investor vesting schedule must be configured');
  }

  if (!compliance.team_vesting_valid) {
    violations.push('Team vesting schedule must be configured');
  }

  if (!compliance.lp_lock_valid) {
    violations.push('LP lock must be at least 12 months');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
