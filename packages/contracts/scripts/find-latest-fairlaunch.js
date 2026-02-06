require('dotenv').config();
const hre = require('hardhat');

// Find most recent FairlaunchCreated events from a factory.
//
// Usage:
//   FAIRLAUNCH_FACTORY_ADDRESS=0x... npx hardhat run scripts/find-latest-fairlaunch.js --network bscTestnet
//
// Defaults to the new BSC testnet factory deployed in this session.

const INGEST =
  'http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07';

function postLog(payload) {
  // #region agent log (debug-session)
  const body = JSON.stringify({
    sessionId: 'debug-session',
    runId: 'pre-fix',
    timestamp: Date.now(),
    ...payload,
  });
  Promise.resolve()
    .then(() =>
      typeof fetch === 'function'
        ? fetch(INGEST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
        : null
    )
    .catch(() => {});
  // #endregion
}

async function main() {
  const factoryAddress =
    process.env.FAIRLAUNCH_FACTORY_ADDRESS || '0x12c426d52B936c799ea3b1c28d0979d4CDbCB05E';

  const artifact = await hre.artifacts.readArtifact('FairlaunchFactory');
  const iface = new hre.ethers.Interface(artifact.abi);

  const latest = await hre.ethers.provider.getBlockNumber();
  const ranges = [2000, 10000, 50000, 200000];

  console.log('Factory:', factoryAddress);
  console.log('Latest block:', latest);

  for (const span of ranges) {
    const fromBlock = Math.max(0, latest - span);
    const toBlock = latest;

    console.log(`\nSearching FairlaunchCreated in blocks [${fromBlock}, ${toBlock}]...`);

    const topic = iface.getEvent('FairlaunchCreated').topicHash;
    const logs = await hre.ethers.provider.getLogs({
      address: factoryAddress,
      fromBlock,
      toBlock,
      topics: [topic],
    });

    if (!logs.length) {
      console.log('  none found');
      continue;
    }

    const decoded = logs
      .map((l) => {
        const parsed = iface.parseLog({ topics: l.topics, data: l.data });
        return {
          blockNumber: l.blockNumber,
          txHash: l.transactionHash,
          fairlaunchId: parsed.args.fairlaunchId?.toString?.(),
          fairlaunch: parsed.args.fairlaunch,
          vesting: parsed.args.vesting,
          projectToken: parsed.args.projectToken,
        };
      })
      .sort((a, b) => a.blockNumber - b.blockNumber);

    const last = decoded[decoded.length - 1];

    console.log('Found:', decoded.length);
    console.log('Most recent:', last);

    postLog({
      hypothesisId: 'C',
      location: 'packages/contracts/scripts/find-latest-fairlaunch.js:main:found',
      message: 'found fairlaunch created events',
      data: { factoryAddress, fromBlock, toBlock, count: decoded.length, last },
    });

    // Print a short list (last 5)
    console.log('\nLast 5:');
    decoded.slice(-5).forEach((x) => console.log(' ', x));

    return;
  }

  postLog({
    hypothesisId: 'C',
    location: 'packages/contracts/scripts/find-latest-fairlaunch.js:main:none',
    message: 'no fairlaunch created events found in searched ranges',
    data: { factoryAddress, latest },
  });

  console.log('\nNo FairlaunchCreated events found in searched ranges.');
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  postLog({
    hypothesisId: 'D',
    location: 'packages/contracts/scripts/find-latest-fairlaunch.js:main:fatal',
    message: 'script fatal error',
    data: { message: e?.message },
  });
  process.exitCode = 1;
});

