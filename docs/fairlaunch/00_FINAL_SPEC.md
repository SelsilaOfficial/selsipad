# Fairlaunch Wizard - FINAL APPROVED SPEC

> **Status**: ✅ APPROVED  
> **Date**: 2026-01-29  
> **Version**: 2.0 (Revised)

---

## 🎯 Executive Summary

Fairlaunch wizard telah diredesign untuk:

1. **Remove KYC requirement** - Fairlaunch is permissionless
2. **Auto SC security scan** - Enforce security at Step 1
3. **Auto-deploy** - No admin review needed
4. **Better UX** - Complete social links, interactive builders
5. **Clear fee structure** - Display all fees upfront with FeeSplitter

**Time to Market:** 3-5 days → **30 minutes** (99% faster)

---

## ✅ Approved Decisions

### 1. SC Scan Integration

**Decision:** Use GoPlus Security API  
**Reason:** Fast, reliable, free tier available  
**Implementation:** Auto-trigger on token address input in Step 1

### 2. Social Links Validation

**Decision:** Strict URL validation, all optional  
**Reason:** Better data quality while allowing flexibility  
**Implementation:** Use Zod URL schema with optional flag

### 3. Vesting Beneficiary Default

**Decision:** Default to wallet address, allow custom  
**Reason:** Most users vest to themselves, but allow delegation  
**Implementation:** Pre-fill with `walletAddress`, editable input

### 4. Deployment Fee Display

**Decision:** Show in Step 1 AND Step 6  
**Implementation:**

- Step 1: Show upfront cost estimate (token creation + deployment)
- Step 6: Show complete fee breakdown with examples

**Fee Structure:**

```
Step 1 Display:
├─ Token Creation (if factory): 0.01-0.2 ETH/BNB
├─ Deployment Fee: 0.1-0.2 ETH/BNB
└─ Total Upfront: Calculate based on network + token source

Step 6 Display:
├─ Upfront Costs (recap from Step 1)
├─ Success Fee: 5% of raised (if softcap met)
│  ├─ Treasury: 2.5%
│  ├─ Referral Pool: 2.0%
│  └─ SBT Staking: 0.5%
└─ Example calculation at softcap
```

### 5. Failed SC Scan - What Next?

**Decision:** Block + suggest factory  
**Reason:** Maintain platform security standards  
**Implementation:**

```typescript
{scanFailed && (
  <div className="error-panel">
    <h3>❌ Security Scan Failed</h3>
    <p>Your token did not pass security checks:</p>
    <ul>
      {failedChecks.map(check => (
        <li key={check}>{check.message}</li>
      ))}
    </ul>
    <div className="actions">
      <button onClick={() => setTokenMode('create')}>
        Create Safe Token via Factory Instead
      </button>
      <button onClick={handleChangeToken}>
        Try Different Token
      </button>
    </div>
  </div>
)}
```

### 6. FeeSplitter Integration

**Decision:** Yes, auto-split success fee to 3 vaults  
**Vaults:**

- Treasury Vault: 2.5% (operational costs)
- Referral Pool Vault: 2.0% (referral rewards)
- SBT Staking Vault: 0.5% (staking rewards)

**Implementation:** Fairlaunch.finalize() calls FeeSplitter.distributeFeeNative()

---

## 📋 Complete 7-Step Flow

### **Step 1: Network & Token Selection** 🌐

**Purpose:** Choose blockchain and secure token source

**UI Components:**

1. Network selector (EVM chains)
2. Token mode: Existing vs Factory
3. If Existing:
   - Token address input
   - **AUTO SC SCAN** (anti-mint, honeypot, tax, pause)
   - PASS = continue with "SC Pass" badge
   - FAIL = BLOCK + suggest factory
4. If Factory:
   - Open CreateTokenDialog
   - Deploy via SimpleTokenFactory
   - Auto assign "SAFU" + "SC Pass" badges
5. **Fee Display:**
   - Token creation fee (if factory)
   - Deployment fee
   - Total upfront cost

**Validation:**

- Network selected
- Token address provided
- If existing: ALL security checks PASSED
- If factory: Token successfully created

**Data Output:**

```typescript
{
  network: string,
  token_address: string,
  token_source: 'existing' | 'factory',
  security_scan_status: 'PASS' | 'FAIL',
  security_badges: ['SAFU', 'SC_PASS'] | ['SC_PASS'],
  token_creation_fee?: string,
  deployment_fee: string,
}
```

---

### **Step 2: Project Information** 📝

**Purpose:** Describe project for live page display

**UI Components:**

1. Project name (required)
2. Token description (required, 10-500 chars)
3. Logo URL (optional but validated)
4. **8 Social Media Links** (all optional but validated):
   - Website
   - Twitter/X
   - Telegram
   - Discord
   - Medium
   - GitHub
   - Reddit
   - YouTube

**Validation:**

- Project name: min 3 chars
- Description: 10-500 chars
- Logo URL: valid URL if provided
- Social links: valid URLs if provided

