// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Uniswap V2 interfaces (compatible with PancakeSwap)
interface IUniswapV2Router02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IFeeSplitter {
    function distributeFairlaunchFee(address fairlaunch) external payable;
}

interface ILPLocker {
    function lockTokens(address lpToken, uint256 amount, uint256 unlockTime, address beneficiary) external returns (uint256 lockId);
}

/**
 * @title Fairlaunch
 * @notice Fair price discovery launchpad pool with automated liquidity provision
 * @dev Price = total_raised / tokens_for_sale (no hardcap)
 */
contract Fairlaunch is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum Status {
        UPCOMING,   // Before startTime
        LIVE,       // During sale period
        ENDED,      // Sale ended, awaiting finalization
        SUCCESS,    // Finalized successfully
        FAILED,     // Softcap not met
        CANCELLED   // Admin cancelled
    }

    // Core config (immutable)
    address public immutable projectToken;
    address public immutable paymentToken; // address(0) for native
    uint256 public immutable softcap;
    uint256 public immutable tokensForSale;
    uint256 public immutable minContribution;
    uint256 public immutable maxContribution;
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    uint16 public immutable listingPremiumBps; // e.g., 500 = 5%

    // External contracts
    address public immutable feeSplitter;
    address public immutable teamVesting; // Can be address(0)
    address public immutable projectOwner;
    IUniswapV2Router02 public immutable dexRouter;
    ILPLocker public lpLocker; // Set during finalization

    // LP config
    uint256 public immutable liquidityPercent; // BPS, min 7000 (70%)
    uint256 public immutable lpLockMonths;     // Min 12 months
    bytes32 public immutable dexId;

    // State
    Status public status;
    uint256 public totalRaised;
    uint256 public participantCount;
    uint256 public finalTokenPrice; // Set on finalization
    bool public isFinalized;
    bool public isPaused;

    mapping(address => uint256) public contributions;
    mapping(address => bool) public hasClaimed;

    // Constants
    uint256 private constant PLATFORM_FEE_BPS = 500; // 5%
    uint256 private constant BPS_BASE = 10000;

    // Events
    event Contributed(address indexed user, uint256 amount, uint256 totalRaised);
    event FinalizedSuccess(uint256 finalPrice, uint256 totalRaised, address lpToken, uint256 lpAmount);
    event FinalizedFail();
    event TokensClaimed(address indexed user, uint256 amount);
    event Refunded(address indexed user, uint256 amount);
    event Paused();
    event Unpaused();
    event Cancelled();
    event LiquidityAdded(address indexed lpToken, uint256 lpAmount, uint256 unlockTime);
    event LPLockerSet(address indexed lpLocker);
    event LiquidityLocked(address indexed lpToken, uint256 amount, uint256 unlockTime);

    // Errors
    error InvalidStatus();
    error ContractPaused();
    error ContributionTooLow();
    error ContributionTooHigh();
    error NoContribution();
    error AlreadyClaimed();
    error NothingToRefund();
    error NotAuthorized();
    error TransferFailed();
    error SoftcapNotMet();
    // Debuggable external-call errors (prevents "revert 0x" mystery failures)
    error FeeSplitterCallFailed(bytes reason);
    error DexAddLiquidityCallFailed(bytes reason);
    error LPLockerCallFailed(bytes reason);

    constructor(
        address _projectToken,
        address _paymentToken,
        uint256 _softcap,
        uint256 _tokensForSale,
        uint256 _minContribution,
        uint256 _maxContribution,
        uint256 _startTime,
        uint256 _endTime,
        uint16 _listingPremiumBps,
        address _feeSplitter,
        address _teamVesting,
        address _projectOwner,
        address _adminExecutor,
        uint256 _liquidityPercent,
        uint256 _lpLockMonths,
        bytes32 _dexId
    ) {
        projectToken = _projectToken;
        paymentToken = _paymentToken;
        softcap = _softcap;
        tokensForSale = _tokensForSale;
        minContribution = _minContribution;
        maxContribution = _maxContribution;
        startTime = _startTime;
        endTime = _endTime;
        listingPremiumBps = _listingPremiumBps;
        feeSplitter = _feeSplitter;
        teamVesting = _teamVesting;
        projectOwner = _projectOwner;
        liquidityPercent = _liquidityPercent;
        lpLockMonths = _lpLockMonths;
        dexId = _dexId;

        status = Status.UPCOMING;

        // Set DEX router based on chain (using ternary for immutable)
        dexRouter = (block.chainid == 56)
            ? IUniswapV2Router02(0x10ED43C718714eb63d5aA57B78B54704E256024E) // BSC Mainnet
            : (block.chainid == 97)
            ? IUniswapV2Router02(0xD99D1c33F9fC3444f8101754aBC46c52416550D1) // BSC Testnet (V2)
            : (block.chainid == 1 || block.chainid == 11155111)
            ? IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D) // Ethereum / Sepolia
            : (block.chainid == 8453 || block.chainid == 84532)
            ? IUniswapV2Router02(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24) // Base / Base Sepolia
            : IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D); // Default to Uniswap

        _grantRole(DEFAULT_ADMIN_ROLE, _adminExecutor);
        _grantRole(ADMIN_ROLE, _adminExecutor);
    }

    /**
     * @notice Set the LP Locker contract address
     * @dev Can only be called by ADMIN_ROLE, and ONLY ONCE before finalization
     * @param _lpLocker Address of the LP Locker contract
     */
    function setLPLocker(address _lpLocker) external onlyRole(ADMIN_ROLE) {
        require(address(lpLocker) == address(0), "LP Locker already set");
        require(!isFinalized, "Already finalized");
        require(_lpLocker != address(0), "Invalid LP Locker address");
        
        lpLocker = ILPLocker(_lpLocker);
        emit LPLockerSet(_lpLocker);
    }

    /**
     * @notice Contribute native token (BNB/ETH)
     */
    function contribute() external payable nonReentrant {
        if (paymentToken != address(0)) revert InvalidStatus();
        _processContribution(msg.sender, msg.value);
    }

    /**
     * @notice Contribute ERC20 token
     */
    function contributeERC20(uint256 amount) external nonReentrant {
        if (paymentToken == address(0)) revert InvalidStatus();
        
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), amount);
        _processContribution(msg.sender, amount);
    }

    /**
     * @notice Internal contribution processing
     */
    function _processContribution(address user, uint256 amount) internal {
        // Update status if needed
        _updateStatus();

        // Validate state
        if (status != Status.LIVE) revert InvalidStatus();
        if (isPaused) revert ContractPaused();
        if (amount < minContribution) revert ContributionTooLow();
        
        uint256 newTotal = contributions[user] + amount;
        if (newTotal > maxContribution) revert ContributionTooHigh();

        // Track new participants
        if (contributions[user] == 0) {
            participantCount++;
        }

        // Update state
        contributions[user] = newTotal;
        totalRaised += amount;

        emit Contributed(user, amount, totalRaised);
    }

    /**
     * @notice Finalize the Fairlaunch (callable by anyone after endTime)
     */
    function finalize() external nonReentrant {
        _updateStatus();

        if (status != Status.ENDED) revert InvalidStatus();
        if (isFinalized) revert InvalidStatus();

        isFinalized = true;

        // Check if softcap met
        if (totalRaised < softcap) {
            status = Status.FAILED;
            emit FinalizedFail();
            return;
        }

        // Calculate final price
        finalTokenPrice = (totalRaised * 1e18) / tokensForSale;

        // Deduct 5% platform fee
        uint256 platformFee = (totalRaised * PLATFORM_FEE_BPS) / BPS_BASE;
        uint256 netRaised = totalRaised - platformFee;

        // Send fee to FeeSplitter
        if (paymentToken == address(0)) {
            try IFeeSplitter(feeSplitter).distributeFairlaunchFee{value: platformFee}(address(this)) {
                // ok
            } catch (bytes memory reason) {
                revert FeeSplitterCallFailed(reason);
            }
        } else {
            IERC20(paymentToken).safeTransfer(feeSplitter, platformFee);
            // Note: FeeSplitter needs ERC20 handling function
        }

        // Calculate liquidity amounts
        uint256 liquidityFunds = (netRaised * liquidityPercent) / BPS_BASE;
        
        // Calculate LP tokens based on listing price
        uint256 listingPrice = (finalTokenPrice * (BPS_BASE + listingPremiumBps)) / BPS_BASE;
        uint256 liquidityTokens = (liquidityFunds * 1e18) / listingPrice;

        // Add liquidity to DEX
        address lpToken;
        try this.__addLiquidityExternal(liquidityTokens, liquidityFunds) returns (address _lpToken) {
            lpToken = _lpToken;
        } catch (bytes memory reason) {
            revert DexAddLiquidityCallFailed(reason);
        }

        // Lock LP tokens in vault for specified duration
        uint256 lpBalance = IERC20(lpToken).balanceOf(address(this));
        uint256 unlockTime = block.timestamp + (lpLockMonths * 30 days);
        
        // Lock LP tokens via LP Locker
        require(address(lpLocker) != address(0), "LP Locker not configured");

        // Approve LP locker to manage tokens
        IERC20(lpToken).approve(address(lpLocker), lpBalance);
        
        // Lock LP tokens with project owner as beneficiary
        try lpLocker.lockTokens(lpToken, lpBalance, unlockTime, projectOwner) returns (uint256 /*lockId*/) {
            // ok
        } catch (bytes memory reason) {
            revert LPLockerCallFailed(reason);
        }
        
        emit LiquidityLocked(lpToken, lpBalance, unlockTime);

        // Transfer remaining tokens to team vesting (if exists)
        if (teamVesting != address(0)) {
            uint256 remainingTokens = IERC20(projectToken).balanceOf(address(this)) - tokensForSale;
            if (remainingTokens > 0) {
                IERC20(projectToken).safeTransfer(teamVesting, remainingTokens);
            }
        }

        // Transfer remaining raised funds to project owner
        uint256 remainingFunds = netRaised - liquidityFunds;
        if (paymentToken == address(0)) {
            (bool success, ) = projectOwner.call{value: remainingFunds}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(paymentToken).safeTransfer(projectOwner, remainingFunds);
        }

        status = Status.SUCCESS;
        emit FinalizedSuccess(finalTokenPrice, totalRaised, lpToken, lpBalance);
    }

    /**
     * @notice Add liquidity to DEX
     */
    function _addLiquidity(uint256 tokenAmount, uint256 fundAmount) internal returns (address lpToken) {
        // Approve router
        IERC20(projectToken).approve(address(dexRouter), tokenAmount);

        if (paymentToken == address(0)) {
            // Native pair (ETH/BNB)
            dexRouter.addLiquidityETH{value: fundAmount}(
                projectToken,
                tokenAmount,
                0, // Accept any amount of tokens
                0, // Accept any amount of ETH
                address(this),
                block.timestamp + 300
            );

            lpToken = IUniswapV2Factory(dexRouter.factory()).getPair(
                projectToken,
                dexRouter.WETH()
            );
        } else {
            // ERC20 pair
            IERC20(paymentToken).approve(address(dexRouter), fundAmount);
            
            dexRouter.addLiquidity(
                projectToken,
                paymentToken,
                tokenAmount,
                fundAmount,
                0,
                0,
                address(this),
                block.timestamp + 300
            );

            lpToken = IUniswapV2Factory(dexRouter.factory()).getPair(
                projectToken,
                paymentToken
            );
        }
    }

    /**
     * @dev External wrapper for try/catch around router calls.
     * Solidity only allows try/catch on external calls, not internal calls.
     * This function MUST remain non-publicly useful (only called by this contract).
     */
    function __addLiquidityExternal(uint256 tokenAmount, uint256 fundAmount)
        external
        returns (address lpToken)
    {
        if (msg.sender != address(this)) revert NotAuthorized();
        return _addLiquidity(tokenAmount, fundAmount);
    }

    /**
     * @notice Claim tokens after successful finalization
     */
    function claimTokens() external nonReentrant {
        if (status != Status.SUCCESS) revert InvalidStatus();
        if (contributions[msg.sender] == 0) revert NoContribution();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        // Calculate user's token allocation
        uint256 userTokens = (contributions[msg.sender] * tokensForSale) / totalRaised;

        hasClaimed[msg.sender] = true;

        IERC20(projectToken).safeTransfer(msg.sender, userTokens);

        emit TokensClaimed(msg.sender, userTokens);
    }

    /**
     * @notice Refund contributions if failed or cancelled
     */
    function refund() external nonReentrant {
        if (status != Status.FAILED && status != Status.CANCELLED) revert InvalidStatus();
        if (contributions[msg.sender] == 0) revert NothingToRefund();

        uint256 amount = contributions[msg.sender];
        contributions[msg.sender] = 0;

        if (paymentToken == address(0)) {
            (bool success, ) = msg.sender.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(paymentToken).safeTransfer(msg.sender, amount);
        }

        emit Refunded(msg.sender, amount);
    }

    /**
     * @notice Pause contributions (admin only)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        isPaused = true;
        emit Paused();
    }

    /**
     * @notice Unpause contributions (admin only)
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        isPaused = false;
        emit Unpaused();
    }

    /**
     * @notice Cancel fairlaunch (admin only, emergency)
     */
    function cancel() external onlyRole(ADMIN_ROLE) {
        if (status == Status.SUCCESS) revert InvalidStatus(); // Cannot cancel after success
        
        status = Status.CANCELLED;
        emit Cancelled();
    }

    /**
     * @notice Update status based on current time
     */
    function _updateStatus() internal {
        if (status == Status.UPCOMING && block.timestamp >= startTime) {
            status = Status.LIVE;
        } else if (status == Status.LIVE && block.timestamp >= endTime) {
            status = Status.ENDED;
        }
    }

    /**
     * @notice Get current status
     */
    function getStatus() external view returns (Status) {
        if (status == Status.UPCOMING && block.timestamp >= startTime) {
            return Status.LIVE;
        } else if (status == Status.LIVE && block.timestamp >= endTime) {
            return Status.ENDED;
        }
        return status;
    }

    /**
     * @notice Get user's contribution
     */
    function getUserContribution(address user) external view returns (uint256) {
        return contributions[user];
    }

    /**
     * @notice Get user's token allocation (if finalized successfully)
     */
    function getUserAllocation(address user) external view returns (uint256) {
        if (status != Status.SUCCESS) return 0;
        if (totalRaised == 0) return 0;
        return (contributions[user] * tokensForSale) / totalRaised;
    }

    /**
     * @notice Get final price (if finalized)
     */
    function getFinalPrice() external view returns (uint256) {
        return finalTokenPrice;
    }

    /**
     * @notice Get the current LP Locker address
     * @return Address of LP Locker contract (or address(0) if not set)
     */
    function lpLockerAddress() external view returns (address) {
        return address(lpLocker);
    }
}
