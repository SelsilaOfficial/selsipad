import { createPublicClient, http, parseAbiItem } from 'viem';
import { bscTestnet } from 'viem/chains';

const client = createPublicClient({
  chain: bscTestnet,
  transport: http('https://bnb-testnet.g.alchemy.com/v2/DuzhFRcH3Eh8ECCk8p1pW'),
});

async function main() {
  // Get the deploy block from the tx hash
  const receipt = await client.getTransactionReceipt({
    hash: '0x1c242f31c73fdabee7433d5c075c856864a60e12a7e6bd7b06f245f8397335f7',
  });
  console.log('Deploy block:', receipt.blockNumber.toString());

  const currentBlock = await client.getBlockNumber();
  console.log('Current block:', currentBlock.toString());

  // Query events from deploy block in chunks of 5000
  const deployBlock = receipt.blockNumber;

  for (let from = deployBlock; from <= currentBlock; from += 5000n) {
    const to = from + 5000n > currentBlock ? currentBlock : from + 5000n;
    try {
      const logs = await client.getLogs({
        address: '0x131d37e2F5C95da8A605A97F8B8b16dc7A271b70',
        event: parseAbiItem(
          'event Contributed(address indexed user, uint256 amount, uint256 totalRaised)'
        ),
        fromBlock: from,
        toBlock: to,
      });
      if (logs.length > 0) {
        console.log('Found', logs.length, 'events in range', from.toString(), '-', to.toString());
        for (const log of logs) {
          const data = {
            user: log.args.user,
            amount: Number(log.args.amount!) / 1e18,
            totalRaised: Number(log.args.totalRaised!) / 1e18,
            txHash: log.transactionHash,
            block: Number(log.blockNumber),
          };
          console.log(JSON.stringify(data));
        }
      }
    } catch (err: any) {
      console.error(
        'Error for range',
        from.toString(),
        '-',
        to.toString(),
        ':',
        err.message?.substring(0, 100)
      );
    }
  }
  console.log('Done scanning');
}
main();
