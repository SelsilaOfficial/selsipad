# Finalize & Fee Verification — Debug Session (2026-02-06)

## Context
Pada saat menjalankan E2E test Fairlaunch, proses `finalize()` terlihat **sukses** (TX confirmed, status `SUCCESS`), tetapi bagian **Fee Distribution Check** menampilkan:

- `Expected fee (5%): 0.006 BNB`
- `Fee received: 0.0 BNB`
- `Match: ❌`

Ini memunculkan pertanyaan: *apakah fee benar-benar terkirim atau ada bug?*

Dokumen ini merangkum investigasi berbasis **runtime evidence**, perubahan yang dikerjakan, serta hasil verifikasi akhir.

## Environment & Artefacts
- **Network**: BSC Testnet (chainId `97`)
- **Script**: `packages/contracts/scripts/e2e-test-fairlaunch.js`
- **Contracts (deployment yang dipakai oleh E2E)**:
  - **FairlaunchFactory**: `0x12c426d52B936c799ea3b1c28d0979d4CDbCB05E`
  - **FeeSplitter**: `0x985B7FEEcADB5660Afb569b158204945421c47b0`
  - **LPLocker**: `0xD492CbD76150C805bF6b6f6D674827e27981eD63`
- **Log runtime (debug-mode NDJSON)**: `.cursor/debug.log`

## Symptoms (Before Fix)
E2E run menunjukkan finalize sukses, namun fee check gagal karena metode cek:

- Script mengecek **delta saldo native di alamat `FeeSplitter`**:
  - `feeReceived = balance(FeeSplitter)_after - balance(FeeSplitter)_before`
- Hasilnya sering `0`, walaupun fee mungkin **langsung diteruskan** ke vault (saldo FeeSplitter tidak “menetap”).

## Hypotheses
H1. **Fee memang terkirim, tapi langsung di-forward** oleh `FeeSplitter` ke vault di dalam transaksi `finalize()`, sehingga saldo `FeeSplitter` tetap ~0.

H2. `FeeSplitter` address yang dipakai Fairlaunch berbeda dari yang dicek script, sehingga delta balance salah alamat.

H3. Fee dibayarkan bukan sebagai saldo `FeeSplitter` (misalnya: dibayar token ERC20 / dipotong di jalur lain), sehingga saldo native `FeeSplitter` memang tidak berubah.

## Instrumentation Added (Runtime Evidence)
Untuk membuktikan/menolak hipotesis di atas, ditambahkan instrumentation kecil (dibungkus region) ke:

- `packages/contracts/scripts/e2e-test-fairlaunch.js`

Instrumentation merekam:
- address `feeSplitter`, `treasuryVault`, `referralPoolVault`, `sbtStakingVault`
- saldo vault sebelum/sesudah `finalize()`
- event `FeeCollected` dan `FeeSplit` dari `FeeSplitter` yang muncul di `finalizeReceipt.logs`

## Runtime Evidence (CONFIRMED)
Hasil run instrumented menunjukkan:

### 1) Fairlaunch benar memanggil FeeSplitter dan fee terkirim
Dari `.cursor/debug.log` (runId `post-fix`, entry `receipt-events`):
- `FeeCollected totalAmount = 6000000000000000` (0.006 BNB)
- `FeeSplit` events = 3 event:
  - 0.003 BNB (bps 250)
  - 0.0024 BNB (bps 200)
  - 0.0006 BNB (bps 50)

Total `FeeSplit sum` = 0.006 BNB, **match** dengan `Expected fee`.

### 2) Kenapa saldo FeeSplitter tetap 0?
`FeeSplitter` contract memang melakukan transfer ke vault pada saat distribusi:

- `FeeSplitter.distributeFairlaunchFee()` → `_distributeFee()` → `_transferNative(vault, amount)`

Karena dana **masuk lalu langsung keluar** di transaksi yang sama, delta saldo `FeeSplitter` bisa **0**, walaupun fee sukses terdistribusi.

Ini mengkonfirmasi H1 dan menolak H2/H3 sebagai penyebab utama mismatch.

## Root Cause
**Bug-nya ada di script verifikasi**, bukan di proses finalize:

- Verifikasi fee menggunakan **saldo `FeeSplitter`** sebagai indikator, padahal `FeeSplitter` **bukan vault penampung**, melainkan *router* yang langsung membagi fee ke vault.

Akibatnya, script bisa menampilkan `Fee received: 0.0` walaupun fee sukses dikirim.

## Fix Implemented
File yang diubah:
- `packages/contracts/scripts/e2e-test-fairlaunch.js`

Perubahan utama:
- Fee verification diubah menjadi berbasis **event**:
  - parse `FeeCollected` untuk total fee yang diterima
  - parse `FeeSplit` untuk memastikan pembagian sesuai
  - status akhir: **Match (by events)**
- Output E2E disesuaikan:
  - tetap menampilkan `FeeSplitter balance delta` (sebagai info)
  - menambahkan `FeeCollected event`, `FeeSplit sum`, dan `Match (by events)`
  - summary menampilkan `✅ Fee distributed (verified by events)` jika match

Catatan:
- Di deployment yang dipakai saat debug, ketiga vault (`treasury/referral/sbt`) dikonfigurasi ke **alamat yang sama** (`0x95D9...`). Ini membuat “delta per vault” terlihat identik (karena sama address), tetapi event `FeeSplit` tetap membuktikan komponen split-nya benar.

## Verification (Post-Fix)
E2E post-fix menghasilkan:
- `FeeSplitter balance delta: 0.0 BNB` (expected, karena forward)
- `FeeCollected event: 0.006 BNB`
- `FeeSplit sum: 0.006 BNB`
- **`Match (by events): ✅`**

Runtime evidence di `.cursor/debug.log` (runId `post-fix`) konsisten dengan output terminal dan menunjukkan event `FeeCollected/FeeSplit` lengkap.

## Final Status
- **Finalize**: ✅ sukses (status `SUCCESS (3)`)
- **Fee distribution**: ✅ sukses (terverifikasi via `FeeCollected/FeeSplit`)
- **Mismatched check**: ✅ diperbaiki (script sekarang memverifikasi dengan metode yang benar)

## Follow-ups (Optional)
- Jika nanti vault dibuat berbeda address (treasury/referral/sbt), bisa tambah assert tambahan:
  - `delta(treasury)+delta(referral)+delta(sbt) == expectedFee` (dengan address berbeda, delta jadi meaningful)
- Setelah dokumentasi ini disimpan dan verifikasi selesai, instrumentation debug dapat dihapus untuk merapikan script (tidak urgent).

