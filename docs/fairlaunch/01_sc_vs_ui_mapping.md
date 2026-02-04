# Fairlaunch SC vs UI Mapping

> **📋 Dokumen diskusi**: Mapping antara Smart Contract Fairlaunch dengan UI Wizard
>
> **Tujuan**: Memastikan UI mengikuti prosedur SC dengan benar

---

## 🏗️ Smart Contract Architecture

### 1. **FairlaunchFactory.sol** (Deployment)

```solidity
constructor(
    uint256 _deploymentFee,        // 0.2 BNB (BSC) / 0.1 ETH (ETH/Base)
    address _feeSplitter,
    address _treasuryWallet,
    address _adminExecutor
)

function createFairlaunch(
    CreateFairlaunchParams params,  // Pool configuration
    TeamVestingParams vestingParams, // Team vesting (MANDATORY)
    LPLockPlan lpPlan                // LP lock plan (min 70%, 12 months)
) payable returns (fairlaunchAddress, vestingAddress)
```

**Parameters Struct:**

```solidity
struct CreateFairlaunchParams {
    address projectToken;        // Token address
    address paymentToken;        // address(0) = native (ETH/BNB)
    uint256 softcap;             // Minimum to raise
    uint256 tokensForSale;       // Fixed token amount for sale
    uint256 minContribution;     // Min contribution per user
    uint256 maxContribution;     // Max contribution per user
    uint256 startTime;           // Sale start
    uint256 endTime;             // Sale end
    address projectOwner;        // Owner address
    uint16 listingPremiumBps;    // Listing price premium (e.g., 500 = 5%)
}

struct TeamVestingParams {
    address beneficiary;
    uint256 startTime;
    uint256[] durations;         // Array of vesting durations
    uint256[] amounts;           // Array of vesting amounts
}

struct LPLockPlan {
    uint256 lockMonths;          // Min 12 months
    uint256 liquidityPercent;    // Min 7000 (70%)
    bytes32 dexId;               // DEX identifier
}
```

### 2. **Fairlaunch.sol** (Pool Logic)

**Status Flow:**

```
UPCOMING → LIVE → ENDED → SUCCESS/FAILED
                        ↓
                    CANCELLED (admin)
```

**Key Functions:**

```solidity
// User functi ons
contribute() payable              // Contribute native token
contributeERC20(amount)           // Contribute ERC20
claimTokens()                     // After SUCCESS
refund()                          // After FAILED/CANCELLED

// Public
finalize()                        // Anyone can finalize after endTime

// Admin
pause/unpause()
cancel()
```

**Price Discovery Formula:**

```solidity
finalTokenPrice = (totalRaised * 1e18) / tokensForSale
```

**Fee Structure:**

```solidity
PLATFORM_FEE_BPS = 500  // 5% of totalRaised
```

**Liquidity Distribution:**

```solidity
1. Deduct 5% platform fee
2. netRaised = totalRaised - platformFee
3. liquidityFunds = netRaised * liquidityPercent / 10000
4. liquidityTokens = tokensForSale * liquidityPercent / 10000
5. Add to DEX
6. Lock LP tokens for lpLockMonths
7. Send remaining funds to projectOwner
```

---

## 🎨 UI Wizard Flow (7 Steps)

### **Step 1: Basic Info**

**SC Mapping:**

- `projectToken` → Token address (from TokenModeStep)
- `projectOwner` → Current wallet address
- Network selection → Determines DEX router

**UI Fields:**

```typescript
✅ name: string           // Project name (off-chain, DB only)
✅ symbol: string         // Token symbol (off-chain, DB only)
✅ description: string    // Description (off-chain, DB only)
✅ logo_url: string       // Logo URL (off-chain, DB only)
✅ network: enum          // Chain selection
✅ token_address: string  // SC: projectToken
```

**Gap Analysis:**

- ✅ Token address capture sudah ada
- ✅ Network selection sudah ada
- ⚠️ **MISSING**: `projectOwner` perlu di-capture (default = wallet address)

---

### **Step 2: Fairlaunch Params**

**SC Mapping:**

- → `CreateFairlaunchParams` struct

**UI Fields:**

```typescript
✅ token_address: string        // SC: projectToken
✅ tokens_for_sale: string      // SC: tokensForSale
✅ softcap: string              // SC: softcap
✅ payment_token: enum          // SC: paymentToken (NATIVE = address(0))
✅ start_at: datetime           // SC: startTime (convert to Unix)
✅ end_at: datetime             // SC: endTime (convert to Unix)
✅ min_contribution: string     // SC: minContribution
✅ max_contribution: string     // SC: maxContribution
```

**Gap Analysis:**

- ✅ Semua parameter sudah ada
- ⚠️ **MISSING**: `listingPremiumBps` (listing price premium)
- 💡 **Suggestion**: Add listing premium field (default 0, range 0-1000 = 0-10%)

---

### **Step 3: Liquidity Plan**

**SC Mapping:**

- → `LPLockPlan` struct

**UI Fields:**

```typescript
✅ liquidity_percent: number   // SC: liquidityPercent (BPS, min 7000)
✅ lp_lock_months: number      // SC: lockMonths (min 12)
✅ listing_platform: string    // SC: dexId (convert to bytes32)
```

**Gap Analysis:**

