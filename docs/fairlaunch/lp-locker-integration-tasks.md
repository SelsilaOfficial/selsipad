# Fairlaunch LP Locker Integration - Task Breakdown

## Overview

Complete integration of LP Locker functionality into Fairlaunch contract to enable automated LP token locking during finalization.

---

## Phase 1: Contract Source Code Updates

### Task 1.1: Add setLPLocker Function

- [ ] Open `packages/contracts/Fairlaunch_flattened.sol`
- [ ] Add `setLPLocker(address _lpLocker)` function after constructor (line ~1070)
- [ ] Include validation checks:
  - [ ] `require(address(lpLocker) == address(0), "LP Locker already set")`
  - [ ] `require(!isFinalized, "Already finalized")`
  - [ ] `require(_lpLocker != address(0), "Invalid LP Locker address")`
- [ ] Add `onlyRole(ADMIN_ROLE)` modifier
- [ ] Emit `LPLockerSet` event

### Task 1.2: Add lpLockerAddress View Function

- [ ] Add `lpLockerAddress()` view function after `getFinalPrice()` (line ~1340)
- [ ] Return `address(lpLocker)`
- [ ] Make it external view

### Task 1.3: Add Events

- [ ] Add `event LPLockerSet(address indexed lpLocker);` (line ~1000)
- [ ] Add `event LiquidityLocked(address indexed lpToken, uint256 amount, uint256 unlockTime);`

### Task 1.4: Update finalize() Function

- [ ] Locate finalize function (line ~1120)
- [ ] Find LP token transfer section (line ~1161-1163)
- [ ] Replace unsafe transfer with LP lock logic:
  - [ ] Add `require(address(lpLocker) != address(0), "LP Locker not configured")`
  - [ ] Add `IERC20(lpToken).approve(address(lpLocker), lpBalance)`
  - [ ] Add `lpLocker.lockTokens(lpToken, lpBalance, unlockTime)`
  - [ ] Emit `LiquidityLocked` event
- [ ] Remove old TODO comment and unsafe transfer

### Task 1.5: Compile Contract

- [ ] Navigate to `packages/contracts/`
- [ ] Run: `solc --optimize --bin Fairlaunch_flattened.sol > fairlaunch_bytecode.txt`
- [ ] Verify compilation successful
- [ ] Save bytecode hash for reference

---

## Phase 2: Factory Contract Update

### Task 2.1: Deploy New FairlaunchFactory

- [ ] Create deployment script with new Fairlaunch bytecode
- [ ] Set adminExecutor address: `0x95D94D86CfC550897d2b80672a3c94c12429a90D`
- [ ] Set LP Locker address: `0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F`
- [ ] Deploy factory to BSC Testnet
- [ ] Save deployment transaction hash
- [ ] Wait for confirmation

### Task 2.2: Update Deployment Config

- [ ] Open `packages/contracts/deployments/fairlaunch-factory-latest.json`
- [ ] Update fields:
  - [ ] `factoryAddress`: <new factory address>
  - [ ] `timestamp`: <current timestamp>
  - [ ] `note`: "Factory with LP Locker integration - setLPLocker function included"
- [ ] Commit changes

### Task 2.3: Update Environment Variables

- [ ] Open `apps/web/.env.local`
- [ ] Update `NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_TESTNET=<new factory address>`
- [ ] Restart dev server to load new env

### Task 2.4: Update Frontend Constants

- [ ] Open `apps/web/src/contracts/FairlaunchFactory.ts`
- [ ] Update line ~10: `97: "<new factory address>"`
- [ ] Open `apps/web/src/actions/fairlaunch/prepare-deployment.ts`
- [ ] Update line ~48: `bsc_testnet: "<new factory address>"`

---

## Phase 3: Admin Deploy API Integration

### Task 3.1: Verify Auto-Setup Code Exists

- [ ] Open `apps/web/app/api/admin/fairlaunch/deploy/route.ts`
- [ ] Check lines 336-360 for LP Locker auto-setup logic
- [ ] Verify lpLockerDeployment import exists (line ~14)
- [ ] Confirm DEPLOYER_PRIVATE_KEY is used (not ADMIN_PRIVATE_KEY)

### Task 3.2: Add Fairlaunch ABI with New Functions

- [ ] Locate Fairlaunch ABI import/definition in deploy route
- [ ] Add `setLPLocker(address)` to ABI
- [ ] Add `lpLockerAddress()` to ABI
- [ ] Ensure ABI matches compiled contract

### Task 3.3: Test Auto-Setup Logic

- [ ] Add debug logging before setLPLocker call
- [ ] Add debug logging after transaction confirmation
- [ ] Add error handling for setLPLocker failures

---

