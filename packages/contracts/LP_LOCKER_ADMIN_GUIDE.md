# LP Locker Configuration for Admin

## ✅ LP Locker Deployed

**Address**: `0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F`  
**Network**: BSC Testnet  
**Verified**: ✅ https://testnet.bscscan.com/address/0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F#code

---

## 🔧 How to Configure for New Fairlaunch

### Option A: Automatic (Recommended)

Add to Hardhat deployment script after deploying Fairlaunch:

```javascript
// After deploying Fairlaunch contract
const fairlaunch = await Fairlaunch.deploy(...params);
await fairlaunch.waitForDeployment();

// ✅ AUTO-CONFIGURE LP LOCKER
const LP_LOCKER = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';
await fairlaunch.setLPLocker(LP_LOCKER);
console.log('✅ LP Locker configured!');

// Save contract address to database
const contractAddress = await fairlaunch.getAddress();
```

### Option B: Manual via Hardhat

```bash
cd packages/contracts

# Set environment variables
export FAIRLAUNCH_ADDRESS=0x...
export LPLOCKER_ADDRESS=0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F

# Run configuration script
npx hardhat run scripts/fairlaunch/set-lplocker.ts --network bscTestnet
```

---

## 🎯 What Happens During Finalization

When `finalize()` is called:

1. ✅ LP tokens created from DEX
2. ✅ LP tokens **locked in vault** (12 months)
3. ✅ Project owner is beneficiary
4. ✅ **No rug pull possible!**

---

## 📋 Mainnet Deployment

For production:

1. Deploy LP Locker to BSC Mainnet
2. Verify on BSCScan
3. Update LP_LOCKER address in scripts
4. Use same configuration flow

---

## ⚠️ Important

**Every new Fairlaunch MUST have LP Locker set** before finalization, otherwise finalize() will revert!

Check LP Locker status:

```javascript
const locker = await fairlaunch.lpLocker();
console.log('LP Locker:', locker);
// Should be: 0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F
```
