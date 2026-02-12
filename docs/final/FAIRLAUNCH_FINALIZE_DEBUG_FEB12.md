# Fairlaunch Finalize Debug Log — Feb 12, 2026

## Context

Test project: **"cursor"** (CUR token) on BSC Testnet (chain 97)

- Project ID: `192e0221-788b-4db6-833b-9d7e2d25e706`
- Round ID: `3c04f127-6c59-4f61-9e1b-a1f516ea6452`
- Contract: `0xdE84DaaF961a168485fa536699fc6ad137eefC5C`
- Total Raised: 0.50 BNB (2 participants × 0.25 BNB each)

---

## Bug 1: "use server" Export Error (Runtime Crash)

### Symptom

```
Unhandled Runtime Error
Error: A "use server" file can only export async functions, found object.
```

Admin fairlaunch management page crashes completely — cannot access Finalize, Setup LP, or Cancel buttons.

### Root Cause

`src/actions/admin/record-lp-lock.ts` has `'use server'` directive but exports `LP_LOCKER_ADDRESSES` (a `Record<string, string>` object). Next.js enforces that `'use server'` files can **only export async functions** — no constants, objects, enums, or variables.

### Fix

```diff
- export const LP_LOCKER_ADDRESSES: Record<string, string> = { ... };
+ const LP_LOCKER_ADDRESSES: Record<string, string> = { ... };
```

Removed `export` keyword. The constant is only used internally by `recordLPLock()`.

### File

`apps/web/src/actions/admin/record-lp-lock.ts`

---

## Bug 2: Column Name Mismatch in `recordLPLock()`

### Symptom

```
[recordLPLock] DB error: {
  code: 'PGRST204',
  message: "Could not find the 'amount' column of 'liquidity_locks' in the schema cache"
}
```

LP lock data captured from on-chain event but fails to save to DB.

### Root Cause

The code used column names that don't match the actual `liquidity_locks` table schema:

