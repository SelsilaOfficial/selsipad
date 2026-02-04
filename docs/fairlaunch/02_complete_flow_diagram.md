# Fairlaunch Complete Flow Diagram

> **📊 Visual flow**: End-to-end fairlaunch lifecycle dari UI ke SC sampai claim

---

## 🎯 Overview

```mermaid
graph TB
    A[User Opens Create Fairlaunch] --> B[7-Step Wizard]
    B --> C{Compliance Check}
    C -->|Pass| D[Deploy to SC]
    C -->|Fail| E[Block Submission]
    D --> F[Fairlaunch LIVE]
    F --> G{Sale Period}
    G --> H[Users Contribute]
    H --> I{End Time Reached}
    I --> J[Anyone Calls finalize()]
    J --> K{Softcap Met?}
    K -->|Yes| L[SUCCESS]
    K -->|No| M[FAILED]
    L --> N[Add Liquidity to DEX]
    N --> O[Lock LP Tokens]
    O --> P[Users Claim Tokens]
    M --> Q[Users Refund]
```

---

## 📝 Detailed Step-by-Step Flow

### **Phase 1: Creation (UI → Database → SC)**

```
┌─────────────────┐
│  Step 1-6       │
│  Wizard Input   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Step 7         │
│  Compliance     │
│  - KYC Check    │
│  - SC Scan      │
│  - Vesting Check│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  Save to Database (DRAFT)   │
│  Status: DRAFT / SUBMITTED  │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Call FairlaunchFactory.    │
│  createFairlaunch()         │
│  - Pay deployment fee       │
│  - Deploy Fairlaunch.sol    │
│  - Deploy TeamVesting.sol   │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Update Database            │
│  - contract_address         │
│  - vesting_contract         │
│  - Status: UPCOMING         │
└─────────────────────────────┘
```

**Key Points:**

- Off-chain gating (KYC, SC Scan) happens BEFORE SC call
- SC doesn't care about compliance, it's permissionless
- Factory returns 2 addresses: Fairlaunch + TeamVesting

---

### **Phase 2: Sale Period (Contributors)**

```
┌──────────────────┐
│  Status: LIVE    │
│  (after start)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│  User Contribution Flow  │
└────────┬─────────────────┘
         │
         ├──► Native Token Path (ETH/BNB)
         │    │
         │    ▼
         │    contribute() payable
         │    - Check: status == LIVE
         │    - Check: !isPaused
         │    - Check: amount >= minContribution
         │    - Check: totalContrib <= maxContribution
         │    - Update: contributions[user]
         │    - Update: totalRaised
         │    - Emit: Contributed
         │
         └──► ERC20 Token Path (USDT/USDC)
              │
              ▼
              contributeERC20(amount)
              - transferFrom(user, this, amount)
              - Same checks as above
```

**Real-time Updates:**

- Frontend polls `totalRaised` for progress bar
- Frontend polls `participantCount` for stats
- Frontend polls `getStatus()` for countdown

---

### **Phase 3: Finalization (Price Discovery)**

```
┌────────────────────┐
│  endTime reached   │
│  Status: ENDED     │
└──────────┬─────────┘
           │
           ▼
┌────────────────────────────────────┐
│  Anyone calls finalize()           │
│  (callable by ANYONE, not just     │
│   admin or owner)                  │
└──────────┬─────────────────────────┘
           │
           ├──► Check softcap
           │    │
           │    ├──► Met? YES ──┐
           │    │                │
           │    └──► Met? NO     │
           │         │           │
           │         ▼           │
           │    Status: FAILED   │
           │    Users can refund │
           │                     │
           │    ◄────────────────┘
           ▼
      SUCCESS PATH
      ╔════════════════════════════╗
      ║  Price Discovery Formula   ║
      ║  finalPrice = totalRaised  ║
      ║             / tokensForSale║
      ╚════════════════════════════╝
           │
           ▼
      ┌─────────────────────────┐
      │ 1. Deduct 5% Fee        │
      │    platformFee =        │
      │    totalRaised * 500    │
      │    / 10000              │
      │ 2. Send fee to          │
      │    FeeSplitter          │
      └──────────┬──────────────┘
           │
           ▼
      ┌─────────────────────────┐
      │ 3. Calculate LP Amounts │
      │    netRaised =          │
      │    totalRaised - fee    │
      │                         │
      │    lpFunds =            │
      │    netRaised *          │
      │    liquidityPercent     │
      │    / 10000              │
      │                         │
      │    lpTokens =           │
      │    tokensForSale *      │
      │    liquidityPercent     │
      │    / 10000              │
      └──────────┬──────────────┘
           │
           ▼
      ┌─────────────────────────┐
      │ 4. Add Liquidity to DEX │
      │    - Approve router     │
      │    - addLiquidityETH()  │
      │      or addLiquidity()  │
      │    - Get LP token addr  │
      └──────────┬──────────────┘
           │
           ▼
      ┌─────────────────────────┐
      │ 5. Lock LP Tokens       │
      │    unlockTime =         │
      │    now + (months * 30d) │
      │    ** TODO: Integrate   │
      │       with LPLocker **  │
      └──────────┬──────────────┘
           │
           ▼
      ┌─────────────────────────┐
      │ 6. Send Team Tokens     │
      │    to TeamVesting       │
      │    (if exists)          │
      └──────────┬──────────────┘
           │
           ▼
      ┌─────────────────────────┐
      │ 7. Send Remaining Funds │
      │    to projectOwner      │
      │    = netRaised - lpFunds│
      └──────────┬──────────────┘
           │
           ▼
      Status: SUCCESS
      Emit: FinalizedSuccess
```

