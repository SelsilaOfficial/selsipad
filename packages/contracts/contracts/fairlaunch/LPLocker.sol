// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LPLocker
 * @notice Secure time-locked vault for LP tokens
 * @dev Prevents rug pulls by locking liquidity for specified duration
 */
contract LPLocker is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Lock {
        address lpToken;      // LP token contract address
        address owner;        // Fairlaunch contract (can transfer ownership)
        address beneficiary;  // Who can withdraw after unlock
        uint256 amount;       // Amount of LP tokens locked
        uint256 lockTime;     // When tokens were locked
        uint256 unlockTime;   // When tokens can be withdrawn
        bool withdrawn;       // Has been withdrawn
    }

    // Storage
    mapping(uint256 => Lock) public locks;
    uint256 public lockCount;

    // Events
    event TokensLocked(
        uint256 indexed lockId,
        address indexed lpToken,
        address indexed owner,
        address beneficiary,
        uint256 amount,
        uint256 unlockTime
    );
    
    event TokensWithdrawn(
        uint256 indexed lockId,
        address indexed beneficiary,
        uint256 amount
    );
    
    event BeneficiaryTransferred(
        uint256 indexed lockId,
        address indexed oldBeneficiary,
        address indexed newBeneficiary
    );

    // Errors
    error InvalidAmount();
    error InvalidUnlockTime();
    error AlreadyWithdrawn();
    error StillLocked();
    error NotBeneficiary();
    error NotOwner();

    /**
     * @notice Lock LP tokens for specified duration
     * @param lpToken LP token contract address
     * @param amount Amount to lock
     * @param unlockTime Timestamp when tokens can be withdrawn
     * @param beneficiary Address that can withdraw tokens
     * @return lockId Unique identifier for this lock
     */
    function lockTokens(
        address lpToken,
        uint256 amount,
        uint256 unlockTime,
        address beneficiary
    ) external nonReentrant returns (uint256 lockId) {
        if (amount == 0) revert InvalidAmount();
        if (unlockTime <= block.timestamp) revert InvalidUnlockTime();

        // Transfer tokens to this contract
        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        // Create lock
        lockId = lockCount++;
        locks[lockId] = Lock({
            lpToken: lpToken,
            owner: msg.sender,
            beneficiary: beneficiary,
            amount: amount,
            lockTime: block.timestamp,
            unlockTime: unlockTime,
            withdrawn: false
        });

        emit TokensLocked(lockId, lpToken, msg.sender, beneficiary, amount, unlockTime);
    }

    /**
     * @notice Withdraw locked tokens after unlock time
     * @param lockId ID of the lock to withdraw
     */
    function withdrawTokens(uint256 lockId) external nonReentrant {
        Lock storage lock = locks[lockId];

        if (msg.sender != lock.beneficiary) revert NotBeneficiary();
        if (block.timestamp < lock.unlockTime) revert StillLocked();
        if (lock.withdrawn) revert AlreadyWithdrawn();

        lock.withdrawn = true;

        IERC20(lock.lpToken).safeTransfer(lock.beneficiary, lock.amount);

        emit TokensWithdrawn(lockId, lock.beneficiary, lock.amount);
    }

    /**
     * @notice Transfer beneficiary rights (only by owner - Fairlaunch contract)
     * @param lockId ID of the lock
     * @param newBeneficiary New beneficiary address
     */
    function transferBeneficiary(uint256 lockId, address newBeneficiary) external {
        Lock storage lock = locks[lockId];

        if (msg.sender != lock.owner) revert NotOwner();
        if (lock.withdrawn) revert AlreadyWithdrawn();

        address oldBeneficiary = lock.beneficiary;
        lock.beneficiary = newBeneficiary;

        emit BeneficiaryTransferred(lockId, oldBeneficiary, newBeneficiary);
    }

    /**
     * @notice Get lock details
     * @param lockId ID of the lock
     */
    function getLock(uint256 lockId) external view returns (Lock memory) {
        return locks[lockId];
    }

    /**
     * @notice Check if lock is currently active (not yet unlocked)
     * @param lockId ID of the lock
     */
    function isLocked(uint256 lockId) external view returns (bool) {
        Lock memory lock = locks[lockId];
        return !lock.withdrawn && block.timestamp < lock.unlockTime;
    }

    /**
     * @notice Get time remaining until unlock
     * @param lockId ID of the lock
     */
    function getTimeUntilUnlock(uint256 lockId) external view returns (uint256) {
        Lock memory lock = locks[lockId];
        if (block.timestamp >= lock.unlockTime) {
            return 0;
        }
        return lock.unlockTime - block.timestamp;
    }
}