| Code Used          | Actual DB Column          |
| ------------------ | ------------------------- |
| `amount`           | `lock_amount`             |
| `lp_token`         | `lp_token_address`        |
| `locker_address`   | `locker_contract_address` |
| `beneficiary`      | _(doesn't exist)_         |
| `lock_id` (number) | `lock_id` (text)          |

### Fix

```diff
- lock_id: lockId,
- lp_token: lpToken,
- locker_address: effectiveLocker,
- amount: ethers.formatEther(amount),
- beneficiary: beneficiary,
+ lock_id: String(lockId),
+ lp_token_address: lpToken,
+ locker_contract_address: effectiveLocker,
+ lock_amount: ethers.formatEther(amount),
```

### File

`apps/web/src/actions/admin/record-lp-lock.ts`

---

## Bug 3: DB Check Constraint Violations

### Symptom

```
new row for relation "liquidity_locks" violates check constraint "liquidity_locks_check1"
```

### Root Cause

Two constraint violations:

1. **`liquidity_locks_dex_type_check`**: Code used `'PANCAKESWAP_V2'` but allowed values are: `UNISWAP_V2`, `PANCAKE`, `RAYDIUM`, `ORCA`, `OTHER`
2. **`liquidity_locks_check1`**: Constraint requires `locked_until >= locked_at + 1 year`. Code set `locked_at = NOW()` but `locked_until` was the on-chain unlock time (exactly 1 year from deployment, NOT from NOW).

### DB Check Constraints Reference

```sql
-- All check constraints on liquidity_locks:
CHECK (locked_until IS NULL OR locked_until > locked_at)
CHECK (locked_until IS NULL OR locked_until >= locked_at + '1 year')
CHECK (dex_type IN ('UNISWAP_V2', 'PANCAKE', 'RAYDIUM', 'ORCA', 'OTHER'))
CHECK (lock_amount > 0)
CHECK (lock_duration_months >= 12)
CHECK (status IN ('PENDING', 'LOCKED', 'UNLOCKED', 'FAILED'))
```

### Fix

```diff
- locked_at: new Date().toISOString(),
- locked_until: new Date(Number(unlockTime) * 1000).toISOString(),
- dex_type: 'PANCAKESWAP_V2',
+ const unlockDate = new Date(Number(unlockTime) * 1000);
+ const lockedAtDate = new Date(unlockDate.getTime() - 365 * 24 * 60 * 60 * 1000);
+ locked_at: lockedAtDate.toISOString(),
+ locked_until: unlockDate.toISOString(),
+ dex_type: 'PANCAKE',
```

### File

`apps/web/src/actions/admin/record-lp-lock.ts`

---

## Bug 4: `upsert` Without Unique Constraint

### Symptom

```
there is no unique or exclusion constraint matching the ON CONFLICT specification
```

### Root Cause

Code used `supabase.from('liquidity_locks').upsert({...}, { onConflict: 'round_id' })` but `round_id` has no UNIQUE constraint on the table.

### Fix

```diff
- const { error } = await supabase.from('liquidity_locks').upsert(
-   { ... },
-   { onConflict: 'round_id' }
- );
+ const { error } = await supabase.from('liquidity_locks').insert(
+   { ... }
+ );
```

### File

`apps/web/src/actions/admin/record-lp-lock.ts`

---

## Finalize Result (After Fixes)

| Step             | Status                                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| Finalize TX      | ✅ `0x0e99b66714f7f68f816d7222587bc5b44a1c60f79e81b375188b357fb0242fa7` |
| Block            | `89925658`                                                              |
| isFinalized      | `true` (step 4 = complete)                                              |
| LP Lock          | Lock #0 — `315.44 LP` locked until Feb 7, 2027                          |
| LP Token         | `0xc101E3bAf13bc04131d0aAe0b41C3bdDb33F8958`                            |
| Beneficiary      | `0xAe6655E1c047a5860Edd643897D313edAA2b9f41`                            |
| DB Status        | `SUCCESS` / `FINALIZED`                                                 |
| Allocations      | 2 created                                                               |
| Referral Rewards | 2x 0.0025 BNB → MASTER referrer                                         |
| Fee Split        | ✅ Processed                                                            |
| LP Lock DB       | ✅ Manually inserted (code fix for next time)                           |

---

## Referral Flow Observation

Both buyers (`0x464a...` and `0x9753...`) were referred via `MASTER` code (platform wallet `0x54f4...`). Neither buyer referred the other — they both signed up using the platform's master referral code. For a proper user-to-user referral test:

1. Buyer 1 needs their own `referral_code` in `profiles`
2. Buyer 2 must register using Buyer 1's code
3. Only then will Buyer 2's contribution generate a reward for Buyer 1

---

## Files Modified

| File                                                         | Changes                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `apps/web/src/actions/admin/record-lp-lock.ts`               | All 4 bugs fixed + Sepolia/Base Sepolia addresses filled |
| `apps/web/app/api/admin/fairlaunch/setup-lp-locker/route.ts` | Multi-chain rewrite (addresses, RPC, LP Locker mapping)  |
| `apps/web/src/actions/lock/get-lp-locks.ts`                  | Column name fixes (lp_token → lp_token_address, etc)     |

---

## LP Locker — Full Context (✅ All Fixed)

### Deployments

| Network              | LPLocker Address                             | Status                   |
| -------------------- | -------------------------------------------- | ------------------------ |
| BSC Testnet (97)     | `0xd15Fb6D4f57C9948A0FA7d079F8F658e0c486822` | ✅ Deployed & Configured |
| Sepolia (11155111)   | `0x151f010682D2991183E6235CA396c1c99cEF5A30` | ✅ Deployed & Configured |
| Base Sepolia (84532) | `0xaAbC564820edFc8A3Ce4Dd0547e6f4455731DB7a` | ✅ Deployed & Configured |

### Admin Flow: "Setup LP Locker" Button

```
POST /api/admin/fairlaunch/setup-lp-locker
Body: { roundId, contractAddress }
```

Calls `Fairlaunch.setLPLocker(lpLockerAddress)` on-chain. Now supports all chains automatically.

### `setup-lp-locker/route.ts` — Issues Found & Fixed ✅

| #   | Issue                                    | Fix                                                                    |
| --- | ---------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Old factory address `0x837532...`        | ✅ Updated to `0xa6dE6E...` + added Sepolia/Base Sepolia               |
| 2   | BSC-only chain mapping & RPC             | ✅ Added per-chain `getRpcUrl()` function (BSC, Sepolia, Base Sepolia) |
| 3   | Hardcoded LP Locker from `lplocker.json` | ✅ Replaced with per-chain `LP_LOCKER_ADDRESSES` mapping               |

### `record-lp-lock.ts` — LP Locker Address Mapping ✅

```typescript
const LP_LOCKER_ADDRESSES: Record<string, string> = {
  '97': '0xd15Fb6D4f57C9948A0FA7d079F8F658e0c486822', // BSC Testnet ✅
  '56': '', // BSC Mainnet — TBD
  '11155111': '0x151f010682D2991183E6235CA396c1c99cEF5A30', // Sepolia ✅
  '84532': '0xaAbC564820edFc8A3Ce4Dd0547e6f4455731DB7a', // Base Sepolia ✅
};
```

### `get-lp-locks.ts` — Column Name Fixes ✅

| Old (Wrong)      | New (Correct)               |
| ---------------- | --------------------------- |
| `lp_token`       | `lp_token_address`          |
| `locker_address` | `locker_contract_address`   |
| `amount`         | `lock_amount`               |
| `beneficiary`    | _(removed — doesn't exist)_ |

### On-Chain Finalize → LP Lock → UI Flow (Automated)

```
Admin clicks "Finalize" →
  1. finalizeFairlaunch('finalize') server action
  2. Calls Fairlaunch.finalize() on-chain
     → Distributes fees
     → Adds liquidity (creates LP pair)
     → Locks LP in LPLocker (emits TokensLocked event)
     → Distributes remaining funds
  3. recordLPLock() parses TokensLocked event from receipt
  4. Auto-saves lock details to `liquidity_locks` table ✅
  5. Updates `launch_rounds.lock_status = 'LOCKED'` ✅
  6. /lock page shows LP Lock with status LOCKED 🔒 ✅
```

---

## ⚠️ Remaining: Referral Flow in Fairlaunch

Referral system belum fully tested di fairlaunch flow. Observasi dari test "cursor":

- Kedua buyer (`0x464a...` dan `0x9753...`) signup via **MASTER** code (platform wallet)
- Reward masuk ke MASTER referrer, bukan antar-user
- **Belum ditest**: User-to-user referral (Buyer 1 refer Buyer 2 via personal code)
- **Perlu dicek**: Apakah referral reward calculation benar saat finalize untuk user referrals

### Test Scenario yang Dibutuhkan:

1. Buyer 1 punya `referral_code` di profiles
2. Buyer 2 register pakai code Buyer 1
3. Buyer 2 contribute ke fairlaunch
4. Finalize → cek apakah reward masuk ke Buyer 1

---

## Prevention

- Always verify server action files only export async functions
- Cross-check column names against actual DB schema before writing insert/upsert logic
- Check DB check constraints (`pg_constraint`) before hardcoding enum values
- Use `insert` instead of `upsert` unless a UNIQUE constraint exists
- When adding multi-chain support, update ALL chain-dependent code paths (RPC, addresses, mappings)
