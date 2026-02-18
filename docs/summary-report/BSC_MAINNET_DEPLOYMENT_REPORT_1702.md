# Selsipad — BSC Mainnet Deployment Report

> **Generated:** 2026-02-17  
> **Chain:** BSC Mainnet (Chain ID: 56)  
> **Deployer:** `0x59788e689b3c1d36F9968c6CC78CC4Ce1b2Ecd4E`

---

## ✅ All Deployed & Verified On-Chain

| Contract              | Address                                                                                                                | Bytecode     | Block    |
| :-------------------- | :--------------------------------------------------------------------------------------------------------------------- | :----------- | :------- |
| **FeeSplitter**       | [`0x2Bf655410Cf6d7A88dc0d4D1f815546C8Eb2Ab52`](https://bscscan.com/address/0x2Bf655410Cf6d7A88dc0d4D1f815546C8Eb2Ab52) | 7,644 bytes  | 81762729 |
| **LPLocker**          | [`0x4c6bA7e2667EBa61c0E84694A4828D0b33ffAF85`](https://bscscan.com/address/0x4c6bA7e2667EBa61c0E84694A4828D0b33ffAF85) | 6,446 bytes  | 81762834 |
| **PresaleFactory**    | [`0x0b3662a97C962bdAFC3e66dcE076A65De18C223d`](https://bscscan.com/address/0x0b3662a97C962bdAFC3e66dcE076A65De18C223d) | 43,506 bytes | 81762840 |
| **BlueCheckRegistry** | [`0xC14CdFE71Ca04c26c969a1C8a6aA4b1192e6fC43`](https://bscscan.com/address/0xC14CdFE71Ca04c26c969a1C8a6aA4b1192e6fC43) | 5,082 bytes  | —        |

### FeeSplitter Configuration

- Treasury: `0x124D5b097838A2F15b08f83239961b5D5D825223` (50% = 250/500 bps)
- Referral Pool: `0x7A5812758Cad9585b84c292bFeaD5f7929E40339` (40% = 200/500 bps)
- SBT Staking: `0x124D5b097838A2F15b08f83239961b5D5D825223` (10% = 50/500 bps)

### PresaleFactory Configuration

- DEX Router: [`0x10ED43C718714eb63d5aA57B78B54704E256024E`](https://bscscan.com/address/0x10ED43C718714eb63d5aA57B78B54704E256024E) (PancakeSwap V2)
- Timelock: Deployer (admin)
- Roles: Factory → FeeSplitter DEFAULT_ADMIN, Deployer → Factory FACTORY_ADMIN

---

## Platform Wallets

| Role                | Address                                      |
| :------------------ | :------------------------------------------- |
| **Treasury**        | `0x124D5b097838A2F15b08f83239961b5D5D825223` |
| **Master Referrer** | `0x7A5812758Cad9585b84c292bFeaD5f7929E40339` |
| **Deployer**        | `0x59788e689b3c1d36F9968c6CC78CC4Ce1b2Ecd4E` |

---

## ⏳ Not Yet Deployed (Phase 2)

| Contract           | Status  |
| :----------------- | :------ |
| Fairlaunch Factory | Pending |
| Token Escrow       | Pending |

---

## Files Updated With Mainnet Addresses

| File                       | Contracts                                 |
| :------------------------- | :---------------------------------------- |
| `.env.local`               | Factory, BlueCheck, LPLocker, FeeSplitter |
| `deploy-presale.ts`        | Factory                                   |
| `addresses.ts`             | Factory, BlueCheck                        |
| `presale-contracts.ts`     | Factory, FeeSplitter, LPLocker            |
| `useBlueCheckPurchase.ts`  | BlueCheck                                 |
| `verify-purchase/route.ts` | BlueCheck                                 |
| `EVMWalletProvider.tsx`    | RPC URL                                   |
