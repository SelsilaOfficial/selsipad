/**
 * Check Fairlaunch contract status and configuration
 */

import { ethers } from 'hardhat';

async function main() {
  const FAIRLAUNCH_ADDRESS =
    process.env.FAIRLAUNCH_ADDRESS || '0x612f1d8D7184EdcD7a017E5990B477498BCfbB0f';

  console.log('\n📊 Fairlaunch Status Check');
  console.log('=====================================');
  console.log(`Contract: ${FAIRLAUNCH_ADDRESS}`);

  // Load contract
  const Fairlaunch = await ethers.getContractFactory('Fairlaunch');
  const fairlaunch = Fairlaunch.attach(FAIRLAUNCH_ADDRESS);

  try {
    // Get status
    const status = await fairlaunch.status();
    const statusNames = ['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'];
    console.log(`\nCurrent Status: ${statusNames[status]} (${status})`);

    // Get dynamic status (includes time-based updates)
    const dynamicStatus = await fairlaunch.getStatus();
    console.log(`Dynamic Status: ${statusNames[dynamicStatus]} (${dynamicStatus})`);

    // Get times
    const startTime = await fairlaunch.startTime();
    const endTime = await fairlaunch.endTime();
    const currentBlockTime = (await ethers.provider.getBlock('latest'))!.timestamp;

    console.log(`\n⏰ Time Info`);
    console.log(`Start Time: ${new Date(Number(startTime) * 1000).toISOString()}`);
    console.log(`End Time: ${new Date(Number(endTime) * 1000).toISOString()}`);
    console.log(`Current Time: ${new Date(currentBlockTime * 1000).toISOString()}`);
    console.log(`Has Ended?: ${currentBlockTime >= endTime ? 'YES ✅' : 'NO ❌'}`);

    // Get raise info
    const totalRaised = await fairlaunch.totalRaised();
    const softcap = await fairlaunch.softcap();
    const tokensForSale = await fairlaunch.tokensForSale();

    console.log(`\n💰 Raise Info`);
    console.log(`Total Raised: ${ethers.formatEther(totalRaised)} BNB`);
    console.log(`Softcap: ${ethers.formatEther(softcap)} BNB`);
    console.log(`Softcap Met?: ${totalRaised >= softcap ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Tokens for Sale: ${ethers.formatUnits(tokensForSale, 18)} LAMP`);

    // Get finalization info
    const isFinalized = await fairlaunch.isFinalized();
    const finalTokenPrice = await fairlaunch.finalTokenPrice();

    console.log(`\n🔒 Finalization Info`);
    console.log(`Is Finalized?: ${isFinalized ? 'YES' : 'NO'}`);
    console.log(
      `Final Token Price: ${ethers.formatEther(finalTokenPrice)} BNB (0 if not finalized)`
    );

    // Get LP config
    const liquidityPercent = await fairlaunch.liquidityPercent();
    const lpLockMonths = await fairlaunch.lpLockMonths();
    const lpLocker = await fairlaunch.lpLocker();

    console.log(`\n🏊 LP Config`);
    console.log(`Liquidity %: ${Number(liquidityPercent) / 100}%`);
    console.log(`LP Lock Months: ${lpLockMonths}`);
    console.log(`LP Locker: ${lpLocker}`);
    console.log(`LP Locker Set?: ${lpLocker !== ethers.ZeroAddress ? 'YES ✅' : 'NO ❌'}`);

    // Check readiness for finalization
    console.log(`\n✅ Finalization Checklist`);
    const canFinalize =
      dynamicStatus === 2 && // ENDED
      !isFinalized &&
      totalRaised >= softcap &&
      lpLocker !== ethers.ZeroAddress;

    console.log(`1. Status is ENDED: ${dynamicStatus === 2 ? '✅' : '❌'}`);
    console.log(`2. Not finalized yet: ${!isFinalized ? '✅' : ' ❌'}`);
    console.log(`3. Softcap met: ${totalRaised >= softcap ? '✅' : '❌'}`);
    console.log(`4. LP Locker set: ${lpLocker !== ethers.ZeroAddress ? '✅' : '❌'}`);
    console.log(`\nCan Finalize?: ${canFinalize ? 'YES ✅' : 'NO ❌'}`);
  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
