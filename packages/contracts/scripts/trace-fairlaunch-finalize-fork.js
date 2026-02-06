require('dotenv').config();
const hre = require('hardhat');

// Fork BSC testnet locally and trace finalize() call.
//
// Usage:
//   FAIRLAUNCH_ADDRESS=0x... npx hardhat run scripts/trace-fairlaunch-finalize-fork.js
//
// Output:
// - Prints a call trace with the first failing subcall address (if any).
// - Also posts a compact summary to the debug ingest server (best-effort).

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

function normalizeAddr(word) {
  if (!word) return null;
  const hex = String(word).toLowerCase().replace(/^0x/, '');
  if (hex.length === 0) return null;
  return `0x${hex.slice(-40).padStart(40, '0')}`;
}

function analyzeStructLogs(fairlaunch, structLogs) {
  const addrByDepth = { 0: fairlaunch };
  const nextAddrByDepth = {};
  let maxRevertDepth = -1;
  let maxRevert = null;

  for (let i = 0; i < structLogs.length; i++) {
    const step = structLogs[i];
    const depth = step?.depth ?? 0;

    if (nextAddrByDepth[depth] && !addrByDepth[depth]) {
      addrByDepth[depth] = nextAddrByDepth[depth];
    }

    const op = step?.op;
    const stack = step?.stack || [];

    if (op === 'CALL' || op === 'STATICCALL' || op === 'DELEGATECALL' || op === 'CALLCODE') {
      // Destination is the 2nd item from the top for these opcodes.
      const toWord = stack.length >= 2 ? stack[stack.length - 2] : null;
      const to = normalizeAddr(toWord);
      if (to) nextAddrByDepth[depth + 1] = to;
    }

    if (op === 'REVERT' || op === 'INVALID') {
      if (depth > maxRevertDepth) {
        maxRevertDepth = depth;
        const chain = [];
        for (let d = 0; d <= depth; d++) chain.push(addrByDepth[d] || nextAddrByDepth[d] || null);
        maxRevert = {
          op,
          depth,
          pc: step?.pc,
          address: addrByDepth[depth] || nextAddrByDepth[depth] || null,
          callChain: chain,
          index: i,
        };
      }
    }
  }

  return { maxRevertDepth, maxRevert };
}

async function main() {
  const fairlaunch = process.env.FAIRLAUNCH_ADDRESS;
  if (!fairlaunch) throw new Error('Set FAIRLAUNCH_ADDRESS env var');
  const forkUrl = process.env.BSC_TESTNET_RPC_URL;
  if (!forkUrl) throw new Error('Missing BSC_TESTNET_RPC_URL in env');

  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [{ forking: { jsonRpcUrl: forkUrl } }],
  });

  const artifact = await hre.artifacts.readArtifact('Fairlaunch');
  const iface = new hre.ethers.Interface(artifact.abi);
  const data = iface.encodeFunctionData('finalize', []);

  const from = '0x95D94D86CfC550897d2b80672a3c94c12429a90D'; // public address only (no secret)

  postLog({
    hypothesisId: 'E',
    location: 'packages/contracts/scripts/trace-fairlaunch-finalize-fork.js:main:entry',
    message: 'starting fork trace',
    data: { fairlaunch },
  });

  const trace = await hre.network.provider.request({
    method: 'debug_traceCall',
    params: [
      {
        from,
        to: fairlaunch,
        data,
        gas: '0xE4E1C0', // 15,000,000
      },
      'latest',
    ],
  });

  const analysis = analyzeStructLogs(fairlaunch, trace?.structLogs || []);
  console.log('=== debug_traceCall summary ===');
  console.log({
    failed: trace?.failed ?? null,
    gas: trace?.gas ?? null,
    returnValue: trace?.returnValue ?? null,
    maxRevert: analysis.maxRevert,
  });

  postLog({
    hypothesisId: 'E',
    location: 'packages/contracts/scripts/trace-fairlaunch-finalize-fork.js:main:result',
    message: 'fork trace result',
    data: {
      failed: trace?.failed ?? null,
      maxRevert: analysis.maxRevert,
    },
  });
}

main().catch((e) => {
  console.error(e);
  postLog({
    hypothesisId: 'D',
    location: 'packages/contracts/scripts/trace-fairlaunch-finalize-fork.js:main:fatal',
    message: 'script fatal error',
    data: { message: e?.message },
  });
  process.exitCode = 1;
});

