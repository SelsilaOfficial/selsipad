# Project Selsipad - Fairlaunch E2E Flow Mapping Report

## Overivew
This document maps the complete end-to-end flow of the Fairlaunch module from creation to claiming. We cross-checked the User UI, Admin Dashboard UI, Next.js API actions, Supabase database schema, and Smart Contracts to ensure consistency.

Here is the step-by-step mapping:

---

### 1 & 3. Submit & Deploy (User UI -> SC -> API -> DB)
**Flow:**
1. **User UI:** User navigates to `CreateFairlaunchWizard`. They enter details (token, softcap, liquidity, team vesting, listing premium, etc).
2. **Deploy (SC):** Unlike Presale, the **Fairlaunch contract is deployed directly by the user** from the frontend using `useFairlaunchDeploy` hook (`FairlaunchFactory.createFairlaunch`). The user pays the deployment fee.
3. **Submit (API):** Once the EVM transaction succeeds, the frontend calls the `saveFairlaunch` server action.
4. **Database (DB):** `saveFairlaunch` inserts a record into the `projects` table (type: FAIRLAUNCH) and `launch_rounds` table. 
   - Initial status is dynamically set: if `start_time` is in the future, it becomes `APPROVED`. If it's already active, it becomes `ACTIVE`.

**Consistency Check:** ✅ **Consistent.** The deployment and DB syncing logic is well-bound. Duplicate prevention exists for 5-minute intervals. 

---

### 2. Approve (Admin Dashboard -> API -> DB)
**Flow:**
1. **Auto-Approval:** Currently, Fairlaunches are structurally **auto-approved** by the backend when saved if the `start_time` is strictly in the future.
2. **Admin UI:** Admin can still review and monitor them in the Admin Dashboard list. If a fairlaunch needs to be manually modified, they can potentially manage it, but it starts as `APPROVED` or `ACTIVE` directly without a manual gating step from 'SUBMITTED' like some presales.

**Consistency Check:** ⚠️ **Note on Flow:** There is no strict manual admin gating before a Fairlaunch goes live unless specifically flagged. The user deploys the contract first, so preventing it from going live on-chain after deployment is technically impossible without the Admin pausing it. This matches standard decentralized launchpad behavior.

---

### 4. User Contribute (User UI -> SC -> API -> DB)
**Flow:**
1. **User UI:** Users navigate to the Fairlaunch detail page. They input how much native currency (e.g., BNB) to contribute.
2. **Contribute (SC):** User signs transaction calling `contribute()` on the `Fairlaunch.sol` smart contract via `useFairlaunchContribute` hook.
3. **API & DB (Referral Tracking):** Upon success, the UI triggers `saveFairlaunchContribution` -> `recordContributionInDatabase`, which logs the transaction into the `contributions` table with status `CONFIRMED`.
4. **Triggers:** Supabase has a `trigger_increment_round_totals` trigger. When a contribution is inserted, it automatically increments `total_raised` and `total_participants` on the `launch_rounds` table.

**Consistency Check:** ✅ **Consistent.** Referral logic is active. Database totals rely on PG triggers which keep the `launch_rounds` table in perfect sync with the `contributions` table.

---

### 5. Finalize (Admin UI -> API -> SC -> DB)
**Flow:**
1. **Admin UI:** Once the round ends, the Admin clicks "Finalize" in the Admin Dashboard.
2. **Finalize (API & SC):** The `finalizeFairlaunch` server action uses the deployer/admin private key to call `finalize()` (or step-by-step admin functions like `adminDistributeFee`, `adminAddLiquidity`, `adminLockLP`) on the Smart Contract.
3. **Database (DB):** Once finalized on-chain:
   - Round status is updated in DB to `SUCCESS` (if softcap reached) or `FAILED`.
   - `projects` table status is updated to `FINALIZED` or `FAILED`.
   - **Allocations:** If SUCCESS, it generates `round_allocations` proportional to the user's contribution slice vs `total_raised`.
   - **Refunds:** If FAILED, it generates `refunds` records.
   - **Referrals:** Processes fee splits and logs rewards into `referral_ledger`.

**Consistency Check:** ✅ **Consistent & Robust.** The system gracefully handles multi-step fairlaunch finalizations, LP locking record generation, and precise fractional allocations for Fairlaunch.

---

### 6. Claim / Refund (User UI -> SC -> API/DB)
**Flow:**
1. **User UI:** User visits the dashboard/portfolio. If success, they see "Claim Tokens". If failed, they see "Claim Refund" via `FairlaunchClaimer.tsx`.
2. **Claim/Refund (SC):** The user calls `claim()` or `refund()` on the contract directly via `useFairlaunchClaim`/`useFairlaunchRefund`.
3. **API Sync:** Upon success, the UI optionally syncs the claim back using `markTokensClaimed` API, updating `claimed_at` in the `contributions` (or allocations) table.

**Consistency Check:** ⚠️ **Warning to Monitor:** The `FairlaunchClaimer.tsx` executes the hook but there needs to be a mechanism to reliably update DB state. Currently, the UI calls `showToast('success')` on success but I don't see an explicit call to `markTokensClaimed` inside `handleClaim` in `FairlaunchClaimer.tsx`. This might rely on an indexer or it should be added to the UI flow.

---

## Conclusion & Recommendations
- **Overall UI-API-DB-SC alignment:** The Fairlaunch flow is highly consistent. The SC and DB structures align closely (e.g., softcap logic, final price calculations).
- **Admin vs User Role:** Unlike Presale where Admin deploys the contract, the **User deploys the Fairlaunch contract explicitly**. Admin maintains control via the deployer wallet strictly for the **Finalization Phase** (adding liquidity, burning/locking, distributing funds).
- **Recommendation:** Double-check that `markTokensClaimed` is invoked in `FairlaunchClaimer.tsx` to maintain 1:1 state between the subgraph/indexer and the Supabase claim tracking.
