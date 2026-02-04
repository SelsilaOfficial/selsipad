# Fairlaunch Quick Reference Guide

## 🚀 Quick Start

### For Users

**Deploy Fairlaunch**:

```
1. Visit: /create/fairlaunch
2. Select network (BSC/Sepolia/Base)
3. Create/Import token
4. Fill wizard → Deploy
5. ✅ Done!
```

**Contribute**:

```
1. Visit: /fairlaunch
2. Click LIVE project
3. Contribute tab → Enter amount
4. Confirm → Wait
5. ✅ Contribution successful!
```

### For Developers

**Key Files**:

```
📁 Smart Contracts
  - packages/contracts/contracts/fairlaunch/Fairlaunch.sol
  - packages/contracts/contracts/fairlaunch/FairlaunchFactory.sol

📁 Frontend
  - apps/web/app/create/fairlaunch/CreateFairlaunchWizard.tsx
  - apps/web/app/fairlaunch/[id]/FairlaunchDetail.tsx

📁 Contracts Config
  - apps/web/src/contracts/Fairlaunch.ts
  - apps/web/src/contracts/FairlaunchFactory.ts

📁 Database
  - supabase/migrations/20260130000001_add_pool_address_to_launch_rounds.sql
```

---

## 🌐 Network Configuration

| Network      | Chain ID | Deployment Fee | Factory Address |
| ------------ | -------- | -------------- | --------------- |
| BSC Testnet  | 97       | 0.2 BNB        | `0x723f...4698` |
| Sepolia      | 11155111 | 0.01 ETH       | `0x6eA1...4FbE` |
| Base Sepolia | 84532    | 0.01 ETH       | `0x6eA1...4FbE` |

---

## 🔧 Common Tasks

### Deploy to Testnet

```bash
# Get testnet funds
BSC: https://testnet.bnbchain.org/faucet-smart
Sepolia: https://sepoliafaucet.com
Base: Coinbase faucet

# Deploy via UI
1. Connect wallet to testnet
2. Go to /create/fairlaunch
3. Follow wizard
4. Confirm transaction
```

### Contribute to Fairlaunch

```bash
# Prerequisites
- Wallet connected
- Sufficient balance (BNB/ETH + gas)
- Fairlaunch status = LIVE

# Steps
1. Go to /fairlaunch/[id]
2. Click "Contribute" tab
3. Enter amount (between min/max)
4. Click "Contribute X BNB"
5. Approve in wallet
6. Wait for confirmation
```

### Run Database Migration

```bash
# Supabase CLI
supabase db push

# Or manual
psql -f supabase/migrations/20260130000001_add_pool_address_to_launch_rounds.sql
```

---

## 🐛 Troubleshooting

### "Cannot convert to BigInt" Error

- ✅ **Fixed** - Use parseEther for BNB/ETH values
- Example: `parseEther("0.1")` instead of `BigInt("0.1")`

### "Wallet not connected" in ContributeTab

- Check wallet connection
- Verify correct network selected
- Try reconnecting wallet

### "Module not found: @/lib/wagmi/config"

- ✅ **Fixed** - Use wagmi hooks directly
- Use `useWalletClient()` and `usePublicClient()`

### Contribution transaction fails

- Check min/max limits
- Ensure sufficient balance (amount + gas)
- Verify sale status is LIVE
- Check network matches Fairlaunch network

---

## 📝 Code Snippets

### Convert Decimal to Wei

```typescript
import { parseEther } from 'viem';

// Convert BNB/ETH to wei
const weiAmount = parseEther('0.1'); // 100000000000000000n
```

### Call Contribute Function

```typescript
import { useWalletClient, usePublicClient } from 'wagmi';
import { parseEther } from 'viem';

const { data: walletClient } = useWalletClient();
const publicClient = usePublicClient();

// Send contribution
const txHash = await walletClient.writeContract({
  address: fairlaunchAddress,
  abi: FAIRLAUNCH_ABI,
  functionName: 'contribute',
  value: parseEther(amount),
});

// Wait for confirmation
await publicClient.waitForTransactionReceipt({
  hash: txHash,
  confirmations: 2,
});
```

### Get Fairlaunch Status

```typescript
import { useReadContract } from 'wagmi';

const { data: status } = useReadContract({
  address: fairlaunchAddress,
  abi: FAIRLAUNCH_ABI,
  functionName: 'status',
});

// 0 = PENDING, 1 = LIVE, 2 = SUCCESS, 3 = FAILED
```

---

## 📊 Contract Functions

### Fairlaunch.sol

**Read**:

- `status()` → uint8
- `totalRaised()` → uint256
- `contributions(address)` → uint256
- `minContribution()` → uint256
- `maxContribution()` → uint256

**Write**:

- `contribute()` payable
- `contributeERC20(uint256)`

### FairlaunchFactory.sol

**Write**:

- `createFairlaunch(params, vestingParams, lpPlan)` payable

**Events**:

- `FairlaunchCreated(uint256 indexed id, address indexed fairlaunch, address indexed vesting, address projectToken)`

---

## 🎯 Testing Checklist

**Before Deployment**:

- [ ] Wallet connected to correct network
- [ ] Sufficient balance for fees
- [ ] Token created/imported
- [ ] Security scan passed
- [ ] All wizard fields validated

**After Deployment**:

- [ ] Transaction confirmed
- [ ] Fairlaunch address received
- [ ] Database entry created
- [ ] UI shows on list page
- [ ] Detail page accessible

**Contribution Testing**:

- [ ] Tab visible on LIVE Fairlaunch
- [ ] Min/Max validation works
- [ ] Transaction successful
- [ ] Stats updated after contribution
- [ ] User can contribute multiple times (up to max)

---

## 🔗 Explorer Links

**BSC Testnet**:

- Factory: https://testnet.bscscan.com/address/0x723fbc908ebd1d13D755a7aC1fA96eFB79964698

**Sepolia**:

- Factory: https://sepolia.etherscan.io/address/0x6eA1044Caf6CEdf36A9F7D978384a634a3f04FbE

**Base Sepolia**:

- Factory: https://sepolia.basescan.org/address/0x6eA1044Caf6CEdf36A9F7D978384a634a3f04FbE

---

## ✅ Production Checklist

**Smart Contracts**:

- [x] Deployed to testnets
- [x] Verified on explorers
- [ ] Deploy to mainnets (pending)

**Frontend**:

- [x] Deployment wizard complete
- [x] Contribution feature complete
- [ ] Claim feature (pending)
- [ ] Refund feature (pending)

**Database**:

- [x] Schema complete
- [x] Indexes created
- [x] RLS policies set

**Testing**:

- [x] BSC Testnet tested
- [ ] Sepolia testing (ready)
- [ ] Base Sepolia testing (ready)

---

## 📞 Quick Links

- **Main Doc**: `IMPLEMENTATION_SUMMARY.md`
- **Deployment Guide**: See "🚀 Deployment Guide" section
- **API Reference**: See "📊 Contract Functions" section
- **Troubleshooting**: See "🐛 Troubleshooting" section

---

_Quick Reference v1.0.0 - January 30, 2026_
