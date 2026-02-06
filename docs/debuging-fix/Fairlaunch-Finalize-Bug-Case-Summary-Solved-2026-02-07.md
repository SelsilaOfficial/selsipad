# Fairlaunch Finalize Bug – Case Summary & Resolution

**Tanggal:** 2026-02-07  
**Contract (contoh):** `0xd1c2361712cAC445b880332D2E86997d4f9c2436` (BSC Testnet, chain 97)  
**Status:** ✅ Solved

---

## 1. Gejala (Problem)

- **UI:** Project fairlaunch tampil **ended** (waktu sudah lewat `end_at`).
- **Admin:** Klik **Finalize** di admin dashboard → transaksi **revert** dengan pesan:  
  `"Finalize failed: Contract finalization failed: transaction execution reverted"`.
- **On-chain:** Status kontrak masih **LIVE** (belum ENDED) dari sudut pandang kontrak, atau revert terjadi **di dalam** `finalize()` (bukan di pengecekan status).

---

## 2. Root Cause (Penyebab)

Dua penyebab utama yang teridentifikasi:

### 2.1 LP Locker belum di-set di kontrak

- `finalize()` di `Fairlaunch.sol` membutuhkan **LP Locker** yang sudah dikonfigurasi (`require(address(lpLocker) != address(0), "LP Locker not configured")`).
- Kontrak yang di-deploy (termasuk via factory) **tidak otomatis** set LP Locker jika:
  - Deploy dilakukan dengan wallet yang **bukan** factory’s **adminExecutor**, sehingga panggilan `setLPLocker()` gagal atau tidak dilakukan, atau
  - Flow deploy lama tidak memanggil `setLPLocker()` setelah deploy.

### 2.2 Wallet admin bukan factory’s adminExecutor

- Di factory, hanya **adminExecutor** (alamat yang di-set saat factory di-deploy) yang mendapat **ADMIN_ROLE** pada setiap Fairlaunch yang dibuat.
- `setLPLocker()` dan operasi admin lain hanya bisa dipanggil oleh wallet dengan **ADMIN_ROLE**.
- Jika `DEPLOYER_PRIVATE_KEY` di backend **bukan** private key dari **factory’s adminExecutor**, maka:
  - Set LP Locker dari backend **gagal** (Admin wallet does not have ADMIN_ROLE on contract).
  - Finalize pun harus memakai wallet yang punya ADMIN_ROLE (biasanya adminExecutor yang sama).

---

## 3. Yang Sudah Dikerjakan (Solusi)

### 3.1 Pre-check LP Locker di action finalize

- **File:** `apps/web/src/actions/admin/finalize-fairlaunch.ts`
- Sebelum memanggil `finalize()` on-chain, backend memanggil **`lpLockerAddress()`**.
- Jika hasilnya `address(0)` → **tidak** mengirim tx, dan mengembalikan error jelas:  
  *"LP Locker not configured on contract. Admin must call setLPLocker() first (e.g. via API POST /api/admin/fairlaunch/setup-lp-locker with contract_address in body)."*
- Dengan ini, user tidak dapat “tanpa sengaja” kirim tx finalize yang pasti revert.

### 3.2 Time guard (waktu chain vs endTime)

- Di file yang sama, sebelum panggil `finalize()`:
  - Dibaca **block timestamp** dan **endTime** dari kontrak.
  - Hanya jika **block time ≥ endTime** maka `finalize()` dipanggil.
  - Jika belum: return error dengan pesan “Sale has not ended on-chain yet” dan perkiraan “try again in ~X minutes”.
- Menghindari finalize terlalu awal karena perbedaan waktu (UI/DB vs chain).

### 3.3 API Setup LP Locker + penjelasan adminExecutor

- **Endpoint:** `POST /api/admin/fairlaunch/setup-lp-locker`  
  Body: `{ "roundId", "contractAddress" }`.
- Menggunakan **DEPLOYER_PRIVATE_KEY** untuk memanggil **`setLPLocker(lpLockerAddress)`** pada kontrak Fairlaunch.
- Jika wallet **tidak** punya **ADMIN_ROLE**:
  - API membaca **factory’s adminExecutor** (dari factory yang dipakai untuk chain tersebut).
  - Response 403 berisi pesan jelas: wallet saat ini bukan adminExecutor, dan menyarankan set **DEPLOYER_PRIVATE_KEY** ke private key **factory’s adminExecutor**.
- Referensi LP Locker diambil dari `packages/contracts/deployments/lplocker.json`.

### 3.4 Alur “Setup LP Locker” dari UI

