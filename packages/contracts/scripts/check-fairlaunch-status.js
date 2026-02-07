const { ethers } = require('hardhat');

async function main() {
  const address = '0xCFBe17F27f1aAECb8E6FB2d7F518e90720Fb35dC';
  console.log(`Checking Fairlaunch at: ${address}`);

  const Fairlaunch = await ethers.getContractFactory('Fairlaunch');
  const fairlaunch = Fairlaunch.attach(address);

  // Read State
  const status = await fairlaunch.status();
  const statusStr = ['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'][Number(status)];

  const startTime = await fairlaunch.startTime();
  const endTime = await fairlaunch.endTime();
  const now = Math.floor(Date.now() / 1000);

  const totalRaised = await fairlaunch.totalRaised();
  const softcap = await fairlaunch.softcap();
  const tokensForSale = await fairlaunch.tokensForSale();

  // Check Step
  // Enum: NONE, FEE_DISTRIBUTED, LIQUIDITY_ADDED, LP_LOCKED, FUNDS_DISTRIBUTED
  const finalizeStep = await fairlaunch.finalizeStep();
  const stepStr = ['NONE', 'FEE_DISTRIBUTED', 'LIQUIDITY_ADDED', 'LP_LOCKED', 'FUNDS_DISTRIBUTED'][
    Number(finalizeStep)
  ];

  console.log('\n--- STATUS REPORT ---');
  console.log(`Status: ${statusStr} (${status})`);
  console.log(`Step: ${stepStr} (${finalizeStep})`);
  console.log(
    `Time: ${new Date(Number(startTime) * 1000).toISOString()} -> ${new Date(
      Number(endTime) * 1000
    ).toISOString()}`
  );
  console.log(`Current Time: ${new Date(now * 1000).toISOString()}`);

  if (now < startTime) console.log('State: UPCOMING');
  else if (now >= startTime && now < endTime) console.log('State: LIVE');
  else console.log('State: ENDED (Time-wise)');

  console.log(`\nRaised: ${ethers.formatEther(totalRaised)} BNB`);
  console.log(`Softcap: ${ethers.formatEther(softcap)} BNB`);

  if (totalRaised >= softcap) {
    console.log('✅ Softcap MET');
  } else {
    console.log('❌ Softcap NOT MET');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
