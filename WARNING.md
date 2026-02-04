# ⚠️ IMPORTANT: Smart Contract Directory Structure

**STOP! READ THIS BEFORE CREATING NEW SMART CONTRACTS.**

The `/contracts` folder in the root directory is **DEPRECATED** and should likely be ignored for new development.

## ✅ Correct Location for New Contracts

All new smart contract development (EVM, Solana, etc.) must be done inside the **`packages/contracts`** workspace.

👉 **`packages/contracts`**

## 🚫 Legacy Location (Deprecated)

The root contracts folder is legacy and not part of the active workspace configuration.

🚫 `/contracts` (Root)

## Future Development (Solana & EVM)

- **Solana Contracts:** Create them in `packages/contracts/contracts/solana` (or a dedicated `packages/solana-contracts` if preferred later, but keep it in `packages/`).
- **EVM Internal Features:** Keep using `packages/contracts`.

Please respect this monorepo structure to ensure proper integration with the frontend (`apps/web`) and shared packages.
