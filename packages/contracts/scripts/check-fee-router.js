const hre = require('hardhat');

const FAIRLAUNCH = '0xd1c2361712cAC445b880332D2E86997d4f9c2436';
const BSC_TESTNET_ROUTER = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1';
const BSC_MAINNET_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

async function main() {
  const abi = [
    'function feeSplitter() view returns (address)',
    'function dexRouter() view returns (address)',
    'function isFinalized() view returns (bool)',
  ];
  const contract = new hre.ethers.Contract(FAIRLAUNCH, abi, hre.ethers.provider);

  console.log('Fairlaunch:', FAIRLAUNCH);
  console.log('Chain: BSC Testnet (97)\n');

  const [feeSplitter, dexRouter, isFinalized] = await Promise.all([
    contract.feeSplitter(),
    contract.dexRouter(),
    contract.isFinalized(),
  ]);

  const feeCode = await hre.ethers.provider.getCode(feeSplitter);
  const routerCode = await hre.ethers.provider.getCode(dexRouter);

  console.log('--- FeeSplitter ---');
  console.log('   Address:', feeSplitter);
  console.log('   Is contract:', feeCode !== '0x' && feeCode.length > 2 ? 'YES' : 'NO');
  const feeOk = feeSplitter !== hre.ethers.ZeroAddress && feeCode !== '0x' && feeCode.length > 2;
  console.log('   Valid:', feeOk ? 'YES' : 'NO');

  console.log('\n--- DEX Router ---');
  console.log('   Address:', dexRouter);
  console.log('   Is contract:', routerCode !== '0x' && routerCode.length > 2 ? 'YES' : 'NO');
  console.log('   Expected (BSC Testnet V2):', BSC_TESTNET_ROUTER);
  const routerMatch = dexRouter && dexRouter.toLowerCase() === BSC_TESTNET_ROUTER.toLowerCase();
  console.log('   Match:', routerMatch ? 'YES' : 'NO');
  if (dexRouter && dexRouter.toLowerCase() === BSC_MAINNET_ROUTER.toLowerCase()) {
    console.log('   WARNING: Router is BSC MAINNET - wrong for Testnet!');
  }

  console.log('\n--- Summary ---');
  console.log('   Finalized:', isFinalized);
  console.log('   FeeSplitter:', feeOk ? 'OK' : 'Invalid or zero');
  console.log('   DEX Router:', routerMatch ? 'OK (PancakeSwap V2 Testnet)' : 'Wrong or not contract');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
