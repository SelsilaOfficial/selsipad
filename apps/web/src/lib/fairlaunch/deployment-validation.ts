/**
 * Validation middleware for Fairlaunch deployment API
 * Validates request parameters before deployment
 */

import { z } from 'zod';

// Ethereum address validation regex
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Fairlaunch deployment parameters schema
export const FairlaunchDeploySchema = z
  .object({
    // Token configuration
    projectToken: z
      .string()
      .regex(ETH_ADDRESS_REGEX, 'Invalid token address format')
      .describe('ERC20 token contract address'),

    tokenDecimals: z.number().int().min(0).max(18).default(18).describe('Token decimals (0-18)'),

    // Sale parameters
    softcap: z
      .string()
      .or(z.number())
      .transform((val: string | number) => String(val))
      .refine((val: string) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Softcap must be a positive number'),

    tokensForSale: z
      .string()
      .or(z.number())
      .transform((val: string | number) => String(val))
      .refine((val: string) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Tokens for sale must be a positive number'),

    minContribution: z
      .string()
      .or(z.number())
      .transform((val: string | number) => String(val))
      .refine((val: string) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Minimum contribution must be positive'),

    maxContribution: z
      .string()
      .or(z.number())
      .transform((val: string | number) => String(val))
      .refine((val: string) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      }, 'Maximum contribution must be positive'),

    // Timing
    // CRITICAL FIX: datetime-local inputs come as strings WITHOUT timezone
    // Server (Node.js) parses them in SERVER timezone (UTC), not user timezone!
    // User in WIB (UTC+7) inputs "05:05" expecting local time,
    // but server parses as "05:05 UTC" instead of "05:05 WIB" (= 22:05 UTC previous day)
    //
    // Solution: Accept timezone offset from client OR hardcode for WIB users
    startTime: z
      .string()
      .or(z.date())
      .or(z.number()) // Accept Unix timestamp too
      .transform((val: string | Date | number) => {
        if (typeof val === 'number') {
          // Unix timestamp in seconds - convert to milliseconds
          return new Date(val * 1000);
        }
        if (typeof val === 'string') {
          // datetime-local format: "2026-02-07T05:05"
          // Parse as Date - will use SERVER timezone (UTC)
          const parsed = new Date(val);

          // TEMPORARY FIX: Assume WIB (UTC+7) for user timezone
          // Subtract 7 hours to get correct UTC timestamp
          // User input: 05:05 WIB → Should store as: 22:05 UTC (previous day)
          const userTimezoneOffsetHours = 7;
          return new Date(parsed.getTime() - userTimezoneOffsetHours * 3600 * 1000);
        }
        return val; // Already a Date
      })
      .refine((date: Date) => date > new Date(), 'Start time must be in the future'),

    endTime: z
      .string()
      .or(z.date())
      .or(z.number())
      .transform((val: string | Date | number) => {
        if (typeof val === 'number') {
          return new Date(val * 1000);
        }
        if (typeof val === 'string') {
          const parsed = new Date(val);
          const userTimezoneOffsetHours = 7; // WIB = UTC+7
          return new Date(parsed.getTime() - userTimezoneOffsetHours * 3600 * 1000);
        }
        return val;
      }),

    // Liquidity settings
    liquidityPercent: z
      .number()
      .int()
      .min(51)
      .max(100)
      .default(70)
      .describe('Liquidity percentage (51-100%)'),

    lpLockMonths: z
      .number()
      .int()
      .min(1)
      .max(60)
      .default(24)
      .describe('LP lock duration in months'),

    listingPremiumBps: z
      .number()
      .int()
      .min(0)
      .max(5000)
      .default(0)
      .describe('Listing price premium in basis points (0-5000)'),

    dexPlatform: z
      .enum(['PancakeSwap', 'Uniswap', 'SushiSwap', 'BaseSwap'])
      .default('PancakeSwap')
      .describe('DEX platform for listing'),

    // Team vesting
    teamVestingTokens: z
      .string()
      .or(z.number())
      .transform((val: string | number) => String(val))
      .optional()
      .describe('Number of tokens allocated for team vesting'),

    teamVestingAddress: z
      .string()
      .regex(ETH_ADDRESS_REGEX, 'Invalid vesting address')
      .optional()
      .describe('Team vesting vault address'),

    vestingSchedule: z
      .array(
        z.object({
          month: z.number().int().min(0),
          percentage: z.number().min(0).max(100),
        })
      )
      .optional()
      .describe('Team vesting schedule (month -> percentage)'),

    creatorWallet: z
      .string()
      .regex(ETH_ADDRESS_REGEX, 'Invalid creator wallet address')
      .describe('Project creator wallet'),

    // Metadata
    metadata: z
      .object({
        name: z.string().min(1, 'Project name is required'),
        symbol: z.string().optional(),
        description: z.string().optional(),
        logoUrl: z.string().optional(),
        projectWebsite: z.string().url().optional(),
        telegram: z.string().optional(),
        twitter: z.string().optional(),
        discord: z.string().optional(),
      })
      .optional()
      .describe('Project metadata (name, description, social links)'),

    // Network
    chainId: z
      .number()
      .int()
      .refine(
        (id: number) => [97, 56, 11155111, 1, 84532, 8453].includes(id),
        'Unsupported chain ID'
      )
      .default(97)
      .describe('Blockchain network ID'),
  })
  .refine(
    (data: any) => {
      // Cross-field validation: end time must be after start time
      return data.endTime > data.startTime;
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  )
  .refine(
    (data: any) => {
      // Cross-field validation: max contribution >= min contribution
      const min = parseFloat(String(data.minContribution));
      const max = parseFloat(String(data.maxContribution));
      return max >= min;
    },
    {
      message: 'Max contribution must be >= min contribution',
      path: ['maxContribution'],
    }
  )
  .refine(
    (data: any) => {
      // Fairlaunch requirement: liquidity must be >= 51%
      return data.liquidityPercent >= 51;
    },
    {
      message: 'Fairlaunch requires minimum 51% liquidity',
      path: ['liquidityPercent'],
    }
  );

export type ValidatedFairlaunchParams = z.infer<typeof FairlaunchDeploySchema>;

/**
 * Validate Fairlaunch deployment parameters
 */
export function validateDeploymentParams(body: unknown): {
  success: boolean;
  data?: ValidatedFairlaunchParams;
  error?: {
    message: string;
    issues?: z.ZodIssue[];
  };
} {
  try {
    const validated = FairlaunchDeploySchema.parse(body);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          message: 'Validation failed',
          issues: error.issues,
        },
      };
    }

    // Handle unknown errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';

    return {
      success: false,
      error: {
        message: errorMessage,
      },
    };
  }
}

/**
 * Format validation errors for user-friendly display
 */
export function formatValidationErrors(issues: z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const field = issue.path.join('.');
    return `${field}: ${issue.message}`;
  });
}
