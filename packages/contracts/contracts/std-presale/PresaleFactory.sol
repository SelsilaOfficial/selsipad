// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./PresaleRound.sol";
import "./MerkleVesting.sol";

// Extended interface for FeeSplitter (includes role management)
interface IFeeSplitterExt {
    function grantPresaleRole(address presale) external;
}

/**
 * @title PresaleFactory
 * @notice Factory for deploying presale rounds with integrated vesting and compliance tracking
 * @dev Aligns with Modul 2/5/6/13/15 specifications
 */
contract PresaleFactory is AccessControl {
    bytes32 public constant FACTORY_ADMIN_ROLE = keccak256("FACTORY_ADMIN_ROLE");
    
    // External contract references
    address public immutable feeSplitter;
    address public immutable timelockExecutor;
    
    // Presale tracking
    uint256 public presaleCount;
    mapping(uint256 => address) public rounds;
    mapping(address => address) public roundToVesting;
    mapping(address => bytes32) public roundToScheduleSalt;
    mapping(address => bytes32) public roundToComplianceHash;
    mapping(address => LPLockPlan) public roundToLPPlan;
    
    struct LPLockPlan {
        uint256 lockMonths;      // Minimum 12 months
        bytes32 dexId;           // DEX identifier (e.g., keccak256("pancakeswap"))
        uint256 liquidityPercent; // Percentage of raised funds for liquidity (BPS)
    }
    
    struct CreatePresaleParams {
        address projectToken;
        address paymentToken;
        uint256 softCap;
        uint256 hardCap;
        uint256 minContribution;
        uint256 maxContribution;
        uint256 startTime;
        uint256 endTime;
        address projectOwner;
    }
    
    struct VestingParams {
        uint256 tgeUnlockBps;    // TGE unlock percentage (1000 = 10%)
        uint256 cliffDuration;    // Cliff duration in seconds
        uint256 vestingDuration;  // Linear vesting duration in seconds
    }
    
    // Events
    event PresaleCreated(
        uint256 indexed presaleId,
        address indexed round,
        address indexed vesting,
        bytes32 scheduleSalt,
        bytes32 complianceHash
    );
    event LPPlanRecorded(
        address indexed round,
        uint256 lockMonths,
        bytes32 dexId,
        uint256 liquidityPercent
    );
    event RolesGranted(address indexed vesting, address indexed rootSetter);
    
    // Errors
    error InvalidCapRange();
    error InvalidTimeRange();
    error InvalidContributionRange();
    error InsufficientLPLockDuration();
    error InvalidLiquidityPercent();
    error ZeroAddress();
    
    constructor(address _feeSplitter, address _timelockExecutor) {
        if (_feeSplitter == address(0)) revert ZeroAddress();
        if (_timelockExecutor == address(0)) revert ZeroAddress();
        
        feeSplitter = _feeSplitter;
        timelockExecutor = _timelockExecutor;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FACTORY_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Create a new presale round with integrated vesting
     * @dev Off-chain gates (KYC, SC Scan, Fee Payment, Admin Approval) are validated by backend
     * @param params Presale configuration parameters
     * @param vestingParams Vesting schedule configuration
     * @param lpPlan Liquidity lock plan (min 12 months)
     * @param complianceHash Optional hash of off-chain compliance data
     * @return round Address of deployed PresaleRound
     * @return vesting Address of deployed MerkleVesting
     */
    function createPresale(
        CreatePresaleParams calldata params,
        VestingParams calldata vestingParams,
        LPLockPlan calldata lpPlan,
        bytes32 complianceHash
    ) external onlyRole(FACTORY_ADMIN_ROLE) returns (address round, address vesting) {
        // Validate parameters
        _validatePresaleParams(params, lpPlan);
        
        // Generate unique schedule salt for this presale
        bytes32 scheduleSalt = keccak256(abi.encodePacked(
            presaleCount,
            block.timestamp,
            params.projectOwner,
            params.projectToken
        ));
        
        // Deploy MerkleVesting with factory as initial admin
        vesting = address(new MerkleVesting(
            params.projectToken,
            vestingParams.tgeUnlockBps,
            vestingParams.cliffDuration,
            vestingParams.vestingDuration,
            scheduleSalt,
            address(this)  // Factory is initial admin
        ));
        
        // Grant ADMIN_ROLE to timelock executor for setMerkleRoot
        bytes32 ADMIN_ROLE = keccak256("ADMIN_ROLE");
        MerkleVesting(vesting).grantRole(ADMIN_ROLE, timelockExecutor);
        
        // Revoke factory's admin role (optional - keep for now for flexibility)
        // MerkleVesting(vesting).revokeRole(DEFAULT_ADMIN_ROLE, address(this));
        
        // Deploy PresaleRound
        round = address(new PresaleRound(
            params.projectToken,
            params.paymentToken,
            params.softCap,
            params.hardCap,
            params.minContribution,
            params.maxContribution,
            params.startTime,
            params.endTime,
            feeSplitter,
            vesting,
            params.projectOwner,
            timelockExecutor  // Admin role for round
        ));
        
        // Grant ADMIN_ROLE to round for calling setMerkleRoot during finalizeSuccess
        MerkleVesting(vesting).grantRole(ADMIN_ROLE, round);
        
        // Grant PRESALE_ROLE on FeeSplitter to round for fee distribution
        IFeeSplitterExt(feeSplitter).grantPresaleRole(round);
        
        // Record mappings
        rounds[presaleCount] = round;
        roundToVesting[round] = vesting;
        roundToScheduleSalt[round] = scheduleSalt;
        roundToComplianceHash[round] = complianceHash;
        roundToLPPlan[round] = lpPlan;
        
        // Emit events
        emit PresaleCreated(presaleCount, round, vesting, scheduleSalt, complianceHash);
        emit LPPlanRecorded(round, lpPlan.lockMonths, lpPlan.dexId, lpPlan.liquidityPercent);
        emit RolesGranted(vesting, timelockExecutor);
        
        presaleCount++;
        
        return (round, vesting);
    }
    
    /**
     * @notice Validate presale parameters
     * @dev Internal validation logic
     */
    function _validatePresaleParams(
        CreatePresaleParams calldata params,
        LPLockPlan calldata lpPlan
    ) internal view {
        // Validate caps
        if (params.softCap >= params.hardCap) revert InvalidCapRange();
        if (params.softCap == 0) revert InvalidCapRange();
        
        // Validate time
        if (params.startTime >= params.endTime) revert InvalidTimeRange();
        if (params.startTime <= block.timestamp) revert InvalidTimeRange();
        
        // Validate contribution limits
        if (params.minContribution > params.maxContribution) revert InvalidContributionRange();
        if (params.minContribution == 0) revert InvalidContributionRange();
        
        // Validate LP lock (Modul 5: minimum 12 months)
        if (lpPlan.lockMonths < 12) revert InsufficientLPLockDuration();
        
        // Validate liquidity percent (reasonable range: 50-90%)
        if (lpPlan.liquidityPercent < 5000 || lpPlan.liquidityPercent > 9000) {
            revert InvalidLiquidityPercent();
        }
        
        // Validate addresses
        if (params.projectToken == address(0)) revert ZeroAddress();
        if (params.projectOwner == address(0)) revert ZeroAddress();
    }
    
    /**
     * @notice Get presale details
     * @param presaleId Presale ID
     */
    function getPresaleDetails(uint256 presaleId) external view returns (
        address round,
        address vesting,
        bytes32 scheduleSalt,
        bytes32 complianceHash,
        LPLockPlan memory lpPlan
    ) {
        round = rounds[presaleId];
        vesting = roundToVesting[round];
        scheduleSalt = roundToScheduleSalt[round];
        complianceHash = roundToComplianceHash[round];
        lpPlan = roundToLPPlan[round];
    }
    
    /**
     * @notice Get vesting address for a round
     */
    function getVestingForRound(address round) external view returns (address) {
        return roundToVesting[round];
    }
    
    /**
     * @notice Get schedule salt for a round
     */
    function getScheduleSalt(address round) external view returns (bytes32) {
        return roundToScheduleSalt[round];
    }
}
