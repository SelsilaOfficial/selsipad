## Task List — Menutup Gap E2E Auth + Referral + Rewards + Blue Check

Tanggal: 2026-02-05  
Repo: `selsipad`  
Goal: bikin flow **benar-benar E2E** untuk user wallet-login → referral apply → qualifying event → reward accrue → claim payout (dengan gate Blue Check).

Konteks report: lihat `.cursor/auth_referral_bluecheck_e2e_report.md`.

---

### P0 (Blocker) — bikin flow end-to-end “jalan”

- **P0.1 Unify authentication untuk semua endpoint “user-facing”**
  - **Problem**: campur Supabase Auth (`supabase.auth.getUser()`) vs wallet-only cookie `session_token` (`auth_sessions`).
  - **Change**:
    - Standarkan semua route referral + bluecheck (yang untuk user) untuk memakai `getServerSession()` (`apps/web/src/lib/auth/session.ts`) + cookie.
    - Hapus dependensi `supabase.auth.getUser()` di:
      - `apps/web/app/api/v1/referral/*` (activate, rewards, claim, claims, stats, claim-requirements)
      - `apps/web/app/api/v1/bluecheck/status` (kalau ada yang pakai supabase auth)
      - (opsional) `apps/web/app/api/auth/verify` kalau masih dipertahankan.
  - **Acceptance**:
    - Login via `/api/auth/wallet` → bisa panggil semua endpoint referral tanpa 401.

- **P0.2 Fix session endpoint response shape untuk UI**
  - **Problem**: `MultiChainConnectWallet.tsx` expect `data.user.address`, tapi `GET /api/auth/session` mengembalikan `{address,...}`.
  - **Change**:
    - Update `apps/web/app/api/auth/session/route.ts` agar mengembalikan:
      - `{ authenticated: true, user: { id, address, chain } }`
      - atau adjust UI supaya baca top-level.
  - **Acceptance**:
    - Reload page setelah login tetap “Signed In” (UI state tidak regress).

- **P0.3 Wiring referral dari link `?ref=CODE` → apply activation**
  - **Problem**: share link ada, tapi tidak ada code yang membaca query param & memanggil activate.
  - **Change (recommended minimal)**:
    - Di entrypoint setelah login sukses (atau saat load session), baca query param `ref`.
    - Panggil `POST /api/v1/referral/activate` dengan code tsb.
    - Simpan marker (localStorage/cookie) supaya hanya sekali dan tidak spam.
  - **Acceptance**:
    - Buka `/?ref=XXXX` → login wallet → tercipta `referral_relationships` untuk user itu.

- **P0.4 Fix worker table mismatch `launch_contributions` → `contributions`**
  - **Problem**: worker job refer ke tabel yang tidak ada.
  - **Change**:
    - `services/worker/jobs/referral-activator.ts`: ganti `.from('launch_contributions')` ke `.from('contributions')` + pastikan kolom yang di-select match schema (`id,user_id,amount,created_at,status`).
    - `services/worker/jobs/reward-distributor.ts`: ganti lookup contribution untuk source PRESALE/FAIRLAUNCH dari `launch_contributions` ke `contributions`.
  - **Acceptance**:
    - Setelah ada `fee_splits` untuk contribution, worker berhasil bikin `referral_ledger`.

- **P0.5 Perbaiki schema + code untuk `fee_splits` supaya mendukung bonding (50/50)**
  - **Problem**:
    - `fee_splits` punya CHECK hard-coded 70/30 → bonding (50/50) gagal.
    - `source_type` mismatch (schema expect `BONDING`, code pakai `BONDING_SWAP`).
  - **Change**:
    - Opsi A (paling aman): ubah schema `fee_splits`:
      - hapus CHECK 70/30
      - tambahkan `treasury_bps` dan `referral_bps` (atau `treasury_percent`, `referral_percent`)
      - enforce `treasury_amount + referral_pool_amount = total_amount` + `bps` match amounts.
    - Samakan `source_type` enum/check ke nilai yang benar: `BONDING` atau adopsi `BONDING_SWAP` tapi konsisten di:
      - `apps/web/app/api/v1/bonding/[pool_id]/swap/confirm/route.ts`
      - `apps/web/src/actions/referral/record-contribution.ts`
      - `services/worker/jobs/reward-distributor.ts`
  - **Acceptance**:
    - Insert bonding fee_splits sukses (50/50) dan reward ledger terbentuk.

