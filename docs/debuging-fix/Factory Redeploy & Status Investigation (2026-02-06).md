# Factory Redeploy & Status Investigation (2026-02-06)

## Scope
Dokumen ini merangkum:
- Deploy “infrastructure” Fairlaunch terbaru (FeeSplitter, LPLocker, FairlaunchFactory) di **BSC Testnet**
- Validasi bahwa **DEX Router sudah benar** (router bukan root cause)
- Investigasi kasus “status stuck LIVE / finalize revert” berdasarkan **bukti on-chain**

> Catatan: Dokumen ini melengkapi dokumen fee/finalize verification:
> `docs/debuging-fix/Finalize Fee Verification Debug Session (2026-02-06).md`

---

## A) Deploy Factory Baru (Infrastructure Deploy)
Deploy dijalankan dari `packages/contracts` menggunakan script:
- `scripts/fairlaunch/deploy-complete.js`

### Output deploy (BSC Testnet)
Kontrak yang ter-deploy dan dipakai untuk E2E:
- **FeeSplitter**: `0x985B7FEEcADB5660Afb569b158204945421c47b0`
- **LPLocker**: `0xD492CbD76150C805bF6b6f6D674827e27981eD63`
- **FairlaunchFactory**: `0x12c426d52B936c799ea3b1c28d0979d4CDbCB05E`

Script juga melakukan verify ke explorer dan menyimpan deployment info:
- `packages/contracts/deployments/fairlaunch-bscTestnet-1770344893086.json`
- `packages/contracts/deployments/fairlaunch-factory-latest.json` (pointer latest)

### Konfigurasi penting saat deploy
Dari output deploy:
- Treasury / Referral Pool / SBT Staking: diarahkan ke alamat deployer (sementara) untuk testnet.
- Admin Executor: `0x178cf582e811B30205CBF4Bb7bE45A9dF31AaC4A`

---

## B) Validasi Router: “Router bukan masalah”
Validasi dilakukan dengan E2E finalize dan/atau status check:
- Router yang digunakan Fairlaunch di **chainId 97** harus:
  - `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` (PancakeSwap V2 testnet)

Bukti runtime:
- E2E test menampilkan **DEX Router Check Match ✅** (router sesuai expected).

Kesimpulan:
- “Router fix” **sudah benar** untuk testnet. Jika `finalize()` revert, cari root cause lain (status / cancel / timing / role / LP locker).

---

## C) Kasus “Finalize REVERT / Status aneh” — Bukti On-chain

### Contract yang dicek
Fairlaunch: `0xDFdD5776678723aBe96651A83Fcb0F93d632Ff3D`

Hasil status check on-chain (script: `scripts/fairlaunch/check-status.ts`):
- **Stored Status**: `CANCELLED (5)`
- **Dynamic Status (`getStatus`)**: `CANCELLED (5)`
- `startTime`: `2026-02-06T01:15:00.000Z`
- `endTime`: `2026-02-06T01:20:00.000Z`
- `current chain time`: `2026-02-06T03:22:35.000Z` → sudah lewat endTime
- `totalRaised`: 1.0 BNB, `softcap`: 1.0 BNB (met)
- `lpLocker`: set
- `isFinalized`: false

### Implikasi
Karena status **CANCELLED**, finalize **tidak mungkin** sukses (akan kena `InvalidStatus` / revert).
Jadi untuk address ini, masalahnya **bukan** “_updateStatus() tidak jalan”, melainkan **pool sudah di-cancel**.

### Bukti transaksi cancel
Event search `Cancelled()` (script: `scripts/fairlaunch/find-cancelled-tx.ts`) menemukan:
- **Tx hash**: `0x8102c80554c9e6f01fdb2f6666f480a8aef686387ea138211fb54ee56b664c9e`
- **Block time**: `2026-02-06T02:55:25.000Z`
- **From**: `0x95D94D86CfC550897d2b80672a3c94c12429a90D`

### Kesimpulan “solusi”
- Untuk pool yang sudah **CANCELLED**: tidak ada opsi finalize; solusinya **buat pool baru** (dan jangan cancel).
- Untuk kasus yang benar-benar “stuck LIVE padahal endTime lewat”: diagnosis harus pakai:
  - `getStatus()` (dynamic) dan `block.timestamp` latest, bukan waktu lokal.
  - memastikan unit time input (seconds vs ms) pada create params.

---

## D) Files / Updates yang dilakukan dalam sesi ini (yang relevan)
Kontribusi sesi debug ini (yang langsung terkait factory/finalize/status):
- `packages/contracts/scripts/e2e-test-fairlaunch.js`
  - instrumentasi runtime log
  - perbaikan verifikasi fee (basis event `FeeCollected/FeeSplit`)
- `packages/contracts/scripts/fairlaunch/find-cancelled-tx.ts`
  - helper untuk mencari tx yang emit event `Cancelled()`
- `docs/debuging-fix/Finalize Fee Verification Debug Session (2026-02-06).md`
  - dokumen debug finalize + fee verification berbasis runtime evidence
- `docs/debuging-fix/Factory Redeploy & Status Investigation (2026-02-06).md`
  - dokumen ini

> Catatan repo: ada banyak perubahan lain (frontend + artifacts) di branch ini di luar scope dokumen ini; daftar diambil dari `git diff --name-only` / `git diff --stat`.

