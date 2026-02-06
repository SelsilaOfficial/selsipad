/**
 * Check FeeSplitter and DEX router on a Fairlaunch contract (BSC Testnet).
 * Usage: node check_fee_router.js
 */
const ethers = require('ethers');

const RPC = process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';
const FAIRLAUNCH_ADDRESS = '0xd1c2361712cAC445b880332D2E86997d4f9c2436';

const BSC_TESTNET_ROUTER = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1';
const BSC_MAINNET_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

const abi = [
  'function feeSplitter() view returns (address)',
  'function dexRouter() view returns (address)',
  'function isFinalized() view returns (bool)',
  'function paymentToken() view returns (address)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const contract = new ethers.Contract(FAIRLAUNCH_ADDRESS, abi, provider);

  console.log('🔍 Fairlaunch:', FAIRLAUNCH_ADDRESS);
  console.log('   Chain: BSC Testnet (97)\n');

  const [feeSplitter, dexRouter, isFinalized, paymentToken] = await Promise.all([
    contract.feeSplitter(),
    contract.dexRouter(),
    contract.isFinalized(),
    contract.paymentToken(),
  ]);

  console.log('--- FeeSplitter ---');
  console.log('   Address:', feeSplitter);
  const feeCode = await provider.getCode(feeSplitter);
  const feeOk = feeSplitter !== ethers.ZeroAddress && feeCode !== '0x' && feeCode.length > 2;
  console.log('   Is contract:', feeCode !== '0x' && feeCode.length > 2 ? '✅ YES' : '❌ NO');
  console.log('   Valid:', feeOk ? '✅' : '❌');

  console.log('\n--- DEX Router ---');
  console.log('   Address:', dexRouter);
  const routerCode = await provider.getCode(dexRouter);
  const routerIsContract = routerCode !== '0x' && routerCode.length > 2;
  console.log('   Is contract:', routerIsContract ? '✅ YES' : '❌ NO');

  const expectedRouter = BSC_TESTNET_ROUTER;
  const routerMatch = dexRouter && dexRouter.toLowerCase() === expectedRouter.toLowerCase();
  console.log('   Expected (BSC Testnet V2):', expectedRouter);
  console.log('   Match:', routerMatch ? '✅ YES' : '❌ NO');

  if (dexRouter && !routerMatch) {
    const isMainnet = dexRouter.toLowerCase() === BSC_MAINNET_ROUTER.toLowerCase();
    if (isMainnet) console.log('   ⚠️  Router is BSC MAINNET – wrong for Testnet!');
  }

  console.log('\n--- Summary ---');
  console.log('   Finalized:', isFinalized);
  console.log('   Payment token (native if zero):', paymentToken === ethers.ZeroAddress ? 'NATIVE (BNB)' : paymentToken);
  console.log('');
  console.log('   FeeSplitter:', feeOk ? '✅ OK' : '❌ Invalid or zero');
  console.log('   DEX Router:', routerMatch && routerIsContract ? '✅ OK (PancakeSwap V2 Testnet)' : '❌ Wrong or not contract');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
