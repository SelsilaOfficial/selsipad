# Fairlaunch LP Locker Integration - Implementation Plan

## Problem Statement

**Current Issue**: Fairlaunch contract deployed WITHOUT LP Locker integration functionality.

**Impact**:

- ❌ Cannot finalize fairlaunch rounds (transaction reverts)
- ❌ LP tokens sent directly to project owner (UNSAFE)
- ❌ No automated LP locking mechanism
- ❌ Contract missing `setLPLocker()` and `lpLockerAddress()` functions

**Root Cause Analysis**:

1. Contract source code ([Fairlaunch_flattened.sol](file:///home/selsipad/final-project/selsipad/packages/contracts/Fairlaunch_flattened.sol#L978)) has `ILPLocker public lpLocker;` variable declared
2. BUT missing required functions to set and use the LP Locker
3. Factory deployment contains OLD bytecode without LP Locker integration
4. Implementation plan existed but contract code was never updated

---

## Implementation Requirements

### 1. Contract Functions to Add

#### a. `setLPLocker(address _lpLocker)` - Admin Function

```solidity
/**
 * @notice Set the LP Locker contract address
 * @dev Can only be called by ADMIN_ROLE, and ONLY ONCE before finalization
 * @param _lpLocker Address of the LP Locker contract
 */
function setLPLocker(address _lpLocker) external onlyRole(ADMIN_ROLE) {
    require(address(lpLocker) == address(0), "LP Locker already set");
    require(!isFinalized, "Already finalized");
    require(_lpLocker != address(0), "Invalid LP Locker address");

    lpLocker = ILPLocker(_lpLocker);
    emit LPLockerSet(_lpLocker);
}
```

**Why ADMIN_ROLE**:

- Factory grants ADMIN_ROLE to adminExecutor during deployment
- Allows automated setup via admin deploy API
- Platform maintains control over LP Locker configuration

#### b. `lpLockerAddress()` - View Function

```solidity
/**
 * @notice Get the current LP Locker address
 * @return Address of LP Locker contract (or address(0) if not set)
 */
function lpLockerAddress() external view returns (address) {
    return address(lpLocker);
}
```

**Purpose**:

- Allow external contracts/UI to verify LP Locker is configured
- Required by setup scripts for validation

### 2. Update `finalize()` Function

**Current Code** (Lines 1161-1163):

```solidity
// TODO: Integrate with actual LP locker
// For now, transfer to project owner (UNSAFE - replace with locker)
IERC20(lpToken).safeTransfer(projectOwner, lpBalance);
```

**Updated Code**:

```solidity
// Lock LP tokens via LP Locker
require(address(lpLocker) != address(0), "LP Locker not configured");

IERC20(lpToken).approve(address(lpLocker), lpBalance);
lpLocker.lockTokens(lpToken, lpBalance, unlockTime);

emit LiquidityLocked(lpToken, lpBalance, unlockTime);
```

**Changes**:

- ✅ Validate LP Locker is set before finalizing
- ✅ Approve LP Locker to spend LP tokens
- ✅ Call `lockTokens()` on LP Locker contract
- ✅ Emit event for transparency

### 3. Add New Event

```solidity
event LPLockerSet(address indexed lpLocker);
event LiquidityLocked(address indexed lpToken, uint256 amount, uint256 unlockTime);
```

---

## Implementation Steps

### Phase 1: Update Contract Source Code

#### Step 1.1: Modify Fairlaunch_flattened.sol

- [ ] Add `setLPLocker()` function after constructor (around line 1070)
- [ ] Add `lpLockerAddress()` view function after `getFinalPrice()` (around line 1340)
- [ ] Add `LPLockerSet` and `LiquidityLocked` events (around line 1000)
- [ ] Update `finalize()` function to use LP Locker (replace lines 1161-1163)
- [ ] Add validation: `require(address(lpLocker) != address(0))` in finalize before LP operations

#### Step 1.2: Compile Updated Contract

```bash
cd /home/selsipad/final-project/selsipad/packages/contracts
# Compile Fairlaunch contract to get new bytecode
solc --optimize --bin Fairlaunch_flattened.sol > fairlaunch_bytecode.txt
```

### Phase 2: Update FairlaunchFactory

**Factory Contract Needs**:

- Store new Fairlaunch bytecode
- Deploy Fairlaunch contracts with LP Locker integration

#### Step 2.1: Update Factory Bytecode

- [ ] Get compiled bytecode from Step 1.2
- [ ] Update FairlaunchFactory constructor args for new bytecode
- [ ] Deploy NEW FairlaunchFactory contract

#### Step 2.2: Update Deployment Config

- [ ] Update `fairlaunch-factory-latest.json` with new factory address
- [ ] Update `.env.local` with `NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_TESTNET`
- [ ] Update `FairlaunchFactory.ts` constant
- [ ] Update `prepare-deployment.ts` constant

### Phase 3: Update Admin Deploy API

#### Step 3.1: Add Auto-Setup LP Locker Logic

**File**: `apps/web/app/api/admin/fairlaunch/deploy/route.ts`

**After factory deployment** (around line 330):

```typescript
// Auto-configure LP Locker (CRITICAL for finalization)
const lpLockerAddress = lpLockerDeployment.lpLocker;

if (lpLockerAddress && lpLockerAddress !== ethers.ZeroAddress) {
  const fairlaunchContract = new ethers.Contract(contractAddress, FairlaunchABI.abi, signer);

  const setLPLockerTx = await fairlaunchContract.setLPLocker(lpLockerAddress);
  await setLPLockerTx.wait();

  console.log('[Admin Deploy] ✅ LP Locker configured:', setLPLockerTx.hash);
}
```

**Why This Works**:

- Factory grants ADMIN_ROLE to `adminExecutor` (DEPLOYER_PRIVATE_KEY)
- Admin signer can immediately call `setLPLocker()` after deployment
- Automated setup = no manual intervention needed

### Phase 4: Testing & Validation

#### Test 1: Deploy Test Fairlaunch

- [ ] Create test project via admin dashboard
- [ ] Deploy Fairlaunch using admin deploy API
- [ ] Verify LP Locker address is set on-chain:

```bash
cast call <FAIRLAUNCH_CONTRACT> "lpLockerAddress()(address)" \
  --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545
```

- [ ] Expected: Returns `0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F` (LP Locker)

#### Test 2: Full E2E Finalization

- [ ] Let test fairlaunch round end naturally
- [ ] Ensure softcap is met
- [ ] Call finalize via UI or API
- [ ] Verify:
  - ✅ Finalize succeeds (no revert)
  - ✅ LP tokens locked in LP Locker (not sent to project owner)
  - ✅ `LiquidityLocked` event emitted
  - ✅ Fee distribution works (70% creator, 30% treasury)

#### Test 3: User Wizard Flow

- [ ] Create new test token via wizard
- [ ] Deploy Fairlaunch via wizard (NOT admin API)
- [ ] Verify LP Locker still gets auto-set
- [ ] Complete full finalization

---

## Rollout Strategy

### For Existing Deployed Fairlaunches (DRAKOR etc.)

**Option A: Cancel & Refund** (Recommended)

- Mark round as CANCELLED
- Allow users to refund contributions
- Re-deploy with updated factory

**Option B: Manual Workaround** (UNSAFE - NOT RECOMMENDED)

- Skip LP lock requirement (contract modification)
- Send LP tokens to project owner
- Manually lock via LP Locker UI

**Decision**: Choose Option A for safety

### For Future Deployments

**Factory Auto-Setup Flow**:

1. User completes wizard → Calls NEW FairlaunchFactory
2. Factory deploys Fairlaunch (with setLPLocker functions)
3. Admin deploy API detects deployment
4. Admin API calls `setLPLocker(0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F)`
5. Fairlaunch ready to finalize with LP locking

---

## Risk Mitigation

### What Could Go Wrong?

1. **LP Locker Contract Not Deployed**
   - Mitigation: Check deployment before factory update
   - Fallback: Add validation in `setLPLocker()` to test LP Locker interface

2. **Admin Wallet Missing ADMIN_ROLE**
   - Mitigation: Use DEPLOYER_PRIVATE_KEY (adminExecutor) not ADMIN_PRIVATE_KEY
   - Verification: Check hasRole() before calling setLPLocker()

3. **Bytecode Update Fails**
   - Mitigation: Test in isolated environment first
   - Rollback Plan: Keep old factory addresses in config as fallback

4. **User Deployments Before API Setup**
   - Mitigation: Manual setup endpoint `/api/admin/fairlaunch/setup-lp-locker`
   - Monitor: Log all factory deployments for LP Locker configuration status

---

## Success Criteria

✅ **Checklist for Completion**:

- [ ] Contract functions added and compiled
- [ ] Factory redeployed with new bytecode
- [ ] All config files updated with new factory address
- [ ] Admin deploy API auto-sets LP Locker
- [ ] Test deployment completes successfully
- [ ] Test finalization locks LP tokens correctly
- [ ] Fee distribution works as expected
- [ ] Documentation updated

---

## Files to Modify

1. **Contract Source**:
   - `packages/contracts/Fairlaunch_flattened.sol`

2. **Factory Config**:
   - `packages/contracts/deployments/fairlaunch-factory-latest.json`

3. **Environment**:
   - `apps/web/.env.local`

4. **Frontend Config**:
   - `apps/web/src/contracts/FairlaunchFactory.ts`
   - `apps/web/src/actions/fairlaunch/prepare-deployment.ts`

5. **Backend API**:
   - `apps/web/app/api/admin/fairlaunch/deploy/route.ts`

6. **ABI Files** (if separate):
   - Update Fairlaunch ABI with new functions

---

## Timeline Estimate

- **Phase 1** (Contract Update): 2-3 hours
- **Phase 2** (Factory Update): 1-2 hours
- **Phase 3** (API Integration): 1 hour
- **Phase 4** (Testing): 2-3 hours
- **Total**: ~6-9 hours

---

## Notes

- This plan assumes LP Locker contract already deployed at `0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F`
- Factory must grant ADMIN_ROLE to adminExecutor for auto-setup to work
- Manual setup endpoint created as fallback for edge cases
- Implementation plan from conversation already covered API auto-setup logic (line 336-360 in deploy/route.ts)
