# Fairlaunch LP Locker Integration - Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: "LP Locker not configured" Error

**Symptom**: Finalize transaction reverts with error message

**Diagnostic Steps**:

```bash
# Check if LP Locker is set on contract
cast call <FAIRLAUNCH_CONTRACT> "lpLockerAddress()(address)" \
  --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545
```

**Expected**: Returns `0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F`  
**If Returns**: `0x0000000000000000000000000000000000000000` → LP Locker not set

**Solution**:

```bash
# Call manual setup endpoint
curl -X POST http://localhost:3000/api/admin/fairlaunch/setup-lp-locker \
  -H "Content-Type: application/json" \
  -d '{"roundId":"<ROUND_ID>","contractAddress":"<CONTRACT_ADDRESS>"}'
```

---

### Issue 2: "Admin wallet does not have ADMIN_ROLE" Error

**Symptom**: Setup API returns 403 error

**Root Cause**: Using wrong admin wallet (ADMIN_PRIVATE_KEY instead of DEPLOYER_PRIVATE_KEY)

**Solution**:

1. Check environment variable in use:

   ```bash
   echo $ADMIN_PRIVATE_KEY  # Wrong wallet
   echo $DEPLOYER_PRIVATE_KEY  # Correct wallet (adminExecutor)
   ```

2. Verify correct wallet has ADMIN_ROLE:

   ```bash
   # Check ADMIN_ROLE
   cast call <CONTRACT> "hasRole(bytes32,address)(bool)" \
     <ADMIN_ROLE_HASH> <WALLET_ADDRESS> \
     --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545
   ```

3. Update API to use DEPLOYER_PRIVATE_KEY

---

### Issue 3: Contract Missing setLPLocker Function

**Symptom**: Call to `lpLockerAddress()` reverts with no data

**Root Cause**: Contract deployed with OLD bytecode (before LP Locker integration)

**Solution**:

- **Short-term**: Cancel round and refund users
- **Long-term**: Redeploy factory with updated bytecode

**Verification**:

```bash
# Try calling function - if reverts, bytecode is old
cast call <CONTRACT> "lpLockerAddress()(address)"
# Error: execution reverted (no data) → Old bytecode
```

---

### Issue 4: LP Locker Already Set

**Symptom**: Setup API returns "LP Locker already configured"

**Diagnostic**:

```bash
# Check current LP Locker address
cast call <CONTRACT> "lpLockerAddress()(address)"
```

**If Correct Address**: No action needed, LP Locker already configured  
**If Wrong Address**: Cannot change (function allows only one-time set)

**Solution**: Deploy new Fairlaunch contract if wrong LP Locker address

---

### Issue 5: Factory Deployment Uses Old Bytecode

**Symptom**: New deployments still missing setLPLocker function

**Root Cause**: Factory contract not updated with new Fairlaunch bytecode

**Verification**:

```bash
# Check factory address being used
grep FAIRLAUNCH_FACTORY apps/web/.env.local
# Should match latest deployment in fairlaunch-factory-latest.json
```

**Solution**:

1. Verify factory redeployed: Check `fairlaunch-factory-latest.json`
2. Update all config files with new factory address
3. Restart dev server: `pnpm dev`

---

### Issue 6: Auto-Setup Not Working

**Symptom**: Admin deploy completes but LP Locker not set

**Diagnostic Steps**:

1. Check deploy API logs for LP Locker setup section
2. Look for error messages in console
3. Verify lpLockerDeployment.json exists:
   ```bash
   cat packages/contracts/deployments/lplocker.json
   ```

**Common Causes**:

- LP Locker deployment file missing
- LP Locker address is `0x0`
- Setup code try-catch silently fails

**Solution**:

1. Add more detailed logging in deploy API
2. Check LP Locker deployment exists
3. Use manual setup endpoint as fallback

---

### Issue 7: Finalization Fails After LP Locker Set

**Symptom**: LP Locker configured but finalize still reverts

**Possible Causes**:

1. **LP Locker contract interface mismatch**

   ```bash
   # Verify LP Locker has lockTokens function
   cast call 0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F \
     "lockTokens(address,uint256,uint256)" \
     --rpc-url <RPC_URL>
   ```

2. **Insufficient LP token approval**
   - Check if approval transaction succeeded
   - Verify approval amount matches LP balance

3. **LP Locker contract paused/disabled**
   - Contact LP Locker admin
   - Check LP Locker contract status

**Solution**: Debug specific revert reason using:

```bash
cast call <CONTRACT> "finalize()" \
  --from <CALLER_ADDRESS> \
  --rpc-url <RPC_URL> \
  --trace
```

---

## Debugging Checklist

When finalize fails, check in order:

1. **Contract State**
   - [ ] Round status is ENDED
   - [ ] Softcap is met
   - [ ] Not already finalized
   - [ ] LP Locker address is set and non-zero

2. **LP Locker Configuration**
   - [ ] LP Locker contract deployed
   - [ ] LP Locker address correct in contract
   - [ ] LP Locker interface matches expected

3. **Permissions**
   - [ ] Caller has permission to finalize
   - [ ] Contract has permission to interact with LP Locker

4. **Token Balances**
   - [ ] Contract has sufficient project tokens
   - [ ] Contract has sufficient raised funds
   - [ ] LP tokens created successfully

5. **Fee Distribution**
   - [ ] FeeSplitter address is valid
   - [ ] FeeSplitter can receive funds

---

## Emergency Procedures

### Scenario A: Urgent Finalization Needed, LP Locker Broken

**Steps**:

1. Notify users of delay
2. Debug LP Locker issue
3. Options:
   - Fix LP Locker and retry
   - Deploy emergency LP Locker
   - Manual LP lock via multisig

### Scenario B: Multiple Deployed Fairlaunches Need Fix

**Batch Fix Process**:

1. Query all affected rounds:

   ```sql
   SELECT id, contract_address, status
   FROM launch_rounds
   WHERE type = 'FAIRLAUNCH'
     AND status = 'DEPLOYED'
     AND deployed_at > '2026-02-05';
   ```

2. For each round:
   - Verify LP Locker not set
   - Call manual setup endpoint
   - Verify success
   - Update tracking sheet

3. Monitor first finalization closely

---

## Prevention Checklist

To avoid recurrence:

- [ ] Always test contract functions in isolation before factory deployment
- [ ] Verify factory bytecode includes all required functions
- [ ] Add integration tests for LP Locker setup
- [ ] Monitor auto-setup success rate
- [ ] Alert on LP Locker configuration failures
- [ ] Document all contract changes in deployment notes

---

**Last Updated**: 2026-02-05  
**Maintainer**: Platform Engineering Team
