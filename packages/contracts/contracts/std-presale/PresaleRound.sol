// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IFeeSplitter {
    function distributeFeeNative() external payable;
    function distributeFeeERC20(address token, uint256 amount) external;
}

interface IMerkleVesting {
    function setMerkleRoot(bytes32 root, uint256 totalAllocated) external;
    function merkleRoot() external view returns (bytes32);
}

interface IPancakeRouter02 {
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
}

interface IPancakeFactory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

interface ILPLocker {
    function lockTokens(
        address lpToken,
        uint256 amount,
        uint256 unlockTime,
        address beneficiary
    ) external returns (uint256 lockId);
}

/**
 * @title PresaleRound
 * @notice Secure presale contract with refund-safe fee handling, vesting, LP creation & lock
 * @dev v2.4.1b.1: Phase-based snapshot finalize with LP creation + lock
 */
contract PresaleRound is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // State Machine
    enum Status {
        UPCOMING,           // Not yet started
        ACTIVE,             // Accepting contributions
        ENDED,              // Time ended, awaiting finalization
        FINALIZING,         // V2.4: Snapshot taken, finalize phases in progress
        FINALIZED_SUCCESS,  // Soft cap met, funds distributed
        FINALIZED_FAILED,   // Soft cap not met, refunds active
        CANCELLED           // Admin cancelled, refunds active
    }
    
    struct FeeConfig {
        uint256 totalBps;          // Total fee in basis points (500 = 5%)
        uint256 treasuryBps;       // Treasury share (250 = 2.5%)
        uint256 referralPoolBps;   // Referral pool share (200 = 2%)
        uint256 sbtStakingBps;     // SBT staking share (50 = 0.5%)
    }

    // V2.4: Finalize snapshot — computed once, used on every retry
    struct FinalizeSnapshot {
        uint256 totalNative;    // totalRaised at first finalize call
        uint256 feeAmount;      // totalNative * feeBps / 10000
        uint256 netAfterFee;    // totalNative - feeAmount
        uint256 lpBnb;          // netAfterFee * liquidityBps / 10000
        uint256 ownerBnb;       // netAfterFee - lpBnb
        bool    taken;          // true after first computation
    }
    
    // Immutable Config
    address public immutable projectToken;
    address public immutable paymentToken; // address(0) for native
    uint256 public immutable softCap;
    uint256 public immutable hardCap;
    uint256 public immutable minContribution;
    uint256 public immutable maxContribution;
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    
    // External Contracts
    address public immutable feeSplitter;
    address public immutable vestingVault;
    address public immutable projectOwner;

    // V2.4: LP Config (immutable)
    address public immutable dexRouter;
    address public immutable lpLocker;
    uint256 public immutable liquidityBps;    // e.g. 6000 = 60%
    uint256 public immutable lpLockDuration;  // seconds, e.g. 365 days
    
    // Fee Config
    FeeConfig public feeConfig;
    
    // State
    Status public status;
    uint256 public totalRaised;
    uint256 public tgeTimestamp; // Set at finalization
    
    // V2.4: Finalize state
    FinalizeSnapshot public snap;
    uint256 public burnedAmount;
    bool    public vestingFunded;
    bool    public feePaid;
    bool    public lpCreated;
    bool    public ownerPaid;
    uint256 public lpLockId;
    uint256 public lpUsedBnb;
    
    // Mappings
    mapping(address => uint256) public contributions;
    mapping(address => address) public referrers; // contributor => referrer
    
    // Events
    event Contributed(address indexed contributor, uint256 amount, address indexed referrer);
    event Refunded(address indexed contributor, uint256 amount);
    event FinalizedSuccess(uint256 totalRaised, uint256 feeAmount, uint256 tgeTimestamp);
    event FinalizedFailed(string reason);
    event Cancelled(string reason);
    event FeeConfigUpdated(FeeConfig newConfig);
    event StatusSynced(Status oldStatus, Status newStatus);
    event UnsoldTokensBurned(uint256 amount);
    event FinalizedSuccessEscrow(
        uint256 totalNative,
        uint256 fee,
        uint256 net,
        uint256 vestingTopUp,
        uint256 burned,
        bytes32 merkleRoot
    );
    event LiquidityAdded(address indexed pair, uint256 tokenAmount, uint256 bnbAmount, uint256 lpTokens);
    event LPLocked(uint256 indexed lockId, address indexed lpToken, uint256 amount, uint256 unlockTime);
    
    // Errors
    error InvalidStatus();
    error SoftCapNotMet();
    error ContributionLimitExceeded();
    error RefundNotAvailable();
    error NoContribution();
    error BelowMinimum();
    error HardCapExceeded();
    error InvalidFeeConfig();
    error ConfigLocked();
    error InvalidAddress();
    error AlreadyFinalized();
    error InsufficientTokenBalance();
    error NativeTransferFailed();
    error InvalidMerkleRoot();
    error FeeDistributionFailed();
    error VestingFundingFailed();
    error LPNotDone();
    error FeeNotDone();
    error InsufficientNativeBal();
    error InsufficientTokenBudget();
    
    constructor(
        address _projectToken,
        address _paymentToken,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _minContribution,
        uint256 _maxContribution,
        uint256 _startTime,
        uint256 _endTime,
        address _feeSplitter,
        address _vestingVault,
        address _projectOwner,
        address _admin,
        address _dexRouter,
        address _lpLocker,
        uint256 _liquidityBps,
        uint256 _lpLockDuration
    ) {
        if (_hardCap < _softCap) revert InvalidStatus();
        if (_endTime <= _startTime) revert InvalidStatus();
        if (_feeSplitter == address(0)) revert InvalidAddress();
        if (_vestingVault == address(0)) revert InvalidAddress();
        if (_projectOwner == address(0)) revert InvalidAddress();
        
        // V2.4: LP config validation
        require(_liquidityBps <= 10000, "INVALID_LP_BPS");
        require(_dexRouter != address(0) || _liquidityBps == 0, "NEED_ROUTER");
        require(_lpLocker != address(0) || _liquidityBps == 0, "NEED_LOCKER");
        require(_lpLockDuration >= 365 days || _liquidityBps == 0, "MIN_12_MONTHS");
        
        projectToken = _projectToken;
        paymentToken = _paymentToken;
        softCap = _softCap;
        hardCap = _hardCap;
        minContribution = _minContribution;
        maxContribution = _maxContribution;
        startTime = _startTime;
        endTime = _endTime;
        feeSplitter = _feeSplitter;
        vestingVault = _vestingVault;
        projectOwner = _projectOwner;
        dexRouter = _dexRouter;
        lpLocker = _lpLocker;
        liquidityBps = _liquidityBps;
        lpLockDuration = _lpLockDuration;
        
        status = Status.UPCOMING;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        
        // Default fee config: 5% total (2.5% / 2% / 0.5%)
        feeConfig = FeeConfig({
            totalBps: 500,
            treasuryBps: 250,
            referralPoolBps: 200,
            sbtStakingBps: 50
        });
    }
    
    /**
     * @notice V2.1 PATCH: Sync status based on time/cap
     * @dev Prevents finalize deadlock if no tx after endTime
     */
    function _syncStatus() internal {
        Status oldStatus = status;
        
        if (block.timestamp >= startTime && status == Status.UPCOMING) {
            status = Status.ACTIVE;
        }
        
        if (status == Status.ACTIVE) {
            if (block.timestamp >= endTime || totalRaised >= hardCap) {
                status = Status.ENDED;
            }
        }
        
        if (oldStatus != status) {
            emit StatusSynced(oldStatus, status);
        }
    }
    
    /**
     * @notice Contribute to presale
     * @dev V2.1: Funds stay in escrow (100%), NO fee deduction here
     */
    function contribute(uint256 amount, address referrer) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
    {
        // V2.1 PATCH: Sync status before processing
        _syncStatus();
        
        if (status != Status.ACTIVE) revert InvalidStatus();
        
        uint256 newTotal = contributions[msg.sender] + amount;
        
        if (newTotal < minContribution) revert BelowMinimum();
        if (newTotal > maxContribution) revert ContributionLimitExceeded();
        if (totalRaised + amount > hardCap) revert HardCapExceeded();
        
        // Transfer payment (FULL AMOUNT to escrow)
        if (paymentToken == address(0)) {
            if (msg.value != amount) revert InvalidStatus();
        } else {
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), amount);
        }
        
        // Record contribution
        contributions[msg.sender] += amount;
        totalRaised += amount;
        
        // Record referrer (immutable per contributor)
        if (referrer != address(0) && referrers[msg.sender] == address(0)) {
            referrers[msg.sender] = referrer;
        }
        
        emit Contributed(msg.sender, amount, referrers[msg.sender]);
    }
    
    /**
     * @notice Finalize presale successfully (soft cap met) — legacy non-escrow path
     * @dev V2.2: Deducts fee & distributes. Funds vesting vault. Burns unsold tokens. Sets TGE.
     */
    function finalizeSuccess(
        bytes32 merkleRoot,
        uint256 totalVestingAllocation,
        uint256 totalTokensForSale
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        _syncStatus();
        
        if (status != Status.ENDED) revert InvalidStatus();
        if (totalRaised < softCap) revert SoftCapNotMet();
        
        uint256 feeAmount = (totalRaised * feeConfig.totalBps) / 10000;
        uint256 netAmount = totalRaised - feeAmount;
        
        IERC20(projectToken).safeTransferFrom(
            projectOwner,
            vestingVault,
            totalVestingAllocation
        );
        
        IMerkleVesting(vestingVault).setMerkleRoot(merkleRoot, totalVestingAllocation);
        
        if (paymentToken == address(0)) {
            IFeeSplitter(feeSplitter).distributeFeeNative{value: feeAmount}();
        } else {
            IERC20(paymentToken).forceApprove(feeSplitter, feeAmount);
            IFeeSplitter(feeSplitter).distributeFeeERC20(paymentToken, feeAmount);
        }
        
        if (paymentToken == address(0)) {
            (bool success, ) = projectOwner.call{value: netAmount}("");
            if (!success) revert VestingFundingFailed();
        } else {
            IERC20(paymentToken).safeTransfer(projectOwner, netAmount);
        }
        
        if (totalRaised < hardCap && totalTokensForSale > 0) {
            uint256 unsoldTokens = (totalTokensForSale * (hardCap - totalRaised)) / hardCap;
            if (unsoldTokens > 0) {
                IERC20(projectToken).safeTransferFrom(
                    projectOwner,
                    address(0xdEaD),
                    unsoldTokens
                );
                emit UnsoldTokensBurned(unsoldTokens);
            }
        }
        
        tgeTimestamp = block.timestamp;
        status = Status.FINALIZED_SUCCESS;
        
        emit FinalizedSuccess(totalRaised, feeAmount, tgeTimestamp);
    }
    
    /**
     * @notice Finalize presale as failed (soft cap not met)
     */
    function finalizeFailed(string calldata reason) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        _syncStatus();
        
        if (status != Status.ENDED) revert InvalidStatus();
        if (totalRaised >= softCap) revert InvalidStatus();
        
        status = Status.FINALIZED_FAILED;
        emit FinalizedFailed(reason);
    }
    
    /**
     * @notice Cancel presale (admin emergency)
     */
    function cancel(string calldata reason) external onlyRole(ADMIN_ROLE) {
        _syncStatus();
        
        if (status != Status.UPCOMING && status != Status.ACTIVE) {
            revert InvalidStatus();
        }
        
        status = Status.CANCELLED;
        emit Cancelled(reason);
    }
    
    /**
     * @notice Claim refund
     * @dev V2.1: ALWAYS accessible when FAILED | CANCELLED (NOT affected by pause)
     */
    function claimRefund() external nonReentrant {
        if (status != Status.FINALIZED_FAILED && status != Status.CANCELLED) {
            revert RefundNotAvailable();
        }
        
        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NoContribution();
        
        contributions[msg.sender] = 0;
        
        if (paymentToken == address(0)) {
            (bool success, ) = msg.sender.call{value: amount}("");
            if (!success) revert VestingFundingFailed();
        } else {
            IERC20(paymentToken).safeTransfer(msg.sender, amount);
        }
        
        emit Refunded(msg.sender, amount);
    }
    
    /**
     * @notice Update fee configuration
     * @dev V2.1 PATCH: LOCKED after presale starts
     */
    function setFeeConfig(FeeConfig calldata newConfig) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (status != Status.UPCOMING) revert ConfigLocked();
        if (totalRaised > 0) revert ConfigLocked();
        if (block.timestamp >= startTime) revert ConfigLocked();
        
        if (newConfig.totalBps != 
            newConfig.treasuryBps + 
            newConfig.referralPoolBps + 
            newConfig.sbtStakingBps
        ) {
            revert InvalidFeeConfig();
        }
        
        feeConfig = newConfig;
        emit FeeConfigUpdated(newConfig);
    }
    
    /**
     * @notice Pause contributions only
     * @dev V2.1: Refunds CANNOT be paused
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Get contribution info
     */
    function getContributionInfo(address contributor) 
        external 
        view 
        returns (
            uint256 contribution,
            address referrer
        ) 
    {
        return (
            contributions[contributor],
            referrers[contributor]
        );
    }
    
    /**
     * @notice Get presale info
     */
    function getPresaleInfo() 
        external 
        view 
        returns (
            Status _status,
            uint256 _totalRaised,
            uint256 _softCap,
            uint256 _hardCap,
            uint256 _startTime,
            uint256 _endTime,
            uint256 _tgeTimestamp
        ) 
    {
        return (
            status,
            totalRaised,
            softCap,
            hardCap,
            startTime,
            endTime,
            tgeTimestamp
        );
    }
    
    // ────────────────────────────────────────────────────────
    //  ESCROW-BASED FINALIZATION (v2.4.1b.1)
    //  Phase-based, snapshot-deterministic, retry-safe
    // ────────────────────────────────────────────────────────
    
    /**
     * @notice Finalize presale using tokens held in THIS contract (released from escrow)
     * @dev V2.4: Phase-based with deterministic snapshot. Retry-safe.
     *      Flow: Snapshot → Vesting → Merkle → Burn → Fee → LP+Lock → Owner → FINALIZED
     * @param _merkleRoot Merkle root for vesting claims (ignored if already set)
     * @param totalVestingAllocation Total tokens for investor vesting
     * @param unsoldToBurn Tokens to send to burn address (0xdEaD)
     * @param tokensForLP Tokens to pair with BNB for LP (calculated off-chain)
     * @param tokenMinLP Min tokens for addLiquidity slippage protection
     * @param bnbMinLP Min BNB for addLiquidity slippage protection
     */
    function finalizeSuccessEscrow(
        bytes32 _merkleRoot,
        uint256 totalVestingAllocation,
        uint256 unsoldToBurn,
        uint256 tokensForLP,
        uint256 tokenMinLP,
        uint256 bnbMinLP
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        // ═══ GATE ═══
        if (status == Status.FINALIZED_SUCCESS) revert AlreadyFinalized();
        if (status != Status.ENDED && status != Status.FINALIZING) {
            _syncStatus();
            if (status != Status.ENDED && status != Status.FINALIZING)
                revert InvalidStatus();
        }
        if (totalRaised < softCap) revert SoftCapNotMet();

        // ═══ SNAPSHOT (once) ═══
        if (!snap.taken) {
            uint256 raised = totalRaised;
            uint256 fee = (raised * feeConfig.totalBps) / 10000;
            uint256 net = raised - fee;
            uint256 lp  = (liquidityBps > 0) ? (net * liquidityBps) / 10000 : 0;

            snap = FinalizeSnapshot({
                totalNative: raised,
                feeAmount:   fee,
                netAfterFee: net,
                lpBnb:       lp,
                ownerBnb:    net - lp,
                taken:       true
            });

            if (address(this).balance < raised) revert InsufficientNativeBal();

            // V2.4.1b.1 FIX (1): validate token budget covers all phases
            uint256 contractTokenBal = IERC20(projectToken).balanceOf(address(this));
            if (contractTokenBal < totalVestingAllocation + tokensForLP + unsoldToBurn)
                revert InsufficientTokenBudget();

            // W1: if fee is zero, mark feePaid immediately
            if (fee == 0) {
                feePaid = true;
            }

            status = Status.FINALIZING;
        }

        // ════════════════════════════════════════
        // PHASE 1 — Fund Vesting Vault
        // ════════════════════════════════════════
        if (!vestingFunded) {
            uint256 vaultBal = IERC20(projectToken).balanceOf(vestingVault);
            if (vaultBal < totalVestingAllocation) {
                uint256 topUp = totalVestingAllocation - vaultBal;
                IERC20(projectToken).safeTransfer(vestingVault, topUp);
            }
            vestingFunded = true;
        }

        // ════════════════════════════════════════
        // PHASE 2 — Set Merkle Root (idempotent)
        // ════════════════════════════════════════
        bytes32 usedRoot = _merkleRoot;
        {
            bytes32 onChainRoot = IMerkleVesting(vestingVault).merkleRoot();
            if (onChainRoot == bytes32(0)) {
                if (_merkleRoot == bytes32(0)) revert InvalidMerkleRoot();
                IMerkleVesting(vestingVault).setMerkleRoot(_merkleRoot, totalVestingAllocation);
            } else {
                usedRoot = onChainRoot;
            }
        }

        // ════════════════════════════════════════
        // PHASE 3 — Burn Unsold
        // ════════════════════════════════════════
        uint256 actualBurned = 0;
        if (unsoldToBurn > 0 && burnedAmount < unsoldToBurn) {
            uint256 toBurn = unsoldToBurn - burnedAmount;
            IERC20(projectToken).safeTransfer(address(0xdEaD), toBurn);
            burnedAmount = unsoldToBurn;
            actualBurned = toBurn;
            emit UnsoldTokensBurned(toBurn);
        }

        // ════════════════════════════════════════
        // PHASE 4 — Fee → FeeSplitter
        // ════════════════════════════════════════
        if (!feePaid && snap.feeAmount > 0) {
            try IFeeSplitter(feeSplitter).distributeFeeNative{value: snap.feeAmount}() {
                feePaid = true;
            } catch {
                revert FeeDistributionFailed();
            }
        }

        // ════════════════════════════════════════
        // PHASE 5 — Add Liquidity + Lock LP
        // ════════════════════════════════════════
        if (!lpCreated && liquidityBps > 0 && tokensForLP > 0 && snap.lpBnb > 0) {
            // V2.4.1b.1 FIX (2): enforce fee paid before LP
            if (!feePaid && snap.feeAmount > 0) revert FeeNotDone();

            if (address(this).balance < snap.lpBnb) revert InsufficientNativeBal();

            // 5a: Approve tokens to router
            IERC20(projectToken).forceApprove(dexRouter, tokensForLP);

            // 5b: Add liquidity — to = address(this) to receive LP tokens
            (uint256 usedToken, uint256 usedBnb, uint256 liquidity) =
                IPancakeRouter02(dexRouter).addLiquidityETH{value: snap.lpBnb}(
                    projectToken,
                    tokensForLP,
                    tokenMinLP,
                    bnbMinLP,
                    address(this),          // LP tokens → this contract
                    block.timestamp + 300
                );

            // 5c: Get pair + lock LP
            address wbnb = IPancakeRouter02(dexRouter).WETH();
            address pair = IPancakeFactory(
                IPancakeRouter02(dexRouter).factory()
            ).getPair(projectToken, wbnb);

            IERC20(pair).forceApprove(lpLocker, liquidity);
            lpLockId = ILPLocker(lpLocker).lockTokens(
                pair,
                liquidity,
                block.timestamp + lpLockDuration,
                projectOwner
            );

            lpUsedBnb = usedBnb;     // persist for owner dust calc
            lpCreated = true;

            emit LiquidityAdded(pair, usedToken, usedBnb, liquidity);
            emit LPLocked(lpLockId, pair, liquidity, block.timestamp + lpLockDuration);

            // 5d: Dust token → burn
            if (tokensForLP > usedToken) {
                IERC20(projectToken).safeTransfer(address(0xdEaD), tokensForLP - usedToken);
            }
        }

        // ════════════════════════════════════════
        // PHASE 6 — Remainder BNB → Owner
        // ════════════════════════════════════════
        if (!ownerPaid) {
            // W2: enforce fee done before owner payout
            if (!feePaid && snap.feeAmount > 0) revert FeeNotDone();

            // Enforce LP done before owner (when LP is configured)
            if (liquidityBps > 0 && snap.lpBnb > 0 && !lpCreated) revert LPNotDone();

            // Computed payout (never raw balance)
            uint256 lpDustBnb = 0;
            if (lpCreated && snap.lpBnb > lpUsedBnb) {
                lpDustBnb = snap.lpBnb - lpUsedBnb;
            }
            uint256 toOwner = snap.ownerBnb + lpDustBnb;

            if (toOwner > 0) {
                if (address(this).balance < toOwner) revert InsufficientNativeBal();
                (bool ok, ) = projectOwner.call{value: toOwner}("");
                if (!ok) revert NativeTransferFailed();
            }
            ownerPaid = true;
        }

        // ════════════════════════════════════════
        // PHASE 7 — Finalize Status (LAST)
        // ════════════════════════════════════════
        tgeTimestamp = block.timestamp;
        status = Status.FINALIZED_SUCCESS;

        emit FinalizedSuccessEscrow(
            snap.totalNative, snap.feeAmount, snap.ownerBnb,
            totalVestingAllocation, actualBurned, usedRoot
        );
    }

    // ────────────────────────────────────────────────────────
    //  ADMIN UTILITIES
    // ────────────────────────────────────────────────────────

    /// @notice Sweep excess native tokens not part of the raise (external deposits, etc)
    /// @dev Only callable after FINALIZED_SUCCESS to avoid interfering with finalize phases
    function sweepExcess(address to) external onlyRole(ADMIN_ROLE) nonReentrant {
        if (status != Status.FINALIZED_SUCCESS) revert InvalidStatus();
        if (to == address(0)) revert InvalidAddress();
        uint256 excess = address(this).balance;
        if (excess > 0) {
            (bool ok, ) = to.call{value: excess}("");
            if (!ok) revert NativeTransferFailed();
        }
    }
    
    /**
     * @notice Receive function to accept native tokens (BNB/ETH)
     * @dev Required for contributions with native token payment
     */
    receive() external payable {}
}
