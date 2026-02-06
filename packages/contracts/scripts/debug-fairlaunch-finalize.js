require('dotenv').config();
const hre = require('hardhat');

// Usage:
//   npx hardhat run scripts/debug-fairlaunch-finalize.js --network bscTestnet -- <FAIRLAUNCH_ADDRESS>
//
// Notes:
// - This script reads on-chain status/time and simulates finalize() to capture revert data.
// - It emits NDJSON debug logs to the provisioned local ingest server (best-effort).

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
  // Use global fetch if present (Node 18+). Best-effort only.
  Promise.resolve()
    .then(() => (typeof fetch === 'function' ? fetch(INGEST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }) : null))
    .catch(() => {});
  // #endregion
}

function pickAddr() {
  // Avoid logging secrets; just pick a sender address for eth_call.
  try {
    const pk = process.env.DEPLOYER_PRIVATE_KEY || process.env.ADMIN_DEPLOYER_PRIVATE_KEY;
    if (!pk) return null;
    const wallet = new hre.ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`);
    return wallet.address;
  } catch {
    return null;
  }
}

async function main() {
  const contractAddress = process.env.FAIRLAUNCH_ADDRESS || process.argv[2];
  if (!contractAddress) {
    throw new Error('Missing FAIRLAUNCH address. Set FAIRLAUNCH_ADDRESS env var.');
  }

  postLog({
    hypothesisId: 'A',
    location: 'packages/contracts/scripts/debug-fairlaunch-finalize.js:main:entry',
    message: 'debug script entry',
    data: { contractAddress },
  });

  const artifact = await hre.artifacts.readArtifact('Fairlaunch');
  const iface = new hre.ethers.Interface(artifact.abi);
  const contract = new hre.ethers.Contract(contractAddress, artifact.abi, hre.ethers.provider);

  const latestBlock = await hre.ethers.provider.getBlock('latest');
  const chainNow = latestBlock?.timestamp ?? null;
  const from = pickAddr();
  const contractBalance = await hre.ethers.provider.getBalance(contractAddress).catch(() => null);

  const read = async (fn) => {
    try {
      const v = await contract[fn]();
      return v;
    } catch {
      return null;
    }
  };

  const [
    storedStatus,
    calcStatus,
    startTime,
    endTime,
    isFinalized,
    totalRaised,
    softcap,
    tokensForSale,
    liquidityPercent,
    lpLockMonths,
    listingPremiumBps,
    projectToken,
    paymentToken,
    feeSplitter,
    projectOwner,
    teamVesting,
    dexRouter,
    lpLockerAddress,
  ] =
    await Promise.all([
      read('status'),
      read('getStatus'),
      read('startTime'),
      read('endTime'),
      read('isFinalized'),
      read('totalRaised'),
      read('softcap'),
      read('tokensForSale'),
      read('liquidityPercent'),
      read('lpLockMonths'),
      read('listingPremiumBps'),
      read('projectToken'),
      read('paymentToken'),
      read('feeSplitter'),
      read('projectOwner'),
      read('teamVesting'),
      read('dexRouter'),
      read('lpLockerAddress'),
    ]);

  const startTimeNum = startTime != null ? Number(startTime) : null;
  const endTimeNum = endTime != null ? Number(endTime) : null;

  const snapshot = {
    chainNow,
    chainNowIso: chainNow != null ? new Date(chainNow * 1000).toISOString() : null,
    from,
    contractBalance: contractBalance?.toString?.() ?? null,
    storedStatus: storedStatus?.toString?.() ?? null,
    calculatedStatus: calcStatus?.toString?.() ?? null,
    startTime: startTime?.toString?.() ?? null,
    endTime: endTime?.toString?.() ?? null,
    startIso: startTimeNum != null ? new Date(startTimeNum * 1000).toISOString() : null,
    endIso: endTimeNum != null ? new Date(endTimeNum * 1000).toISOString() : null,
    chainNowGteStart: chainNow != null && startTimeNum != null ? chainNow >= startTimeNum : null,
    chainNowGteEnd: chainNow != null && endTimeNum != null ? chainNow >= endTimeNum : null,
    isFinalized: isFinalized ?? null,
    totalRaised: totalRaised?.toString?.() ?? null,
    softcap: softcap?.toString?.() ?? null,
    tokensForSale: tokensForSale?.toString?.() ?? null,
    liquidityPercent: liquidityPercent?.toString?.() ?? null,
    lpLockMonths: lpLockMonths?.toString?.() ?? null,
    listingPremiumBps: listingPremiumBps?.toString?.() ?? null,
    projectToken,
    paymentToken,
    feeSplitter,
    projectOwner,
    teamVesting,
    dexRouter,
    lpLockerAddress,
  };

  // Extra checks: balances and code existence (helps isolate router/locker issues)
  const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
  let projectTokenBalance = null;
  try {
    if (projectToken && projectToken !== hre.ethers.ZeroAddress) {
      const token = new hre.ethers.Contract(projectToken, erc20Abi, hre.ethers.provider);
      projectTokenBalance = await token.balanceOf(contractAddress);
    }
  } catch {
    projectTokenBalance = null;
  }

  let routerCodeSize = null;
  try {
    if (dexRouter) {
      const code = await hre.ethers.provider.getCode(dexRouter);
      routerCodeSize = code && code !== '0x' ? Math.max(0, (code.length - 2) / 2) : 0;
    }
  } catch {
    routerCodeSize = null;
  }

  snapshot.projectTokenBalance = projectTokenBalance?.toString?.() ?? null;
  snapshot.routerCodeSize = routerCodeSize;

  // code size checks (EOA vs contract)
  try {
    const codeSize = async (addr) => {
      try {
        if (!addr) return null;
        const code = await hre.ethers.provider.getCode(addr);
        return code && code !== '0x' ? Math.max(0, (code.length - 2) / 2) : 0;
      } catch {
        return null;
      }
    };
    snapshot.projectOwnerCodeSize = await codeSize(projectOwner);
    snapshot.teamVestingCodeSize = await codeSize(teamVesting);
    snapshot.lpLockerCodeSize = await codeSize(lpLockerAddress);
  } catch {
    // ignore
  }

  // Router metadata
  try {
    if (dexRouter) {
      const routerAbi = [
        'function factory() view returns (address)',
        'function WETH() view returns (address)',
      ];
      const router = new hre.ethers.Contract(dexRouter, routerAbi, hre.ethers.provider);
      const [factoryAddr, wethAddr] = await Promise.all([
        router.factory().catch(() => null),
        router.WETH().catch(() => null),
      ]);
      snapshot.routerFactory = factoryAddr;
      snapshot.routerWETH = wethAddr;
      if (factoryAddr && projectToken && wethAddr) {
        const factoryAbi = ['function getPair(address,address) view returns (address)'];
        const f = new hre.ethers.Contract(factoryAddr, factoryAbi, hre.ethers.provider);
        snapshot.routerPair = await f.getPair(projectToken, wethAddr).catch(() => null);
      }
    }
  } catch {
    // ignore
  }

  // Token behavior probes: can the Fairlaunch contract approve/transfer?
  try {
    if (projectToken && projectToken !== hre.ethers.ZeroAddress) {
      const probeAbi = [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function owner() view returns (address)',
        'function approve(address spender,uint256 amount) returns (bool)',
        'function transfer(address to,uint256 amount) returns (bool)',
      ];
      const token = new hre.ethers.Contract(projectToken, probeAbi, hre.ethers.provider);
      const [name, symbol, decimals, owner] = await Promise.all([
        token.name().catch(() => null),
        token.symbol().catch(() => null),
        token.decimals().catch(() => null),
        token.owner().catch(() => null),
      ]);
      snapshot.tokenName = name;
      snapshot.tokenSymbol = symbol;
      snapshot.tokenDecimals = decimals != null ? Number(decimals) : null;
      snapshot.tokenOwner = owner;

      const tiny = 1n;
      const canApprove = await token.approve.staticCall(dexRouter, tiny, {
        from: contractAddress,
      }).then(() => true).catch(() => false);
      const canTransferToRouter = await token.transfer.staticCall(dexRouter, tiny, {
        from: contractAddress,
      }).then(() => true).catch(() => false);
      const burn = '0x000000000000000000000000000000000000dEaD';
      const canTransferToDead = await token.transfer.staticCall(burn, tiny, {
        from: contractAddress,
      }).then(() => true).catch(() => false);

      snapshot.tokenProbe_canApproveFromFairlaunch = canApprove;
      snapshot.tokenProbe_canTransferToRouterFromFairlaunch = canTransferToRouter;
      snapshot.tokenProbe_canTransferToDeadFromFairlaunch = canTransferToDead;
    }
  } catch {
    // ignore
  }

  // FeeSplitter probes: vault accept native? does distributeFairlaunchFee revert?
  try {
    if (feeSplitter) {
      const splitterAbi = [
        'function treasuryVault() view returns (address)',
        'function referralPoolVault() view returns (address)',
        'function sbtStakingVault() view returns (address)',
        'function feeConfig() view returns (uint256 totalBps,uint256 treasuryBps,uint256 referralPoolBps,uint256 sbtStakingBps)',
        'function distributeFairlaunchFee(address fairlaunch) external payable',
        // AccessControl (in some deployed variants)
        'function PRESALE_ROLE() view returns (bytes32)',
        'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
        'function hasRole(bytes32 role, address account) view returns (bool)',
        'function getRoleAdmin(bytes32 role) view returns (bytes32)',
      ];
      const splitter = new hre.ethers.Contract(feeSplitter, splitterAbi, hre.ethers.provider);
      const [treasuryVault, referralPoolVault, sbtStakingVault] = await Promise.all([
        splitter.treasuryVault().catch(() => null),
        splitter.referralPoolVault().catch(() => null),
        splitter.sbtStakingVault().catch(() => null),
      ]);
      const feeCfg = await splitter.feeConfig().catch(() => null);

      const codeSize = async (addr) => {
        try {
          if (!addr) return null;
          const code = await hre.ethers.provider.getCode(addr);
          return code && code !== '0x' ? Math.max(0, (code.length - 2) / 2) : 0;
        } catch {
          return null;
        }
      };

      snapshot.feeSplitterVaults = {
        treasuryVault,
        referralPoolVault,
        sbtStakingVault,
      };
      snapshot.feeSplitterVaultCodeSize = {
        treasuryVault: await codeSize(treasuryVault),
        referralPoolVault: await codeSize(referralPoolVault),
        sbtStakingVault: await codeSize(sbtStakingVault),
      };
      snapshot.feeSplitterCodeSize = await codeSize(feeSplitter);
      snapshot.feeSplitterFeeConfig = feeCfg
        ? {
            totalBps: feeCfg[0]?.toString?.() ?? null,
            treasuryBps: feeCfg[1]?.toString?.() ?? null,
            referralPoolBps: feeCfg[2]?.toString?.() ?? null,
            sbtStakingBps: feeCfg[3]?.toString?.() ?? null,
          }
        : null;

      // Role checks (helps confirm onlyRole gating on some deployments)
      try {
        const presaleRole = await splitter.PRESALE_ROLE().catch(() => null);
        const defaultAdminRole = await splitter.DEFAULT_ADMIN_ROLE().catch(() => null);
        if (presaleRole) {
          const [fairlaunchHas, eoaHas, adminRole, eoaAdminHas] = await Promise.all([
            splitter.hasRole(presaleRole, contractAddress).catch(() => null),
            splitter.hasRole(presaleRole, from).catch(() => null),
            splitter.getRoleAdmin(presaleRole).catch(() => null),
            defaultAdminRole ? splitter.hasRole(defaultAdminRole, from).catch(() => null) : null,
          ]);
          snapshot.feeSplitterRoles = {
            presaleRole,
            fairlaunchHasPresaleRole: fairlaunchHas,
            eoaHasPresaleRole: eoaHas,
            presaleRoleAdmin: adminRole,
            eoaHasDefaultAdminRole: eoaAdminHas,
          };
        }
      } catch {
        // ignore
      }

      // platformFee = totalRaised * 5%
      const raised = totalRaised != null ? BigInt(totalRaised.toString()) : null;
      const platformFee = raised != null ? (raised * 500n) / 10000n : null;
      snapshot.platformFeeWei = platformFee != null ? platformFee.toString() : null;

      if (platformFee != null && platformFee > 0n) {
        const tryStatic = async (fromAddr) => {
          try {
            await splitter.distributeFairlaunchFee.staticCall(contractAddress, {
              from: fromAddr ?? undefined,
              value: platformFee,
              gasLimit: 5_000_000,
            });
            return { ok: true, error: null };
          } catch (e) {
            const err = e || {};
            const data =
              err?.data ??
              err?.info?.error?.data ??
              err?.error?.data ??
              null;
            let decoded = null;
            if (typeof data === 'string' && data.startsWith('0x') && data.length >= 10) {
              try {
                decoded = splitter.interface.parseError(data);
              } catch {
                decoded = null;
              }
            }
            return {
              ok: false,
              error: {
                message: err?.message,
                code: err?.code,
                data: typeof data === 'string' ? data : null,
                decoded: decoded ? decoded.name : null,
              },
            };
          }
        };

        const [asFairlaunch, asEOA] = await Promise.all([
          tryStatic(contractAddress),
          tryStatic(from),
        ]);

        snapshot.feeSplitterProbe = {
          platformFeeWei: platformFee.toString(),
          asFairlaunch,
          asEOA,
        };
      }
    }
  } catch {
    // ignore
  }

  // Compute "extra tokens" cushion and a rough required liquidityTokens formula
  try {
    const tf = tokensForSale != null ? BigInt(tokensForSale.toString()) : null;
    const bal = projectTokenBalance != null ? BigInt(projectTokenBalance.toString()) : null;
    const liqBps = liquidityPercent != null ? BigInt(liquidityPercent.toString()) : null;
    const premiumBps = listingPremiumBps != null ? BigInt(listingPremiumBps.toString()) : null;
    const raised = totalRaised != null ? BigInt(totalRaised.toString()) : null;
    if (tf != null && bal != null && liqBps != null && premiumBps != null && raised != null && raised > 0n) {
      const extraTokens = bal > tf ? bal - tf : 0n;
      // liquidityTokens ~= (netRaised * liqBps / 10000) * tokensForSale / totalRaised / (1 + premium)
      // Approx netRaised = raised * 95% (platform fee 5%)
      const netRaised = (raised * 9500n) / 10000n;
      const liquidityFunds = (netRaised * liqBps) / 10000n;
      const denomPremium = 10000n + premiumBps;
      const approxLiquidityTokens = (liquidityFunds * tf * 10000n) / (raised * denomPremium);
      snapshot.extraTokens = extraTokens.toString();
      snapshot.approxLiquidityTokens = approxLiquidityTokens.toString();
      snapshot.approxLiquidityTokensGteExtra = approxLiquidityTokens >= extraTokens;
    }
  } catch {
    // ignore
  }

  console.log('=== Fairlaunch on-chain snapshot ===');
  console.log(snapshot);

  postLog({
    hypothesisId: 'A',
    location: 'packages/contracts/scripts/debug-fairlaunch-finalize.js:main:snapshot',
    message: 'on-chain snapshot',
    data: snapshot,
  });

  // Simulate finalize() via eth_call (static call) to capture revert reason/data.
  // Also try eth_estimateGas to detect potential out-of-gas vs logic revert.
  try {
    const est = await contract.finalize.estimateGas({ from: from ?? undefined });
    console.log('ℹ️ finalize() estimateGas:', est.toString());
    postLog({
      hypothesisId: 'E',
      location: 'packages/contracts/scripts/debug-fairlaunch-finalize.js:main:estimateGas',
      message: 'finalize estimateGas success',
      data: { estimatedGas: est.toString() },
    });
  } catch (e) {
    const err = e || {};
    console.log('ℹ️ finalize() estimateGas: FAILED');
    console.log({ message: err?.message, code: err?.code, data: err?.data ?? err?.info?.error?.data ?? null });
    postLog({
      hypothesisId: 'E',
      location: 'packages/contracts/scripts/debug-fairlaunch-finalize.js:main:estimateGas',
      message: 'finalize estimateGas failed',
      data: {
        message: err?.message,
        code: err?.code,
        data: err?.data ?? err?.info?.error?.data ?? null,
      },
    });
  }

  try {
    // ethers v6: staticCall on function
    await contract.finalize.staticCall({ from: from ?? undefined, gasLimit: 15_000_000 });
    console.log('✅ finalize() staticCall: SUCCESS (would not revert)');
    postLog({
      hypothesisId: 'E',
      location: 'packages/contracts/scripts/debug-fairlaunch-finalize.js:main:staticCall',
      message: 'finalize staticCall success',
      data: {},
    });
  } catch (e) {
    const err = e || {};
    const data =
      err?.data ??
      err?.info?.error?.data ??
      err?.error?.data ??
      err?.receipt?.revertReason ??
      null;

    let decoded = null;
    if (typeof data === 'string' && data.startsWith('0x') && data.length >= 10) {
      try {
        decoded = iface.parseError(data);
      } catch {
        decoded = null;
      }
    }

    console.log('❌ finalize() staticCall: REVERT');
    console.log({
      name: err?.name,
      code: err?.code,
      shortMessage: err?.shortMessage,
      message: err?.message,
      data,
      decoded: decoded
        ? { name: decoded?.name, args: decoded?.args ? Array.from(decoded.args) : [] }
        : null,
    });

    postLog({
      hypothesisId: 'E',
      location: 'packages/contracts/scripts/debug-fairlaunch-finalize.js:main:staticCall',
      message: 'finalize staticCall revert',
      data: {
        name: err?.name,
        code: err?.code,
        shortMessage: err?.shortMessage,
        message: err?.message,
        data,
        decoded: decoded ? { name: decoded?.name } : null,
      },
    });
  }
}

main().catch((e) => {
  console.error(e);
  postLog({
    hypothesisId: 'D',
    location: 'packages/contracts/scripts/debug-fairlaunch-finalize.js:main:fatal',
    message: 'script fatal error',
    data: { message: e?.message },
  });
  process.exitCode = 1;
});