**Data Output:**

```typescript
{
  project_name: string,
  description: string,
  logo_url: string | null,
  social_links: {
    website?: string,
    twitter?: string,
    telegram?: string,
    discord?: string,
    medium?: string,
    github?: string,
    reddit?: string,
    youtube?: string,
  }
}
```

---

### **Step 3: Sale Parameters** 💰

**Purpose:** Configure sale timing and economics

**UI Components:**

1. Tokens for sale (fixed amount)
2. Softcap (minimum to raise)
3. **Real-time price preview** at softcap
4. Start time / end time (datetime picker)
5. Duration display
6. Min/max contribution per user
7. **DEX selection** (network-aware)
8. Listing premium % (0-10%)

**Validation:**

- tokensForSale > 0
- softcap > 0
- startTime >= now
- endTime > startTime
- minContribution > 0
- maxContribution > minContribution
- listingPremium: 0-10%

**Data Output:**

```typescript
{
  tokens_for_sale: string,
  softcap: string,
  start_time: string, // ISO
  end_time: string,   // ISO
  min_contribution: string,
  max_contribution: string,
  dex_platform: string,
  listing_premium_bps: number, // 0-1000
}
```

---

### **Step 4: Liquidity Plan** 💧

**Purpose:** Configure LP allocation and lock

**UI Components:**

1. Liquidity % slider (70-100%)
2. **Visual distribution breakdown:**
   - Platform fee calculation
   - To liquidity (tokens + funds)
   - To project owner
3. LP lock duration dropdown
4. **Unlock date calculator**

**Validation:**

- liquidityPercent: 70-100
- lpLockMonths: >= 12

**Data Output:**

```typescript
{
  liquidity_percent: number,
  lp_lock_months: number,
}
```

---

### **Step 5: Team Vesting** 📅

**Purpose:** Configure team token vesting

**UI Components:**

1. Team allocation input
2. Vesting beneficiary (default: wallet, allow custom)
3. **Interactive schedule builder:**
   - Add/remove periods
   - Month + percentage inputs
   - Real-time token calculation
   - Total validator (must = 100%)
4. **Quick presets:**
   - Linear 12 months
   - 6m cliff + 12m linear
   - Standard (20% TGE + 80% linear)

**Validation:**

- If teamAllocation > 0:
  - Beneficiary required
  - Total vesting % === 100
- All months >= 0

**Data Output:**

```typescript
{
  team_allocation: string,
  vesting_beneficiary: string,
  vesting_schedule: Array<{
    month: number,
    percentage: number,
  }>,
}
```

---

### **Step 6: Review & Apply** ✅

**Purpose:** Final review before deployment

**UI Components:**

1. **Complete summary** (all sections)
2. **Badge display** (SAFU + SC Pass or SC Pass only)
3. **Complete fee breakdown:**
   - Upfront costs recap
   - Success fee structure (5%)
   - FeeSplitter distribution (2.5% / 2.0% / 0.5%)
   - Example calculation at softcap
4. Terms & conditions checkbox
5. Save Draft / Apply & Deploy buttons

**Validation:**

- All previous steps valid
- Terms accepted

---

### **Step 7: Deploy** 🚀

**Purpose:** Auto-deploy to blockchain

**Flow:**

1. **Convert Data**
   - Transform vesting schedule
   - Hash DEX ID
   - Prepare all parameters
2. **Call FairlaunchFactory**
   - User confirms transaction
   - Pay deployment fee
   - Deploy Fairlaunch.sol + TeamVesting.sol
3. **Wait for Confirmation**
   - Show transaction hash
   - Link to explorer
   - Wait for block confirmation
4. **Save to Database**
   - Store contract addresses
   - Store all metadata
   - Set status = UPCOMING
   - Assign badges
5. **Success!**
   - Display fairlaunch address
   - Display vesting address (if any)
   - Show earned badges
   - Link to live page

**NO KYC CHECK**  
**NO ADMIN REVIEW**  
**INSTANT DEPLOYMENT**

---

## 💰 Complete Fee Structure

### Upfront Fees (Pay Now)

| Fee Type           | BSC     | Ethereum | Base     | Goes To       |
| ------------------ | ------- | -------- | -------- | ------------- |
| **Token Creation** | 0.2 BNB | 0.01 ETH | 0.05 ETH | Treasury 100% |
| **Deployment**     | 0.2 BNB | 0.1 ETH  | 0.1 ETH  | Treasury 100% |

**Total Upfront Example (Factory Token on Sepolia):**

- Token creation: 0.01 ETH
- Deployment: 0.1 ETH
- **Total: 0.11 ETH**

### Success Fee (On Softcap Met)

**Total:** 5% of total_raised

**Distribution via FeeSplitter:**

- Treasury: 2.5% (50% of fee)
- Referral Pool: 2.0% (40% of fee)
- SBT Staking: 0.5% (10% of fee)

**Example (100 ETH raised):**

