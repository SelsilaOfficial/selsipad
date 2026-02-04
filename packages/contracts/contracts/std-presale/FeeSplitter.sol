// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FeeSplitter
 * @notice Distributes presale fees to 3 vaults: Treasury, Referral Pool, SBT Staking
 * @dev Supports both native tokens and ERC20
 */
contract FeeSplitter is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant PRESALE_ROLE = keccak256("PRESALE_ROLE");
    
    struct FeeConfig {
        uint256 totalBps;          // Total fee in basis points (500 = 5%)
        uint256 treasuryBps;       // Treasury share (250 = 2.5%)
        uint256 referralPoolBps;   // Referral pool share (200 = 2%)
        uint256 sbtStakingBps;     // SBT staking share (50 = 0.5%)
    }
    
    // Vault addresses
    address public treasuryVault;
    address public referralPoolVault;
    address public sbtStakingVault;
    
    // Fee configuration
    FeeConfig public feeConfig;
    
    // Events
    event FeeCollected(address indexed token, uint256 totalAmount);
    event FeeSplit(address indexed vault, address indexed token, uint256 amount, uint256 bps);
    event FeeConfigUpdated(FeeConfig newConfig);
    event VaultUpdated(string vaultType, address newVault);
    
    // Errors
    error InvalidFeeConfig();
    error InvalidVault();
    error TransferFailed();
    error ZeroAmount();
    
    constructor(
        address _treasury,
        address _referralPool,
        address _sbtStaking,
        address _admin
    ) {
        if (_treasury == address(0)) revert InvalidVault();
        if (_referralPool == address(0)) revert InvalidVault();
        if (_sbtStaking == address(0)) revert InvalidVault();
        
        treasuryVault = _treasury;
        referralPoolVault = _referralPool;
        sbtStakingVault = _sbtStaking;
        
        // Default config: 5% total (2.5% / 2% / 0.5%)
        feeConfig = FeeConfig({
            totalBps: 500,
            treasuryBps: 250,
            referralPoolBps: 200,
            sbtStakingBps: 50
        });
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PRESALE_ROLE, _admin); // Admin can act as presale temporarily
    }
    
    /**
     * @notice Distribute native token fees
     */
    function distributeFeeNative() external payable nonReentrant onlyRole(PRESALE_ROLE) {
        uint256 totalAmount = msg.value;
        if (totalAmount == 0) revert ZeroAmount();
        
        _distributeFee(address(0), totalAmount);
    }
    
    /**
     * @notice Distribute Fairlaunch platform fees (native token)
     * @dev Called by Fairlaunch contracts during finalization
     */
    function distributeFairlaunchFee(address fairlaunch) external payable nonReentrant {
        uint256 totalAmount = msg.value;
        if (totalAmount == 0) revert ZeroAmount();
        
        _distributeFee(address(0), totalAmount);
        
        emit FeeCollected(address(0), totalAmount);
    }
    
    /**
     * @notice Distribute ERC20 token fees
     * @param token ERC20 token address
     * @param totalAmount Total fee amount
     */
    function distributeFeeERC20(address token, uint256 totalAmount) 
        external 
        nonReentrant 
        onlyRole(PRESALE_ROLE) 
    {
        if (totalAmount == 0) revert ZeroAmount();
        
        // Transfer tokens from caller (presale contract)
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);
        
        _distributeFee(token, totalAmount);
    }
    
    /**
     * @notice Internal fee distribution logic
     * @dev Splits totalAmount based on relative proportions (share-of-fee model)
     * @param token Token address (address(0) for native)
     * @param totalAmount Total fee amount to distribute
     * 
     * Fee Model: vaultAmount = feeAmount * vaultBps / totalBps
     * Rounding Policy: Any remainder goes to treasury vault
     */
    function _distributeFee(address token, uint256 totalAmount) internal {
        // Calculate splits using relative proportions
        // Example: if totalBps=500, treasuryBps=250, then treasury gets 250/500 = 50% of fee
        uint256 treasuryAmount = (totalAmount * feeConfig.treasuryBps) / feeConfig.totalBps;
        uint256 referralAmount = (totalAmount * feeConfig.referralPoolBps) / feeConfig.totalBps;
        uint256 sbtAmount = (totalAmount * feeConfig.sbtStakingBps) / feeConfig.totalBps;
        
        // Deterministic rounding: remainder goes to treasury
        uint256 remainder = totalAmount - (treasuryAmount + referralAmount + sbtAmount);
        treasuryAmount += remainder;
        
        // Distribute to vaults
        if (token == address(0)) {
            // Native token distribution
            _transferNative(treasuryVault, treasuryAmount);
            _transferNative(referralPoolVault, referralAmount);
            _transferNative(sbtStakingVault, sbtAmount);
        } else {
            // ERC20 distribution
            IERC20(token).safeTransfer(treasuryVault, treasuryAmount);
            IERC20(token).safeTransfer(referralPoolVault, referralAmount);
            IERC20(token).safeTransfer(sbtStakingVault, sbtAmount);
        }
        
        emit FeeCollected(token, totalAmount);
        emit FeeSplit(treasuryVault, token, treasuryAmount, feeConfig.treasuryBps);
        emit FeeSplit(referralPoolVault, token, referralAmount, feeConfig.referralPoolBps);
        emit FeeSplit(sbtStakingVault, token, sbtAmount, feeConfig.sbtStakingBps);
    }
    
    /**
     * @notice Safe native token transfer
     */
    function _transferNative(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }
    
    /**
     * @notice Update fee configuration
     * @dev Only admin, requires validation. Uses share-of-fee model.
     * @param newConfig New fee configuration
     */
    function setFeeConfig(FeeConfig calldata newConfig) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        // Validate: totalBps must be positive
        if (newConfig.totalBps == 0) revert InvalidFeeConfig();
        
        // Validate: sum of vault BPS must equal totalBps (share-of-fee model)
        if (newConfig.totalBps != 
            newConfig.treasuryBps + 
            newConfig.referralPoolBps + 
            newConfig.sbtStakingBps
        ) {
            revert InvalidFeeConfig();
        }
        
        // Validate: reasonable limits (max 10%)
        if (newConfig.totalBps > 1000) revert InvalidFeeConfig();
        
        feeConfig = newConfig;
        emit FeeConfigUpdated(newConfig);
    }
    
    /**
     * @notice Update vault addresses
     */
    function setTreasuryVault(address newVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newVault == address(0)) revert InvalidVault();
        treasuryVault = newVault;
        emit VaultUpdated("treasury", newVault);
    }
    
    function setReferralPoolVault(address newVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newVault == address(0)) revert InvalidVault();
        referralPoolVault = newVault;
        emit VaultUpdated("referralPool", newVault);
    }
    
    function setSbtStakingVault(address newVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newVault == address(0)) revert InvalidVault();
        sbtStakingVault = newVault;
        emit VaultUpdated("sbtStaking", newVault);
    }
    
    /**
     * @notice Grant presale role to new presale contract
     */
    function grantPresaleRole(address presale) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(PRESALE_ROLE, presale);
    }
    
    /**
     * @notice Receive function for native token
     */
    receive() external payable {
        // Allow receiving native tokens
    }
}
