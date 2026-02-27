# Bonding Curve — Summary Report

**Date**: 2026-02-26  
**Status**: ✅ Testnet Complete — Ready for Mainnet Deploy

---

## 1. Architecture Overview

```
User → Frontend (Next.js) → Smart Contract (BSC) → PancakeSwap V2
                ↓                      ↓
           Supabase DB  ←  Indexer EVM (event listener)
```

### Smart Contracts
| Contract | Address (BSC Testnet) | Purpose |
|----------|----------------------|---------|
| `SelsipadBondingCurveFactory` | `0x8572CF00E6a91D54cEAF009bd4cbbEC8CCA41F4b` | Factory + bonding curve trading + auto-migration |
| `SelsipadBCToken` | Per-token deploy | ERC-20 token (1B supply, pre-minted to factory) |
| BlueCheck | `0xfFaB42eC...` (testnet) / `0xC14CdFE7...` (mainnet) | Badge purchase + referral |

### Curve Parameters
| Parameter | Value |
|-----------|-------|
| Virtual ETH Reserve | 30 BNB |
| Virtual Token Reserve | 1B tokens |
| Trading Reserve | 800M tokens |
| Migration Reserve | 200M tokens (for DEX LP) |
| Trade Fee | 1.5% |
| Referral Fee | 0.75% (half of trade fee) |
| Create Fee | 0.05 BNB |
| Migration Threshold | 1 BNB (testnet) |
| LP Lock | Burned to `0x...dEaD` (permanent) |

---

## 2. Features Implemented (This Session)

### 2.1 Explore Page Integration
- **Files**: `projects.ts`, `page.tsx`, `ExploreProjectCard.tsx`, `ExploreClientContent.tsx`
- Bonding curve tokens displayed alongside presale/fairlaunch projects
- Merged data fetch via `Promise.all()` for parallel loading
- Bonding curve cards link to `/bonding-curve/{id}`
- "Bonding Curve" label in card footer
- **Contributor count** fetched from `bonding_swaps` (unique wallets per pool)

### 2.2 Metadata Save Fix (Logo & Banner)
- **File**: `CreateBondingCurveWizard.tsx`
- **Bug**: Stale closure in `useEffect` — `logoFile`, `bannerFile`, `wizardData` were null inside closure
- **Fix**: Added `useRef` hooks synced with state, `saveMetadata()` reads from `.current`
- **Also fixed**: Declaration order — refs now declared after `wizardData` useState

### 2.3 Indexer: LiquidityMigrated Event Handler
- **Files**: `indexer_evm/src/index.ts`, `processors.ts`
- Added `LiquidityMigrated` event to ABI
- New `handleLiquidityMigrated()` → updates `bonding_pools.status` to `GRADUATED`
- Auto-triggers when bonding curve reaches migration threshold

### 2.4 UI: Graduated Status
- **File**: `StatusPill.tsx`
- Added `GRADUATED` case with gold/amber styling and 🎓 emoji
- **File**: `BondingCurveDetail.tsx`
- `isMigrated` check fixed: `pool.status === 'GRADUATED'` (was `'MIGRATED'`)
- Header shows "Trade on PancakeSwap 🥞" when graduated

### 2.5 DEX Mode Swap Panel
- **File**: `SwapPanel.tsx`
- When token is GRADUATED, swap panel routes trades through **PancakeSwap V2 Router**
- **Quote**: `router.getAmountsOut()` via on-chain read
- **Buy**: `swapExactETHForTokensSupportingFeeOnTransferTokens`
- **Sell**: `swapExactTokensForETHSupportingFeeOnTransferTokens`
- **Approval**: Targets PCS Router (not factory)
- **Slippage**: Applied to minAmountOut with 5-min deadline
- Info box: green, "This token has graduated! Trading on PancakeSwap V2 LP."

### 2.6 UI Polish
- **Font**: Stat cards + chart axes → Inter/system font (not Orbitron)
- **Back button**: BondingCurveList → links to `/explore`
- **Deploy fee**: 0.05 BNB shown in BondingCurveDetail

---

## 3. Indexer Events Summary

| Event | Handler | DB Action |
|-------|---------|-----------|
| `TokenLaunched` | `handleTokenLaunched` | Insert `bonding_pools` (status: LIVE) |
| `TokensPurchased` | `handleTokensPurchased` | Insert `bonding_swaps`, update reserves, process referral |
| `TokensSold` | `handleTokensSold` | Insert `bonding_swaps`, update reserves, process referral |
| `LiquidityMigrated` | `handleLiquidityMigrated` | Update `bonding_pools.status` → GRADUATED |
| `BlueCheckPurchased` | `handleBlueCheckPurchased` | Update profile, insert fee_split + referral_ledger |

