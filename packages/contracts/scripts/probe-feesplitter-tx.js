require('dotenv').config();
const hre = require('hardhat');

// Sends a tiny real tx to FeeSplitter.distributeFairlaunchFee to confirm
// whether FeeSplitter is executable on-chain (not just eth_call).
//
// Usage:
//   FAIRLAUNCH_ADDRESS=0x... npx hardhat run scripts/probe-feesplitter-tx.js --network bscTestnet
//
// Notes:
// - Sends value=1 wei (minimal side-effect).
// - Requires DEPLOYER_PRIVATE_KEY in env for signing.

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
  const fairlaunch = process.env.FAIRLAUNCH_ADDRESS;
  if (!fairlaunch) throw new Error('Set FAIRLAUNCH_ADDRESS env var');

  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('Missing DEPLOYER_PRIVATE_KEY in env');
  const wallet = new hre.ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`, hre.ethers.provider);

  const fairlaunchAbi = [
    'function feeSplitter() view returns (address)',
  ];
  const fl = new hre.ethers.Contract(fairlaunch, fairlaunchAbi, hre.ethers.provider);
  const feeSplitter = await fl.feeSplitter();

  const splitterAbi = [
    'function distributeFairlaunchFee(address fairlaunch) external payable',
  ];
  const splitterIface = new hre.ethers.Interface(splitterAbi);
  const calldata = splitterIface.encodeFunctionData('distributeFairlaunchFee', [fairlaunch]);
  console.log('calldata:', calldata);

  postLog({
    hypothesisId: 'E',
    location: 'packages/contracts/scripts/probe-feesplitter-tx.js:main:send',
    message: 'sending feeSplitter probe tx',
    data: { fairlaunch, feeSplitter, from: wallet.address, valueWei: '1' },
  });

  try {
    const txRequest = {
      to: feeSplitter,
      data: calldata,
      value: 1n,
      gasLimit: 500000,
    };
    console.log('txRequest:', {
      to: txRequest.to,
      dataPrefix: typeof txRequest.data === 'string' ? txRequest.data.slice(0, 18) : null,
      value: txRequest.value?.toString?.() ?? String(txRequest.value),
      gasLimit: txRequest.gasLimit?.toString?.() ?? String(txRequest.gasLimit),
    });

    const tx = await wallet.sendTransaction(txRequest);
    const receipt = await tx.wait();
    console.log('✅ FeeSplitter probe tx receipt:', {
      hash: tx.hash,
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString?.(),
    });
    postLog({
      hypothesisId: 'E',
      location: 'packages/contracts/scripts/probe-feesplitter-tx.js:main:receipt',
      message: 'feeSplitter probe tx receipt',
      data: {
        hash: tx.hash,
        status: receipt.status,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString?.(),
      },
    });
  } catch (err) {
    console.log('❌ FeeSplitter probe tx reverted:', {
      message: err?.message,
      code: err?.code,
      data: err?.data ?? err?.info?.error?.data ?? null,
    });
    postLog({
      hypothesisId: 'E',
      location: 'packages/contracts/scripts/probe-feesplitter-tx.js:main:error',
      message: 'feeSplitter probe tx reverted',
      data: {
        message: err?.message,
        code: err?.code,
        data: err?.data ?? err?.info?.error?.data ?? null,
      },
    });
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  postLog({
    hypothesisId: 'D',
    location: 'packages/contracts/scripts/probe-feesplitter-tx.js:main:fatal',
    message: 'probe script fatal',
    data: { message: e?.message },
  });
  process.exitCode = 1;
});

