// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable}          from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard}  from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SelsipadBCToken.sol";

/* ─── Interfaces ─── */

interface IUniswapV2Router02 {
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    function WETH() external view returns (address);
    function factory() external view returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IERC20Minimal {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account)               external view returns (uint256);
    function transfer(address to, uint256 value)      external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/**
 * @title SelsipadBondingCurveFactory
 * @notice Creates bonding-curve tokens and handles buy/sell trading with a
 *         constant-product (x·y = k) virtual AMM.  When the real ETH/BNB
 *         reserve hits the migration threshold the liquidity is automatically
 *         migrated to a DEX (PancakeSwap / Uniswap V2).
 *
 * Fee model
 * ─────────
 *  • 1.5 % trade fee on every buy / sell.
 *  • If the caller provides a valid referrer address:
 *       0.75 % → treasury
 *       0.75 % → accumulated for the referrer (claimable after migration)
 *  • If no referrer (address(0) or self-referral):
 *       full 1.5 % → treasury
 */
contract SelsipadBondingCurveFactory is Ownable, ReentrancyGuard {

    // ═══════════════════════════════════════════════════════════════
    //                          STRUCTS
    // ═══════════════════════════════════════════════════════════════

    struct TokenInfo {
        address creator;
        address tokenAddress;
        uint256 vReserveEth;      // virtual ETH reserve  (used in price calc)
        uint256 vReserveToken;    // virtual token reserve (used in price calc)
        uint256 rReserveEth;      // real ETH locked in the curve
        int256  rReserveToken;    // real tokens remaining in the curve
        bool    liquidityMigrated;
        uint256 createdAt;        // block.timestamp at launch
    }

    // ═══════════════════════════════════════════════════════════════
    //                        STATE
    // ═══════════════════════════════════════════════════════════════

    // Token registry
    mapping(address => TokenInfo) public tokens;
    address[] public allTokens;

    // DEX router
    address public uniswapRouter;
    address public WETH;

    // Treasury
    address public treasuryWallet;

    // Referral claimable balances  token => referrer => claimable amount
    mapping(address => mapping(address => uint256)) public referralRewards;
    // Track total pending referral for a token (for accounting)
    mapping(address => uint256) public totalPendingReferral;

    // ── Curve parameters (defaults, can be updated by owner) ──
    uint256 public V_ETH_RESERVE    = 15 ether / 1000;        // 0.015 ETH
    uint256 public V_TOKEN_RESERVE  = 1_073_000_000 ether;     // 1.073 B tokens
    uint256 public R_TOKEN_RESERVE  = 793_100_000  ether;      // 793.1 M tokens

    // ── Fee config ──
    uint256 public constant TRADE_FEE_BPS    = 150;   // 1.5 %
    uint256 public constant REFERRAL_FEE_BPS = 75;    // 0.75 % (half of 1.5 %)
    uint256 public constant BPS_DENOMINATOR  = 10_000;

    // ── Migration ──
    uint256 public migrationThreshold = 1 ether;  // 1 BNB for testnet

    // ── Create fee ──
    uint256 public createFee = 0.05 ether;  // 0.05 BNB to launch a token

    // ── Referral timeout ──
    uint256 public constant REFERRAL_TIMEOUT = 30 days;  // claim after 30 days even without migration

    // LP token burn address (dead address)
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ═══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ═══════════════════════════════════════════════════════════════

    event TokenLaunched(
        address indexed token,
        string  name,
        string  symbol,
        address indexed creator
    );

    event TokensPurchased(
        address indexed token,
        address indexed buyer,
        uint256 tokenAmount,
        uint256 ethCost,
        address indexed referrer
    );

    event TokensSold(
        address indexed token,
        address indexed seller,
        uint256 tokenAmount,
        uint256 ethRefund,
        address indexed referrer
    );

    event LiquidityMigrated(
        address indexed token,
        uint256 tokenAmount,
        uint256 ethAmount,
        address lpPair
    );

    event ReferralRewardAccumulated(
        address indexed token,
        address indexed referrer,
        uint256 amount
    );

    event ReferralRewardClaimed(
        address indexed token,
        address indexed referrer,
        uint256 amount
    );

    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event MigrationThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event CreateFeeUpdated(uint256 oldFee, uint256 newFee);

    // ═══════════════════════════════════════════════════════════════
    //                          ERRORS
    // ═══════════════════════════════════════════════════════════════

    error InvalidToken();
    error ZeroAmount();
    error TradingMigrated();
    error TradingNotMigrated();
    error InsufficientReserve();
    error TransferFailed();
    error NothingToClaim();
    error InvalidAddress();
    error InsufficientFee();
    error ClaimNotReady();

    // ═══════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    /**
     * @param _router       UniswapV2 / PancakeSwap router address
     * @param _treasury     Treasury wallet that receives fees
     */
    constructor(
        address _router,
        address _treasury
    ) Ownable(msg.sender) {
        if (_router   == address(0)) revert InvalidAddress();
        if (_treasury == address(0)) revert InvalidAddress();

        uniswapRouter  = _router;
        WETH           = IUniswapV2Router02(_router).WETH();
        treasuryWallet = _treasury;
    }

    // ═══════════════════════════════════════════════════════════════
    //                     LAUNCH TOKEN
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Create a new bonding-curve token.
     *         Optionally buy tokens in the same tx by sending ETH/BNB.
     * @param _name     Token name
     * @param _symbol   Token symbol
     * @param _referrer Referrer address (address(0) if none)
     */
    function launchToken(
        string memory _name,
        string memory _symbol,
        address _referrer
    ) external payable nonReentrant {
        // ── Charge creation fee ──
        if (msg.value < createFee) revert InsufficientFee();

        // Send fee to treasury
        if (createFee > 0) {
            (bool feeOk, ) = payable(treasuryWallet).call{value: createFee}("");
            if (!feeOk) revert TransferFailed();
        }

        uint256 remainingEth = msg.value - createFee;

        SelsipadBCToken token = new SelsipadBCToken(_name, _symbol, msg.sender);

        TokenInfo storage info = tokens[address(token)];
        info.creator       = msg.sender;
        info.tokenAddress  = address(token);
        info.rReserveEth   = 0;
        info.rReserveToken = int256(R_TOKEN_RESERVE);
        info.vReserveEth   = V_ETH_RESERVE;
        info.vReserveToken = V_TOKEN_RESERVE;
        info.liquidityMigrated = false;
        info.createdAt     = block.timestamp;

        allTokens.push(address(token));

        emit TokenLaunched(address(token), _name, _symbol, msg.sender);

        // Optional initial buy with remaining ETH (after fee deduction)
        if (remainingEth > 0) {
            _buyInternal(address(token), msg.sender, remainingEth, _referrer);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //                        BUY TOKEN
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Buy tokens on the bonding curve by sending ETH/BNB.
     * @param _token    Token address
     * @param _referrer Referrer address (address(0) if none)
     */
    function buyToken(
        address _token,
        address _referrer
    ) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        _buyInternal(_token, msg.sender, msg.value, _referrer);
    }

    /**
     * @dev Shared buy logic. Handles fee splitting, reserve update, and
     *      auto-migration check.
     */
    function _buyInternal(
        address _token,
        address buyer,
        uint256 ethIn,
        address referrer
    ) internal {
        TokenInfo storage info = tokens[_token];
        if (info.tokenAddress == address(0))  revert InvalidToken();
        if (info.liquidityMigrated)           revert TradingMigrated();

        // ── Fee ──
        uint256 fee      = (ethIn * TRADE_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netEthIn = ethIn - fee;

        _distributeFee(_token, fee, referrer, buyer);

        // ── Constant-product ──
        (uint256 newVEth, uint256 newVToken) = _reserveAfterBuy(
            info.vReserveEth,
            info.vReserveToken,
            netEthIn
        );

        uint256 tokensOut = info.vReserveToken - newVToken;

        info.vReserveEth   = newVEth;
        info.vReserveToken = newVToken;
        info.rReserveEth  += netEthIn;
        info.rReserveToken -= int256(tokensOut);

        // Mint tokens to buyer
        SelsipadBCToken(_token).mintFromFactory(buyer, tokensOut);

        emit TokensPurchased(_token, buyer, tokensOut, ethIn, referrer);

        // ── Auto migration check ──
        if (info.rReserveEth >= migrationThreshold) {
            _migrateLiquidity(_token);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //                       SELL TOKEN
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Sell tokens back to the bonding curve.
     *         Caller must have approved this contract to spend their tokens.
     * @param _token      Token address
     * @param tokenAmount Amount of tokens to sell
     * @param _referrer   Referrer address (address(0) if none)
     */
    function sellToken(
        address _token,
        uint256 tokenAmount,
        address _referrer
    ) external nonReentrant {
        if (tokenAmount == 0) revert ZeroAmount();

        TokenInfo storage info = tokens[_token];
        if (info.tokenAddress == address(0))  revert InvalidToken();
        if (info.liquidityMigrated)           revert TradingMigrated();

        // ── Constant-product ──
        uint256 newVToken = info.vReserveToken + tokenAmount;
        uint256 newVEth   = (info.vReserveEth * info.vReserveToken) / newVToken;

        uint256 grossEthOut = info.vReserveEth - newVEth;
        if (grossEthOut == 0 || grossEthOut > info.rReserveEth)
            revert InsufficientReserve();

        // ── Fee ──
        uint256 fee       = (grossEthOut * TRADE_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netEthOut = grossEthOut - fee;

        // Transfer tokens from seller → contract (burn held internally)
        bool ok = IERC20Minimal(_token).transferFrom(
            msg.sender,
            address(this),
            tokenAmount
        );
        if (!ok) revert TransferFailed();

        _distributeFee(_token, fee, _referrer, msg.sender);

        // Update reserves
        info.vReserveEth   = newVEth;
        info.vReserveToken = newVToken;
        info.rReserveEth  -= grossEthOut;
        info.rReserveToken += int256(tokenAmount);

        // Send ETH to seller
        (bool sent, ) = payable(msg.sender).call{value: netEthOut}("");
        if (!sent) revert TransferFailed();

        emit TokensSold(_token, msg.sender, tokenAmount, netEthOut, _referrer);
    }

    // ═══════════════════════════════════════════════════════════════
    //                     FEE DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════

    /**
     * @dev Splits the trade fee.
     *      • Valid referrer → 50 % treasury, 50 % accumulated for referrer.
     *      • No referrer    → 100 % treasury.
     */
    function _distributeFee(
        address _token,
        uint256 fee,
        address referrer,
        address trader
    ) internal {
        bool hasValidReferrer = (
            referrer != address(0) &&
            referrer != trader
        );

        if (hasValidReferrer) {
            uint256 referrerShare  = (fee * REFERRAL_FEE_BPS) / TRADE_FEE_BPS;
            uint256 treasuryShare  = fee - referrerShare;

            // Send treasury portion immediately
            (bool ok, ) = payable(treasuryWallet).call{value: treasuryShare}("");
            if (!ok) revert TransferFailed();

            // Accumulate referrer share (claimable after migration)
            referralRewards[_token][referrer]  += referrerShare;
            totalPendingReferral[_token]       += referrerShare;

            emit ReferralRewardAccumulated(_token, referrer, referrerShare);
        } else {
            // No referrer → full 1.5 % to treasury
            (bool ok, ) = payable(treasuryWallet).call{value: fee}("");
            if (!ok) revert TransferFailed();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //                  REFERRAL REWARD CLAIM
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Claim accumulated referral rewards.
     *         Claimable if: token has migrated, OR 30 days have passed since launch.
     * @param _token The bonding-curve token.
     */
    function claimReferralReward(address _token) external nonReentrant {
        TokenInfo storage info = tokens[_token];

        // Allow claim if migrated OR if REFERRAL_TIMEOUT has elapsed
        bool migrated  = info.liquidityMigrated;
        bool timedOut  = (block.timestamp >= info.createdAt + REFERRAL_TIMEOUT);
        if (!migrated && !timedOut) revert ClaimNotReady();

        uint256 reward = referralRewards[_token][msg.sender];
        if (reward == 0) revert NothingToClaim();

        referralRewards[_token][msg.sender] = 0;
        totalPendingReferral[_token]       -= reward;

        (bool ok, ) = payable(msg.sender).call{value: reward}("");
        if (!ok) revert TransferFailed();

        emit ReferralRewardClaimed(_token, msg.sender, reward);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   LIQUIDITY MIGRATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * @dev Automatically called when rReserveEth >= migrationThreshold.
     *      1. Mints remaining curve tokens to this contract.
     *      2. Approves the router.
     *      3. Adds liquidity (ETH + tokens) on the DEX.
     *      4. Sends LP tokens to DEAD_ADDRESS (burn / permanent lock).
     */
    function _migrateLiquidity(address _token) internal {
        TokenInfo storage info = tokens[_token];
        info.liquidityMigrated = true;

        // Contract ETH balance = rReserveEth + totalPendingReferral
        // We must keep pendingRef in the contract for future claims.
        uint256 pendingRef  = totalPendingReferral[_token];
        uint256 contractBal = address(this).balance;
        uint256 ethToPool   = contractBal > pendingRef
            ? contractBal - pendingRef
            : 0;

        // Calculate token amount for LP based on current curve price.
        // price (eth per token) = vReserveEth / vReserveToken
        // tokenForLP = ethToPool / price = ethToPool * vReserveToken / vReserveEth
        uint256 tokenForLP = (ethToPool * info.vReserveToken) / info.vReserveEth;

        // Reset real reserves
        info.rReserveEth   = 0;
        info.rReserveToken = 0;

        // Mint the calculated token amount to this contract for LP
        if (tokenForLP > 0) {
            SelsipadBCToken(_token).mintFromFactory(address(this), tokenForLP);
        }

        // Approve router to spend tokens
        IERC20Minimal(_token).approve(uniswapRouter, tokenForLP);

        // Add liquidity — LP tokens go to DEAD_ADDRESS (permanent lock)
        IUniswapV2Router02(uniswapRouter).addLiquidityETH{value: ethToPool}(
            _token,
            tokenForLP,
            0,              // amountTokenMin (accept any slippage on testnet)
            0,              // amountETHMin
            DEAD_ADDRESS,   // LP tokens sent to dead = locked forever
            block.timestamp + 300
        );

        // Resolve LP pair address for the event
        address v2factory = IUniswapV2Router02(uniswapRouter).factory();
        address pair      = IUniswapV2Factory(v2factory).getPair(_token, WETH);

        emit LiquidityMigrated(_token, tokenForLP, ethToPool, pair);
    }

    // ═══════════════════════════════════════════════════════════════
    //                    PURE / VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════

    function _reserveAfterBuy(
        uint256 reserveEth,
        uint256 reserveToken,
        uint256 ethIn
    ) internal pure returns (uint256 newEth, uint256 newToken) {
        newEth   = reserveEth + ethIn;
        newToken = (reserveEth * reserveToken) / newEth;
    }

    /**
     * @notice Preview a buy — how many tokens for `ethIn` ETH (before fee).
     */
    function getAmountOut(
        address _token,
        uint256 ethIn
    ) external view returns (uint256 tokensOut) {
        TokenInfo storage info = tokens[_token];
        uint256 fee       = (ethIn * TRADE_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netEthIn  = ethIn - fee;
        (, uint256 newVT) = _reserveAfterBuy(info.vReserveEth, info.vReserveToken, netEthIn);
        tokensOut = info.vReserveToken - newVT;
    }

    /**
     * @notice Preview a sell — how much ETH for `tokenAmount` tokens (before fee).
     */
    function getAmountIn(
        address _token,
        uint256 tokenAmount
    ) external view returns (uint256 ethOut) {
        TokenInfo storage info = tokens[_token];
        uint256 newVT     = info.vReserveToken + tokenAmount;
        uint256 newVE     = (info.vReserveEth * info.vReserveToken) / newVT;
        uint256 grossEth  = info.vReserveEth - newVE;
        uint256 fee       = (grossEth * TRADE_FEE_BPS) / BPS_DENOMINATOR;
        ethOut = grossEth - fee;
    }

    /**
     * @notice Current "spot" price — ETH per 1 whole token.
     */
    function getCurrentPrice(address _token) external view returns (uint256) {
        TokenInfo storage info = tokens[_token];
        // price = vReserveEth / vReserveToken  (scaled by 1e18)
        return (info.vReserveEth * 1 ether) / info.vReserveToken;
    }

    /**
     * @notice Progress towards migration (0‑10000 bps, 10000 = 100 %).
     */
    function getMigrationProgress(address _token) external view returns (uint256 bps) {
        TokenInfo storage info = tokens[_token];
        if (info.liquidityMigrated) return 10_000;
        bps = (info.rReserveEth * 10_000) / migrationThreshold;
        if (bps > 10_000) bps = 10_000;
    }

    function totalTokensLaunched() external view returns (uint256) {
        return allTokens.length;
    }

    // ═══════════════════════════════════════════════════════════════
    //                    ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function setTreasuryWallet(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidAddress();
        emit TreasuryUpdated(treasuryWallet, _treasury);
        treasuryWallet = _treasury;
    }

    function setMigrationThreshold(uint256 _threshold) external onlyOwner {
        emit MigrationThresholdUpdated(migrationThreshold, _threshold);
        migrationThreshold = _threshold;
    }

    function setCreateFee(uint256 _fee) external onlyOwner {
        emit CreateFeeUpdated(createFee, _fee);
        createFee = _fee;
    }

    function updateReserves(
        uint256 _vEthReserve,
        uint256 _vTokenReserve,
        uint256 _rTokenReserve
    ) external onlyOwner {
        V_ETH_RESERVE   = _vEthReserve;
        V_TOKEN_RESERVE = _vTokenReserve;
        R_TOKEN_RESERVE = _rTokenReserve;
    }

    function setRouter(address _router) external onlyOwner {
        if (_router == address(0)) revert InvalidAddress();
        uniswapRouter = _router;
        WETH = IUniswapV2Router02(_router).WETH();
    }

    // Allow the contract to receive ETH/BNB
    receive() external payable {}
}
