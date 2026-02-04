# Fairlaunch Fee Structure & Distribution

> **Complete fee breakdown**: Deployment fees, success fees, dan distribusi ke vaults

---

## 💰 Fee Types

### 1. **Deployment Fee** (One-time, Upfront)

Dibayar saat deploy fairlaunch contract.

| Network          | Fee     | Goes To                |
| ---------------- | ------- | ---------------------- |
| **BSC Mainnet**  | 0.2 BNB | Treasury Wallet (100%) |
| **BSC Testnet**  | 0.2 BNB | Treasury Wallet (100%) |
| **Ethereum**     | 0.1 ETH | Treasury Wallet (100%) |
| **Sepolia**      | 0.1 ETH | Treasury Wallet (100%) |
| **Base**         | 0.1 ETH | Treasury Wallet (100%) |
| **Base Sepolia** | 0.1 ETH | Treasury Wallet (100%) |

**Purpose:**

- Cover gas costs for deploying Fairlaunch.sol
- Cover gas costs for deploying TeamVesting.sol
- Platform deployment fee

**Collection Point:**

```solidity
// In FairlaunchFactory.createFairlaunch()
function createFairlaunch(...) external payable {
    require(msg.value >= DEPLOYMENT_FEE);

    // Send to treasury
    (bool success, ) = treasuryWallet.call{value: msg.value}("");
    require(success);

    // Deploy contracts...
}
```

**Note:** Deployment fee masuk **100% ke Treasury Wallet** (tidak displit).

---

### 2. **Token Creation Fee** (Optional, If Using Factory)

Dibayar saat create token via SimpleTokenFactory.

| Network          | Fee      | Goes To                |
| ---------------- | -------- | ---------------------- |
| **BSC Mainnet**  | 0.2 BNB  | Treasury Wallet (100%) |
| **BSC Testnet**  | 0.2 BNB  | Treasury Wallet (100%) |
| **Ethereum**     | 0.01 ETH | Treasury Wallet (100%) |
| **Sepolia**      | 0.01 ETH | Treasury Wallet (100%) |
| **Base**         | 0.05 ETH | Treasury Wallet (100%) |
| **Base Sepolia** | 0.01 ETH | Treasury Wallet (100%) |

**Purpose:**

- Cover gas for deploying SimpleToken.sol
- Platform token factory fee

**Collection Point:**

```solidity
// In SimpleTokenFactory.createToken()
function createToken(...) external payable returns (address token) {
    require(msg.value >= creationFee);

    // Deploy token
    SimpleToken newToken = new SimpleToken(...);

    // Send fee to treasury
    (bool success, ) = treasury.call{value: msg.value}("");
    require(success);
}
```

**Note:** Token creation fee juga **100% ke Treasury Wallet** (tidak displit).

**Reference:** `Modul_15_fee-creation.json`

---

### 3. **Success Fee** (5%, On Finalization)

Dibayar dari total funds raised saat fairlaunch berhasil (softcap tercapai).

| Parameter         | Value                        |
| ----------------- | ---------------------------- |
| **Total Fee**     | 5% of total_raised           |
| **Trigger**       | On finalize() if softcap met |
| **Deducted From** | Total raised funds           |
| **Split Via**     | FeeSplitter contract         |

**Distribution:**

```
Total Success Fee: 5% of total_raised
├─ Treasury:      2.5% (50% of fee)
├─ Referral Pool: 2.0% (40% of fee)
└─ SBT Staking:   0.5% (10% of fee)
```

**Example:**

```
Fairlaunch raises: 100 ETH
Success fee (5%): 5 ETH
├─ Treasury:      2.5 ETH
├─ Referral Pool: 2.0 ETH
└─ SBT Staking:   0.5 ETH

Net to distribute: 95 ETH
├─ To Liquidity (70%): 66.5 ETH
└─ To Project Owner:   28.5 ETH
```

**Collection Point:**

```solidity
// In Fairlaunch.finalize()
function finalize() external {
    // Check softcap met
    require(totalRaised >= softcap);

    // Calculate 5% platform fee
    uint256 platformFee = (totalRaised * 500) / 10000; // 5%
    uint256 netRaised = totalRaised - platformFee;

    // Send fee to FeeSplitter (auto-distributes)
    IFeeSplitter(feeSplitter).distributeFeeNative{value: platformFee}();

    // Continue with liquidity provision...
}
```

---

## 🏛️ FeeSplitter Contract

### Overview

FeeSplitter adalah smart contract yang otomatis split dan distribute success fee ke 3 vaults:

- Treasury Vault
- Referral Pool Vault
- SBT Staking Vault

### Fee Configuration