**Calculations Example:**

```
Input:
- tokensForSale: 1,000,000 tokens
- totalRaised: 100 ETH
- liquidityPercent: 7000 (70%)

Step-by-step:
1. finalPrice = 100 ETH / 1,000,000 = 0.0001 ETH per token
2. platformFee = 100 * 0.05 = 5 ETH
3. netRaised = 100 - 5 = 95 ETH
4. lpFunds = 95 * 0.70 = 66.5 ETH
5. lpTokens = 1,000,000 * 0.70 = 700,000 tokens
6. Add 700k tokens + 66.5 ETH to DEX = LP tokens created
7. Team vesting gets remaining 300k tokens (if configured)
8. Project owner gets 95 - 66.5 = 28.5 ETH
```

---

### **Phase 4: Claim (Users Get Tokens)**

```
┌────────────────┐
│ Status: SUCCESS│
└────────┬───────┘
         │
         ▼
┌──────────────────────────┐
│  User calls claimTokens()│
└────────┬─────────────────┘
         │
         ├──► Checks:
         │    - status == SUCCESS
         │    - contributions[user] > 0
         │    - !hasClaimed[user]
         │
         ▼
    Calculate allocation:
    userTokens =
      contributions[user] *
      tokensForSale /
      totalRaised
         │
         ▼
    Transfer tokens to user
    Set hasClaimed[user] = true
    Emit: TokensClaimed
```

**Pro-Rata Distribution:**

```
Example:
- User contributed: 1 ETH
- totalRaised: 100 ETH
- tokensForSale: 1,000,000

userTokens = 1 * 1,000,000 / 100 = 10,000 tokens
```

---

### **Phase 5: Refund Path (If Failed)**

```
┌────────────────┐
│ Status: FAILED │
│ or CANCELLED   │
└────────┬───────┘
         │
         ▼
┌──────────────────────┐
│  User calls refund() │
└────────┬─────────────┘
         │
         ├──► Checks:
         │    - status == FAILED || CANCELLED
         │    - contributions[user] > 0
         │
         ▼
    Get amount = contributions[user]
    Set contributions[user] = 0
         │
         ▼
    Transfer funds back
    (Native or ERC20)
         │
         ▼
    Emit: Refunded
```

---

## 🔄 Status State Machine

```
                    ┌──────────┐
                    │ UPCOMING │
                    └────┬─────┘
                         │ time >= startTime
                         ▼
                    ┌──────────┐
                    │   LIVE   │◄──── unpause()
                    └────┬─────┘
                         │ time >= endTime
                         │
          pause() ───────┤
                         │
                         ▼
                    ┌──────────┐
                    │  ENDED   │
                    └────┬─────┘
                         │ finalize()
              ┌──────────┴──────────┐
              │                     │
    totalRaised < softcap  totalRaised >= softcap
              │                     │
              ▼                     ▼
         ┌────────┐           ┌───────────┐
         │ FAILED │           │  SUCCESS  │
         └────────┘           └───────────┘
              │                     │
              ▼                     ▼
         refund()              claimTokens()

    ┌──────────────┐
    │  CANCELLED   │◄──── admin cancel()
    │  (any time)  │      (cannot cancel after SUCCESS)
    └──────┬───────┘
           │
           ▼
        refund()
```

---

## 📊 Database Updates Timeline

| Event              | SC Status   | DB Status   | DB Updates                                |
| ------------------ | ----------- | ----------- | ----------------------------------------- |
| Wizard submit      | -           | `DRAFT`     | Save wizard data                          |
| Factory call       | `UPCOMING`  | `SUBMITTED` | `contract_address`, `vesting_contract`    |
| Start time         | `LIVE`      | `LIVE`      | -                                         |
| End time           | `ENDED`     | `ENDED`     | -                                         |
| Finalize (success) | `SUCCESS`   | `SUCCESS`   | `final_price`, `total_raised`, `lp_token` |
| Finalize (fail)    | `FAILED`    | `FAILED`    | -                                         |
| Admin cancel       | `CANCELLED` | `CANCELLED` | -                                         |

---

## 🎯 Key Takeaways

1. **Permissionless**: Anyone can finalize after endTime
2. **Price Discovery**: No hardcap, price = raised/tokens
3. **Automated LP**: Liquidity added automatically on finalization
4. **Pro-Rata**: Fair distribution based on contribution %
5. **Fee Structure**: 5% platform fee deducted from raised amount
6. **Minimum Safety**: 70% LP + 12 month lock enforced

**Siap diskusi flow-nya, bro! 🔥**