- **P0.6 Referral claim: stop “mock tx hash” & implement payout real (minimal Tx Manager integration)**
  - **Problem**: claim endpoint hanya mark CLAIMED tanpa transfer.
  - **Change**:
    - Tentukan mekanisme payout:
      - **Server-side tx manager / relayer** (service wallet) untuk transfer asset native/ERC20.
      - atau **client-side claim** (user wallet sign tx) → server only validates & marks.
    - Implement minimal:
      - create payout tx → persist tx hash → mark ledger CLAIMED hanya setelah tx broadcast (atau confirmed).
  - **Acceptance**:
    - Claim menghasilkan tx hash valid dan dana benar-benar pindah.

- **P0.7 Fix “primary wallet” resolution untuk payout**
  - **Problem**: claim endpoint membaca `profiles.primary_wallet` (tidak ada).
  - **Change**:
    - Pakai function `get_primary_wallet(p_user_id)` dari `supabase/migrations/20260121210000_enforce_evm_primary.sql`, atau query `wallets` yang `is_primary=true` untuk chain yang sesuai.
    - Pastikan EVM primary invariant sesuai migration enforce.
  - **Acceptance**:
    - Payout always dikirim ke wallet primary yang benar (EVM/Solana sesuai chain reward).

---

### P1 (High value) — rapihin konsistensi & mengurangi tech debt yang bikin drift

- **P1.1 Satu jalur Blue Check purchase (pilih salah satu sebagai source-of-truth)**
  - **Problem**: ada jalur `v1/bluecheck/buy/*` vs jalur on-chain hook + `/api/bluecheck/verify-purchase`.
  - **Change**:
    - Pilih:
      - (A) “on-chain first”: UI beli on-chain, server verify receipt + update DB + fee_splits.
      - (B) “server intent/confirm”: server create intent, UI submit tx hash, worker verify.
    - Deprecate yang tidak dipakai.

- **P1.2 Fix `/api/bluecheck/verify-purchase` schema mismatch**
  - **Problem**: query `wallets.profile_id`/`wallets.network` tidak sesuai migrations (`wallets.user_id`, `wallets.chain`).
  - **Change**:
    - Update endpoint agar lookup wallet by address+chain, lalu update `profiles` by `user_id`.

- **P1.3 Konsolidasi Rewards page (hapus dead/legacy page)**
  - **Problem**: ada `apps/web/app/rewards/page.tsx` (aktif) dan `apps/web/src/app/rewards/page.tsx` (legacy, stub).
  - **Change**:
    - Hapus/relokasi legacy atau pastikan routing tidak pernah mengarah ke stub.

- **P1.4 Referral stats correctness**
  - **Problem**: server action `apps/web/src/actions/referral/get-stats.ts` mismatch kolom ledger (`reward_amount/source/claimed` vs `amount/source_type/status`).
  - **Change**:
    - Update query & aggregator sesuai schema.

---

### P2 (Nice-to-have / hardening) — produksi-ready

- **P2.1 Idempotency & anti-fraud**
  - Rate-limit apply referral dan claim.
  - Dedup `fee_splits` by unique constraint `(source_type,source_id)` + enforce (sebagian sudah ada via error “duplicate” handling).

- **P2.2 Observability**
  - Tambah structured logs untuk worker dan API claim/purchase.
  - Dashboard admin: lihat “fee_splits pending”, “ledger created”, “claims processed”.

- **P2.3 RLS & permissions audit**
  - Validasi policy `auth_sessions` (saat ini “System can manage sessions” menggunakan `USING (true)` — pastikan hanya service_role yang bisa write via grants).

---

### Quick “Definition of Done” untuk E2E

- User A punya referral link `?ref=A_CODE`.
- User B klik link → login wallet → referral relationship tersimpan.
- User B melakukan qualifying event (contribution / bonding / bluecheck) → `fee_splits` tercatat.
- Worker memproses → `referral_ledger` untuk User A bertambah (CLAIMABLE).
- User A (Blue Check ACTIVE + active_referral_count memenuhi threshold) → claim → payout benar-benar terjadi ke primary wallet.

