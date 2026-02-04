# Fairlaunch UI Improvement Action Plan

> **🎯 Action items**: Daftar perubahan yang perlu dilakukan pada UI berdasarkan analisis SC

---

## 🔴 Critical Fixes (Must Have)

### 1. **Fix Team Vesting Data Structure**

**Problem:**
UI menggunakan format `{month, percentage}` tapi SC butuh `{beneficiary, startTime, durations[], amounts[]}`.

**Files to Modify:**

- `/apps/web/app/create/fairlaunch/CreateFairlaunchWizard.tsx` (Step 4)
- `/apps/web/app/create/fairlaunch/actions.ts` (SC call)

**Changes:**

```typescript
// ADD to Step 4: Team Vesting Beneficiary field
<div>
  <label className="block text-sm font-medium text-gray-300 mb-2">
    Vesting Beneficiary Address
  </label>
  <input
    type="text"
    value={wizardData.team_vesting?.beneficiary || walletAddress}
    onChange={(e) =>
      setWizardData({
        ...wizardData,
        team_vesting: {
          ...wizardData.team_vesting,
          beneficiary: e.target.value
        },
      })
    }
    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm"
    placeholder={walletAddress}
  />
  <p className="text-gray-500 text-xs mt-1">
    Address that will receive vested tokens (defaults to your wallet)
  </p>
</div>
```

```typescript
// ADD conversion function in actions.ts
function convertVestingForSC(
  schedule: Array<{ month: number; percentage: number }>,
  allocation: string,
  saleEndTime: number,
  beneficiary: string
): TeamVestingParams {
  const totalAllocation = BigInt(allocation);

  return {
    beneficiary: beneficiary,
    startTime: saleEndTime,
    durations: schedule.map((s) => s.month * 30 * 24 * 60 * 60), // Convert months to seconds
    amounts: schedule.map((s) => (totalAllocation * BigInt(s.percentage)) / 100n),
  };
}
```

**Testing:**

```bash
# Test conversion
Input:
  schedule = [{month: 0, percentage: 20}, {month: 6, percentage: 80}]
  allocation = "1000000"
  saleEndTime = 1706745600
  beneficiary = "0x123..."

Output:
  beneficiary = "0x123..."
  startTime = 1706745600
  durations = [0, 15552000]  // 0 and 6 months in seconds
  amounts = [200000, 800000] // 20% and 80% of 1M
```

---

### 2. **Add Listing Premium Field**

**Problem:**
SC membutuhkan `listingPremiumBps` tapi UI tidak collect parameter ini.

**Files to Modify:**

- `/apps/web/app/create/fairlaunch/CreateFairlaunchWizard.tsx` (Step 3)

**Changes:**

```typescript
// ADD to Step 3: Liquidity Plan
<div>
  <label className="block text-sm font-medium text-gray-300 mb-2">
    Listing Price Premium (%)
  </label>
  <input
    type="number"
    min="0"
    max="10"
    step="0.5"
    value={(wizardData.liquidity?.listing_premium_bps || 0) / 100}
    onChange={(e) =>
      setWizardData({
        ...wizardData,
        liquidity: {
          ...wizardData.liquidity,
          listing_premium_bps: parseFloat(e.target.value) * 100,
        },
      })
    }
    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
    placeholder="5"
  />
  <p className="text-gray-500 text-xs mt-1">
    Listing price on DEX will be X% higher than final fairlaunch price.
    Example: 5% premium means if final price is $1, listing will be $1.05
  </p>
  <p className="text-gray-400 text-xs mt-1">
    Recommended: 0-10%. Higher premium = more initial liquidity depth
  </p>
</div>
```

**Update Schema:**

```typescript
const fairlaunchLiquiditySchema = z.object({
  liquidity_percent: z.number().min(70, 'Fairlaunch requires min 70% liquidity'),
  lp_lock_months: z.number().min(12, 'LP lock must be at least 12 months'),
  listing_platform: z.string().min(1, 'Platform required'),
  listing_premium_bps: z.number().min(0).max(1000, 'Max 10% premium'), // NEW
});
```

---

### 3. **Add DEX ID Hash Conversion**

**Problem:**
UI stores string "Uniswap" tapi SC expects `bytes32 dexId`.

**Files to Create:**

- `/apps/web/src/lib/web3/dex-config.ts`

**New File:**

```typescript
import { ethers } from 'ethers';

// DEX identifier mapping
export const DEX_IDS = {
  Uniswap: ethers.id('UNISWAP'), // Ethereum/Sepolia
  PancakeSwap: ethers.id('PANCAKESWAP'), // BSC/BSC Testnet
  BaseSwap: ethers.id('BASESWAP'), // Base/Base Sepolia
  Raydium: ethers.id('RAYDIUM'), // Solana (not used for EVM)
} as const;

export function getDexId(platform: string): string {
  return DEX_IDS[platform as keyof typeof DEX_IDS] || ethers.id(platform.toUpperCase());
}

export function getDexPlatformsByNetwork(network: string): string[] {
  const mapping: Record<string, string[]> = {
    ethereum: ['Uniswap'],
    sepolia: ['Uniswap'],
    bnb: ['PancakeSwap'],
    bsc_testnet: ['PancakeSwap'],
    base: ['BaseSwap', 'Uniswap'],
    base_sepolia: ['BaseSwap', 'Uniswap'],
    localhost: ['Uniswap'],
  };
  return mapping[network] || ['Uniswap'];
}
```