## Phase 4: Manual Setup Endpoint (Fallback)

### Task 4.1: Verify Manual Setup API

- [ ] Check `apps/web/app/api/admin/fairlaunch/setup-lp-locker/route.ts` exists
- [ ] Verify it uses DEPLOYER_PRIVATE_KEY
- [ ] Test endpoint with curl:

```bash
curl -X POST http://localhost:3000/api/admin/fairlaunch/setup-lp-locker \
  -H "Content-Type: application/json" \
  -d '{"roundId":"<test-round-id>","contractAddress":"<contract-address>"}'
```

- [ ] Verify success response

---

## Phase 5: Testing & Validation

### Task 5.1: Unit Test - Contract Functions

- [ ] Deploy test Fairlaunch contract
- [ ] Call `lpLockerAddress()` → Should return `address(0)` initially
- [ ] Call `setLPLocker(0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F)` as admin
- [ ] Call `lpLockerAddress()` again → Should return LP Locker address
- [ ] Try calling `setLPLocker()` again → Should revert ("LP Locker already set")
- [ ] Try calling from non-admin → Should revert (AccessControl)

### Task 5.2: Integration Test - Admin Deploy Flow

- [ ] Create test project in database
- [ ] Call admin deploy API with test project
- [ ] Monitor logs for LP Locker setup
- [ ] Verify on-chain: `cast call <contract> "lpLockerAddress()(address)"`
- [ ] Expected: `0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F`

### Task 5.3: E2E Test - Full Finalization

- [ ] Deploy test Fairlaunch via admin API
- [ ] Make test contributions (meet softcap)
- [ ] Wait for round to end (or fast-forward time in testnet)
- [ ] Call finalize via API/UI
- [ ] Verify:
  - [ ] Transaction succeeds (no revert)
  - [ ] `LiquidityLocked` event emitted
  - [ ] LP tokens exist in LP Locker contract (not project owner)
  - [ ] Fee distribution executed (check treasury balance)

### Task 5.4: E2E Test - User Wizard Flow

- [ ] Create new token via wizard UI
- [ ] Complete Fairlaunch setup via wizard
- [ ] Verify factory deployment uses NEW factory address
- [ ] Check LP Locker auto-configured
- [ ] Complete finalization test

---

## Phase 6: Existing Fairlaunch Cleanup

### Task 6.1: Handle DRAKOR Round

- [ ] Decision: Cancel or Manual Fix?
- [ ] If Cancel:
  - [ ] Update status to CANCELLED in database
  - [ ] Notify users for refund
  - [ ] Process refunds
- [ ] If Manual Fix:
  - [ ] Call manual setup endpoint
  - [ ] Verify LP Locker set
  - [ ] Test finalize call

### Task 6.2: Audit Other Pending Rounds

- [ ] Query database for all rounds with status DEPLOYED
- [ ] Check each for LP Locker configuration
- [ ] List rounds needing manual setup
- [ ] Batch fix via manual setup endpoint

---

## Phase 7: Documentation

### Task 7.1: Update Technical Docs

- [ ] Document new contract functions in code comments
- [ ] Update API documentation for admin deploy
- [ ] Document manual setup endpoint usage

### Task 7.2: Create Runbook

- [ ] Document troubleshooting steps
- [ ] List common errors and solutions
- [ ] Add monitoring checklist for new deployments

### Task 7.3: Update Architecture Diagrams

- [ ] Show LP Locker integration in finalization flow
- [ ] Document factory → fairlaunch → LP locker relationship
- [ ] Update deployment sequence diagram

---

## Completion Checklist

### Code Changes

- [ ] Contract functions added
- [ ] Contract compiled successfully
- [ ] Factory redeployed
- [ ] Config files updated
- [ ] API integration verified

### Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E admin flow works
- [ ] E2E user wizard flow works

### Deployment

- [ ] Factory deployed to BSC Testnet
- [ ] LP Locker verified
- [ ] Test finalization successful
- [ ] Production-ready

### Documentation

- [ ] Technical docs updated
- [ ] Runbook created
- [ ] Team notified of changes

---

## Rollback Plan

If critical issues discovered:

1. Revert environment variables to old factory address
2. Revert frontend constants to old factory
3. Keep old factory active until issues resolved
4. Document issues encountered
5. Fix and redeploy

---

## Post-Deployment Monitoring

- [ ] Monitor first 3 deployments closely
- [ ] Check LP Locker configuration status
- [ ] Verify finalization transactions
- [ ] Collect metrics:
  - Success rate of auto-setup
  - Finalization success rate
  - LP lock confirmation rate

---

**Status**: Ready for implementation
**Priority**: HIGH - Blocks all fairlaunch finalizations
**Estimated Time**: 6-9 hours total
