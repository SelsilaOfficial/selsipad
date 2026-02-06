/**
 * Find the tx that emitted Fairlaunch Cancelled() event.
 *
 * Usage:
 *   FAIRLAUNCH_ADDRESS=0x... npx hardhat run scripts/fairlaunch/find-cancelled-tx.ts --network bscTestnet
 */
import { ethers } from 'hardhat';

async function main() {
  const FAIRLAUNCH_ADDRESS = process.env.FAIRLAUNCH_ADDRESS;
  if (!FAIRLAUNCH_ADDRESS) {
    throw new Error('Missing env FAIRLAUNCH_ADDRESS');
  }

  const provider = ethers.provider;
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 50_000);

  const topic0 = ethers.id('Cancelled()');

  const logs = await provider.getLogs({
    address: FAIRLAUNCH_ADDRESS,
    topics: [topic0],
    fromBlock,
    toBlock: latestBlock,
  });

  console.log('\n🔎 Cancelled() Event Search');
  console.log('=====================================');
  console.log(`Contract: ${FAIRLAUNCH_ADDRESS}`);
  console.log(`Block range: ${fromBlock} .. ${latestBlock}`);
  console.log(`Matches: ${logs.length}`);

  if (logs.length === 0) {
    console.log('\nNo Cancelled() logs found in this range.');
    console.log('Try increasing the lookback window (edit script) if needed.');
    return;
  }

  const last = logs[logs.length - 1]!;
  const blk = await provider.getBlock(last.blockNumber);
  const tx = await provider.getTransaction(last.transactionHash);

  console.log('\n✅ Latest Cancelled() found');
  console.log(`Tx hash: ${last.transactionHash}`);
  console.log(`Block: ${last.blockNumber}`);
  console.log(`Block time: ${new Date((blk?.timestamp ?? 0) * 1000).toISOString()}`);
  console.log(`From: ${tx?.from ?? '(unknown)'}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Error:', e?.message || e);
    process.exit(1);
  });

