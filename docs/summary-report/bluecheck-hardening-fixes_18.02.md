# BlueCheck Purchase Flow — Hardening Fixes

**Date:** 2026-02-18  
**Status:** ✅ Completed & Deployed

---

## Overview

4 additive fixes applied to strengthen the BlueCheck purchase + referral reward flow. All changes are backward-compatible — the existing purchase flow is unchanged.

## Problem Statement

The BlueCheck purchase flow had several edge-case vulnerabilities:

1. **Data loss risk** — If user closes browser after TX confirmation but before `verify-purchase` completes, the DB misses the purchase (profile stays non-ACTIVE, referral reward not recorded)
2. **Duplicate entries** — `crypto.randomUUID()` as `source_id` meant calling `verify-purchase` twice creates duplicate `fee_splits` and `referral_ledger` rows
3. **Insecure auto-reconcile** — `/api/admin/bluecheck/fix-status` blindly set status to ACTIVE without on-chain verification
4. **Worker stub** — `bluecheck-verifier.ts` used simulated verification instead of real on-chain checks

## Fixes Applied

### Fix #1: Secure Auto-Reconcile Endpoint

**File:** `apps/web/src/app/api/admin/bluecheck/fix-status/route.ts`

- Added session authentication requirement
- Added on-chain `hasBlueCheck()` verification across BSC Mainnet (56) and Testnet (97) before updating DB
- Rejects the request if wallet is not verified on-chain

### Fix #2: Idempotent Source ID

**File:** `apps/web/src/app/api/bluecheck/verify-purchase/route.ts`

- Replaced `crypto.randomUUID()` with `tx_hash` as `source_id` in both `fee_splits` and `referral_ledger`
- Changed `.insert()` to `.upsert()` with `ignoreDuplicates: true`
- Calling verify-purchase multiple times with same TX hash now safely no-ops

### Fix #3: Real On-Chain Worker Verification

**File:** `services/worker/jobs/bluecheck-verifier.ts`

- Replaced `simulateOnChainVerification()` stub with real on-chain `hasBlueCheck()` calls via viem
- Worker now scans all non-ACTIVE profiles, checks their EVM wallets against the BlueCheck contract
- Auto-activates any wallet verified on-chain but missed in DB

### Fix #4: Save Transaction Hash

**File:** `apps/web/src/app/api/bluecheck/verify-purchase/route.ts`

- Added `bluecheck_tx_hash` field to profiles update during verification
- Enables future reconciliation and audit trail

## Database Migrations

### `20260218063200_bluecheck_tx_hash_and_idempotency`

- Added `bluecheck_tx_hash TEXT` column to `profiles`
- Added unique constraint `(source_type, source_id)` on `fee_splits`

### `20260218063200_bluecheck_deduplicate_and_constraint`

- Cleaned 8 groups of duplicate entries in `referral_ledger` (kept latest per group)
- Added unique constraint `(source_type, source_id)` on `referral_ledger`

## Data Safety

| Aspect                           | Status                                        |
| -------------------------------- | --------------------------------------------- |
| Existing unique referral entries | ✅ Not touched                                |
| Duplicate entries cleaned        | ✅ Kept latest, removed older duplicates only |
| BLUECHECK entries                | ✅ No duplicates existed, no changes          |
| On-chain rewards                 | ✅ Unaffected (SC handles directly)           |

## Contract Addresses

| Chain            | Address                                      |
| ---------------- | -------------------------------------------- |
| BSC Mainnet (56) | `0xC14CdFE71Ca04c26c969a1C8a6aA4b1192e6fC43` |
| BSC Testnet (97) | `0xfFaB42EcD7Eb0a85b018516421C9aCc088aC7157` |

## Verification

- ✅ TypeScript build clean (zero new errors)
- ✅ Migrations applied to Supabase successfully
- ✅ Existing flow unchanged (all fixes are additive)