- ✅ Min 70% liquidity enforced
- ✅ Min 12 months lock enforced
- 💡 **Need**: Convert `listing_platform` string to `bytes32 dexId`
  ```typescript
  // Example mapping
  'Uniswap' → keccak256('UNISWAP')
  'PancakeSwap' → keccak256('PANCAKESWAP')
  'Raydium' → keccak256('RAYDIUM')
  ```

---

### **Step 4: Team Vesting (MANDATORY)**

**SC Mapping:**

- → `TeamVestingParams` struct

**UI Fields:**

```typescript
✅ team_allocation: string      // Total team tokens
✅ schedule: Array<{
     month: number,             // Vesting month
     percentage: number         // % to vest
   }>
```

**SC Expects:**

```solidity
struct TeamVestingParams {
    address beneficiary;         // ❌ MISSING in UI
    uint256 startTime;           // ❌ MISSING in UI
    uint256[] durations;         // ❌ MISSING in UI
    uint256[] amounts;           // Calculated from schedule
}
```

**Gap Analysis:**

- ❌ **MISSING**: `beneficiary` address
- ❌ **MISSING**: `startTime` (vesting start)
- ❌ **MISSING**: `durations` array (convert from months)
- ⚠️ **FORMAT MISMATCH**: UI uses `{month, percentage}` but SC needs `{durations[], amounts[]}`

**Conversion Logic Needed:**

```typescript
// UI Input:
schedule = [
  { month: 0, percentage: 20 },   // 20% at TGE
  { month: 6, percentage: 40 },   // 40% at 6 months
  { month: 12, percentage: 40 }   // 40% at 12 months
]

// SC Output:
beneficiary = projectOwner
startTime = endTime (sale end)
durations = [0, 6*30*24*60*60, 12*30*24*60*60]  // In seconds
amounts = [
  team_allocation * 0.20,
  team_allocation * 0.40,
  team_allocation * 0.40
]
```

---

### **Step 5: Fees**

**SC Mapping:**

- No input needed, fees are hardcoded

**UI Display Only:**

```typescript
✅ platform_fee_bps: 500        // Display only (5%)
✅ referral_reward_bps: 100     // Display only (1%)
```

**Gap Analysis:**

- ✅ Correct, just informational

---

### **Step 6: Review**

**Gap Analysis:**

- ✅ Summary display
- ✅ Terms acceptance
- ⚠️ **Should show**: Calculated final deployment fee (0.2 BNB or 0.1 ETH)

---

### **Step 7: Submit (Compliance)**

**SC Doesn't Care About:**

- ❌ KYC status (off-chain only)
- ❌ SC Scan (off-chain only)

**SC Only Requires:**

- ✅ Deployment fee paid
- ✅ Valid parameters

**Gap Analysis:**

- ⚠️ Compliance check is **off-chain only**, not SC enforced
- 💡 Platform should gate submission before calling SC

---

## 🔥 Critical Issues Found

### 1. **Team Vesting Format Mismatch** ❌

**Problem:**

- UI stores: `{month, percentage}` array
- SC expects: `{beneficiary, startTime, durations[], amounts[]}`

**Solution:**

```typescript
function convertVestingToSC(
  schedule: Array<{ month: number; percentage: number }>,
  allocation: string,
  saleEndTime: number,
  beneficiary: string
): TeamVestingParams {
  return {
    beneficiary: beneficiary,
    startTime: saleEndTime,
    durations: schedule.map((s) => s.month * 30 * 24 * 60 * 60),
    amounts: schedule.map((s) => (BigInt(allocation) * BigInt(s.percentage)) / 100n),
  };
}
```

### 2. **Missing Beneficiary Address** ❌

**Problem:**

- UI doesn't ask for vesting beneficiary
- SC requires `beneficiary` address

**Solution:**

- Add field in Step 4: "Team Vesting Beneficiary Address"
- Or default to `projectOwner`

### 3. **Missing Listing Premium** ⚠️

**Problem:**

- UI doesn't collect `listingPremiumBps`
- SC requires this parameter

**Solution:**

- Add field in Step 3 or create new "Listing Config" section
- Range: 0-1000 BPS (0-10%)
- Help text: "Listing price will be X% higher than final fairlaunch price"

### 4. **DEX ID Conversion** ⚠️

**Problem:**

- UI stores string "Uniswap"
- SC expects bytes32 hash

**Solution:**

```typescript
const DEX_IDS = {
  Uniswap: ethers.utils.id('UNISWAP'),
  PancakeSwap: ethers.utils.id('PANCAKESWAP'),
  Raydium: ethers.utils.id('RAYDIUM'),
};
```

---

## ✅ Summary: What Needs to Be Fixed

| Issue                          | Priority    | Action                        |
| ------------------------------ | ----------- | ----------------------------- |
| Team vesting format conversion | 🔴 Critical | Implement conversion function |
| Missing beneficiary field      | 🔴 Critical | Add to Step 4                 |
| Missing listing premium        | 🟡 High     | Add to Step 3                 |
| DEX ID hashing                 | 🟡 High     | Add converter function        |
| Deployment fee display         | 🟢 Medium   | Show in Step 6                |
| Project owner capture          | 🟢 Medium   | Default to wallet             |

---

## 📋 Next Steps

1. **Review bersama**: Diskusi gap yang ditemukan
2. **Prioritize fixes**: Tentukan mana yang critical
3. **Update UI**: Implement missing fields & converters
4. **Test SC call**: Pastikan parameter mapping benar
5. **Deploy test**: Test di testnet

**Ready untuk diskusi, bro! 🚀**
