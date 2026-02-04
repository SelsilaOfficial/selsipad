# Fairlaunch Documentation Index

> **📚 Quick reference**: Semua dokumentasi Fairlaunch dalam satu tempat

---

## 📂 Document Structure

```
docs/fairlaunch/
├── 01_sc_vs_ui_mapping.md          # SC parameter mapping + gap analysis
├── 02_complete_flow_diagram.md     # End-to-end flow dengan mermaid diagrams
├── 03_ui_improvement_action_plan.md # Action items + code examples (OLD)
├── 04_revised_wizard_spec.md       # NEW 7-step wizard specification ⭐
├── 05_old_vs_new_comparison.md     # Old vs new design comparison
├── 06_fee_structure.md             # Complete fee breakdown + FeeSplitter
└── README.md                        # This file (quick reference)
```

---

## 🎯 Quick Links

### For Product Managers

- [Complete Flow Diagram](./02_complete_flow_diagram.md) - Understand the full fairlaunch lifecycle
- [Gap Analysis](./01_sc_vs_ui_mapping.md#-critical-issues-found) - What's missing in current UI
- [New Wizard Spec](./04_revised_wizard_spec.md) - Complete 7-step redesign ⭐
- [Old vs New Comparison](./05_old_vs_new_comparison.md) - What changed and why

### For Developers

- [SC vs UI Mapping](./01_sc_vs_ui_mapping.md) - Parameter mapping table
- [New Wizard Spec](./04_revised_wizard_spec.md) - Detailed implementation spec
- [Fee Structure](./06_fee_structure.md) - Complete fee breakdown + FeeSplitter
- [Action Plan (Old)](./03_ui_improvement_action_plan.md) - Legacy fixes for old design

### For Finance/Operations

- [Fee Structure](./06_fee_structure.md) - All fees and distribution
- [FeeSplitter Logic](./06_fee_structure.md#-feesplitter-contract) - Auto distribution to vaults

### For QA

- [New Wizard Spec](./04_revised_wizard_spec.md) - Test scenarios per step
- [Flow Diagram](./02_complete_flow_diagram.md) - E2E testing guide

---

## 🔑 Key Concepts

### What is Fairlaunch?

Fairlaunch adalah launchpad dengan **price discovery mechanism**:

- **No hardcap** - hanya softcap minimum
- **Final price** = total_raised / tokens_for_sale
- **Pro-rata distribution** - everyone gets fair share
- **High liquidity requirement** - min 70% + 12 month lock

### How is it Different from Presale?

| Feature          | Fairlaunch              | Presale                |
| ---------------- | ----------------------- | ---------------------- |
| **Price**        | Discovered (no hardcap) | Fixed (pre-determined) |
| **Cap**          | Softcap only            | Softcap + Hardcap      |
| **Liquidity**    | Min 70%                 | Min 51%                |
| **LP Lock**      | Min 12 months           | Variable               |
| **Team Vesting** | Mandatory               | Optional               |
| **Use Case**     | Fair price discovery    | Quick fundraise        |

---

## ⚡ Quick Reference

### SC Contracts

```
FairlaunchFactory.sol  → Deploy fairlaunch pools
├─ Fairlaunch.sol      → Individual pool logic
└─ TeamVesting.sol     → Team token vesting contract
```

### Key Parameters

| Parameter           | Type         | Min/Max    | Description                 |
| ------------------- | ------------ | ---------- | --------------------------- |
| `softcap`           | uint256      | > 0        | Minimum funds to raise      |
| `tokensForSale`     | uint256      | > 0        | Fixed token amount for sale |
| `liquidityPercent`  | uint256(BPS) | 7000-10000 | 70-100%                     |
| `lpLockMonths`      | uint256      | >= 12      | LP lock duration            |
| `minContribution`   | uint256      | > 0        | Per-user minimum            |
| `maxContribution`   | uint256      | > min      | Per-user maximum            |
| `listingPremiumBps` | uint16       | 0-1000     | 0-10% price premium         |

### Deployment Fees

| Network     | Fee     |
| ----------- | ------- |
| BSC Mainnet | 0.2 BNB |
| BSC Testnet | 0.2 BNB |
| Ethereum    | 0.1 ETH |
| Base        | 0.1 ETH |
| Sepolia     | 0.1 ETH |

### Platform Fees

| Fee Type        | Rate | When            |
| --------------- | ---- | --------------- |
| Success Fee     | 5%   | On finalization |
| Referral Reward | 1%   | If referred     |

---

## 🚨 Common Issues

### 1. Vesting Format Mismatch

**Problem:** UI uses `{month, percentage}[]` but SC needs `{durations[], amounts[]}`

**Solution:** Convert using helper function (see [Action Plan](./03_ui_improvement_action_plan.md#1-fix-team-vesting-data-structure))

### 2. Missing Beneficiary

**Problem:** UI doesn't ask for vesting beneficiary address

**Solution:** Add field in Step 4, default to `projectOwner`

### 3. Missing Listing Premium

**Problem:** SC requires `listingPremiumBps` but UI doesn't collect it

**Solution:** Add to Step 3 (see [Action Plan](./03_ui_improvement_action_plan.md#2-add-listing-premium-field))

### 4. DEX ID Type Mismatch

**Problem:** UI stores string "Uniswap" but SC expects bytes32 hash

**Solution:** Use `ethers.id()` to hash (see [Action Plan](./03_ui_improvement_action_plan.md#3-add-dex-id-hash-conversion))

---

## 📊 Status Flow

```
UPCOMING (before start)
    ↓
LIVE (contributions open)
    ↓
ENDED (after end time)
    ↓
  ┌───┴───┐
  ↓       ↓
SUCCESS  FAILED
  ↓       ↓
CLAIM   REFUND
```

---

## 💡 Best Practices

### For Project Creators

1. **Set realistic softcap** - Too high = likely to fail
2. **Use high liquidity %** - 80-90% recommended for stability
3. **Lock LP long-term** - 24+ months builds trust
4. **Transparent vesting** - Show clear unlock schedule
5. **Moderate listing premium** - 0-5% is usually enough

### For Contributors

1. **Check softcap** - Can it realistically be met?
2. **Verify liquidity plan** - 70%+ liquidity is safer
3. **Review LP lock** - Longer = better
4. **Understand price discovery** - No fixed price!
5. **Check team vesting** - Team should have skin in the game

---

## 🔗 Related Resources

### Smart Contracts

- [Fairlaunch.sol](../../packages/contracts/contracts/fairlaunch/Fairlaunch.sol)
- [FairlaunchFactory.sol](../../packages/contracts/contracts/fairlaunch/FairlaunchFactory.sol)
- [TeamVesting.sol](../../packages/contracts/contracts/fairlaunch/TeamVesting.sol)
- [IFairlaunch.sol](../../packages/contracts/contracts/fairlaunch/interfaces/IFairlaunch.sol)

### Frontend

- [CreateFairlaunchWizard.tsx](../../apps/web/app/create/fairlaunch/CreateFairlaunchWizard.tsx)
- [TokenModeStep.tsx](../../apps/web/app/create/fairlaunch/TokenModeStep.tsx)
- [CreateTokenDialog.tsx](../../apps/web/src/components/fairlaunch/CreateTokenDialog.tsx)

### Database

- [Fairlaunch Migration](../../supabase/migrations/20260124000002_fairlaunch.sql)
- [Security Badges Migration](../../supabase/migrations/20260128000001_fairlaunch_security_badges.sql)

---

## 📞 Discussion Points

### Next Meeting Agenda

1. **Review Gap Analysis** - Discuss critical issues found
2. **Prioritize Fixes** - Which ones to tackle first?
3. **Timeline** - When can we implement?
4. **Testing Strategy** - How to ensure quality?
5. **User Impact** - Will require wizard updates?

### Questions to Answer

- [ ] Do we need vesting beneficiary to be separate from project owner?
- [ ] What default listing premium should we use?
- [ ] Should we support multiple DEX options per network?
- [ ] How do we handle partial vesting refunds if fairlaunch fails?
- [ ] Do we need admin override for vesting parameters?

---

## ✅ Action Items Summary

### Critical (Week 1)

- [ ] Implement vesting conversion function
- [ ] Add beneficiary field to UI
- [ ] Add listing premium input
- [ ] Implement DEX ID hashing

### High Priority (Week 2)

- [ ] Display deployment fee
- [ ] Improve vesting schedule builder
- [ ] Add validation helpers
- [ ] Write unit tests

### Medium Priority (Week 3)

- [ ] Add price preview calculator
- [ ] Improve error messages
- [ ] Add tooltips
- [ ] E2E testing

---

## 📚 Further Reading

- [Understanding Fairlaunch Mechanisms](https://docs.pinksale.finance/fairlaunch)
- [LP Locking Best Practices](https://unicrypt.network/blog)
- [Team Vesting Patterns](https://medium.com/coinmonks/token-vesting-best-practices)

---

**Last Updated:** 2026-01-29  
**Author:** Selsipad Dev Team  
**Status:** Draft for Review

**Siap untuk diskusi lengkap, bro! 🎯**