- Success fee: 5 ETH
  - Treasury: 2.5 ETH
  - Referral Pool: 2.0 ETH
  - SBT Staking: 0.5 ETH
- Net to project: 95 ETH

---

## 🔒 Security Model

### Token Security (Step 1)

**Existing Token:**

```
Input address
    ↓
Auto SC Scan (GoPlus API)
    ↓
Check 4 Critical Risks:
├─ Anti-Mint ✓
├─ No Honeypot ✓
├─ No Tax Manipulation ✓
└─ No Pause Function ✓
    ↓
ALL PASS? → Continue with "SC Pass" badge
ANY FAIL?  → BLOCK + suggest factory
```

**Factory Token:**

```
Create token via SimpleTokenFactory
    ↓
Platform-deployed = trusted
    ↓
Auto assign badges:
├─ SAFU (platform guarantee)
└─ SC Pass (auto-whitelisted)
```

### No KYC Requirement

**Rationale:**

- Fairlaunch is permissionless by nature
- Focus on token security, not developer identity
- Faster time-to-market
- Reduce admin workload

**Security Enforcement:**

- Token scan at Step 1 (blocking)
- Smart contract immutability
- Transparent on-chain operations

---

## 🎨 Badge System

### Badge Types

| Badge         | Awarded When                    | Meaning                      |
| ------------- | ------------------------------- | ---------------------------- |
| **🛡️ SAFU**   | Token created via factory       | Platform-verified safe token |
| **✓ SC Pass** | Token passed all security scans | No critical vulnerabilities  |

### Badge Logic

```typescript
// Factory token
badges = ['SAFU', 'SC_PASS']

// Existing token with successful scan
badges = ['SC_PASS']

// Existing token with failed scan
→ BLOCKED (cannot proceed)
```

### Badge Display

**Wizard (Step 1):**

- Show preview of badges user will earn
- Update in real-time based on token source

**Review (Step 6):**

- Display earned badges prominently
- Explain what each badge means

**Live Page:**

- Display badges next to project name
- Clickable tooltip for badge meaning

---

## 📊 Implementation Timeline

### Phase 1: Core Components (Week 1)

- [ ] SecurityScanPanel component
- [ ] SocialMediaInputs component
- [ ] VestingScheduleBuilder component
- [ ] DistributionPreview component
- [ ] FeeBreakdown component
- [ ] DeploymentProgress component

### Phase 2: Integration (Week 2)

- [ ] Integrate GoPlus API for SC scan
- [ ] Refactor wizard to new 7-step flow
- [ ] Implement auto badge assignment
- [ ] Add vesting conversion logic
- [ ] Add DEX ID hashing
- [ ] Connect to FairlaunchFactory

### Phase 3: Testing (Week 3)

- [ ] Unit tests (all components)
- [ ] Integration tests (wizard flow)
- [ ] SC scan testing (various tokens)
- [ ] Testnet deployments (BSC, Sepolia, Base)
- [ ] E2E testing (full user journey)

### Phase 4: Deployment (Week 4)

- [ ] Deploy to staging
- [ ] Final QA
- [ ] Documentation update
- [ ] Deploy to production
- [ ] Monitor and iterate

---

## 📚 Reference Documents

1. **[04_revised_wizard_spec.md](./04_revised_wizard_spec.md)** - Complete UI specification
2. **[05_old_vs_new_comparison.md](./05_old_vs_new_comparison.md)** - What changed and why
3. **[06_fee_structure.md](./06_fee_structure.md)** - Fee breakdown + FeeSplitter
4. **[02_complete_flow_diagram.md](./02_complete_flow_diagram.md)** - SC flow diagrams
5. **[01_sc_vs_ui_mapping.md](./01_sc_vs_ui_mapping.md)** - Parameter mapping

---

## ✅ Success Criteria

### User Experience

- [ ] Wizard completion time: < 10 minutes
- [ ] Clear error messages for validation
- [ ] Real-time previews (price, distribution, fees)
- [ ] Intuitive step-by-step flow

### Security

- [ ] 100% of existing tokens scanned
- [ ] 0 unsafe tokens deployed
- [ ] Clear badge assignment
- [ ] Transparent security status

### Performance

- [ ] SC scan: < 5 seconds
- [ ] Deployment: < 2 minutes
- [ ] Database save: < 1 second
- [ ] Page load: < 2 seconds

### Platform

- [ ] No admin bottleneck
- [ ] Automated badge assignment
- [ ] Proper fee distribution
- [ ] Scalable architecture

---

## 🎯 Next Actions

1. ✅ **Spec approved** (this document)
2. **Create UI mockups/wireframes**
3. **Set up GoPlus API integration**
4. **Start Phase 1 implementation**
5. **Weekly progress review**

---

**Document Status:** ✅ FINAL APPROVED  
**Ready for Implementation:** YES  
**Estimated Completion:** 4 weeks from start

**All decisions confirmed by user on 2026-01-29** 🎉