```solidity
struct FeeConfig {
    uint256 totalBps;          // 500 (5%)
    uint256 treasuryBps;       // 250 (2.5%)
    uint256 referralPoolBps;   // 200 (2.0%)
    uint256 sbtStakingBps;     // 50  (0.5%)
}
```

### Distribution Formula

```solidity
// Share-of-fee model
vaultAmount = totalFee * vaultBps / totalBps

// Example with 5 ETH fee:
treasuryAmount = 5 ETH * 250 / 500 = 2.5 ETH
referralAmount = 5 ETH * 200 / 500 = 2.0 ETH
sbtAmount      = 5 ETH * 50  / 500 = 0.5 ETH
```

**Rounding Policy:** Any remainder goes to Treasury vault.

### Usage in Fairlaunch

```solidity
// Fairlaunch calls FeeSplitter
IFeeSplitter(feeSplitter).distributeFeeNative{value: platformFee}();

// FeeSplitter automatically:
// 1. Receives the fee
// 2. Calculates splits
// 3. Transfers to 3 vaults
// 4. Emits events
```

### Events Emitted

```solidity
event FeeCollected(address indexed token, uint256 totalAmount);
event FeeSplit(address indexed vault, address indexed token, uint256 amount, uint256 bps);

// Example log:
// FeeCollected(0x0, 5000000000000000000)  // 5 ETH
// FeeSplit(treasuryVault, 0x0, 2500000000000000000, 250)  // 2.5 ETH
// FeeSplit(referralPool, 0x0, 2000000000000000000, 200)   // 2.0 ETH
// FeeSplit(sbtStaking, 0x0, 500000000000000000, 50)       // 0.5 ETH
```

---

## 📊 Complete Fee Flow Diagram

### Scenario: User Creates Fairlaunch via Factory Token

```
┌─────────────────────────────────────┐
│ Step 1: Create Token                │
│ User pays: 0.01 ETH (creation fee)  │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌────────────┐
        │  Treasury  │ ← 100% (0.01 ETH)
        └────────────┘

┌─────────────────────────────────────┐
│ Step 2: Deploy Fairlaunch           │
│ User pays: 0.1 ETH (deployment fee) │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌────────────┐
        │  Treasury  │ ← 100% (0.1 ETH)
        └────────────┘

┌─────────────────────────────────────┐
│ Step 3: Fairlaunch SUCCESS          │
│ Total raised: 100 ETH               │
└──────────────┬──────────────────────┘
               │
               ├─► Platform Fee (5%) = 5 ETH
               │   │
               │   ▼
               │   ┌──────────────┐
               │   │ FeeSplitter  │
               │   └──────┬───────┘
               │          │
               │          ├─► Treasury (2.5 ETH)
               │          ├─► Referral Pool (2.0 ETH)
               │          └─► SBT Staking (0.5 ETH)
               │
               └─► Net Raised (95 ETH)
                   │
                   ├─► To Liquidity 70% (66.5 ETH)
                   │   + 700k tokens
                   │   → Add to DEX
                   │   → Lock LP tokens
                   │
                   └─► To Project Owner (28.5 ETH)
```

---

## 💡 Total Cost Breakdown for User

### Example: Create Fairlaunch on Sepolia with Factory Token

**Upfront Costs:**

```
1. Token Creation Fee:    0.01 ETH
2. Deployment Fee:        0.1  ETH
   ─────────────────────────────
   Total Upfront:         0.11 ETH
```

**Success Costs (if softcap met):**

```
If raises 100 ETH:
- Platform fee:           5 ETH (5%)
- Net to user/liquidity:  95 ETH
```

**Total Platform Revenue:**

```
- Token creation:         0.01 ETH → Treasury
- Deployment:             0.1  ETH → Treasury
- Success fee:            5    ETH → Split (2.5/2.0/0.5)
  ─────────────────────────────────────────
  Total:                  5.11 ETH
```

---

## 🎯 UI Display Requirements

### Step 1: Network & Token Selection

**If user selects "Create New Token":**

```typescript
<div className="fee-notice">
  <h4>Token Creation Fee</h4>
  <p className="amount">
    {network === 'bsc_testnet' || network === 'bnb'
      ? '0.2 BNB'
      : network === 'base'
      ? '0.05 ETH'
      : '0.01 ETH'
    }
  </p>
  <p className="description">
    One-time fee to deploy your token contract via factory.
    This token will automatically receive SAFU + SC Pass badges.
  </p>
</div>

<div className="deployment-fee-notice">
  <h4>Fairlaunch Deployment Fee</h4>
  <p className="amount">
    {network.includes('bsc') ? '0.2 BNB' : '0.1 ETH'}
  </p>
  <p className="description">
    Required to deploy your fairlaunch contract (Step 7).
  </p>
</div>

<div className="total-upfront">
  <strong>Total Upfront Cost:</strong>
  <span className="total">
    {calculateTotalUpfront(network)} {networkSymbol}
  </span>
</div>
```

