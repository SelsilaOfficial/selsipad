const hre = require('hardhat');

async function main() {
  console.log('\n⏰ VESTING SCHEDULE CHECK\n');

  const vestingVaultAddr = '0xCCFc8221d3B482740d04eEce281A1Ff8Bd9b51E9';
  const vesting = await hre.ethers.getContractAt('MerkleVesting', vestingVaultAddr);

  // Get vesting parameters
  const tgeUnlockBps = await vesting.tgeUnlockBps();
  const cliffDuration = await vesting.cliffDuration();
  const vestingDuration = await vesting.vestingDuration();
  const tgeTimestamp = await vesting.tgeTimestamp();

  console.log('📋 Vesting Configuration:\n');
  console.log(`  TGE Unlock: ${tgeUnlockBps} BPS (${Number(tgeUnlockBps) / 100}%)`);
  console.log(`  Cliff Duration: ${cliffDuration} seconds (${Number(cliffDuration) / 3600} hours)`);
  console.log(
    `  Vesting Duration: ${vestingDuration} seconds (${Number(vestingDuration) / 86400} days)`
  );
  console.log(`  TGE Time: ${new Date(Number(tgeTimestamp) * 1000).toISOString()}\n`);

  // Calculate key timestamps
  const tge = Number(tgeTimestamp);
  const cliffEnd = tge + Number(cliffDuration);
  const vestingEnd = cliffEnd + Number(vestingDuration);
  const now = Math.floor(Date.now() / 1000);

  console.log('⏳ Timeline:\n');

  // UTC times
  console.log('  UTC Times:');
  console.log(`  - TGE: ${new Date(tge * 1000).toISOString()}`);
  console.log(`  - Cliff End: ${new Date(cliffEnd * 1000).toISOString()}`);
  console.log(`  - Vesting End: ${new Date(vestingEnd * 1000).toISOString()}`);
  console.log(`  - Current: ${new Date(now * 1000).toISOString()}\n`);

  // WIB times (UTC+7)
  console.log('  WIB Times (UTC+7):');
  console.log(
    `  - TGE: ${new Date((tge + 7 * 3600) * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}`
  );
  console.log(
    `  - Cliff End: ${new Date((cliffEnd + 7 * 3600) * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}`
  );
  console.log(
    `  - Vesting End: ${new Date((vestingEnd + 7 * 3600) * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}`
  );
  console.log(
    `  - Current: ${new Date((now + 7 * 3600) * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}\n`
  );

  // Calculate time remaining
  console.log('⏱️  Time Remaining:\n');

  const tgeRemaining = tge - now;
  const cliffRemaining = cliffEnd - now;
  const vestingRemaining = vestingEnd - now;

  if (tgeRemaining > 0) {
    console.log(
      `  Until TGE: ${Math.floor(tgeRemaining / 3600)} hours ${Math.floor(
        (tgeRemaining % 3600) / 60
      )} minutes`
    );
  } else {
    console.log(`  TGE: ✅ Already happened (${Math.floor(-tgeRemaining / 3600)} hours ago)`);
  }

  if (cliffRemaining > 0) {
    const days = Math.floor(cliffRemaining / 86400);
    const hours = Math.floor((cliffRemaining % 86400) / 3600);
    const minutes = Math.floor((cliffRemaining % 3600) / 60);
    console.log(`  Until Cliff End: ${days} days ${hours} hours ${minutes} minutes`);
  } else {
    console.log(`  Cliff End: ✅ Already passed (${Math.floor(-cliffRemaining / 3600)} hours ago)`);
  }

  if (vestingRemaining > 0) {
    const days = Math.floor(vestingRemaining / 86400);
    const hours = Math.floor((vestingRemaining % 86400) / 3600);
    console.log(`  Until Full Vesting: ${days} days ${hours} hours`);
  } else {
    console.log(`  Vesting End: ✅ Fully vested`);
  }

  console.log('\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
