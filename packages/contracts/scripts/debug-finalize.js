const hre = require('hardhat');

async function main() {
  const contractAddress = '0x4dE0d3CbF18550300a43AF99FA0b7Ec62841b1A1';

  const fullAbi = require('../artifacts/contracts/fairlaunch/Fairlaunch.sol/Fairlaunch.json').abi;

  const contract = new hre.ethers.Contract(contractAddress, fullAbi, hre.ethers.provider);

  console.log('🔍 Pre-Finalize State Debugging\n');

  // Get basic state
  const [
    projectToken,
    paymentToken,
    totalRaised,
    softcap,
    tokensForSale,
    feeSplitter,
    dexRouter,
    lpLocker,
    liquidityPercent,
    listingPremiumBps,
  ] = await Promise.all([
    contract.projectToken(),
    contract.paymentToken(),
    contract.totalRaised(),
    contract.softcap(),
    contract.tokensForSale(),
    contract.feeSplitter(),
    contract.dexRouter(),
    contract.lpLockerAddress(),
    contract.liquidityPercent(),
    contract.listingPremiumBps(),
  ]);

  console.log('=== Basic Configuration ===');
  console.log('Project Token:', projectToken);
  console.log(
    'Payment Token:',
    paymentToken === hre.ethers.ZeroAddress ? 'BNB (native)' : paymentToken
  );
  console.log('Total Raised:', hre.ethers.formatEther(totalRaised), 'BNB');
  console.log('Softcap:', hre.ethers.formatEther(softcap), 'BNB');
  console.log('Tokens For Sale:', hre.ethers.formatEther(tokensForSale));
  console.log('Fee Splitter:', feeSplitter);
  console.log('DEX Router:', dexRouter);
  console.log('LP Locker:', lpLocker);
  console.log('Liquidity %:', (Number(liquidityPercent) / 100).toFixed(0) + '%');
  console.log('Listing Premium BPS:', listingPremiumBps.toString());

  // Check balances
  console.log('\n=== Contract Balances ===');

  const tokenContract = new hre.ethers.Contract(
    projectToken,
    ['function balanceOf(address) view returns (uint256)'],
    hre.ethers.provider
  );

  const [bnbBalance, tokenBalance] = await Promise.all([
    hre.ethers.provider.getBalance(contractAddress),
    tokenContract.balanceOf(contractAddress),
  ]);

  console.log('Contract BNB Balance:', hre.ethers.formatEther(bnbBalance));
  console.log('Contract Token Balance:', hre.ethers.formatEther(tokenBalance));

  // Calculate expected amounts
  console.log('\n=== Expected Finalize Calculations ===');

  const platformFee = (totalRaised * 500n) / 10000n; // 5%
  const netRaised = totalRaised - platformFee;
  const liquidityFunds = (netRaised * liquidityPercent) / 10000n;

  const finalTokenPrice = (totalRaised * hre.ethers.parseEther('1')) / tokensForSale;
  const listingPrice = (finalTokenPrice * (10000n + listingPremiumBps)) / 10000n;
  const liquidityTokens = (liquidityFunds * hre.ethers.parseEther('1')) / listingPrice;

  console.log('Platform Fee (5%):', hre.ethers.formatEther(platformFee), 'BNB');
  console.log('Net Raised:', hre.ethers.formatEther(netRaised), 'BNB');
  console.log('Liquidity Funds:', hre.ethers.formatEther(liquidityFunds), 'BNB');
  console.log('Final Token Price:', hre.ethers.formatEther(finalTokenPrice), 'BNB per token');
  console.log('Listing Price:', hre.ethers.formatEther(listingPrice), 'BNB per token');
  console.log('Liquidity Tokens needed:', hre.ethers.formatEther(liquidityTokens));

  // Check if contract has enough tokens
  console.log('\n=== Token Sufficiency Check ===');
  const hasEnoughTokens = tokenBalance >= liquidityTokens;
  console.log('Has enough tokens for liquidity?', hasEnoughTokens ? '✅ YES' : '❌ NO');
  if (!hasEnoughTokens) {
    console.log('  DEFICIT:', hre.ethers.formatEther(liquidityTokens - tokenBalance), 'tokens');
  }

  // Check if contract has enough BNB
  console.log('Has enough BNB for liquidity?', bnbBalance >= liquidityFunds ? '✅ YES' : '❌ NO');
  if (bnbBalance < liquidityFunds) {
    console.log('  DEFICIT:', hre.ethers.formatEther(liquidityFunds - bnbBalance), 'BNB');
  }

  // Check FeeSplitter
  console.log('\n=== FeeSplitter Check ===');
  try {
    const feeSplitterCode = await hre.ethers.provider.getCode(feeSplitter);
    console.log(
      'FeeSplitter is contract?',
      feeSplitterCode !== '0x' ? '✅ YES' : '❌ NO (EOA or non-existent)'
    );
  } catch (e) {
    console.log('FeeSplitter check failed:', e.message);
  }

  // Check DEX Router
  console.log('\n=== DEX Router Check ===');
  try {
    const routerCode = await hre.ethers.provider.getCode(dexRouter);
    console.log('Router is contract?', routerCode !== '0x' ? '✅ YES' : '❌ NO');

    if (routerCode !== '0x') {
      const routerContract = new hre.ethers.Contract(
        dexRouter,
        ['function factory() view returns (address)'],
        hre.ethers.provider
      );
      const factoryAddress = await routerContract.factory();
      console.log('Router Factory:', factoryAddress);
    }
  } catch (e) {
    console.log('Router check failed:', e.message);
  }

  console.log('\n=== POTENTIAL ISSUES ===');
  const issues = [];

  if (!hasEnoughTokens) {
    issues.push('❌ Contract lacks sufficient tokens for liquidity');
  }
  if (bnbBalance < liquidityFunds) {
    issues.push('❌ Contract lacks sufficient BNB for liquidity');
  }
  if (lpLocker === hre.ethers.ZeroAddress) {
    issues.push('❌ LP Locker not set');
  }

  if (issues.length === 0) {
    console.log('✅ No obvious issues found - revert likely from DEX interaction');
  } else {
    issues.forEach((issue) => console.log(issue));
  }
}

main().catch(console.error);