### Step 6: Review

```typescript
<section className="fee-breakdown">
  <h3>Fee Breakdown</h3>

  <div className="upfront-fees">
    <h4>Upfront Costs (Pay Now)</h4>
    <div className="fee-row">
      <span>Token Creation Fee:</span>
      <span>{tokenCreationFee} {symbol}</span>
    </div>
    <div className="fee-row">
      <span>Deployment Fee:</span>
      <span>{deploymentFee} {symbol}</span>
    </div>
    <div className="fee-row total">
      <strong>Total Now:</strong>
      <strong>{totalUpfront} {symbol}</strong>
    </div>
  </div>

  <div className="success-fees">
    <h4>Success Fees (If Softcap Met)</h4>
    <div className="fee-row">
      <span>Platform Success Fee:</span>
      <span>5% of raised funds</span>
    </div>
    <div className="fee-split">
      <p className="split-title">Fee Distribution:</p>
      <ul>
        <li>Treasury: 2.5%</li>
        <li>Referral Rewards: 2.0%</li>
        <li>SBT Staking: 0.5%</li>
      </ul>
    </div>
  </div>

  {/* Example Calculation */}
  {softcap && (
    <div className="example-calculation">
      <p className="label">Example at Softcap ({softcap} {symbol}):</p>
      <div className="breakdown">
        <div className="row">
          <span>Total Raised:</span>
          <span>{softcap} {symbol}</span>
        </div>
        <div className="row fee">
          <span>Platform Fee (5%):</span>
          <span>{(parseFloat(softcap) * 0.05).toFixed(2)} {symbol}</span>
        </div>
        <div className="row">
          <span>Net for Project:</span>
          <span>{(parseFloat(softcap) * 0.95).toFixed(2)} {symbol}</span>
        </div>
      </div>
    </div>
  )}
</section>
```

---

## 🔧 Helper Functions

### Calculate Total Upfront Cost

```typescript
export function calculateTotalUpfrontCost(
  network: string,
  tokenSource: 'factory' | 'existing'
): { amount: string; symbol: string } {
  const isBSC = network === 'bnb' || network === 'bsc_testnet';
  const symbol = isBSC ? 'BNB' : 'ETH';

  // Deployment fee
  const deploymentFee = isBSC ? 0.2 : 0.1;

  // Token creation fee (only if factory)
  const tokenCreationFee =
    tokenSource === 'factory' ? (isBSC ? 0.2 : network === 'base' ? 0.05 : 0.01) : 0;

  const total = deploymentFee + tokenCreationFee;

  return {
    amount: total.toString(),
    symbol: symbol,
  };
}
```

### Calculate Success Fee Split

```typescript
export function calculateSuccessFeeSplit(totalRaised: string) {
  const raised = parseFloat(totalRaised);
  const platformFee = raised * 0.05; // 5%

  return {
    total: platformFee,
    treasury: platformFee * 0.5, // 2.5% of raised = 50% of fee
    referralPool: platformFee * 0.4, // 2.0% of raised = 40% of fee
    sbtStaking: platformFee * 0.1, // 0.5% of raised = 10% of fee
    netRaised: raised - platformFee, // 95%
  };
}
```

---

## 📋 Summary

### Fee Types

| Fee Type           | When                 | Amount           | Distribution       |
| ------------------ | -------------------- | ---------------- | ------------------ |
| **Token Creation** | Token factory deploy | 0.01-0.2 ETH/BNB | 100% Treasury      |
| **Deployment**     | Fairlaunch deploy    | 0.1-0.2 ETH/BNB  | 100% Treasury      |
| **Success**        | Softcap reached      | 5% of raised     | 2.5% / 2.0% / 0.5% |

### Vault Purposes

| Vault             | Receives                   | Purpose                                 |
| ----------------- | -------------------------- | --------------------------------------- |
| **Treasury**      | All upfront + 2.5% success | Operational costs, development          |
| **Referral Pool** | 2.0% success fee           | Rewards for referrers (Blue Check only) |
| **SBT Staking**   | 0.5% success fee           | Rewards for SBT stakers                 |

### Key Points

✅ **Upfront fees** go 100% to Treasury (deployment + token creation)  
✅ **Success fees** are automatically split via FeeSplitter  
✅ **FeeSplitter** is called by Fairlaunch.finalize()  
✅ **Referral rewards** can only be claimed by Blue Check users  
✅ **SBT staking rewards** distributed to SBT token stakers

**Jadi yes bro, ada FeeSplitter yang otomatis bagi ke 3 vault! 🎯**