- **File:** `apps/web/app/admin/fairlaunch/page.tsx`
- Saat finalize gagal dengan error **"LP Locker not configured"** dan response menyertakan **contractAddress**:
  - Muncul konfirmasi: *"LP Locker is not set on this contract. Set it now with admin wallet? (Then click Finalize again.)"*
  - Jika user setuju → frontend memanggil **POST /api/admin/fairlaunch/setup-lp-locker** dengan `roundId` dan `contractAddress`.
  - Jika sukses → alert “LP Locker configured. Click Finalize again to complete.” dan list di-refresh.
  - User lalu klik **Finalize** lagi → finalize on-chain dijalankan (karena LP Locker sudah ter-set).

### 3.5 Konfigurasi env (adminExecutor)

- **File:** `apps/web/.env.local` (atau env yang dipakai deploy/backend).
- **DEPLOYER_PRIVATE_KEY** harus di-set ke **private key wallet yang merupakan factory’s adminExecutor** (alamat yang punya ADMIN_ROLE pada Fairlaunch yang dibuat factory tersebut).
- Untuk BSC Testnet, factory adminExecutor bisa dicek on-chain (e.g. `FairlaunchFactory.adminExecutor()`). Setelah diganti, Setup LP Locker dan Finalize berjalan sukses.

### 3.6 Logging & error decode

- Di `finalize-fairlaunch.ts`, jika panggilan kontrak gagal:
  - Log lengkap (termasuk `data` revert) dan decode custom error (FeeSplitterCallFailed, DexAddLiquidityCallFailed, LPLockerCallFailed, InvalidStatus) agar penyebab revert bisa dibaca di log server.

---

## 4. Verifikasi

### 4.1 Finalize sukses (runtime)

- Setelah:
  1. Set **DEPLOYER_PRIVATE_KEY** = private key factory’s adminExecutor,
  2. Memanggil Setup LP Locker (dari UI atau API) untuk round tersebut,
  3. Klik **Finalize** lagi,
- Log server menampilkan:
  - `[finalizeFairlaunch] Calling finalize() on contract...`
  - `[finalizeFairlaunch] Transaction sent: 0x...`
  - `[finalizeFairlaunch] Transaction confirmed in block: ...`
- UI menampilkan: **"Fairlaunch finalized!"** dengan contract address dan chain.

### 4.2 FeeSplitter & DEX Router

- Script: `packages/contracts/scripts/check-fee-router.js` (target: Fairlaunch `0xd1c23...`).
- Hasil (BSC Testnet):
  - **FeeSplitter:** `0x141fd4e368FAE882640Ca7612EF12778cF985645` – kontrak valid ✅
  - **DEX Router:** `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` – sesuai PancakeSwap V2 Testnet ✅
- Finalize (termasuk distribusi fee dan add liquidity) memakai konfigurasi yang benar.

---

## 5. Untuk Project Fairlaunch Berikutnya

| Skenario | Bisa finalize? | Catatan |
|----------|----------------|--------|
| **Fairlaunch baru** (deploy setelah DEPLOYER_PRIVATE_KEY = adminExecutor) | ✅ Ya | Deploy route otomatis panggil `setLPLocker()` setelah deploy; admin bisa langsung finalize saat round ended. |
| **Fairlaunch lama** (LP Locker belum pernah di-set) | ✅ Ya, dengan satu kali setup | Saat finalize, muncul error “LP Locker not configured” → pilih “Set it now?” → Setup LP Locker sukses → klik Finalize lagi. |

---

## 6. File & Referensi Penting

| Item | Path / Nilai |
|------|------------------|
| Action finalize (pre-check, time guard, finalize on-chain) | `apps/web/src/actions/admin/finalize-fairlaunch.ts` |
| API Setup LP Locker | `apps/web/app/api/admin/fairlaunch/setup-lp-locker/route.ts` |
| UI flow “Set LP Locker” + Finalize | `apps/web/app/admin/fairlaunch/page.tsx` |
| Kontrak Fairlaunch (finalize, LP Locker, router) | `packages/contracts/contracts/fairlaunch/Fairlaunch.sol` |
| Factory (adminExecutor, feeSplitter) | `packages/contracts/contracts/fairlaunch/FairlaunchFactory.sol` |
| Script cek FeeSplitter + Router | `packages/contracts/scripts/check-fee-router.js` |
| BSC Testnet DEX Router (PancakeSwap V2) | `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` |
| LP Locker deployment | `packages/contracts/deployments/lplocker.json` |

---

## 7. Ringkasan Singkat

- **Masalah:** Finalize revert karena LP Locker belum di-set dan/atau wallet backend bukan factory’s adminExecutor.
- **Solusi:** Pre-check LP Locker & waktu di finalize, API + UI untuk Setup LP Locker, dan pastikan **DEPLOYER_PRIVATE_KEY** = factory’s adminExecutor. Fairlaunch baru dari deploy route akan dapat LP Locker otomatis; fairlaunch lama cukup sekali Setup LP Locker lalu Finalize lagi.
- **Verifikasi:** Finalize on-chain sukses; FeeSplitter dan DEX router untuk kontrak contoh sudah dicek dan benar.
