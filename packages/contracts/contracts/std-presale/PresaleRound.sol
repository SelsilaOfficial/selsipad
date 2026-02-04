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
}

/**
 * @title PresaleRound
 * @notice Secure presale contract with refund-safe fee handling and scalable vesting
 * @dev v2.1 Compliant: Status sync, locked fee config, vault funding enforcement
 */
contract PresaleRound is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // State Machine
    enum Status {
        UPCOMING,           // Not yet started
        ACTIVE,             // Accepting contributions
        ENDED,              // Time ended, awaiting finalization
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
    
    // Fee Config
    FeeConfig public feeConfig;
    
    // State
    Status public status;
    uint256 public totalRaised;
    uint256 public tgeTimestamp; // Set at finalization
    
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
    error VestingFundingFailed();
    
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
        address _admin
    ) {
        if (_hardCap < _softCap) revert InvalidStatus();
        if (_endTime <= _startTime) revert InvalidStatus();
        if (_feeSplitter == address(0)) revert InvalidAddress();
        if (_vestingVault == address(0)) revert InvalidAddress();
        if (_projectOwner == address(0)) revert InvalidAddress();
        
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
     * @notice Finalize presale successfully (soft cap met)
     * @dev V2.1: Deducts fee & distributes. Funds vesting vault. Sets TGE.
     */
    function finalizeSuccess(
        bytes32 merkleRoot,
        uint256 totalVestingAllocation
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        // V2.1 PATCH: Sync status
        _syncStatus();
        
        if (status != Status.ENDED) revert InvalidStatus();
        if (totalRaised < softCap) revert SoftCapNotMet();
        
        // Calculate fee
        uint256 feeAmount = (totalRaised * feeConfig.totalBps) / 10000;
        uint256 netAmount = totalRaised - feeAmount;
        
        // V2.1 PATCH: Fund vesting vault BEFORE setting root
        IERC20(projectToken).safeTransferFrom(
            projectOwner,
            vestingVault,
            totalVestingAllocation
        );
        
        // Set merkle root (will revert if vault underfunded)
        IMerkleVesting(vestingVault).setMerkleRoot(merkleRoot, totalVestingAllocation);
        
        // Distribute fee via FeeSplitter
        if (paymentToken == address(0)) {
            // Native token
            IFeeSplitter(feeSplitter).distributeFeeNative{value: feeAmount}();
        } else {
            // ERC20 token
            IERC20(paymentToken).forceApprove(feeSplitter, feeAmount);
            IFeeSplitter(feeSplitter).distributeFeeERC20(paymentToken, feeAmount);
        }
        
        // Transfer net amount to project owner
        if (paymentToken == address(0)) {
            (bool success, ) = projectOwner.call{value: netAmount}("");
            if (!success) revert VestingFundingFailed();
        } else {
            IERC20(paymentToken).safeTransfer(projectOwner, netAmount);
        }
        
        // Set TGE timestamp
        tgeTimestamp = block.timestamp;
        
        // Update status
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
        // V2.1 PATCH: Sync status
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
        // V2.1 PATCH: Refund NOT blocked by pause
        if (status != Status.FINALIZED_FAILED && status != Status.CANCELLED) {
            revert RefundNotAvailable();
        }
        
        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NoContribution();
        
        contributions[msg.sender] = 0;
        
        // Transfer full contribution back (NO fee deduction)
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
        // V2.1 PATCH: Can only update if UPCOMING + no contributions + before start
        if (status != Status.UPCOMING) revert ConfigLocked();
        if (totalRaised > 0) revert ConfigLocked();
        if (block.timestamp >= startTime) revert ConfigLocked();
        
        // Validate total equals sum
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
}