**Usage in Wizard:**

```typescript
import { getDexPlatformsByNetwork, getDexId } from '@/lib/web3/dex-config';

// In Step 3, dynamically populate DEX options
const dexOptions = getDexPlatformsByNetwork(wizardData.basics?.network || 'ethereum');

<select
  value={wizardData.liquidity?.listing_platform || dexOptions[0]}
  onChange={(e) =>
    setWizardData({
      ...wizardData,
      liquidity: { ...wizardData.liquidity, listing_platform: e.target.value },
    })
  }
  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
>
  {dexOptions.map(dex => (
    <option key={dex} value={dex}>{dex}</option>
  ))}
</select>

// In actions.ts, convert before SC call
const dexId = getDexId(wizardData.liquidity.listing_platform);
```

---

## 🟡 High Priority (Should Have)

### 4. **Display Deployment Fee in Step 6**

**Changes:**

```typescript
// ADD to Step 6: Review
const deploymentFee = wizardData.basics?.network?.includes('bsc')
  ? '0.2 BNB'
  : '0.1 ETH';

<div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-4 mb-4">
  <div className="flex items-center gap-3">
    <AlertCircle className="w-5 h-5 text-amber-400" />
    <div>
      <p className="text-amber-200 font-medium">Deployment Fee Required</p>
      <p className="text-amber-300/80 text-sm">
        You will need to pay <strong>{deploymentFee}</strong> to deploy your Fairlaunch contract.
        This fee covers gas and platform deployment costs.
      </p>
    </div>
  </div>
</div>
```

---

### 5. **Add Min/Max Contribution Validation**

**Problem:**
UI shows optional fields tapi SC expects valid min/max contribution.

**Changes:**

```typescript
// UPDATE schema
const fairlaunchParamsSchema = z
  .object({
    // ... other fields
    min_contribution: z.string().min(1, 'Min contribution required'), // Remove optional
    max_contribution: z.string().min(1, 'Max contribution required'), // Remove optional
  })
  .refine(
    (data) => {
      const minBn = parseFloat(data.min_contribution || '0');
      const maxBn = parseFloat(data.max_contribution || '0');
      return minBn > 0 && maxBn > minBn;
    },
    {
      message: 'Max contribution must be greater than min contribution',
      path: ['max_contribution'],
    }
  );
```

```typescript
// UPDATE UI - Step 2
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-2">
      Min Contribution (per user)
    </label>
    <input
      type="number"
      step="0.01"
      value={wizardData.params?.min_contribution || ''}
      onChange={(e) =>
        setWizardData({
          ...wizardData,
          params: { ...wizardData.params, min_contribution: e.target.value },
        })
      }
      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
      placeholder="0.1"
      required
    />
    <p className="text-gray-500 text-xs mt-1">
      Minimum amount each user can contribute
    </p>
  </div>

  <div>
    <label className="block text-sm font-medium text-gray-300 mb-2">
      Max Contribution (per user)
    </label>
    <input
      type="number"
      step="0.1"
      value={wizardData.params?.max_contribution || ''}
      onChange={(e) =>
        setWizardData({
          ...wizardData,
          params: { ...wizardData.params, max_contribution: e.target.value },
        })
      }
      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
      placeholder="10"
      required
    />
    <p className="text-gray-500 text-xs mt-1">
      Maximum amount each user can contribute
    </p>
  </div>
</div>
```

---

### 6. **Improve Vesting Schedule Builder**

**Problem:**
Current UI hanya placeholder untuk schedule input.

**Changes:**

