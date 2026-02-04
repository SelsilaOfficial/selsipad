# Fairlaunch: Old vs New Wizard Comparison

> **Quick comparison**: Apa yang berubah dari desain lama ke desain baru

---

## 📊 Side-by-Side Comparison

| Aspect               | Old Design                 | New Design              | Why Changed                 |
| -------------------- | -------------------------- | ----------------------- | --------------------------- |
| **Total Steps**      | 7 steps                    | 7 steps                 | ✅ Same                     |
| **KYC Required**     | ✅ Yes (Step 7 blocker)    | ❌ No                   | Fairlaunch = permissionless |
| **Admin Review**     | ✅ Required before deploy  | ❌ Auto-deploy          | Faster launch               |
| **Token Selection**  | Mixed with params (Step 2) | Dedicated step (Step 1) | Better UX                   |
| **SC Scan**          | Manual trigger             | Auto on token input     | Better security             |
| **Social Media**     | Basic (3-4 links)          | Comprehensive (8 links) | Better visibility           |
| **Badge Assignment** | Manual by admin            | Auto based on scan      | Faster, transparent         |
| **Deployment**       | After admin approval       | Immediate after Step 7  | Faster time-to-market       |

---

## 🔄 Step-by-Step Changes

### Step 1: Network & Token Selection (NEW STRUCTURE)

**Old Design:**

```
Step 1: Basic Info
- Project name
- Token symbol
- Description
- Network
- Logo URL
```

**New Design:**

```
Step 1: Network & Token Selection
- Network selection
- Token mode (existing vs factory)
- If existing: Token address + AUTO SC SCAN
  - Anti-Mint check
  - Honeypot check
  - Tax check
  - Pause check
  → MUST PASS ALL to continue
- If factory: Create token dialog
  → Auto SAFU + SC Pass badges
```

**Why?**

- ✅ Separate concerns: network/token first
- ✅ Enforce security upfront (blocking)
- ✅ Clear badge logic from start

---

### Step 2: Project Info (ENHANCED)

**Old Design:**

```
Step 2: Fairlaunch Params
- Token address (input manually)
- Tokens for sale
- Softcap
- Payment token
- Start/end time
- Min/max contribution
```

**New Design:**

```
Step 2: Project Information
- Project name
- Token description
- Logo URL
- Social media (8 platforms):
  - Website
  - Twitter/X
  - Telegram
  - Discord
  - Medium
  - GitHub
  - Reddit
  - YouTube
```

**Why?**

- ✅ Better project presentation
- ✅ All social links in one place
- ✅ Improve investor confidence
- ✅ Displayed on live fairlaunch page

---

### Step 3: Sale Parameters (REORGANIZED)

**Old Design:**

```
(Mixed in Step 2)
```

**New Design:**

```
Step 3: Sale Parameters
- Tokens for sale
- Softcap
- Start/end time
- Min/max contribution per user
- DEX selection
- Listing premium (%)
- Real-time price preview
```

**Why?**

- ✅ Dedicated step for sale config
- ✅ Add listing premium (was missing)
- ✅ Add price preview calculator
- ✅ Network-aware DEX options

---

### Step 4: Liquidity Plan (ENHANCED)

**Old Design:**

```
Step 3: Liquidity Plan
- Liquidity % (min 70%)
- LP lock months (min 12)
- Listing platform
```

**New Design:**

```
Step 4: Liquidity Plan
- Liquidity % with slider (70-100%)
- LP lock duration (dropdown presets)
- Distribution breakdown preview:
  - Platform fee calculation
  - To liquidity
  - To project owner
- Unlock date calculator
```

**Why?**

- ✅ Visual slider for better UX
- ✅ Real-time distribution preview
- ✅ Clear fee breakdown
- ✅ Unlock date visibility

---

### Step 5: Team Vesting (VASTLY IMPROVED)

**Old Design:**

```
Step 4: Team Vesting
- Team allocation (number input)
- Schedule (basic array input)
- Manual percentage validation
```

**New Design:**

```
Step 5: Team Vesting
- Team allocation
- Vesting beneficiary address
  → Defaults to wallet
  → Allow custom address
- Interactive schedule builder:
  - Add/remove periods
  - Month + percentage inputs
  - Real-time token calculation
  - Total percentage validator
- Quick presets:
  - Linear 12 months
  - 6m cliff + 12m linear
  - Standard (20% TGE + 80% linear)
```

**Why?**

- ✅ Add missing beneficiary field (SC requires it)
- ✅ Interactive builder vs static input
- ✅ Real-time validation
- ✅ Quick presets for common patterns
- ✅ Show actual token amounts

---

### Step 6: Review & Apply (ENHANCED)

**Old Design:**

```
Step 6: Review
- Basic summary
- Terms checkbox
- Next button
```

**New Design:**

```
Step 6: Review & Apply
- Complete summary (all sections)
- Badge display
- Fee breakdown:
  - Deployment fee (0.1 or 0.2)
  - Platform success fee (5%)
- Terms & conditions
- Save Draft or Apply & Deploy buttons
```

**Why?**

- ✅ Comprehensive review
- ✅ Show all fees upfront
- ✅ Display earned badges
- ✅ Clear about costs

---

### Step 7: Deploy (COMPLETELY NEW)

**Old Design:**