---

## 4. On-Chain Verification (BCE Token)

| Check | Result |
|-------|--------|
| `liquidityMigrated` | `true` ✅ |
| `rReserveEth` | `0.0` (all sent to LP) ✅ |
| `router.factory()` | `0x6725F303...` ✅ |
| `router.WETH()` | `0xae13d989...` (standard WBNB) ✅ |
| LP Pair | `0xB3A8Aa78...` ✅ |
| LP Reserves | 1.0047 WBNB + 31.3M BCE ✅ |
| `getAmountsOut(0.01 BNB)` | 308,392 BCE ✅ |
| Token contract | Standard ERC-20, no restrictions ✅ |

**PCS UI Issue**: PancakeSwap testnet frontend uses older V2 factory (`0xB7926C04...`), our LP is on factory `0x6725F303...`. **Testnet-only issue** — mainnet has single canonical V2 factory.

---

## 5. Mainnet Deployment Checklist

### ✅ Ready (No Changes Needed)
- [x] Smart contract compiled & tested
- [x] Bonding curve formula (x*y=k virtual AMM)
- [x] Slippage protection (`_minAmountOut` on buy/sell)
- [x] Trade fees (1.5%) + referral fees (0.75%)
- [x] Auto-migration to DEX when threshold reached
- [x] LP burned to dead address (permanent lock)
- [x] Token contract (standard ERC-20, no restrictions)
- [x] Indexer handles all events
- [x] Frontend: create wizard, detail page, explore integration
- [x] DEX mode swap panel for graduated tokens
- [x] BlueCheck referral indexer (already on mainnet)

### ⚠️ Config Changes for Mainnet Deploy
| Setting | Testnet | Mainnet |
|---------|---------|---------|
| `migrationThreshold` | 1 BNB | **TBD** (e.g., 24 BNB like pump.fun) |
| `createFee` | 0.05 BNB | **TBD** (keep or adjust) |
| `uniswapRouter` | `0xD99D1c33...` (PCS Testnet) | `0x10ED43C718714eb63d5aA57B78B54704E256024E` (PCS Mainnet) |
| `treasuryWallet` | Testnet wallet | **Production treasury** |
| `V_ETH_RESERVE` | 30 BNB | **Review** (affects initial price) |
| Chain ID in indexer | 97 | 56 |
| `FACTORY_ADDRESS` in indexer | Testnet address | **New mainnet deploy address** |
| `PCS_ROUTER` in SwapPanel.tsx | Testnet address | Mainnet address |
| `WBNB` in SwapPanel.tsx | Testnet WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |

### 🔲 Pre-Mainnet Tasks
- [ ] Decide `migrationThreshold` for mainnet
- [ ] Decide `V_ETH_RESERVE` (affects initial price curve)
- [ ] Deploy factory to BSC Mainnet via Hardhat
- [ ] Update `.env` with mainnet factory address
- [ ] Update indexer `config.ts` with mainnet factory address
- [ ] Update frontend `PCS_ROUTER` and `WBNB` for mainnet
- [ ] Test 1 token create + buy + sell + migration on mainnet
- [ ] Verify PancakeSwap mainnet finds LP pair

---

## 6. File Changes Summary

| File | Changes |
|------|---------|
| `apps/web/src/lib/data/projects.ts` | Added `getBondingCurvePools()` with contributor count |
| `apps/web/src/app/explore/page.tsx` | Parallel fetch BC + presale data |
| `apps/web/src/components/explore/ExploreProjectCard.tsx` | BC routing + footer |
| `apps/web/src/app/create/bonding-curve/CreateBondingCurveWizard.tsx` | Stale closure fix (refs) |
| `apps/web/src/components/bonding/SwapPanel.tsx` | DEX mode (PCS Router trading) |
| `apps/web/src/app/bonding-curve/[id]/BondingCurveDetail.tsx` | Font fix, graduated UI, DEX header |
| `apps/web/src/app/bonding-curve/BondingCurveList.tsx` | Back button to /explore |
| `apps/web/src/components/presale/StatusPill.tsx` | GRADUATED status pill |
| `services/indexer_evm/src/index.ts` | LiquidityMigrated event listener |
| `services/indexer_evm/src/processors.ts` | `handleLiquidityMigrated()` handler |
