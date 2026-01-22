# BlueCheck Registry Deployment Guide

## Prerequisites

Before deploying, ensure you have the following environment variables set in `/contracts/presale/.env`:

```bash
# Deployment Account
DEPLOYER_PRIVATE_KEY=your_private_key_here

# Treasury & Pool Addresses
TREASURY_ADDRESS=0xYourTreasuryAddress
REFERRAL_POOL_ADDRESS=0xYourReferralPoolAddress

# BSCScan API (for verification)
BSCSCAN_API_KEY=your_bscscan_api_key
```

## Get Testnet BNB

1. Go to https://testnet.bnbchain.org/faucet-smart
2. Enter your deployer address
3. Request 0.5 BNB (should be enough for deployment)

## Deployment Steps

### 1. Install Dependencies

```bash
cd contracts/bluecheck
npm install
```

### 2. Deploy to BSC Testnet

```bash
npm run deploy:testnet
```

This will:

- Deploy BlueCheckRegistry contract
- Set treasury and referral pool addresses
- Set initial BNB price to $600
- Save deployment info to `deployment-bluecheck-testnet.json`

### 3. Verify Contract on BSCScan

```bash
npx hardhat verify --network bscTestnet <CONTRACT_ADDRESS> "<TREASURY>" "<REFERRAL_POOL>" "<INITIAL_PRICE>"
```

Replace values from deployment output.

### 4. Update Frontend

Update contract address in:

- `apps/web/src/hooks/useBlueCheckPurchase.ts` (line 35)
- `apps/web/app/api/bluecheck/verify-purchase/route.ts` (line 13)

### 5. Test Purchase Flow

1. Go to `/profile/blue-check` on your app
2. Connect EVM wallet
3. Review BNB price
4. Execute purchase
5. Verify on BSCScan
6. Check profile updated to ACTIVE

## Troubleshooting

**"Insufficient funds"**

- Get more testnet BNB from faucet

**"Invalid treasury address"**

- Ensure TREASURY_ADDRESS is set in .env
- Must be valid Ethereum address

**"Verification failed"**

- Check BSCSCAN_API_KEY is correct
- Wait a few minutes after deployment before verifying

## Next Steps After Deployment

1. Update BNB price if needed:

   ```typescript
   await blueCheckRegistry.updateManualPrice(newPriceInWei);
   ```

2. Test full purchase flow end-to-end

3. Set up indexer to listen for `BlueCheckPurchased` events

4. Ready for mainnet when tested!
