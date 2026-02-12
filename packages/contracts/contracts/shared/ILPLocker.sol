// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILPLocker
 * @notice Unified interface for LP token locking — used by both Presale and Fairlaunch
 * @dev Any locker contract (custom, Unicrypt, Team Finance) must implement this interface
 */
interface ILPLocker {
    struct Lock {
        address lpToken;      // LP token contract address
        address owner;        // Launch contract that created the lock
        address beneficiary;  // Who can withdraw after unlock
        uint256 amount;       // Amount of LP tokens locked
        uint256 lockTime;     // When tokens were locked
        uint256 unlockTime;   // When tokens can be withdrawn
        bool withdrawn;       // Has been withdrawn
    }

    /**
     * @notice Lock LP tokens for a specified duration
     * @param lpToken Address of the LP token to lock
     * @param amount Amount of LP tokens to lock
     * @param unlockTime Unix timestamp when tokens can be unlocked
     * @param beneficiary Address that can withdraw tokens after unlock
     * @return lockId Unique identifier for this lock
     */
    function lockTokens(
        address lpToken,
        uint256 amount,
        uint256 unlockTime,
        address beneficiary
    ) external returns (uint256 lockId);

    /**
     * @notice Withdraw locked tokens after unlock time
     * @param lockId ID of the lock to withdraw
     */
    function withdrawTokens(uint256 lockId) external;

    /**
     * @notice Extend the lock duration
     * @param lockId ID of the lock to extend
     * @param newUnlockTime New unlock timestamp (must be > current unlock)
     */
    function extendLock(uint256 lockId, uint256 newUnlockTime) external;

    /**
     * @notice Get lock details
     * @param lockId ID of the lock
     */
    function getLock(uint256 lockId) external view returns (Lock memory);

    /**
     * @notice Check if lock is currently active
     * @param lockId ID of the lock
     */
    function isLocked(uint256 lockId) external view returns (bool);

    /**
     * @notice Get time remaining until unlock
     * @param lockId ID of the lock
     */
    function getTimeUntilUnlock(uint256 lockId) external view returns (uint256);

    /**
     * @notice Total number of locks ever created
     */
    function totalLockCount() external view returns (uint256);
}