```typescript
// ADD interactive vesting schedule builder
const [vestingSchedule, setVestingSchedule] = useState<Array<{month: number, percentage: number}>>([
  { month: 0, percentage: 20 }  // Default TGE
]);

function addVestingPeriod() {
  setVestingSchedule([...vestingSchedule, { month: 6, percentage: 0 }]);
}

function removeVestingPeriod(index: number) {
  setVestingSchedule(vestingSchedule.filter((_, i) => i !== index));
}

function updateVestingPeriod(index: number, field: 'month' | 'percentage', value: number) {
  const updated = [...vestingSchedule];
  updated[index][field] = value;
  setVestingSchedule(updated);
  setWizardData({
    ...wizardData,
    team_vesting: { ...wizardData.team_vesting, schedule: updated }
  });
}

const totalPercentage = vestingSchedule.reduce((sum, v) => sum + v.percentage, 0);

// UI Component
<div className="space-y-3">
  <label className="block text-sm font-medium text-gray-300">
    Vesting Schedule
  </label>

  {vestingSchedule.map((period, index) => (
    <div key={index} className="flex gap-3 items-end">
      <div className="flex-1">
        <label className="text-xs text-gray-400">Month</label>
        <input
          type="number"
          min="0"
          value={period.month}
          onChange={(e) => updateVestingPeriod(index, 'month', parseInt(e.target.value))}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
        />
      </div>
      <div className="flex-1">
        <label className="text-xs text-gray-400">Percentage</label>
        <input
          type="number"
          min="0"
          max="100"
          value={period.percentage}
          onChange={(e) => updateVestingPeriod(index, 'percentage', parseInt(e.target.value))}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
        />
      </div>
      {vestingSchedule.length > 1 && (
        <button
          onClick={() => removeVestingPeriod(index)}
          className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded"
        >
          Remove
        </button>
      )}
    </div>
  ))}

  <div className="flex justify-between items-center pt-2">
    <button
      onClick={addVestingPeriod}
      className="text-sm text-purple-400 hover:text-purple-300"
    >
      + Add Period
    </button>
    <div className={`text-sm font-medium ${totalPercentage === 100 ? 'text-green-400' : 'text-red-400'}`}>
      Total: {totalPercentage}% {totalPercentage === 100 ? '✓' : '(must be 100%)'}
    </div>
  </div>
</div>
```

---

## 🟢 Medium Priority (Nice to Have)

### 7. **Add Real-time Price Preview**

Show estimated final price based on softcap:

```typescript
// In Step 2
const estimatedPriceAtSoftcap = wizardData.params?.softcap && wizardData.params?.tokens_for_sale
  ? (parseFloat(wizardData.params.softcap) / parseFloat(wizardData.params.tokens_for_sale)).toFixed(8)
  : '0';

<div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-4 mt-4">
  <p className="text-blue-200 text-sm mb-2">
    <strong>Price Preview:</strong>
  </p>
  <p className="text-blue-300/90 text-xs">
    If softcap is reached: <strong>1 token = {estimatedPriceAtSoftcap} {wizardData.params?.payment_token || 'ETH'}</strong>
  </p>
  <p className="text-blue-300/70 text-xs mt-1">
    Note: Final price will be calculated as total_raised / tokens_for_sale
  </p>
</div>
```

---

### 8. **Add Network-Aware DEX Selection**

Automatically filter DEX options based on selected network:

```typescript
// Already covered in Fix #3 above
```

---

### 9. **Improve Error Messages**

Add helpful error messages for common mistakes:

```typescript
// Custom validation messages
const customErrorMessages = {
  liquidityPercent: 'Fairlaunch requires minimum 70% liquidity to ensure adequate trading depth',
  lpLockMonths: 'Minimum 12 months lock protects your investors from early rug pulls',
  softcap: 'Set a realistic softcap - if not reached, all funds will be refunded',
  vestingTotal: 'Vesting schedule must total exactly 100% to distribute all team tokens',
};
```

---

## 📋 Implementation Checklist

### Sprint 1: Critical Fixes (Week 1)

- [ ] Fix team vesting data structure + conversion
- [ ] Add vesting beneficiary field
- [ ] Add listing premium field
- [ ] Implement DEX ID hash conversion
- [ ] Test conversion functions

### Sprint 2: High Priority (Week 2)

- [ ] Display deployment fee
- [ ] Add min/max contribution validation
- [ ] Improve vesting schedule builder
- [ ] Add real-time validation feedback

### Sprint 3: Polish (Week 3)

- [ ] Add price preview calculator
- [ ] Network-aware DEX selection
- [ ] Improve error messages
- [ ] Add tooltips and help text
- [ ] Comprehensive testing

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe('Vesting Conversion', () => {
  it('should convert UI schedule to SC format', () => {
    const schedule = [
      { month: 0, percentage: 20 },
      { month: 6, percentage: 80 }
    ];
    const result = convertVestingForSC(
      schedule,
      '1000000',
      16707456 00,
      '0x123...'
    );
    expect(result.durations).toEqual([0, 15552000]);
    expect(result.amounts).toEqual([200000n, 800000n]);
  });
});
```

### Integration Tests

```typescript
describe('Fairlaunch Creation Flow', () => {
  it('should create fairlaunch with correct parameters', async () => {
    // Fill wizard
    // Submit
    // Verify SC call
    // Check database
  });
});
```

### E2E Tests

```typescript
describe('User Journey', () => {
  it('should complete full wizard flow', async () => {
    // Open wizard
    // Fill all steps
    // Submit
    // Verify success
  });
});
```

---

## 📊 Success Metrics

- [ ] All wizard steps map to SC parameters
- [ ] No data loss in conversion
- [ ] 100% SC call success rate
- [ ] Clear error messages for validation failures
- [ ] User can complete wizard in < 10 minutes

**Ready untuk implementasi, bro! 🚀**
