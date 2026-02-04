import { network } from 'hardhat';

export async function now(): Promise<number> {
  const block = await network.provider.send('eth_getBlockByNumber', ['latest', false]);
  return parseInt(block.timestamp, 16);
}

export async function increaseTime(seconds: number) {
  await network.provider.send('evm_increaseTime', [seconds]);
  await network.provider.send('evm_mine');
}

export async function setNextTimestamp(ts: number) {
  await network.provider.send('evm_setNextBlockTimestamp', [ts]);
  await network.provider.send('evm_mine');
}
