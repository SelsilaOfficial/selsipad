// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Fairlaunch.sol";
import "./TeamVesting.sol";

/**
 * @title FairlaunchFactory
 * @notice Factory for deploying Fairlaunch pools with integrated team vesting
 * @dev Enforces deployment fee, LP lock requirements, and security standards
 */
contract FairlaunchFactory is AccessControl {
    using SafeERC20 for IERC20;
    
    bytes32 public constant FACTORY_ADMIN_ROLE = keccak256("FACTORY_ADMIN_ROLE");
    
    // External contract references
    address public immutable feeSplitter;
    address public immutable treasuryWallet;
    address public immutable adminExecutor;
    
    // Fee structure
    uint256 public immutable DEPLOYMENT_FEE; // 0.2 BNB for BSC, 0.1 ETH for ETH/Base
    
    // Fairlaunch tracking
    uint256 public fairlaunchCount;
    mapping(uint256 => address) public fairlaunches;
    mapping(address => address) public fairlaunchToVesting;
    mapping(address => LPLockPlan) public fairlaunchToLPPlan;
    
    struct LPLockPlan {
        uint256 lockMonths;        // Minimum 12 months
        uint256 liquidityPercent;  // Minimum 7000 (70%)
        bytes32 dexId;             // DEX identifier
    }
    
    struct CreateFairlaunchParams {
        address projectToken;
        address paymentToken;      // address(0) for native
        uint256 softcap;
        uint256 tokensForSale;
        uint256 minContribution;
        uint256 maxContribution;
        uint256 startTime;
        uint256 endTime;
        address projectOwner;
        uint16 listingPremiumBps;
    }
    
    struct TeamVestingParams {
        address beneficiary;
        uint256 startTime;
        uint256[] durations;
        uint256[] amounts;
    }
    
    // Events
    event FairlaunchCreated(
        uint256 indexed fairlaunchId,
        address indexed fairlaunch,
        address indexed vesting,
        address projectToken
    );
    event LPPlanRecorded(
        address indexed fairlaunch,
        uint256 lockMonths,
        bytes32 dexId,
        uint256 liquidityPercent
    );
    
    // Errors
    error InsufficientDeploymentFee();
    error InvalidSoftcap();
    error InvalidTimeRange();
    error InvalidContributionRange();
    error InsufficientLPLockDuration();
    error InsufficientLiquidityPercent();
    error ZeroAddress();
    error FeeTransferFailed();
    error InsufficientTokenBalance();
    error TokenTransferFailed();
    
    constructor(
        uint256 _deploymentFee,
        address _feeSplitter,
        address _treasuryWallet,
        address _adminExecutor
    ) {
        if (_feeSplitter == address(0)) revert ZeroAddress();
        if (_treasuryWallet == address(0)) revert ZeroAddress();
        if (_adminExecutor == address(0)) revert ZeroAddress();
        
        DEPLOYMENT_FEE = _deploymentFee;
        feeSplitter = _feeSplitter;
        treasuryWallet = _treasuryWallet;
        adminExecutor = _adminExecutor;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FACTORY_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Create a new Fairlaunch pool with optional team vesting
     * @dev Permissionless (no KYC) - SC scan gating handled off-chain
     * @param params Fairlaunch configuration
     * @param vestingParams Team vesting schedule (amounts array can be empty for no vesting)
     * @param lpPlan Liquidity lock plan
     * @return fairlaunch Address of deployed Fairlaunch pool
     * @return vesting Address of deployed TeamVesting (address(0) if no vesting)
     */
    function createFairlaunch(
        CreateFairlaunchParams calldata params,
        TeamVestingParams calldata vestingParams,
        LPLockPlan calldata lpPlan
    ) external payable returns (address fairlaunch, address vesting) {
        // Validate deployment fee
        if (msg.value < DEPLOYMENT_FEE) revert InsufficientDeploymentFee();
        
        // Validate parameters
        _validateParams(params, lpPlan);
        
        // Send deployment fee to treasury
        (bool success, ) = treasuryWallet.call{value: msg.value}("");
        if (!success) revert FeeTransferFailed();
        
        // Deploy TeamVesting if amounts provided
        if (vestingParams.amounts.length > 0) {
            vesting = address(new TeamVesting(
                params.projectToken,
                vestingParams.beneficiary,
                vestingParams.startTime,
                vestingParams.durations,
                vestingParams.amounts,
                adminExecutor
            ));
        }
        
        // Deploy Fairlaunch pool
        fairlaunch = address(new Fairlaunch(
            params.projectToken,
            params.paymentToken,
            params.softcap,
            params.tokensForSale,
            params.minContribution,
            params.maxContribution,
            params.startTime,
            params.endTime,
            params.listingPremiumBps,
            feeSplitter,
            vesting,
            params.projectOwner,
            adminExecutor,
            lpPlan.liquidityPercent,
            lpPlan.lockMonths,
            lpPlan.dexId
        ));
        
        // Calculate and transfer tokens AFTER deployment
        IERC20 projectToken = IERC20(params.projectToken);
        
        // Calculate liquidity tokens (multiply before divide for accuracy)
        uint256 liquidityTokens = (params.tokensForSale * lpPlan.liquidityPercent) / 10000;
        uint256 totalFairlaunchTokens = params.tokensForSale + liquidityTokens;
        
        // Transfer tokens to Fairlaunch contract
        projectToken.safeTransferFrom(msg.sender, fairlaunch, totalFairlaunchTokens);
        
        // Transfer tokens to Vesting contract if it exists
        if (vesting != address(0)) {
            uint256 totalVestingTokens = _calculateVestingTokens(vestingParams.amounts);
            if (totalVestingTokens > 0) {
                projectToken.safeTransferFrom(msg.sender, vesting, totalVestingTokens);
            }
        }
        
        // Record mappings
        fairlaunches[fairlaunchCount] = fairlaunch;
        if (vesting != address(0)) {
            fairlaunchToVesting[fairlaunch] = vesting;
        }
        fairlaunchToLPPlan[fairlaunch] = lpPlan;
        
        // Emit events
        emit FairlaunchCreated(fairlaunchCount, fairlaunch, vesting, params.projectToken);
        emit LPPlanRecorded(fairlaunch, lpPlan.lockMonths, lpPlan.dexId, lpPlan.liquidityPercent);
        
        fairlaunchCount++;
        
        return (fairlaunch, vesting);
    }
    
    /**
     * @notice Validate Fairlaunch parameters
     */
    function _validateParams(
        CreateFairlaunchParams calldata params,
        LPLockPlan calldata lpPlan
    ) internal view {
        // Validate softcap
        if (params.softcap == 0) revert InvalidSoftcap();
        
        // Validate time
        if (params.startTime >= params.endTime) revert InvalidTimeRange();
        if (params.startTime <= block.timestamp) revert InvalidTimeRange();
        
        // Validate contribution limits
        if (params.minContribution > params.maxContribution) revert InvalidContributionRange();
        if (params.minContribution == 0) revert InvalidContributionRange();
        
        // Validate LP lock (minimum 12 months)
        if (lpPlan.lockMonths < 12) revert InsufficientLPLockDuration();
        
        // Validate liquidity percent (minimum 70%)
        if (lpPlan.liquidityPercent < 7000) revert InsufficientLiquidityPercent();
        
        // Validate addresses
        if (params.projectToken == address(0)) revert ZeroAddress();
        if (params.projectOwner == address(0)) revert ZeroAddress();
    }
    
    /**
     * @notice Calculate total vesting tokens from amounts array
     * @dev Returns 0 if array is empty (safe for no-vesting case)
     */
    function _calculateVestingTokens(uint256[] calldata amounts) 
        internal 
        pure 
        returns (uint256 total) 
    {
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }
        return total;
    }
    
    /**
     * @notice Get Fairlaunch details
     */
    function getFairlaunchDetails(uint256 fairlaunchId)
        external
        view
        returns (
            address fairlaunch,
            address vesting,
            LPLockPlan memory lpPlan
        )
    {
        fairlaunch = fairlaunches[fairlaunchId];
        vesting = fairlaunchToVesting[fairlaunch];
        lpPlan = fairlaunchToLPPlan[fairlaunch];
    }
}
