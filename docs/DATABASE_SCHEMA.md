# Selsipad Database Schema

**Database:** `selsipad_vinal`  
**Project ID:** `tkmlclijfinaqtphojkb`  
**Region:** ap-northeast-1  
**Status:** ACTIVE_HEALTHY  
**Last Updated:** 2026-01-21

---

## Table of Contents

- [Overview](#overview)
- [Core Modules](#core-modules)
  - [1. Authentication & Wallet Management](#1-authentication--wallet-management)
  - [2. User Profiles & Badges](#2-user-profiles--badges)
  - [3. Projects & Lifecycle](#3-projects--lifecycle)
  - [4. Launchpad System](#4-launchpad-system)
  - [5. Vesting & Locks](#5-vesting--locks)
  - [6. Social-Fi (SelsiFeed)](#6-social-fi-selsifeed)
  - [7. AMA System](#7-ama-system)
  - [8. Bonding Curve](#8-bonding-curve)
  - [9. SBT Staking](#9-sbt-staking)
  - [10. Referral System](#10-referral-system)
  - [11. Financial Transactions](#11-financial-transactions)
  - [12. Admin & Audit](#12-admin--audit)
  - [13. Trending & Analytics](#13-trending--analytics)
- [Database Statistics](#database-statistics)

---

## Overview

The Selsipad database consists of **46 tables** organized into 13 functional modules. Total database size: ~3.2 MB.

### Key Design Patterns

- **Wallet-First Authentication**: No email/password, only wallet-based auth via signatures
- **Multi-Chain Support**: EVM (Ethereum, BSC, Polygon, etc.) and Solana
- **UUID Primary Keys**: All tables use UUIDs for distributed scalability
- **Timestamped Records**: Most tables include `created_at` and `updated_at`
- **Referential Integrity**: Extensive use of foreign keys with CASCADE deletes
- **Indexed Lookups**: Strategic indexes on frequently queried columns

---

## Core Modules

### 1. Authentication & Wallet Management

#### `wallets`

**Purpose**: Store user wallet addresses across multiple chains  
**Size**: 112 kB | **Columns**: 8

| Column        | Type        | Nullable | Default             | Description                                |
| ------------- | ----------- | -------- | ------------------- | ------------------------------------------ |
| `id`          | uuid        | NO       | `gen_random_uuid()` | Primary key                                |
| `user_id`     | uuid        | NO       | -                   | FK to profiles                             |
| `chain`       | text        | NO       | -                   | Chain identifier (e.g., 'solana', 'evm-1') |
| `address`     | text        | NO       | -                   | Wallet address (lowercase)                 |
| `is_primary`  | boolean     | YES      | `false`             | Primary wallet per chain                   |
| `verified_at` | timestamptz | YES      | -                   | Timestamp of signature verification        |
| `created_at`  | timestamptz | YES      | `now()`             | -                                          |
| `updated_at`  | timestamptz | YES      | `now()`             | -                                          |

**Indexes**:

- `wallets_pkey` (PRIMARY KEY on `id`)
- `idx_wallets_user_id` (on `user_id`)
- `idx_wallets_address` (on `address`)
- `idx_wallets_chain` (on `chain`)
- `unique_user_chain_address` (UNIQUE on `user_id, chain, address`)
- `idx_wallets_unique_primary_per_chain` (UNIQUE on `user_id, chain` WHERE `is_primary = true`)

---

#### `auth_sessions`

**Purpose**: Store active authentication sessions for wallet-based login  
**Size**: 160 kB | **Columns**: 11

| Column           | Type        | Nullable | Default             | Description                       |
| ---------------- | ----------- | -------- | ------------------- | --------------------------------- |
| `id`             | uuid        | NO       | `gen_random_uuid()` | Primary key                       |
| `user_id`        | uuid        | NO       | -                   | FK to profiles                    |
| `wallet_address` | text        | NO       | -                   | Session wallet                    |
| `chain`          | text        | NO       | -                   | Chain for this session            |
| `session_token`  | text        | NO       | -                   | Unique session identifier         |
| `signature`      | text        | NO       | -                   | Wallet signature for verification |
| `message`        | text        | NO       | -                   | Signed message                    |
| `nonce`          | text        | NO       | -                   | Anti-replay nonce                 |
| `wallet_id`      | uuid        | YES      | -                   | FK to wallets (direct reference)  |
| `created_at`     | timestamptz | YES      | `now()`             | Session start                     |
| `expires_at`     | timestamptz | YES      | -                   | Session expiry                    |

**Foreign Keys**:

- `wallet_id` → `wallets.id` (ON DELETE CASCADE)

**Indexes**:

- `idx_auth_sessions_wallet_id` (on `wallet_id`)
- `idx_auth_sessions_token` (on `session_token`)
- `idx_auth_sessions_user` (on `user_id`)

---

#### `wallet_link_nonces`

**Purpose**: Temporary nonces for linking new wallets to existing users  
**Size**: 40 kB | **Columns**: 7

| Column       | Type        | Nullable | Default             |
| ------------ | ----------- | -------- | ------------------- |
| `id`         | uuid        | NO       | `gen_random_uuid()` |
| `user_id`    | uuid        | NO       | -                   |
| `chain`      | text        | NO       | -                   |
| `nonce`      | text        | NO       | -                   |
| `used`       | boolean     | YES      | `false`             |
| `created_at` | timestamptz | YES      | `now()`             |
| `expires_at` | timestamptz | NO       | -                   |

**Indexes**:

- `wallet_link_nonces_nonce_key` (UNIQUE on `nonce`)
- `idx_nonces_expires` (on `expires_at`)

---

### 2. User Profiles & Badges

#### `profiles`

**Purpose**: User profile data and reputation metrics  
**Size**: 136 kB | **Columns**: 15

| Column                 | Type        | Nullable | Default             | Notes                             |
| ---------------------- | ----------- | -------- | ------------------- | --------------------------------- |
| `user_id`              | uuid        | NO       | `gen_random_uuid()` | Primary key                       |
| `nickname`             | text        | YES      | -                   | Display name                      |
| `bio`                  | text        | YES      | -                   | User bio                          |
| `avatar_url`           | text        | YES      | -                   | Profile picture                   |
| `verification_status`  | text        | YES      | `'UNVERIFIED'`      | KYC status                        |
| `kyc_verified_at`      | timestamptz | YES      | -                   | KYC approval timestamp            |
| `kyc_submission_id`    | uuid        | YES      | -                   | FK to kyc_submissions             |
| `referrer_id`          | uuid        | YES      | -                   | FK to profiles (self-referential) |
| `total_referrals`      | integer     | YES      | `0`                 | Referral count                    |
| `is_admin`             | boolean     | YES      | `false`             | Admin flag                        |
| `created_at`           | timestamptz | YES      | `now()`             | -                                 |
| `updated_at`           | timestamptz | YES      | `now()`             | -                                 |
| (+ engagement metrics) | -           | -        | -                   | See full schema                   |

**Key Relationships**:

- Self-referential for referral tree
- Links to `kyc_submissions` for verification
- Referenced by `wallets` for multi-chain auth

---

#### `badge_definitions`

**Purpose**: System-wide badge catalog (e.g., Blue Check, Whale, Developer KYC)  
**Size**: 112 kB | **Columns**: 10

| Column        | Type        | Nullable | Default             | Notes                                  |
| ------------- | ----------- | -------- | ------------------- | -------------------------------------- |
| `id`          | uuid        | NO       | `gen_random_uuid()` | -                                      |
| `slug`        | text        | NO       | -                   | Unique identifier (e.g., 'blue_check') |
| `name`        | text        | NO       | -                   | Display name                           |
| `description` | text        | YES      | -                   | -                                      |
| `icon_url`    | text        | YES      | -                   | Badge icon                             |
| `scope`       | text        | NO       | `'USER'`            | 'USER' or 'PROJECT'                    |
| `is_system`   | boolean     | YES      | `false`             | System-managed badge                   |
| `metadata`    | jsonb       | YES      | `'{}'::jsonb`       | Additional properties                  |
| `created_at`  | timestamptz | YES      | `now()`             | -                                      |
| `updated_at`  | timestamptz | YES      | `now()`             | -                                      |

**Notable Badges**:

- `blue_check` (USER scope, subscription-based)
- `developer_kyc` (USER scope, KYC verification)
- `whale` (USER scope, high transaction volume)
- `security_audit` (PROJECT scope, audit completion)

---

#### `badge_instances`

**Purpose**: Awarded badges to users or projects  
**Size**: 112 kB | **Columns**: 14

| Column         | Type        | Nullable | Default             |
| -------------- | ----------- | -------- | ------------------- |
| `id`           | uuid        | NO       | `gen_random_uuid()` |
| `badge_id`     | uuid        | NO       | -                   |
| `user_id`      | uuid        | YES      | -                   |
| `project_id`   | uuid        | YES      | -                   |
| `awarded_at`   | timestamptz | YES      | `now()`             |
| `expires_at`   | timestamptz | YES      | -                   |
| `is_active`    | boolean     | YES      | `true`              |
| `award_reason` | text        | YES      | -                   |
| `metadata`     | jsonb       | YES      | `'{}'::jsonb`       |

**Foreign Keys**:

- `badge_id` → `badge_definitions.id`

**Constraint**: Either `user_id` OR `project_id` must be set (CHECK constraint)

---

### 3. Projects & Lifecycle

#### `projects`

**Purpose**: Core project information for fundraising campaigns  
**Size**: 104 kB | **Columns**: 27

| Column                  | Type        | Nullable | Default             | Notes                  |
| ----------------------- | ----------- | -------- | ------------------- | ---------------------- |
| `id`                    | uuid        | NO       | `gen_random_uuid()` | Primary key            |
| `name`                  | text        | NO       | -                   | Project name           |
| `description`           | text        | YES      | -                   | Project description    |
| `creator_id`            | uuid        | NO       | -                   | FK to profiles         |
| `chain`                 | text        | NO       | -                   | Target blockchain      |
| `status`                | text        | YES      | `'DRAFT'`           | Lifecycle status       |
| `kyc_status`            | text        | YES      | `'NOT_SUBMITTED'`   | KYC verification state |
| `contract_audit_status` | text        | YES      | `'NOT_SUBMITTED'`   | Audit state            |
| `logo_url`              | text        | YES      | -                   | Project logo           |
| `banner_url`            | text        | YES      | -                   | Banner image           |
| `website_url`           | text        | YES      | -                   | Official website       |
| `whitepaper_url`        | text        | YES      | -                   | Whitepaper link        |
| `twitter_url`           | text        | YES      | -                   | Twitter profile        |
| `telegram_url`          | text        | YES      | -                   | Telegram group         |
| `discord_url`           | text        | YES      | -                   | Discord server         |
| `token_name`            | text        | YES      | -                   | Token name             |
| `token_symbol`          | text        | YES      | -                   | Token ticker           |
| `token_supply`          | numeric     | YES      | -                   | Total supply           |
| `created_at`            | timestamptz | YES      | `now()`             | -                      |
| `updated_at`            | timestamptz | YES      | `now()`             | -                      |

**Status Flow**:
`DRAFT` → `PENDING_KYC` → `PENDING_AUDIT` → `APPROVED` → `ACTIVE` → `COMPLETED` / `CANCELLED`

---

#### `kyc_submissions`

**Purpose**: Developer KYC verification submissions  
**Size**: 96 kB | **Columns**: 12

| Column             | Type        | Nullable | Default             |
| ------------------ | ----------- | -------- | ------------------- |
| `id`               | uuid        | NO       | `gen_random_uuid()` |
| `user_id`          | uuid        | NO       | -                   |
| `full_name`        | text        | NO       | -                   |
| `country`          | text        | NO       | -                   |
| `id_document_url`  | text        | NO       | -                   |
| `selfie_url`       | text        | NO       | -                   |
| `status`           | text        | YES      | `'PENDING'`         |
| `reviewed_by`      | uuid        | YES      | -                   |
| `reviewed_at`      | timestamptz | YES      | -                   |
| `rejection_reason` | text        | YES      | -                   |
| `submitted_at`     | timestamptz | YES      | `now()`             |
| `updated_at`       | timestamptz | YES      | `now()`             |

**Note**: There is NO `document_type` column. All submissions are Developer KYC by default.

**Status Values**: `PENDING`, `APPROVED`, `REJECTED`

---

#### `sc_scan_results`

**Purpose**: Smart contract security scan results  
**Size**: 64 kB | **Columns**: 24

| Column                | Type        | Nullable | Default             | Notes                            |
| --------------------- | ----------- | -------- | ------------------- | -------------------------------- |
| `id`                  | uuid        | NO       | `gen_random_uuid()` | -                                |
| `project_id`          | uuid        | NO       | -                   | FK to projects                   |
| `contract_address`    | text        | NO       | -                   | Scanned contract                 |
| `chain`               | text        | NO       | -                   | Blockchain                       |
| `scan_status`         | text        | YES      | `'PENDING'`         | `PENDING`, `COMPLETED`, `FAILED` |
| `security_score`      | numeric     | YES      | -                   | 0-100 score                      |
| `vulnerability_count` | integer     | YES      | `0`                 | Critical issues found            |
| `scan_result_json`    | jsonb       | YES      | -                   | Full scan report                 |
| `scanned_at`          | timestamptz | YES      | -                   | Scan completion time             |
| (+ risk levels)       | -           | -        | -                   | HIGH/MEDIUM/LOW counts           |

**Foreign Keys**:

- `project_id` → `projects.id` (ON DELETE CASCADE)

---

### 4. Launchpad System

#### `launch_rounds`

**Purpose**: Presale/Fairlaunch rounds configuration  
**Size**: 128 kB | **Columns**: 41

| Column                  | Type        | Nullable | Default             | Notes                       |
| ----------------------- | ----------- | -------- | ------------------- | --------------------------- |
| `id`                    | uuid        | NO       | `gen_random_uuid()` | Primary key                 |
| `project_id`            | uuid        | NO       | -                   | FK to projects              |
| `type`                  | text        | NO       | -                   | Round type identifier       |
| `sale_type`             | text        | YES      | -                   | `presale` or `fairlaunch`   |
| `chain`                 | text        | NO       | -                   | Blockchain identifier       |
| `token_address`         | text        | NO       | -                   | Token contract              |
| `raise_asset`           | text        | NO       | -                   | Asset used for fundraising  |
| `start_at`              | timestamptz | NO       | -                   | Round starts                |
| `end_at`                | timestamptz | NO       | -                   | Round ends                  |
| `status`                | text        | YES      | -                   | Current state               |
| `result`                | text        | YES      | -                   | Round outcome               |
| `kyc_status_at_submit`  | text        | YES      | -                   | KYC status at submission    |
| `scan_status_at_submit` | text        | YES      | -                   | Security scan status        |
| `params`                | jsonb       | NO       | -                   | Round configuration (JSONB) |
| `total_raised`          | numeric     | YES      | `0`                 | Current total               |
| `total_participants`    | integer     | YES      | `0`                 | Unique contributors         |
| `rejection_reason`      | text        | YES      | -                   | Admin rejection reason      |
| `approved_by`           | uuid        | YES      | -                   | Admin who approved          |
| `approved_at`           | timestamptz | YES      | -                   | Approval timestamp          |
| `reviewed_by`           | uuid        | YES      | -                   | Admin who reviewed          |
| `reviewed_at`           | timestamptz | YES      | -                   | Review timestamp            |
| `finalized_by`          | uuid        | YES      | -                   | Finalizer user              |
| `finalized_at`          | timestamptz | YES      | -                   | Finalization time           |
| `created_by`            | uuid        | NO       | -                   | Creator user                |
| `created_at`            | timestamptz | YES      | `now()`             | -                           |
| `updated_at`            | timestamptz | YES      | `now()`             | -                           |
| `vesting_status`        | text        | YES      | -                   | Vesting state               |
| `lock_status`           | text        | YES      | -                   | LP lock state               |
| `success_gated_at`      | timestamptz | YES      | -                   | Success gate timestamp      |
| `chain_id`              | integer     | YES      | -                   | Blockchain ID               |
| `round_address`         | text        | YES      | -                   | Presale contract address    |
| `vesting_vault_address` | text        | YES      | -                   | MerkleVesting contract      |
| `schedule_salt`         | text        | YES      | -                   | Vesting salt                |
| `merkle_root`           | text        | YES      | -                   | Allocation Merkle root      |
| `tge_timestamp`         | bigint      | YES      | -                   | Token Generation Event      |
| `fee_splitter_address`  | text        | YES      | -                   | FeeSplitter contract        |
| `created_token_id`      | uuid        | YES      | -                   | FK to created tokens        |
| `listing_premium_bps`   | integer     | YES      | -                   | Listing price premium (bps) |
| `final_price`           | numeric     | YES      | -                   | Final sale price            |
| `listing_price`         | numeric     | YES      | -                   | DEX listing price           |
| `tokens_deposited_at`   | timestamptz | YES      | -                   | Token deposit timestamp     |

**Indexes**:

- `idx_launch_rounds_round_address` (on `round_address`)
- `idx_launch_rounds_chain` (on `chain_id`)
- `idx_launch_rounds_schedule_salt` (on `schedule_salt`)
- `idx_launch_rounds_fee_splitter` (on `fee_splitter_address`)

**Status Values**:
`SUBMITTED`, `SUBMITTED_FOR_REVIEW`, `APPROVED_TO_DEPLOY`, `REJECTED`, `UPCOMING`, `ACTIVE`, `ENDED`, `FINALIZED_SUCCESS`, `FINALIZED_FAILED`, `CANCELLED`

**Sale Type Values**:

- `presale` - Traditional presale with hardcap/softcap
- `fairlaunch` - Fair launch (70%+ liquidity, no hardcap)

---

#### `presale_merkle_proofs`

**Purpose**: Store Merkle proofs for vesting allocations (newly added)  
**Size**: 40 kB | **Columns**: 7

| Column           | Type        | Nullable | Default             |
| ---------------- | ----------- | -------- | ------------------- |
| `id`             | uuid        | NO       | `gen_random_uuid()` |
| `round_id`       | uuid        | NO       | -                   |
| `wallet_address` | text        | NO       | -                   |
| `allocation`     | text        | NO       | -                   |
| `proof`          | jsonb       | NO       | -                   |
| `snapshot_hash`  | text        | YES      | -                   |
| `created_at`     | timestamptz | YES      | `now()`             |

**Foreign Keys**:

- `round_id` → `launch_rounds.id` (ON DELETE CASCADE)

**Unique Constraint**: `(round_id, wallet_address)`

**Security**: Allocation stored as TEXT to prevent precision loss in wei values

---

#### `contributions`

**Purpose**: Track individual user contributions to rounds  
**Size**: 72 kB | **Columns**: 11

| Column          | Type        | Nullable | Default             |
| --------------- | ----------- | -------- | ------------------- |
| `id`            | uuid        | NO       | `gen_random_uuid()` |
| `round_id`      | uuid        | NO       | -                   |
| `user_id`       | uuid        | NO       | -                   |
| `amount`        | numeric     | NO       | -                   |
| `payment_token` | text        | YES      | `'NATIVE'`          |
| `tx_hash`       | text        | NO       | -                   |
| `referrer_id`   | uuid        | YES      | -                   |
| `created_at`    | timestamptz | YES      | `now()`             |

**Foreign Keys**:

- `round_id` → `launch_rounds.id`
- `referrer_id` → `profiles.user_id`

---

#### `refunds`

**Purpose**: Track refund requests for failed presales  
**Size**: 64 kB | **Columns**: 12

| Column            | Type        | Nullable | Default             |
| ----------------- | ----------- | -------- | ------------------- |
| `id`              | uuid        | NO       | `gen_random_uuid()` |
| `contribution_id` | uuid        | NO       | -                   |
| `user_id`         | uuid        | NO       | -                   |
| `amount`          | numeric     | NO       | -                   |
| `status`          | text        | YES      | `'PENDING'`         |
| `tx_hash`         | text        | YES      | -                   |
| `processed_at`    | timestamptz | YES      | -                   |
| `created_at`      | timestamptz | YES      | `now()`             |

---

### 5. Vesting & Locks

#### `vesting_schedules`

**Purpose**: Define vesting configurations (TGE %, cliff, linear)  
**Size**: 56 kB | **Columns**: 17

| Column                    | Type        | Nullable | Default             | Notes                      |
| ------------------------- | ----------- | -------- | ------------------- | -------------------------- |
| `id`                      | uuid        | NO       | `gen_random_uuid()` | -                          |
| `round_id`                | uuid        | NO       | -                   | FK to launch_rounds        |
| `schedule_type`           | text        | NO       | -                   | `INVESTOR` or `TEAM`       |
| `tge_percent`             | numeric     | NO       | -                   | Immediate unlock % (0-100) |
| `cliff_duration_seconds`  | integer     | NO       | -                   | Blocking period            |
| `linear_duration_seconds` | integer     | NO       | -                   | Vesting period             |
| `total_allocation`        | numeric     | YES      | -                   | Total tokens               |
| `created_at`              | timestamptz | YES      | `now()`             | -                          |

**Foreign Keys**:

- `round_id` → `launch_rounds.id`

---

#### `vesting_allocations`

**Purpose**: Individual user vesting allocations  
**Size**: 40 kB | **Columns**: 10

| Column             | Type        | Nullable | Default             |
| ------------------ | ----------- | -------- | ------------------- |
| `id`               | uuid        | NO       | `gen_random_uuid()` |
| `schedule_id`      | uuid        | NO       | -                   |
| `round_id`         | uuid        | NO       | -                   |
| `user_id`          | uuid        | NO       | -                   |
| `total_allocation` | numeric     | NO       | -                   |
| `claimed_amount`   | numeric     | YES      | `0`                 |
| `created_at`       | timestamptz | YES      | `now()`             |

**Foreign Keys**:

- `schedule_id` → `vesting_schedules.id`
- `round_id` → `launch_rounds.id`

---

#### `vesting_claims`

**Purpose**: Track individual vesting claim transactions  
**Size**: 64 kB | **Columns**: 12

| Column           | Type        | Nullable | Default             |
| ---------------- | ----------- | -------- | ------------------- |
| `id`             | uuid        | NO       | `gen_random_uuid()` |
| `allocation_id`  | uuid        | NO       | -                   |
| `user_id`        | uuid        | NO       | -                   |
| `claimed_amount` | numeric     | NO       | -                   |
| `tx_hash`        | text        | NO       | -                   |
| `claimed_at`     | timestamptz | YES      | `now()`             |

---

#### `liquidity_locks`

**Purpose**: LP token lock configuration  
**Size**: 48 kB | **Columns**: 16

| Column             | Type        | Nullable | Default             | Notes                |
| ------------------ | ----------- | -------- | ------------------- | -------------------- |
| `id`               | uuid        | NO       | `gen_random_uuid()` | -                    |
| `project_id`       | uuid        | YES      | -                   | FK to projects       |
| `lp_token_address` | text        | NO       | -                   | LP token contract    |
| `amount`           | numeric     | NO       | -                   | Locked amount        |
| `unlock_time`      | timestamptz | NO       | -                   | Unlock timestamp     |
| `status`           | text        | YES      | `'LOCKED'`          | `LOCKED`, `UNLOCKED` |
| `tx_hash`          | text        | YES      | -                   | Lock transaction     |
| `created_at`       | timestamptz | YES      | `now()`             | -                    |

---

### 6. Social-Fi (SelsiFeed)

#### `posts`

**Purpose**: User-generated feed posts  
**Size**: 112 kB | **Columns**: 15

| Column          | Type        | Nullable | Default             | Notes                   |
| --------------- | ----------- | -------- | ------------------- | ----------------------- |
| `id`            | uuid        | NO       | `gen_random_uuid()` | -                       |
| `author_id`     | uuid        | NO       | -                   | FK to profiles          |
| `content`       | text        | NO       | -                   | Post text               |
| `image_urls`    | ARRAY       | YES      | -                   | Media attachments       |
| `is_premium`    | boolean     | YES      | `false`             | Blue Check only         |
| `reply_to_id`   | uuid        | YES      | -                   | Parent post (threading) |
| `repost_of_id`  | uuid        | YES      | -                   | Original post (repost)  |
| `view_count`    | integer     | YES      | `0`                 | View counter            |
| `like_count`    | integer     | YES      | `0`                 | Like counter            |
| `comment_count` | integer     | YES      | `0`                 | Comment counter         |
| `repost_count`  | integer     | YES      | `0`                 | Repost counter          |
| `created_at`    | timestamptz | YES      | `now()`             | -                       |
| `updated_at`    | timestamptz | YES      | `now()`             | -                       |

**Indexes**:

- `idx_posts_author` (on `author_id`)
- `idx_posts_created` (on `created_at DESC`)
- `idx_posts_has_images` (on `id` WHERE `image_urls IS NOT NULL`)

---

#### `post_likes`

**Purpose**: Like interactions on posts  
**Size**: 72 kB | **Columns**: 4

| Column           | Type        | Nullable | Default |
| ---------------- | ----------- | -------- | ------- |
| `post_id`        | uuid        | NO       | -       |
| `user_id`        | uuid        | NO       | -       |
| `created_at`     | timestamptz | YES      | `now()` |
| `wallet_address` | text        | NO       | -       |

**Primary Key**: `(post_id, wallet_address)`  
**Foreign Keys**: `post_id` → `posts.id` (ON DELETE CASCADE)

---

#### `post_comments`

**Purpose**: Comments on posts  
**Size**: 80 kB | **Columns**: 9

| Column           | Type        | Nullable | Default             |
| ---------------- | ----------- | -------- | ------------------- |
| `id`             | uuid        | NO       | `gen_random_uuid()` |
| `post_id`        | uuid        | NO       | -                   |
| `author_id`      | uuid        | NO       | -                   |
| `wallet_address` | text        | NO       | -                   |
| `content`        | text        | NO       | -                   |
| `like_count`     | integer     | YES      | `0`                 |
| `created_at`     | timestamptz | YES      | `now()`             |
| `updated_at`     | timestamptz | YES      | `now()`             |

---

#### `post_reactions`

**Purpose**: Emoji reactions on posts  
**Size**: 96 kB | **Columns**: 5

| Column           | Type        | Nullable | Default |
| ---------------- | ----------- | -------- | ------- |
| `post_id`        | uuid        | NO       | -       |
| `wallet_address` | text        | NO       | -       |
| `emoji`          | text        | NO       | -       |
| `created_at`     | timestamptz | YES      | `now()` |

**Primary Key**: `(post_id, wallet_address, emoji)`

---

#### `user_follows`

**Purpose**: User follow relationships  
**Size**: 48 kB | **Columns**: 4

| Column             | Type        | Nullable | Default |
| ------------------ | ----------- | -------- | ------- |
| `follower_wallet`  | text        | NO       | -       |
| `following_wallet` | text        | NO       | -       |
| `created_at`       | timestamptz | YES      | `now()` |

**Primary Key**: `(follower_wallet, following_wallet)`

---

### 7. AMA System

#### `ama_sessions`

**Purpose**: Developer AMA sessions  
**Size**: 48 kB | **Columns**: 13

| Column              | Type        | Nullable | Default             |
| ------------------- | ----------- | -------- | ------------------- |
| `id`                | uuid        | NO       | `gen_random_uuid()` |
| `project_id`        | uuid        | NO       | -                   |
| `title`             | text        | NO       | -                   |
| `description`       | text        | YES      | -                   |
| `start_time`        | timestamptz | NO       | -                   |
| `end_time`          | timestamptz | NO       | -                   |
| `status`            | text        | YES      | `'SCHEDULED'`       |
| `max_participants`  | integer     | YES      | -                   |
| `participant_count` | integer     | YES      | `0`                 |
| `requires_kyc`      | boolean     | YES      | `false`             |
| `created_at`        | timestamptz | YES      | `now()`             |

**Status Flow**: `SCHEDULED` → `LIVE` → `ENDED`

---

#### `ama_join_tokens`

**Purpose**: Join tokens for AMA access control  
**Size**: 56 kB | **Columns**: 7

| Column       | Type        | Nullable | Default             |
| ------------ | ----------- | -------- | ------------------- |
| `id`         | uuid        | NO       | `gen_random_uuid()` |
| `ama_id`     | uuid        | NO       | -                   |
| `user_id`    | uuid        | NO       | -                   |
| `token`      | text        | NO       | -                   |
| `expires_at` | timestamptz | NO       | -                   |
| `used_at`    | timestamptz | YES      | -                   |
| `created_at` | timestamptz | YES      | `now()`             |

**Unique Constraint**: `token` (unique join link)

---

### 8. Bonding Curve

#### `bonding_pools`

**Purpose**: Solana bonding curve pool configuration  
**Size**: 64 kB | **Columns**: 31

| Column                  | Type    | Nullable | Default             | Notes               |
| ----------------------- | ------- | -------- | ------------------- | ------------------- |
| `id`                    | uuid    | NO       | `gen_random_uuid()` | -                   |
| `project_id`            | uuid    | YES      | -                   | FK to projects      |
| `creator_id`            | uuid    | NO       | -                   | FK to profiles      |
| `token_mint`            | text    | NO       | -                   | SPL token address   |
| `token_name`            | text    | NO       | -                   | -                   |
| `token_symbol`          | text    | NO       | -                   | -                   |
| `initial_price`         | numeric | NO       | -                   | Starting price      |
| `graduation_threshold`  | numeric | NO       | -                   | Migration trigger   |
| `total_supply`          | numeric | NO       | -                   | Max tokens          |
| `reserve_ratio`         | numeric | NO       | -                   | Bonding curve param |
| `status`                | text    | YES      | `'ACTIVE'`          | Pool state          |
| `virtual_sol_reserve`   | numeric | YES      | -                   | Virtual reserves    |
| `virtual_token_reserve` | numeric | YES      | -                   | Virtual reserves    |
| (+ analytics)           | -       | -        | -                   | See full schema     |

**Status Values**: `ACTIVE`, `GRADUATED`, `PAUSED`

---

#### `bonding_swaps`

**Purpose**: Buy/sell transactions on bonding curve  
**Size**: 56 kB | **Columns**: 18

| Column         | Type        | Nullable | Default             |
| -------------- | ----------- | -------- | ------------------- |
| `id`           | uuid        | NO       | `gen_random_uuid()` |
| `pool_id`      | uuid        | NO       | -                   |
| `user_id`      | uuid        | NO       | -                   |
| `swap_type`    | text        | NO       | -                   |
| `sol_amount`   | numeric     | NO       | -                   |
| `token_amount` | numeric     | NO       | -                   |
| `price`        | numeric     | NO       | -                   |
| `tx_signature` | text        | NO       | -                   |
| `created_at`   | timestamptz | YES      | `now()`             |

**Swap Types**: `BUY`, `SELL`

---

### 9. SBT Staking

#### `sbt_stakes`

**Purpose**: Staked SBT positions  
**Size**: 40 kB | **Columns**: 5

| Column          | Type        | Nullable | Default |
| --------------- | ----------- | -------- | ------- |
| `rule_id`       | uuid        | NO       | -       |
| `user_id`       | uuid        | NO       | -       |
| `amount_staked` | numeric     | NO       | -       |
| `staked_at`     | timestamptz | YES      | `now()` |
| `updated_at`    | timestamptz | YES      | `now()` |

**Primary Key**: `(rule_id, user_id)`

---

#### `sbt_rules`

**Purpose**: Staking rule configuration  
**Size**: 24 kB | **Columns**: 8

| Column                  | Type        | Nullable | Default             |
| ----------------------- | ----------- | -------- | ------------------- |
| `id`                    | uuid        | NO       | `gen_random_uuid()` |
| `round_id`              | uuid        | YES      | -                   |
| `required_amount`       | numeric     | NO       | -                   |
| `apy_percent`           | numeric     | YES      | -                   |
| `lock_duration_seconds` | integer     | YES      | -                   |
| `created_at`            | timestamptz | YES      | `now()`             |

---

#### `sbt_claims`

**Purpose**: SBT reward claims  
**Size**: 32 kB | **Columns**: 8

| Column           | Type        | Nullable | Default             |
| ---------------- | ----------- | -------- | ------------------- |
| `id`             | uuid        | NO       | `gen_random_uuid()` |
| `user_id`        | uuid        | NO       | -                   |
| `rule_id`        | uuid        | NO       | -                   |
| `amount_claimed` | numeric     | NO       | -                   |
| `reward_type`    | text        | NO       | -                   |
| `tx_hash`        | text        | YES      | -                   |
| `claimed_at`     | timestamptz | YES      | `now()`             |

---

### 10. Referral System

#### `referral_relationships`

**Purpose**: Referrer-referee mappings  
**Size**: 56 kB | **Columns**: 7

| Column          | Type        | Nullable | Default             |
| --------------- | ----------- | -------- | ------------------- |
| `id`            | uuid        | NO       | `gen_random_uuid()` |
| `referrer_id`   | uuid        | NO       | -                   |
| `referee_id`    | uuid        | NO       | -                   |
| `referral_code` | text        | YES      | -                   |
| `is_active`     | boolean     | YES      | `true`              |
| `created_at`    | timestamptz | YES      | `now()`             |

**Unique Constraint**: `(referrer_id, referee_id)`

---

#### `referral_ledger`

**Purpose**: Referral reward tracking  
**Size**: 56 kB | **Columns**: 12

| Column          | Type        | Nullable | Default             | Notes                |
| --------------- | ----------- | -------- | ------------------- | -------------------- |
| `id`            | uuid        | NO       | `gen_random_uuid()` | -                    |
| `referrer_id`   | uuid        | NO       | -                   | Who gets paid        |
| `referee_id`    | uuid        | NO       | -                   | Who triggered reward |
| `source`        | text        | NO       | -                   | Source type          |
| `source_id`     | uuid        | NO       | -                   | Source record ID     |
| `reward_amount` | numeric     | NO       | -                   | Reward value         |
| `reward_token`  | text        | YES      | `'USDT'`            | Token type           |
| `claimed`       | boolean     | YES      | `false`             | Claim status         |
| `claimed_at`    | timestamptz | YES      | -                   | Claim time           |
| `created_at`    | timestamptz | YES      | `now()`             | -                    |

**Source Types**: `PRESALE`, `FAIRLAUNCH`, `BONDING_CURVE`, `BLUECHECK`

---

### 11. Financial Transactions

#### `transactions`

**Purpose**: General transaction log  
**Size**: 56 kB | **Columns**: 12

| Column       | Type        | Nullable | Default             |
| ------------ | ----------- | -------- | ------------------- |
| `id`         | uuid        | NO       | `gen_random_uuid()` |
| `user_id`    | uuid        | NO       | -                   |
| `tx_type`    | text        | NO       | -                   |
| `amount`     | numeric     | NO       | -                   |
| `token`      | text        | YES      | `'NATIVE'`          |
| `tx_hash`    | text        | NO       | -                   |
| `status`     | text        | YES      | `'PENDING'`         |
| `metadata`   | jsonb       | YES      | `'{}'::jsonb`       |
| `created_at` | timestamptz | YES      | `now()`             |

**TX Types**: `CONTRIBUTION`, `REFUND`, `CLAIM`, `STAKE`, `SWAP`, etc.

---

#### `fee_splits`

**Purpose**: Fee distribution records (Treasury/Referral/SBT)  
**Size**: 40 kB | **Columns**: 11

| Column             | Type        | Nullable | Default             |
| ------------------ | ----------- | -------- | ------------------- |
| `id`               | uuid        | NO       | `gen_random_uuid()` |
| `round_id`         | uuid        | NO       | -                   |
| `total_fees`       | numeric     | NO       | -                   |
| `treasury_amount`  | numeric     | NO       | -                   |
| `referral_amount`  | numeric     | NO       | -                   |
| `sbt_vault_amount` | numeric     | NO       | -                   |
| `split_at`         | timestamptz | YES      | `now()`             |
| `tx_hash`          | text        | YES      | -                   |

---

#### `bluecheck_purchases`

**Purpose**: Blue Check subscription payments  
**Size**: 48 kB | **Columns**: 11

| Column           | Type        | Nullable | Default             |
| ---------------- | ----------- | -------- | ------------------- |
| `id`             | uuid        | NO       | `gen_random_uuid()` |
| `user_id`        | uuid        | NO       | -                   |
| `payment_amount` | numeric     | NO       | -                   |
| `payment_token`  | text        | NO       | -                   |
| `duration_days`  | integer     | NO       | -                   |
| `tx_hash`        | text        | NO       | -                   |
| `is_renewal`     | boolean     | YES      | `false`             |
| `purchased_at`   | timestamptz | YES      | `now()`             |

---

### 12. Admin & Audit

#### `admin_audit_logs`

**Purpose**: Admin action audit trail  
**Size**: 48 kB | **Columns**: 7

| Column           | Type        | Nullable | Default             |
| ---------------- | ----------- | -------- | ------------------- |
| `id`             | uuid        | NO       | `gen_random_uuid()` |
| `actor_admin_id` | uuid        | NO       | -                   |
| `action`         | text        | NO       | -                   |
| `entity_type`    | text        | NO       | -                   |
| `entity_id`      | text        | NO       | -                   |
| `metadata`       | jsonb       | YES      | `'{}'::jsonb`       |
| `created_at`     | timestamptz | YES      | `now()`             |

**Indexes**:

- `idx_admin_logs_actor` (on `actor_admin_id`)
- `idx_admin_logs_action` (on `action`)
- `idx_admin_logs_entity` (on `entity_type, entity_id`)
- `idx_admin_logs_created` (on `created_at DESC`)

---

#### `audit_logs`

**Purpose**: General system audit trail  
**Size**: 40 kB | **Columns**: 11

| Column        | Type        | Nullable | Default             |
| ------------- | ----------- | -------- | ------------------- |
| `id`          | uuid        | NO       | `gen_random_uuid()` |
| `actor_id`    | text        | YES      | -                   |
| `action`      | text        | NO       | -                   |
| `entity_type` | text        | YES      | -                   |
| `entity_id`   | text        | YES      | -                   |
| `changes`     | jsonb       | YES      | -                   |
| `ip_address`  | text        | YES      | -                   |
| `user_agent`  | text        | YES      | -                   |
| `created_at`  | timestamptz | YES      | `now()`             |

---

#### `template_audits`

**Purpose**: Audit records for template-based deployments  
**Size**: 48 kB | **Columns**: 13

| Column             | Type        | Nullable | Default             |
| ------------------ | ----------- | -------- | ------------------- |
| `id`               | uuid        | NO       | `gen_random_uuid()` |
| `template_name`    | text        | NO       | -                   |
| `template_version` | text        | NO       | -                   |
| `audited_by`       | text        | NO       | -                   |
| `audit_report_url` | text        | YES      | -                   |
| `security_score`   | numeric     | YES      | -                   |
| `status`           | text        | YES      | `'VALID'`           |
| `audited_at`       | timestamptz | YES      | `now()`             |

---

### 13. Trending & Analytics

#### `trending_snapshots`

**Purpose**: Daily trending snapshot triggers  
**Size**: 24 kB | **Columns**: 5

| Column          | Type        | Nullable | Default             |
| --------------- | ----------- | -------- | ------------------- |
| `id`            | uuid        | NO       | `gen_random_uuid()` |
| `snapshot_date` | date        | NO       | -                   |
| `created_at`    | timestamptz | YES      | `now()`             |

**Unique Constraint**: `snapshot_date`

---

#### `trending_projects`

**Purpose**: Trending project rankings  
**Size**: 40 kB | **Columns**: 10

| Column               | Type        | Nullable | Default             |
| -------------------- | ----------- | -------- | ------------------- |
| `id`                 | uuid        | NO       | `gen_random_uuid()` |
| `snapshot_id`        | uuid        | NO       | -                   |
| `project_id`         | uuid        | NO       | -                   |
| `rank`               | integer     | NO       | -                   |
| `score`              | numeric     | NO       | -                   |
| `view_count`         | integer     | YES      | `0`                 |
| `contribution_count` | integer     | YES      | `0`                 |
| `created_at`         | timestamptz | YES      | `now()`             |

---

## Database Statistics

| Metric                        | Value                        |
| ----------------------------- | ---------------------------- |
| **Total Tables**              | 46                           |
| **Total Database Size**       | ~3.2 MB                      |
| **Largest Table**             | `auth_sessions` (160 kB)     |
| **Most Columns**              | `bonding_pools` (31 columns) |
| **Foreign Key Relationships** | 50+                          |
| **Indexes**                   | 150+                         |

### Tables by Module

| Module            | Table Count | Total Size |
| ----------------- | ----------- | ---------- |
| Social-Fi         | 6           | ~500 kB    |
| Launchpad         | 8           | ~600 kB    |
| Authentication    | 3           | ~310 kB    |
| Profiles & Badges | 3           | ~360 kB    |
| Bonding Curve     | 3           | ~160 kB    |
| Vesting           | 3           | ~160 kB    |
| Referral          | 2           | ~110 kB    |
| Projects          | 4           | ~310 kB    |
| Admin & Audit     | 3           | ~140 kB    |
| Other             | 11          | ~650 kB    |

---

## Key Design Decisions

### 1. Wallet-Only Authentication

- No traditional email/password auth
- Multi-chain support (EVM + Solana)
- Session tokens tied to wallet signatures
- Direct `wallet_id` reference in `auth_sessions`

### 2. Flexible Badge System

- Dual-scope badges (USER and PROJECT)
- System-managed badges (Blue Check, KYC)
- User-awarded badges (community rewards)
- Expirable badges for subscriptions

### 3. Comprehensive Referral Tracking

- Multi-source rewards (Presale, Fairlaunch, Bonding Curve, Blue Check)
- Claim gating via Blue Check status
- Full audit trail in `referral_ledger`

### 4. Presale v2.1.1 Security

- Server-side Merkle proof generation (`presale_merkle_proofs`)
- Allocation stored as TEXT (precision-safe)
- Contract addresses stored in `launch_rounds`
- Finalization tracking with `finalized_at` timestamp

### 5. Social-Fi Engagement

- High-velocity interactions (likes, comments, reposts)
- Direct wallet-based actions (no user_id dependency)
- View counting for analytics
- Image upload support (array storage)

### 6. Financial Transaction Safety

- All amounts stored as `NUMERIC` (arbitrary precision)
- Transaction hashes for blockchain verification
- Status tracking (`PENDING`, `COMPLETED`, `FAILED`)
- Metadata JSONB for extensibility

---

## Maintenance Notes

### Indexes to Monitor

- `idx_posts_created` - High write volume on social feed
- `idx_auth_sessions_token` - Session lookup performance
- `idx_contributions_round` - Round aggregation queries

### Cleanup Recommendations

1. **Expired Sessions**: Regular cleanup of `auth_sessions` WHERE `expires_at < NOW()`
2. **Used Nonces**: Archive/delete old `wallet_link_nonces` WHERE `used = true` AND `expires_at < NOW()`
3. **Old AMA Join Tokens**: Cleanup `ama_join_tokens` WHERE `expires_at < NOW()`

### RLS Policies

Most tables have Row Level Security (RLS) policies enabled. Notable patterns:

- Public read for feed content (`posts`, `comments`)
- User-scoped write for contributions
- Admin-only access for audit logs
- Service role for indexer writes

---

**Generated:** 2026-01-21 via Supabase MCP  
**Last Schema Migration:** `20260121193337_launch_rounds_presale_fields.sql`
