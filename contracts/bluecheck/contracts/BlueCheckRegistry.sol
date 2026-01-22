// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BlueCheckRegistry
 * @notice Handles Blue Check purchases with automatic fee splitting
 * @dev $10 USD payment with 70% to Treasury, 30% to Referral Pool
 */
contract BlueCheckRegistry is Ownable, ReentrancyGuard, Pausable {
    // ===================== Constants =====================
    
    /// @notice Price in USD (18 decimals, like wei)
    uint256 public constant PRICE_USD = 10 * 1e18; // $10
    
    /// @notice Fee distribution percentages
    uint256 public constant TREASURY_SHARE = 70; // 70%
    uint256 public constant REFERRAL_POOL_SHARE = 30; // 30%
    
    // ===================== State Variables =====================
    
    /// @notice Treasury address (receives 70%)
    address public treasury;
    
    /// @notice Referral pool address (receives 30%)
    address public referralPool;
    
    /// @notice Price oracle address (for BNB/USD conversion)
    address public priceOracle;
    
    /// @notice Manual price in BNB (18 decimals) - fallback if oracle fails
    uint256 public manualPriceBNB;
    
    /// @notice Track who has purchased Blue Check
    mapping(address => bool) public hasBlueCheck;
    
    /// @notice Track purchase timestamps
    mapping(address => uint256) public purchaseTimestamp;
    
    /// @notice Total purchases counter
    uint256 public totalPurchases;
    
    /// @notice Total BNB collected
    uint256 public totalBNBCollected;
    
    // ===================== Events =====================
    
    /**
     * @notice Emitted when Blue Check is purchased
     * @param user Address of the purchaser
     * @param amountPaid BNB amount paid
     * @param treasuryAmount BNB sent to treasury
     * @param referralPoolAmount BNB sent to referral pool
     * @param timestamp Purchase timestamp
     */
    event BlueCheckPurchased(
        address indexed user,
        uint256 amountPaid,
        uint256 treasuryAmount,
        uint256 referralPoolAmount,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when treasury address is updated
     * @param oldTreasury Previous treasury address
     * @param newTreasury New treasury address
     */
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    
    /**
     * @notice Emitted when referral pool address is updated
     * @param oldPool Previous pool address
     * @param newPool New pool address
     */
    event ReferralPoolUpdated(address indexed oldPool, address indexed newPool);
    
    /**
     * @notice Emitted when manual price is updated
     * @param oldPrice Previous price in BNB
     * @param newPrice New price in BNB
     */
    event ManualPriceUpdated(uint256 oldPrice, uint256 newPrice);
    
    // ===================== Errors =====================
    
    error AlreadyPurchased();
    error InsufficientPayment();
    error InvalidAddress();
    error TransferFailed();
    
    // ===================== Constructor =====================
    
    /**
     * @notice Initialize the contract
     * @param _treasury Treasury address
     * @param _referralPool Referral pool address
     * @param _initialPriceBNB Initial BNB price (fallback)
     */
    constructor(
        address _treasury,
        address _referralPool,
        uint256 _initialPriceBNB
    ) Ownable(msg.sender) {
        if (_treasury == address(0) || _referralPool == address(0)) {
            revert InvalidAddress();
        }
        
        treasury = _treasury;
        referralPool = _referralPool;
        manualPriceBNB = _initialPriceBNB;
    }
    
    // ===================== Main Functions =====================
    
    /**
     * @notice Purchase Blue Check (lifetime access)
     * @dev Sends 70% to treasury, 30% to referral pool
     */
    function purchaseBlueCheck() external payable nonReentrant whenNotPaused {
        if (hasBlueCheck[msg.sender]) {
            revert AlreadyPurchased();
        }
        
        // Get required BNB amount
        uint256 requiredBNB = getRequiredBNB();
        
        if (msg.value < requiredBNB) {
            revert InsufficientPayment();
        }
        
        // Mark as purchased
        hasBlueCheck[msg.sender] = true;
        purchaseTimestamp[msg.sender] = block.timestamp;
        totalPurchases++;
        totalBNBCollected += requiredBNB;
        
        // Calculate splits
        uint256 treasuryAmount = (requiredBNB * TREASURY_SHARE) / 100;
        uint256 referralAmount = requiredBNB - treasuryAmount; // Ensures no rounding issues
        
        // Transfer to treasury
        (bool treasurySuccess, ) = treasury.call{value: treasuryAmount}("");
        if (!treasurySuccess) {
            revert TransferFailed();
        }
        
        // Transfer to referral pool
        (bool poolSuccess, ) = referralPool.call{value: referralAmount}("");
        if (!poolSuccess) {
            revert TransferFailed();
        }
        
        // Emit event for indexer
        emit BlueCheckPurchased(
            msg.sender,
            requiredBNB,
            treasuryAmount,
            referralAmount,
            block.timestamp
        );
        
        // Refund excess if any
        uint256 excess = msg.value - requiredBNB;
        if (excess > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excess}("");
            if (!refundSuccess) {
                revert TransferFailed();
            }
        }
    }
    
    /**
     * @notice Get required BNB for $10 USD
     * @dev Uses manual price (oracle integration can be added later)
     * @return Required BNB amount in wei
     */
    function getRequiredBNB() public view returns (uint256) {
        // TODO: Integrate with Chainlink or price oracle
        // For now, use manual price
        
        if (manualPriceBNB == 0) {
            revert("Price not set");
        }
        
        // manualPriceBNB is price of 1 BNB in USD (18 decimals)
        // PRICE_USD is $10 in 18 decimals
        // Required BNB = PRICE_USD / manualPriceBNB
        
        return (PRICE_USD * 1e18) / manualPriceBNB;
    }
    
    /**
     * @notice Check if address has Blue Check
     * @param user Address to check
     * @return bool True if user has Blue Check
     */
    function checkBlueCheck(address user) external view returns (bool) {
        return hasBlueCheck[user];
    }
    
    // ===================== Admin Functions =====================
    
    /**
     * @notice Update treasury address
     * @param _newTreasury New treasury address
     */
    function updateTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) {
            revert InvalidAddress();
        }
        
        address oldTreasury = treasury;
        treasury = _newTreasury;
        
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
    
    /**
     * @notice Update referral pool address
     * @param _newPool New pool address
     */
    function updateReferralPool(address _newPool) external onlyOwner {
        if (_newPool == address(0)) {
            revert InvalidAddress();
        }
        
        address oldPool = referralPool;
        referralPool = _newPool;
        
        emit ReferralPoolUpdated(oldPool, _newPool);
    }
    
    /**
     * @notice Update manual BNB price
     * @param _newPriceBNB New price (1 BNB in USD, 18 decimals)
     * @dev Example: If 1 BNB = $600, pass 600 * 1e18
     */
    function updateManualPrice(uint256 _newPriceBNB) external onlyOwner {
        uint256 oldPrice = manualPriceBNB;
        manualPriceBNB = _newPriceBNB;
        
        emit ManualPriceUpdated(oldPrice, _newPriceBNB);
    }
    
    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency withdraw (only if stuck funds)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        (bool success, ) = owner().call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }
    }
}