```
Step 7: Submit (Compliance)
- KYC check (blocking)
- SC Scan check (blocking)
- Team vesting check
- Liquidity check
→ Submit for ADMIN REVIEW
→ Wait for approval
→ Admin deploys
```

**New Design:**

```
Step 7: Deploy (Auto)
- No compliance checks (done in Step 1)
- Immediate deployment flow:
  1. Convert wizard data
  2. Call FairlaunchFactory
  3. Wait for confirmation
  4. Save to database
  5. Success! View live page
→ NO ADMIN REVIEW
→ NO WAITING
→ INSTANT LIVE
```

**Why?**

- ✅ Fairlaunch is permissionless
- ✅ Security enforced in Step 1 (token scan)
- ✅ Faster time-to-market
- ✅ Better UX (no waiting)
- ✅ Reduce admin workload

---

## 🎯 Badge Logic Comparison

### Old Design (Manual)

```
Admin manually assigns badges after review:
- Review KYC status
- Review SC scan
- Manually add SAFU badge
- Manually add SC Pass badge
→ Inconsistent
→ Slow
→ Admin bottleneck
```

### New Design (Automatic)

```
Auto-assign based on token source:

Factory Token:
→ SAFU badge (auto)
→ SC Pass badge (auto)
→ Instant

Existing Token:
→ Run SC scan (auto)
→ If pass: SC Pass badge (auto)
→ If fail: BLOCK wizard
→ Instant, transparent
```

**Benefits:**

- ✅ Consistent
- ✅ Fast
- ✅ Transparent
- ✅ No admin bottleneck

---

## 🔒 Security Comparison

### Old Design

```
Security checks at END (Step 7):
- User completes entire wizard
- Waits for KYC approval
- Waits for SC scan
- Waits for admin review
→ Waste time if fail
→ Bad UX
```

### New Design

```
Security checks at START (Step 1):
- User select token first
- SC scan runs immediately
- BLOCKING if fail
- Cannot proceed if unsafe
→ Save time
→ Clear expectations
→ Better UX
```

---

## 📋 Implementation Impact

### Files to Modify

| File                         | Old Design    | New Design           | Effort |
| ---------------------------- | ------------- | -------------------- | ------ |
| `CreateFairlaunchWizard.tsx` | 775 lines     | ~900 lines           | Medium |
| `TokenModeStep.tsx`          | Separate file | Integrate to Step 1  | Low    |
| `actions.ts`                 | Basic SC call | + Vesting conversion | Medium |
| Database schema              | Basic fields  | + social_links JSON  | Low    |

### New Files Needed

| File                  | Purpose                 | Effort |
| --------------------- | ----------------------- | ------ |
| `dex-config.ts`       | DEX ID mapping          | Low    |
| `vesting-presets.ts`  | Quick vesting templates | Low    |
| `price-calculator.ts` | Real-time price preview | Low    |

### Components to Build

| Component                | Purpose                | Effort |
| ------------------------ | ---------------------- | ------ |
| `SecurityScanPanel`      | Show scan results      | Medium |
| `VestingScheduleBuilder` | Interactive vesting UI | High   |
| `DistributionPreview`    | Show fund breakdown    | Medium |
| `DeploymentProgress`     | Step 7 progress UI     | Medium |

---

## 🚀 Migration Strategy

### Phase 1: Preparation (Week 1)

- [ ] Create new wizard spec (DONE ✓)
- [ ] Design new UI mockups
- [ ] Update database schema
- [ ] Write conversion functions

### Phase 2: Implementation (Week 2-3)

- [ ] Implement Step 1 (network + token)
- [ ] Implement Step 2 (project info)
- [ ] Implement Step 3 (sale params)
- [ ] Implement Step 4 (liquidity)
- [ ] Implement Step 5 (vesting builder)
- [ ] Implement Step 6 (review)
- [ ] Implement Step 7 (auto-deploy)

### Phase 3: Testing (Week 4)

- [ ] Unit tests
- [ ] Integration tests
- [ ] Testnet deployment tests
- [ ] User acceptance testing

### Phase 4: Deployment (Week 5)

- [ ] Deploy to staging
- [ ] Final testing
- [ ] Deploy to production
- [ ] Monitor and fix issues

---

## ✅ Benefits Summary

### For Users

- ✅ Faster launch (no KYC, no admin review)
- ✅ Clear security expectations upfront
- ✅ Better project presentation (social links)
- ✅ Interactive builders (vesting, distribution)
- ✅ Real-time previews (price, fees)

### For Platform

- ✅ Reduced admin workload
- ✅ Automated badge assignment
- ✅ Consistent security enforcement
- ✅ Faster time-to-market
- ✅ Better scalability

### For Investors

- ✅ More project info (social links)
- ✅ Clear badge meaning
- ✅ Transparent security status
- ✅ Better research capabilities

---

## 🎯 Success Metrics

### Time Savings

- Old: ~3-5 days (KYC + review)
- New: ~30 minutes (wizard + deploy)
- **Improvement: 99% faster** 🚀

### User Experience

- Old: 7 steps with waiting
- New: 7 steps, instant deploy
- **Improvement: No waiting** ✨

### Security

- Old: Manual checks at end
- New: Auto checks at start
- **Improvement: Fail fast** 🛡️

---

**Jadi kesimpulannya, new design jauh lebih simple, fast, dan user-friendly untuk fairlaunch yang memang nature-nya permissionless! 🎉**
